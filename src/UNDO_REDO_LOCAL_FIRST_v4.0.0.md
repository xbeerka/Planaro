# Undo/Redo Local-First Architecture v4.0.0

## Проблема

История работает криво из-за смешения локальных изменений с синхронизацией с сервером:

1. **Автосохранение истории** срабатывает при ЛЮБОМ изменении events (включая polling)
2. **Промежуточные состояния** попадают в историю (события во время async операций)
3. **Race conditions** между Undo/Redo и debounced save
4. **Скачки при Undo** - восстанавливаются промежуточные состояния вместо финальных

Пример проблемы:
```
1. Пользователь drag событие → событие меняет позицию
2. Автосохранение срабатывает → история сохраняет state с новой позицией
3. Debounced save отправляет на сервер (задержка 500ms)
4. Пользователь быстро делает Undo
5. Событие восстанавливается в старую позицию
6. Но debounced save ещё не завершился!
7. Сервер сохраняет НОВУЮ позицию
8. Delta Sync через 4 секунды загружает событие с НОВОЙ позицией обратно
9. Undo не сработал! Событие "воскресло"
```

## Решение - Local-First Architecture

### Принципы

1. **История хранит только финальные состояния** - после завершения операций пользователя
2. **Undo/Redo работают мгновенно** - только с локальным state, БЕЗ API calls
3. **Debounced sync** - собирает все изменения и отправляет пакетом при простое
4. **Умная блокировка polling** - не загружает события, которые изменялись локально

### Изменения v4.0.0

#### 1. Убрано автосохранение истории

**Было (v3.x):**
```typescript
// ❌ Автосохранение при ЛЮБОМ изменении events
React.useEffect(() => {
  if (!historyInitializedRef.current) return;
  
  const eventsChanged = JSON.stringify(prevEventsRef.current) !== JSON.stringify(events);
  
  if (eventsChanged) {
    // Проверки пропуска для Undo/Redo и т.д.
    saveHistory(events, eventZOrder, projects);
  }
}, [events, eventZOrder, projects, saveHistory]);
```

**Стало (v4.0.0):**
```typescript
// ✅ История сохраняется ТОЛЬКО явно:
// 1. Drag/Drop → saveHistory() в handleEventDragEnd
// 2. Resize → saveHistory() в handleEventResize
// 3. Gap Drag → saveHistory() в handleGapDragEnd
// 4. Create/Delete/Paste → saveHistory() сразу после setEvents()
// 5. Модалки → saveHistory() после сохранения на сервере
```

#### 2. Явное сохранение истории после операций

**Drag & Drop:**
```typescript
const handleEventDragEnd = useCallback(() => {
  // ... логика drag
  
  setEvents(newEvents);
  
  // ✅ Сохраняем историю ПОСЛЕ завершения drag
  saveHistory(newEvents, eventZOrder, projects);
}, [setEvents, saveHistory, eventZOrder, projects]);
```

**Resize:**
```typescript
const handleEventResize = useCallback(() => {
  // ... логика resize
  
  setEvents(newEvents);
  
  // ✅ Сохраняем историю ПОСЛЕ завершения resize
  saveHistory(newEvents, eventZOrder, projects);
}, [setEvents, saveHistory, eventZOrder, projects]);
```

**Create/Delete/Paste:**
```typescript
const handlePaste = useCallback(async () => {
  const newEvent = { ...copiedEventRef.current, id: tempId, ... };
  
  setEvents(prev => [...prev, newEvent]);
  
  // ✅ Сохраняем историю СРАЗУ после создания
  saveHistory([...events, newEvent], eventZOrder, projects);
  
  // Async создание на сервере (в фоне)
  const created = await createEvent(newEvent);
}, [setEvents, saveHistory, createEvent]);
```

#### 3. Undo/Redo БЕЗ flushPendingChanges

**Было (v3.x):**
```typescript
const handleUndo = useCallback(async () => {
  // ❌ Ждём завершения всех pending операций
  await flushPendingChanges(updateHistoryEventId);
  
  const state = historyUndo();
  if (!state) return;
  
  setEvents(state.events);
  // ...
}, [historyUndo, flushPendingChanges, ...]);
```

**Стало (v4.0.0):**
```typescript
const handleUndo = useCallback(() => {
  // ✅ Блокируем Undo если есть pending операции
  if (hasPendingOperations()) {
    showToast({
      type: 'warning',
      message: 'Подождите',
      description: 'Дождитесь завершения сохранения'
    });
    return;
  }
  
  // ✅ Мгновенное восстановление из истории
  const state = historyUndo();
  if (!state) return;
  
  // ✅ Отменяем pending изменения для удалённых событий
  const currentIds = new Set(state.events.map(e => e.id));
  events.forEach(e => {
    if (!currentIds.has(e.id)) {
      cancelPendingChange(e.id);
    }
  });
  
  // ✅ Мгновенно применяем state
  setEvents(state.events);
  setProjects(state.projects);
  // НЕ сохраняем историю!
  
  // ✅ Блокируем polling на 2 секунды
  resetDeltaSyncTimer();
  resetProjectsSyncTimer();
}, [historyUndo, hasPendingOperations, cancelPendingChange, ...]);
```

#### 4. Умная блокировка Undo/Redo

**Проверка pending операций:**
```typescript
// ✅ Блокируем Undo/Redo если есть несохранённые изменения
if (hasPendingOperations()) {
  // События в процессе сохранения - нельзя делать Undo/Redo
  showToast({ type: 'warning', message: 'Подождите...' });
  return;
}
```

**Типичная задержка:** 500ms (время debounced save)
**UX:** Пользователь видит toast "Подождите" если пытается сделать Undo слишком быстро

#### 5. Отмена pending операций при Undo/Redo

**Проблема:**
```
1. Пользователь drag событие e123
2. Debounced save добавляет в очередь: changesQueue.set('e123', { top: 100 })
3. Пользователь делает Undo → событие e123 удаляется из state
4. Через 500ms debounced save отправляет UPDATE для e123
5. Сервер обновляет событие e123
6. Delta Sync загружает e123 обратно → "воскрешение"!
```

**Решение:**
```typescript
const handleUndo = useCallback(() => {
  const state = historyUndo();
  if (!state) return;
  
  // ✅ Находим удалённые события
  const currentIds = new Set(state.events.map(e => e.id));
  const deletedEvents = events.filter(e => !currentIds.has(e.id));
  
  // ✅ Отменяем pending изменения для удалённых
  deletedEvents.forEach(event => {
    cancelPendingChange(event.id); // Удаляем из changesQueue
  });
  
  setEvents(state.events);
}, [historyUndo, events, cancelPendingChange]);
```

#### 6. Блокировка polling после Undo/Redo

**Проблема:**
```
1. Пользователь делает Undo → события восстанавливаются
2. Через 4 секунды Delta Sync загружает события с сервера
3. Сервер ещё не знает об Undo (debounced save не завершился)
4. События перезаписываются данными с сервера → Undo откатывается!
```

**Решение:**
```typescript
const handleUndo = useCallback(() => {
  // ... восстанавливаем state
  
  // ✅ Блокируем polling на 2 секунды
  resetDeltaSyncTimer();      // События
  resetProjectsSyncTimer();   // Проекты
  resetResourcesSyncTimer();  // Сотрудники
  resetDepartmentsSyncTimer(); // Департаменты
}, [resetDeltaSyncTimer, ...]);
```

**Как работает блокировка:**
```typescript
// В SchedulerContext.tsx
const lastLocalChangeTimeRef = useRef<number>(0);

const resetDeltaSyncTimer = useCallback(() => {
  lastLocalChangeTimeRef.current = Date.now();
  console.log('⏱️ Delta Sync: блокировка на 2 секунды после локального изменения');
}, []);

// В polling эффекте
useEffect(() => {
  const interval = setInterval(() => {
    const timeSinceLastChange = Date.now() - lastLocalChangeTimeRef.current;
    
    if (timeSinceLastChange < 2000) {
      console.log('⏭️ Delta Sync: пропуск - недавнее локальное изменение');
      return;
    }
    
    // Загружаем изменения с сервера
    deltaSync();
  }, 4000);
  
  return () => clearInterval(interval);
}, [deltaSync]);
```

## Архитектура потока данных

```
┌─────────────────────────────────────────────────────────────┐
│                     ПОЛЬЗОВАТЕЛЬ                             │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│                  UI ОПЕРАЦИЯ                                 │
│  • Drag & Drop                                               │
│  • Resize                                                    │
│  • Create/Delete/Paste                                       │
│  • Gap Drag                                                  │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│              ИЗМЕНЕНИЕ STATE (мгновенно)                     │
│  setEvents(newEvents)                                        │
│  setEventZOrder(newZOrder)                                   │
└────────────┬────────────────────────────────────────────────┘
             │
             ├───────────────────────┬─────────────────────────┐
             ▼                       ▼                         ▼
┌──────────────────────┐  ┌──────────────────┐  ┌────────────────────┐
│  СОХРАНЕНИЕ ИСТОРИИ  │  │ DEBOUNCED SAVE   │  │ БЛОКИРОВКА POLLING │
│  (синхронно)         │  │ (через 500ms)    │  │ (на 2 секунды)     │
│                      │  │                  │  │                    │
│  saveHistory(        │  │ queueChange(id)  │  │ resetDeltaSyncTimer│
│    events,           │  │ → changesQueue   │  │ ()                 │
│    eventZOrder,      │  │                  │  │                    │
│    projects          │  │ flush() через    │  │                    │
│  )                   │  │ 500ms → API      │  │                    │
└──────────────────────┘  └──────────────────┘  └────────────────────┘

                                  │
                                  ▼
                         ┌─────────────────┐
                         │  СЕРВЕР (API)   │
                         │  Batch Update   │
                         └─────────────────┘
                                  │
                                  ▼
                         ┌─────────────────┐
                         │   БАЗА ДАННЫХ   │
                         └─────────────────┘
```

## Undo/Redo поток

```
┌─────────────────────────────────────────────────────────────┐
│              ПОЛЬЗОВАТЕЛЬ НАЖИМАЕТ UNDO                      │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│         ПРОВЕРКА: hasPendingOperations()?                    │
│  • Есть pending операции → БЛОКИРОВКА + Toast               │
│  • Нет pending операций → Продолжить                        │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│         ВОССТАНОВЛЕНИЕ ИЗ ИСТОРИИ (мгновенно)                │
│  const state = historyUndo()                                 │
│  • events: SchedulerEvent[]                                  │
│  • projects: Project[]                                       │
│  • eventZOrder: Map<string, number>                          │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│      ОТМЕНА PENDING ОПЕРАЦИЙ ДЛЯ УДАЛЁННЫХ СОБЫТИЙ           │
│  deletedEvents.forEach(e => cancelPendingChange(e.id))       │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│           ПРИМЕНЕНИЕ STATE (мгновенно)                       │
│  setEvents(state.events)                                     │
│  setProjects(state.projects)                                 │
│  // НЕ сохраняем историю!                                    │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│           БЛОКИРОВКА POLLING (на 2 секунды)                  │
│  resetDeltaSyncTimer()                                       │
│  resetProjectsSyncTimer()                                    │
└─────────────────────────────────────────────────────────────┘
```

## Преимущества

1. **Нет промежуточных состояний в истории**
   - История содержит только "финальные" состояния после действий пользователя
   - Polling не создаёт новые записи в истории

2. **Мгновенный Undo/Redo**
   - Восстановление из истории занимает ~1ms (только изменение state)
   - Нет ожидания завершения API calls
   - Можно делать Undo/Redo хоть 10 раз в секунду

3. **Нет race conditions**
   - Pending операции отменяются для удалённых событий
   - Polling блокируется после локальных изменений
   - Debounced save работает независимо от истории

4. **Предсказуемое поведение**
   - Undo всегда восстанавливает ПОСЛЕДНЕЕ финальное состояние
   - Нет "скачков" или "воскрешений" событий
   - История работает как в обычном текстовом редакторе

5. **Защита от критикалов**
   - При такой архитектуре невозможно удалить ВСЕ события через Undo
   - История всегда содержит корректные состояния
   - Нет зависимости от сервера для Undo/Redo

## Недостатки и компромиссы

1. **Блокировка Undo при pending операциях**
   - Пользователь должен подождать 500ms после drag перед Undo
   - Toast уведомление может раздражать при очень быстрых действиях
   - **Решение:** Уменьшить debounce delay до 200-300ms

2. **Ручное сохранение истории**
   - Нужно явно вызывать saveHistory() после каждой операции
   - Риск забыть вызвать saveHistory() в новых операциях
   - **Решение:** Code review и тесты

3. **Блокировка polling на 2 секунды**
   - После Undo изменения от других пользователей придут с задержкой
   - Но это необходимо для предотвращения перезаписи локальных изменений
   - **Решение:** Оставляем как есть, приоритет у локальных изменений

## Миграция с v3.x на v4.0.0

### 1. Убрать автосохранение истории

```diff
- // ✅ Автосохранение истории при изменении событий
- React.useEffect(() => {
-   if (!historyInitializedRef.current) return;
-   const eventsChanged = JSON.stringify(prevEventsRef.current) !== JSON.stringify(events);
-   if (eventsChanged) {
-     saveHistory(events, eventZOrder, projects);
-   }
- }, [events, eventZOrder, projects, saveHistory]);
```

### 2. Добавить явное сохранение в операции

```diff
const handleEventDragEnd = useCallback(() => {
  // ... логика drag
  setEvents(newEvents);
  
+ // ✅ Сохраняем историю ПОСЛЕ drag
+ saveHistory(newEvents, eventZOrder, projects);
}, [setEvents, saveHistory, eventZOrder, projects]);
```

### 3. Убрать flushPendingChanges из Undo/Redo

```diff
const handleUndo = useCallback(async () => {
- await flushPendingChanges(updateHistoryEventId);
  
+ // ✅ Блокируем Undo если есть pending
+ if (hasPendingOperations()) {
+   showToast({ type: 'warning', message: 'Подождите...' });
+   return;
+ }
  
  const state = historyUndo();
  // ...
}, [historyUndo, hasPendingOperations, ...]);
```

### 4. Добавить отмену pending операций

```diff
const handleUndo = useCallback(() => {
  const state = historyUndo();
  if (!state) return;
  
+ // ✅ Отменяем pending для удалённых событий
+ const currentIds = new Set(state.events.map(e => e.id));
+ events.forEach(e => {
+   if (!currentIds.has(e.id)) {
+     cancelPendingChange(e.id);
+   }
+ });
  
  setEvents(state.events);
}, [historyUndo, events, cancelPendingChange]);
```

## Тестирование

### Базовые сценарии

1. **Создать событие → Undo**
   - ✅ Событие исчезает мгновенно
   - ✅ Нет "воскрешения" через Delta Sync

2. **Drag событие → Undo**
   - ✅ Позиция восстанавливается мгновенно
   - ✅ Нет "скачков" обратно после 4 секунд

3. **Быстрый drag → сразу Undo (< 500ms)**
   - ✅ Toast "Подождите..."
   - ✅ После завершения save можно сделать Undo

4. **10 быстрых Undo подряд**
   - ✅ Все события восстанавливаются корректно
   - ✅ Нет ошибок или зависаний

### Стресс-тесты

1. **Drag 10 событий → 10 Undo**
   - ✅ Каждый Undo восстанавливает предыдущее состояние
   - ✅ Нет промежуточных состояний

2. **Drag → Undo → Redo → Undo → Redo**
   - ✅ Состояния переключаются корректно
   - ✅ Нет "застревания" в промежуточных состояниях

3. **Polling во время Undo**
   - ✅ Polling блокируется на 2 секунды
   - ✅ Локальные изменения не перезаписываются

## Выводы

**Архитектура v4.0.0 возвращается к изначальным принципам Local-First:**

✅ Все изменения ТОЛЬКО локально (мгновенно)
✅ Debounced sync при простое (2-4 секунды)
✅ Polling для получения изменений от других пользователей (каждые 4 секунды)
✅ История содержит только финальные состояния
✅ Undo/Redo работают мгновенно без API calls
✅ Невозможен критикал с удалением всех событий

**Версия документа:** v4.0.0 (2025-11-25)
