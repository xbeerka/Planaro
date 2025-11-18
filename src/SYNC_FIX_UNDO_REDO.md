# ✅ КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Undo/Redo + Debounced Save

## 🚨 Проблема которую решили

### Было:
```
T+0s:  Перемещаешь событие → optimistic update
T+0s:  queueChange() → добавляется в debounced queue (500ms)
T+0.2s: Ctrl+Z → откат локально
T+0.5s: flush() → DEBOUNCED SAVE СРАБАТЫВАЕТ И ПЕРЕЗАПИСЫВАЕТ ОТКАТ! ❌
```

**Результат:** Событие "прыгает назад" после undo, потому что debounced save перезаписывает откат данными из queue.

---

## ✅ Решение

### 1. Добавлены функции в SchedulerContext

**Файл:** `/contexts/SchedulerContext.tsx`

```typescript
interface SchedulerContextType {
  // ... existing fields
  
  // ✨ Sync operations (для Undo/Redo)
  cancelPendingChange: (id: string) => void;
  flushPendingChanges: () => Promise<void>;
}
```

**Реализация:**
```typescript
const cancelPendingChange = useCallback((id: string) => {
  pendingOps.removePending(id); // Удаляет из pending queue
}, [pendingOps]);

const flushPendingChanges = useCallback(async () => {
  await flushPendingUpdates(); // Сохраняет все pending изменения
}, [flushPendingUpdates]);
```

---

### 2. Обновлён handleUndo в SchedulerMain

**Файл:** `/components/scheduler/SchedulerMain.tsx`

```typescript
const handleUndo = useCallback(async () => {
  const state = historyUndo();
  if (!state) return;
  
  console.log('↩️ Undo: откат изменений');
  
  // 1. Находим изменённые события
  const changedEventIds = new Set<string>();
  
  state.events.forEach(newEvent => {
    const oldEvent = events.find(e => e.id === newEvent.id);
    if (oldEvent && JSON.stringify(oldEvent) !== JSON.stringify(newEvent)) {
      changedEventIds.add(newEvent.id);
    }
  });
  
  events.forEach(oldEvent => {
    if (!state.events.find(e => e.id === oldEvent.id)) {
      changedEventIds.add(oldEvent.id);
    }
  });
  
  // 2. ✅ КРИТИЧНО: Отменяем pending операции для изменённых событий
  changedEventIds.forEach(id => {
    cancelPendingChange(id);
  });
  
  // 3. Обновляем локально
  setEvents(state.events);
  setEventZOrder(state.eventZOrder);
  
  // 4. Синхронизируем с сервером
  const updatePromises = Array.from(changedEventIds).map(async (id) => {
    const event = state.events.find(e => e.id === id);
    if (event && !id.startsWith('ev_temp_')) {
      await updateEvent(event.id, event);
    }
  });
  
  await Promise.all(updatePromises);
}, [historyUndo, setEvents, events, cancelPendingChange, updateEvent]);
```

---

### 3. Обновлён handleRedo аналогично

Та же логика: отменяем pending операции → обновляем локально → синхронизируем с сервером.

---

## 🎯 Как это работает теперь

### Сценарий: Быстрое перемещение + Undo

```
T+0s:   Перемещаешь событие → optimistic update
T+0s:   addPending(event, update, old, new)
T+0s:   queueChange(event) → добавляется в queue (500ms)

T+0.2s: Ctrl+Z → handleUndo()
        ├─ Находит изменённые события: [event.id]
        ├─ cancelPendingChange(event.id) ← ✅ УДАЛЯЕТ ИЗ QUEUE!
        ├─ setEvents(oldState) ← Откат локально
        └─ updateEvent(event) ← Синхронизация с сервером

T+0.5s: flush() → ничего не делает, queue пустая! ✅
```

**Результат:** Событие остаётся на старом месте, нет "прыганий"!

---

### Сценарий: Множественные изменения + Undo

```
T+0s:   Перемещаешь Event A → queue
T+0.1s: Изменяешь размер Event B → queue
T+0.2s: Перемещаешь Event C → queue

T+0.3s: Ctrl+Z → handleUndo()
        ├─ Находит изменённые: [A, B, C]
        ├─ cancelPendingChange(A)
        ├─ cancelPendingChange(B)
        ├─ cancelPendingChange(C)
        ├─ setEvents(oldState)
        └─ Promise.all([updateA, updateB, updateC]) ← Параллельно!

T+0.5s: flush() → queue пустая! ✅
```

**Результат:** Все события откатываются одновременно, без "прыганий"!

---

## 🧪 Тестирование

### Тест 1: Простой Undo
1. Переместить событие
2. Подождать 200ms (НЕ ждать flush 500ms!)
3. Нажать Ctrl+Z
4. **Ожидаемый результат:** Событие вернулось на старое место И ОСТАЛОСЬ ТАМ ✅

### Тест 2: Быстрые изменения + Undo
1. Быстро переместить событие 5 раз (за 1 секунду)
2. Сразу нажать Ctrl+Z
3. **Ожидаемый результат:** Событие вернулось на исходное место И ОСТАЛОСЬ ТАМ ✅

### Тест 3: Undo → Redo
1. Переместить событие
2. Ctrl+Z (undo)
3. Подождать 1 секунду
4. Ctrl+Shift+Z (redo)
5. **Ожидаемый результат:** Событие вернулось на новое место И ОСТАЛОСЬ ТАМ ✅

### Тест 4: Множественный Undo
1. Переместить Event A
2. Изменить размер Event B
3. Ctrl+Z (откатывает Event B)
4. Ctrl+Z (откатывает Event A)
5. **Ожидаемый результат:** Оба события вернулись на исходные места И ОСТАЛИСЬ ТАМ ✅

---

## 📊 Диаграмма потока данных

### ДО исправления (ПРОБЛЕМА):
```
User Action
    ↓
Optimistic Update (state)
    ↓
queueChange() → debounced queue
    ↓
[User presses Ctrl+Z]
    ↓
Undo (state rollback) ← ❌ НО QUEUE ЕЩЁ АКТИВНА!
    ↓
[500ms later]
    ↓
flush() → API request ← ❌ ПЕРЕЗАПИСЫВАЕТ UNDO!
    ↓
State updated from server ← ❌ СОБЫТИЯ "ПРЫГАЮТ"!
```

### ПОСЛЕ исправления (РЕШЕНИЕ):
```
User Action
    ↓
Optimistic Update (state)
    ↓
queueChange() → debounced queue
    ↓
[User presses Ctrl+Z]
    ↓
cancelPendingChange() ← ✅ ОЧИЩАЕТ QUEUE!
    ↓
Undo (state rollback)
    ↓
updateEvent() → immediate API request ← ✅ СИНХРОНИЗАЦИЯ!
    ↓
[500ms later]
    ↓
flush() → queue empty, nothing happens ← ✅ НЕТ КОНФЛИКТА!
```

---

## 🔍 Логи для диагностики

### Успешный Undo:
```
↩️ Undo: откат изменений
↩️ Undo: отменяем 1 pending операций
✅ Удалена pending операция для события e123
⏳ Добавление обновления в debounced queue: e123
💾 Debounced save: отправка на сервер e123
✅ Debounced Save: все 1 изменений сохранены
✅ Undo: синхронизировано 1 событий
```

### Успешный Redo:
```
↪️ Redo: повтор изменений
↪️ Redo: отменяем 1 pending операций
✅ Удалена pending операция для события e123
⏳ Добавление обновления в debounced queue: e123
💾 Debounced save: отправка на сервер e123
✅ Debounced Save: все 1 изменений сохранены
✅ Redo: синхронизировано 1 событий
```

---

## 🎨 Файлы изменены

1. `/contexts/SchedulerContext.tsx`
   - Добавлен `cancelPendingChange()` в интерфейс
   - Добавлен `flushPendingChanges()` в интерфейс
   - Экспортированы в Provider value

2. `/components/scheduler/SchedulerMain.tsx`
   - Импорт `cancelPendingChange` и `flushPendingChanges` из useScheduler
   - Обновлён `handleUndo()` - отменяет pending операции
   - Обновлён `handleRedo()` - отменяет pending операции

---

**Дата:** 2025-11-17  
**Версия:** 2.1 (Undo/Redo Fix)  
**Статус:** ✅ ГОТОВО К ТЕСТИРОВАНИЮ

---

## 💡 Почему это критично?

**БЕЗ этого исправления:**
- Undo "работает", но событие прыгает назад через 500ms
- Пользователь думает что "undo сломан"
- Множественные undo создают хаос (события прыгают туда-сюда)

**С этим исправлением:**
- Undo работает МГНОВЕННО и НАДЁЖНО
- Нет конфликтов между undo и debounced save
- История изменений синхронизируется с сервером корректно
