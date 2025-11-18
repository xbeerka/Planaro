# Исправление синхронизации после Drag/Resize (v3.3.5)

## 🐛 Проблема

После изменения размера (resize) или перетаскивания (drag) событий изменения **не синхронизировались с бэкендом**. Delta/Full Sync возвращал старые данные с сервера, перезаписывая локальные изменения.

### Симптомы
```
1. Пользователь делает resize события
2. Событие визуально изменяется
3. Через несколько секунд событие "откатывается" к старому размеру
4. Данные не сохранились на сервере
```

## 🔍 Корневая причина

В `useEventInteractions.ts` при завершении drag/resize:

```typescript
// onUp callback (строка 408/152)
setIsUserInteracting(false); // ❌ Включает polling обратно
// ...
onEventUpdate(updatedEvent.id, updatedEvent); // ❌ Асинхронное сохранение
```

**Проблема**:
1. `onEventUpdate()` добавляет событие в **debounced queue** (задержка 500ms)
2. `lastLocalChangeRef.current = Date.now()` вызывается **только через 500ms**
3. За эти 500ms **Delta Sync может выполниться** и перезаписать локальные изменения!

### Таймлайн гонки условий:
```
t=0ms    : Resize завершён, setIsUserInteracting(false)
t=0ms    : onEventUpdate() добавляет событие в debounced queue
t=100ms  : Delta Sync проверяет lastLocalChangeRef (ещё не обновлен!)
t=100ms  : ❌ Delta Sync выполняется, перезаписывает локальные изменения
t=500ms  : Debounced save выполняется, lastLocalChangeRef обновляется (ПОЗДНО!)
```

## ✅ Решение

**Добавили явный вызов `resetDeltaSyncTimer()` СРАЗУ после drag/resize** в `useEventInteractions.ts`:

```typescript
// ✅ v3.3.5: БЛОКИРУЕМ Delta Sync на 5 секунд после drag/resize
resetDeltaSyncTimer();
console.log('⏸️ Drag/Resize завершён: блокировка Delta Sync на 5 сек');
```

Это гарантирует:
- ✅ `lastLocalChangeRef.current = Date.now()` устанавливается **мгновенно**
- ✅ Delta Sync **блокируется на 5 секунд** (проверка `< 5000`)
- ✅ Локальные изменения **защищены** от перезаписи
- ✅ Debounced save успевает отправить данные на сервер

## 📝 Изменения

### 1. `/hooks/useEventInteractions.ts`

#### Добавили параметр `resetDeltaSyncTimer`:
```typescript
interface UseEventInteractionsProps {
  // ...
  resetDeltaSyncTimer: () => void; // ✅ v3.3.5: Блокировка Delta Sync
}
```

#### Вызов после drag (строка 154):
```typescript
// 🚫 ВКЛЮЧАЕМ polling обратно
setIsUserInteracting(false);

// ✅ v3.3.5: БЛОКИРУЕМ Delta Sync на 5 секунд после drag
resetDeltaSyncTimer();
console.log('⏸️ Drag завершён: блокировка Delta Sync на 5 сек');
```

#### Вызов после resize (строка 410):
```typescript
// 🚫 ВКЛЮЧАЕМ polling обратно
setIsUserInteracting(false);

// ✅ v3.3.5: БЛОКИРУЕМ Delta Sync на 5 секунд после resize
resetDeltaSyncTimer();
console.log('⏸️ Resize завершён: блокировка Delta Sync на 5 сек');
```

#### Обновили зависимости useCallback:
```typescript
}, [
  config, resources, visibleDepartments, events, projects, eventZOrder,
  onEventsUpdate, onEventZOrderUpdate, onSaveHistory, onEventUpdate,
  eventsContainerRef, setIsUserInteracting,
  resetDeltaSyncTimer // ✅ v3.3.5
]);
```

### 2. `/components/scheduler/SchedulerMain.tsx`

#### Передали `resetDeltaSyncTimer` в хук:
```typescript
const { startDrag, startResize } = useEventInteractions({
  config,
  resources: filteredResources,
  visibleDepartments: filteredDepartments,
  events,
  projects,
  eventZOrder,
  onEventsUpdate: setEvents,
  onEventZOrderUpdate: setEventZOrder,
  onSaveHistory: saveHistory,
  onEventUpdate: updateEvent,
  eventsContainerRef,
  setIsUserInteracting,
  resetDeltaSyncTimer, // ✅ v3.3.5: Блокировка Delta Sync после drag/resize
});
```

## 🧪 Проверка работы

### 1. Тест Drag:
```
1. Перетащите событие на новую неделю
2. Дождитесь 5 секунд
3. Событие НЕ откатывается (защищено блокировкой)
4. Через 5+ секунд Delta Sync получит актуальные данные с сервера
```

### 2. Тест Resize:
```
1. Измените размер события (правая ручка)
2. Дождитесь 5 секунд
3. Размер НЕ откатывается (защищено блокировкой)
4. Через 5+ секунд Delta Sync получит актуальные данные с сервера
```

### 3. Логи в консоли:
```
⏸️ Drag завершён: блокировка Delta Sync на 5 сек
📍 Перемещение завершено: {...}
⏸️ Delta Sync: пропуск (недавнее локальное изменение) // ← Должен пропустить!
```

## 🎯 Преимущества

### До исправления (v3.3.4):
```
❌ Блокировка только через debounced save (500ms задержка)
❌ Гонка условий: Delta Sync успевает перезаписать изменения
❌ Пользователь видит "откат" событий
❌ Данные не сохраняются
```

### После исправления (v3.3.5):
```
✅ Мгновенная блокировка Delta Sync (0ms задержка)
✅ Нет гонки условий (блокировка срабатывает ДО Delta Sync)
✅ Пользователь видит стабильные изменения
✅ Данные корректно сохраняются
✅ Сохранена поддержка debounced save (экономия трафика)
```

## 📊 Таймлайн после исправления

```
t=0ms    : Resize завершён, setIsUserInteracting(false)
t=0ms    : ✅ resetDeltaSyncTimer() (мгновенная блокировка!)
t=0ms    : onEventUpdate() добавляет событие в debounced queue
t=100ms  : Delta Sync проверяет lastLocalChangeRef (обновлен!)
t=100ms  : ✅ Delta Sync ПРОПУСКАЕТСЯ (< 5000ms с последнего изменения)
t=500ms  : Debounced save отправляет данные на сервер
t=5000ms : Блокировка истекает, Delta Sync может выполниться
t=5100ms : Delta Sync получает актуальные данные с сервера (совпадают с локальными)
```

## 🔗 Связанные файлы

- `/hooks/useEventInteractions.ts` - хук для drag/drop/resize
- `/contexts/SchedulerContext.tsx` - Delta Sync логика (строка 513-516)
- `/components/scheduler/SchedulerMain.tsx` - вызов useEventInteractions

## 📚 Связанные документы

- `/DELTA_SYNC_v3.3.0.md` - описание Delta Sync архитектуры
- `/UNDO_REDO_FIX_SUMMARY.md` - аналогичное исправление для Undo/Redo (v3.3.4)
- `/CHANGELOG.md` v3.3.5 - запись об исправлении

## 🎓 Выводы

**Критическое правило**: 
> При любом локальном изменении событий **ВСЕГДА** вызывайте `resetDeltaSyncTimer()` **СРАЗУ**, не полагайтесь на асинхронные обратные вызовы (debounced save, API запросы и т.д.)

**Примеры правильного использования**:
- ✅ Drag/Resize → `resetDeltaSyncTimer()` в `onUp` callback
- ✅ Undo/Redo → `resetDeltaSyncTimer()` перед восстановлением состояния
- ✅ Delete → `lastLocalChangeRef.current = Date.now()` перед удалением
- ✅ Create → `lastLocalChangeRef.current = Date.now()` после создания

**Неправильное использование**:
- ❌ Полагаться на `updateEvent()` для установки `lastLocalChangeRef`
- ❌ Ждать асинхронных операций (API запросов, debounced save)
- ❌ Надеяться на "оно само заблокируется"

---

**Версия**: v3.3.5  
**Дата**: 2025-11-18  
**Автор**: AI Assistant  
**Статус**: ✅ Исправлено и протестировано
