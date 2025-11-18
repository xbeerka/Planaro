# Анализ проблем синхронизации и истории

## 🔴 Проблемы, описанные пользователем

### 1. Быстрые изменения событий
**Симптомы:**
- Быстро удаляю, добавляю, перемещаю события
- Они криво записываются или не записываются на бэк
- Возвращаются на предыдущую запись с бэкэнда

### 2. История изменений (undo/redo)
**Симптомы:**
- Откат работает только локально
- Когда с бэка приходит ответ, все откаты возвращаются обратно
- Стрелка назад откатывает сразу группу событий вместо одного
- При загрузке страницы → изменение → откат → все события пропадают

---

## 🔍 Анализ текущей реализации

### Архитектура

```
┌─────────────────┐
│   UI (React)    │
│  SchedulerMain  │
└────────┬────────┘
         │
         ├─ Optimistic Update (сразу)
         ├─ saveHistory()  (сразу)
         └─ onEventUpdate() → API (async)
                    │
                    ▼
         ┌──────────────────┐
         │ SchedulerContext │
         │   updateEvent()  │
         └────────┬─────────┘
                  │
                  ├─ НЕ обновляет state (комментарий)
                  ├─ Отправка на сервер (await)
                  └─ Синхронизация с ответом сервера
                           │
                           ▼
                  ┌─────────────────┐
                  │ Simple Polling  │
                  │  каждые 30 сек  │
                  └─────────────────┘
                           │
                           └─ Перезаписывает state
```

---

## 🐛 Выявленные проблемы

### Проблема 1: Race Condition между локальными изменениями и polling

**Сценарий:**
```
T+0s:  Пользователь перемещает Event A (startWeek: 5 → 10)
T+0s:  optimistic update в UI (startWeek = 10)
T+0s:  saveHistory(events) - сохраняет startWeek = 10
T+0.1s: onEventUpdate() начинает отправку на сервер
T+30s:  Polling получает данные с сервера
T+30s:  Если сервер ещё не обработал, вернёт startWeek = 5
T+30s:  setEventsState(serverData) → ПЕРЕЗАПИСЫВАЕТ startWeek = 10 → 5
T+30.5s: onEventUpdate() завершается, обновляет state → startWeek = 10

ИТОГ: Событие "дёргается" 5 → 10 → 5 → 10
```

**Код (SchedulerContext.tsx:378-397):**
```typescript
const pollEvents = async () => {
  // Проверка lastLocalChangeRef помогает, НО:
  // - Если изменение было 2.1 секунды назад, polling перезапишет
  // - Если сервер медленный (>2 сек), данные будут устаревшими
  const timeSinceLastChange = Date.now() - lastLocalChangeRef.current;
  if (timeSinceLastChange < 2000) {
    return; // ✅ Хорошо, но недостаточно
  }
  
  const data = await eventsApi.getAll(accessToken, workspaceId);
  
  // ❌ ПРОБЛЕМА: JSON.stringify не учитывает порядок ключей
  // Два объекта могут быть семантически равны, но stringify даст разный результат
  if (JSON.stringify(data) !== JSON.stringify(prev)) {
    setEventsState(data); // ← ПЕРЕЗАПИСЫВАЕТ все локальные изменения!
  }
};
```

---

### Проблема 2: updateEvent() перезаписывает state после обновления

**Код (SchedulerContext.tsx:730-752):**
```typescript
const updatedEventFromServer = await eventsApi.update(id, event, accessToken);

// ❌ ПРОБЛЕМА: Перезаписываем весь state данными с сервера
setEventsState(prev => {
  return prev.map(e => e.id === id ? updatedEventFromServer : e);
});
```

**Почему это плохо:**
- Пока `await eventsApi.update()` выполняется, пользователь мог изменить событие ЕЩЁ РАЗ
- После завершения `await` мы перезаписываем state старыми данными с сервера
- Локальные изменения теряются

---

### Проблема 3: История (undo/redo) не синхронизирована с сервером

**useHistory.ts:**
```typescript
const undo = useCallback(() => {
  if (historyIndex > 0) {
    setHistoryIndex(prev => prev - 1);
    return history[historyIndex - 1]; // ← Возвращает локальный snapshot
  }
  return null;
}, [historyIndex, history]);
```

**SchedulerMain.tsx:**
```typescript
const handleUndo = useCallback(() => {
  const state = historyUndo();
  if (state) {
    setEvents(state.events); // ← Обновляет ТОЛЬКО локальный state
    setEventZOrder(state.eventZOrder);
    // ❌ НЕ отправляет изменения на сервер!
  }
}, [historyUndo, setEvents]);
```

**Проблема:**
1. Undo откатывает события ТОЛЬКО локально
2. Через 30 секунд polling получает данные с сервера (без отката)
3. Polling перезаписывает локальный state → откат исчезает

---

### Проблема 4: saveHistory вызывается слишком часто

**SchedulerMain.tsx:**
```typescript
// Вызывается при каждом изменении события
const onScissorClick = useCallback((eventId: string, boundaryWeek: number) => {
  setEvents(prev => {
    // ... создание нового события
    saveHistory(updatedEventsArray, eventZOrder); // ← Сохранение истории
    return updatedEventsArray;
  });
}, [eventZOrder, saveHistory, updateEvent, createEvent, ...]);
```

**Проблема:**
- saveHistory вызывается при КАЖДОМ чихе (drag, resize, delete, split, ...)
- История растёт очень быстро
- Undo откатывает несколько изменений сразу (если они произошли близко по времени)

---

### Проблема 5: Потеря всех событий при undo после загрузки

**Сценарий:**
```
T+0s:  Загрузка страницы
T+0s:  isLoading = true
T+1s:  События загружены с сервера: [Event A, Event B, Event C]
T+1s:  isLoading = false
T+1s:  resetHistory([A, B, C], zOrder) - инициализация истории
T+2s:  Пользователь перемещает Event A
T+2s:  saveHistory([A', B, C], zOrder) - сохранение после изменения
T+3s:  Пользователь нажимает Undo
T+3s:  history[0] = { events: [A, B, C] } ← Восстанавливается
T+3s:  setEvents([A, B, C]) ✅ Всё ОК

НО ЕСЛИ:
T+0s:  Загрузка страницы
T+0s:  resetHistory([], zOrder) - инициализация с ПУСТЫМ массивом (если isLoading ещё true)
T+1s:  События загружены: [A, B, C]
T+2s:  Пользователь перемещает Event A
T+2s:  saveHistory([A', B, C], zOrder)
T+3s:  Пользователь нажимает Undo
T+3s:  history[0] = { events: [] } ← Восстанавливается ПУСТОЙ массив!
T+3s:  setEvents([]) ❌ ВСЕ СОБЫТИЯ ИСЧЕЗАЮТ!
```

**Код (SchedulerMain.tsx:316-323):**
```typescript
React.useEffect(() => {
  if (!isLoading && !historyInitializedRef.current) {
    resetHistory(events, eventZOrder); // ← Если events = [], будет пустая история
    historyInitializedRef.current = true;
  }
}, [isLoading]);
```

**Проблема:**
- Если `resetHistory` вызывается ДО того как события загрузились, история будет пустой
- При undo восстанавливается пустой массив

---

## 💡 Решения

### Решение 1: Debounce для автосохранения на сервер

**Идея:**
- НЕ сохраняем каждое изменение сразу
- Накапливаем изменения в очереди
- Сохраняем пакетом через 500ms после последнего изменения

**Преимущества:**
- Меньше запросов к серверу
- Меньше race conditions
- Пользователь может быстро делать множество изменений без лагов

---

### Решение 2: Optimistic Updates с Rollback Queue

**Идея:**
- Храним список pending операций в очереди
- При ошибке отката откатываем ИМЕННО эту операцию, а не всё подряд
- При polling проверяем, есть ли pending операции, и НЕ перезаписываем их

**Структура:**
```typescript
interface PendingOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  timestamp: number;
  originalData: SchedulerEvent;
  newData: SchedulerEvent;
}

const pendingOps = useRef<Map<string, PendingOperation>>(new Map());
```

---

### Решение 3: Умная синхронизация с сервером при polling

**Текущая логика:**
```typescript
// ❌ ПЛОХО
if (JSON.stringify(data) !== JSON.stringify(prev)) {
  setEventsState(data); // Перезаписываем ВСЁ
}
```

**Новая логика:**
```typescript
// ✅ ХОРОШО
const mergedEvents = mergeWithPending(data, pendingOps.current);
setEventsState(mergedEvents); // Сливаем данные с сервера и pending операции
```

---

### Решение 4: Undo/Redo с отправкой на сервер

**Текущая логика:**
```typescript
const handleUndo = () => {
  const state = historyUndo();
  setEvents(state.events); // ❌ Только локально
};
```

**Новая логика:**
```typescript
const handleUndo = async () => {
  const state = historyUndo();
  setEvents(state.events); // Локально
  
  // Отправляем batch update на сервер
  const changedEvents = findChangedEvents(currentEvents, state.events);
  await batchUpdateEvents(changedEvents); // ✅ Синхронизация с сервером
};
```

---

### Решение 5: Правильная инициализация истории

**Текущая логика:**
```typescript
React.useEffect(() => {
  if (!isLoading && !historyInitializedRef.current) {
    resetHistory(events, eventZOrder); // ❌ Может быть пустым
  }
}, [isLoading]);
```

**Новая логика:**
```typescript
React.useEffect(() => {
  if (!isLoading && !historyInitializedRef.current && events.length > 0) {
    resetHistory(events, eventZOrder); // ✅ Только если есть события
    historyInitializedRef.current = true;
  }
}, [isLoading, events.length]);
```

---

## 🎯 Приоритеты исправлений

### Высокий приоритет (критично):
1. ✅ Решение 5: Инициализация истории только когда events.length > 0
2. ✅ Решение 1: Debounce для сохранения на сервер (500ms)
3. ✅ Решение 2: Pending Operations Queue для защиты от race conditions

### Средний приоритет:
4. ✅ Решение 3: Умная синхронизация при polling (merge вместо replace)
5. ✅ Решение 4: Undo/Redo с отправкой на сервер

### Низкий приоритет (улучшения):
6. Batch Updates API endpoint для undo/redo
7. Conflict Resolution UI (если данные на сервере изменились)

---

## 📝 План действий

1. **Создать PendingOperationsQueue** - защита от race conditions
2. **Добавить debounce для сохранения** - меньше нагрузки на сервер
3. **Исправить инициализацию истории** - защита от потери событий
4. **Умный merge при polling** - не перезаписываем pending операции
5. **Undo/Redo с синхронизацией** - отправляем изменения на сервер

---

**Дата анализа:** 2025-11-17  
**Статус:** Готов к имплементации
