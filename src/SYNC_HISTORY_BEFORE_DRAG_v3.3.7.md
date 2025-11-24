# Sync History Before Drag (v3.3.7) - ФИНАЛЬНОЕ ИСПРАВЛЕНИЕ

## 🎯 Проблема

При быстром создании и drag событий (< 1 сек) возникала критическая проблема с системой undo/redo:

### Сценарий 1: Асинхронное сохранение истории
1. Пользователь создаёт событие через модалку → событие создаётся на сервере с реальным ID
2. `saveHistory()` вызывается **асинхронно** через `setEvents(currentEvents => { saveHistory(...); })`
3. **< 1 сек:** Пользователь начинает drag → `saveHistory()` ЕЩЁ НЕ ВЫПОЛНИЛАСЬ!
4. Drag завершается → сохраняется состояние ПОСЛЕ драга в историю
5. **Проблема:** В истории НЕТ шага CREATE - есть только шаг DRAG
6. **Результат:** При undo восстанавливается состояние ДО создания → событие удаляется

### Сценарий 2: IIFE (fire-and-forget) в handlePaste
1. Пользователь вставляет событие через контекстное меню (copy-paste)
2. `handlePaste()` использует IIFE: `(async () => { await createEvent(); })();`
3. **КРИТИЧНО:** Функция `handlePaste()` завершается СРАЗУ, не дожидаясь IIFE!
4. **< 1 сек:** Пользователь начинает drag → событие ЕЩЁ имеет временный ID!
5. Drag работает с **временным ID** `ev_temp_...` вместо реального `e37356`
6. История сохраняет drag с временным ID
7. **Результат:** При undo событие удаляется (временный ID не в loadedEventIds)

### Логи (Сценарий 1):
```
📝 История: сохранение после создания события (модалка) ← ЕЩЁ НЕ ВЫПОЛНИЛАСЬ
🚀 DRAG: Начат drag события e37353
💾 HISTORY: Сохранена операция drag с ID e37353 ← ПЕРВОЕ сохранение в историю!
📝 История: сохранение после создания события (модалка) ← Выполнилась ПОСЛЕ drag
↩️ UNDO: Восстановление 14 событий ← Состояние ДО создания!
🔄 UNDO/REDO: Найдено 1 удалённых событий: ["e37353"]
❌ Событие удалено!
```

### Логи (Сценарий 2 - IIFE):
```
📝 setEventsState (добавление временного): 14 → 15 { tempId: "ev_temp_1763501474316" }
🚀 DRAG: Flush pending операций перед началом drag
📍 Перемещение завершено: { "id": "ev_temp_1763501474316" } ← ВРЕМЕННЫЙ ID!
✅ Событие создано: e37356 ← Реальный ID получен ПОСЛЕ drag
📝 История: обновлен ID ev_temp_1763501474316 → e37356 (paste)
📝 История: сохранение после вставки события (paste)
↩️ UNDO: Восстановление 14 событий ← Нет события с временным ID!
🔄 UNDO/REDO: Найдено 1 удалённых событий: ["e37356"]
❌ Событие удалено!
```

## ✅ Решение v3.3.7

### Часть 1: Flush Pending Before Drag
Добавлен вызов `flushPendingChanges()` в начале drag операций (уже реализовано ранее).

### Часть 2: Sync History Before Drag (НОВОЕ)
`saveHistory()` теперь вызывается **синхронно** через Promise - ждём завершения перед продолжением.

**До исправления:**
```typescript
const createdEvent = await createEvent(tempEvent);
updateHistoryEventId(tempEvent.id, createdEvent.id);

// ❌ АСИНХРОННО - может выполниться ПОСЛЕ drag
setEvents(currentEvents => {
  saveHistory(currentEvents, eventZOrder, projects);
  return currentEvents;
});
// Функция завершается СРАЗУ, пользователь может начать drag
```

**После исправления:**
```typescript
const createdEvent = await createEvent(tempEvent);
updateHistoryEventId(tempEvent.id, createdEvent.id);

// ✅ v3.3.7: СИНХРОННО через Promise.resolve
await new Promise<void>(resolve => {
  setEvents(currentEvents => {
    saveHistory(currentEvents, eventZOrder, projects);
    resolve(); // ✅ Продолжаем только ПОСЛЕ сохранения истории
    return currentEvents;
  });
});
// Функция НЕ завершится пока saveHistory() не выполнится
```

## 📊 Изменённые файлы

### 1. `/components/scheduler/SchedulerMain.tsx`

**handleModalSave** (создание через модалку):
```typescript
const createdEvent = await createEvent(tempEvent);
updateHistoryEventId(tempEvent.id, createdEvent.id);

// v3.3.7: КРИТИЧНО - сохраняем историю СИНХРОННО через Promise
await new Promise<void>(resolve => {
  setEvents(currentEvents => {
    saveHistory(currentEvents, eventZOrder, projects);
    resolve();
    return currentEvents;
  });
});
```

**handlePaste** (вставка через контекстное меню):
```typescript
// v3.3.7: Сделали async и убрали IIFE
const handlePaste = useCallback(async () => {
  // ... validation ...
  
  // v3.3.7: УБРАЛИ IIFE - теперь handlePaste дожидается завершения
  try {
    const createdEvent = await createEvent(tempEvent);
    updateHistoryEventId(tempEvent.id, createdEvent.id);
    
    // v3.3.7: КРИТИЧНО - сохраняем историю СИНХРОННО через Promise
    await new Promise<void>(resolve => {
      setEvents(currentEvents => {
        saveHistory(currentEvents, eventZOrder, projects);
        resolve();
        return currentEvents;
      });
    });
  } catch (error) {
    console.error("❌ Ошибка вставки события:", error);
  }
}, [...]); // ← функция завершается ТОЛЬКО после создания и сохранения истории
```

**Проблема IIFE:**
```typescript
// ❌ ДО ИСПРАВЛЕНИЯ - fire-and-forget IIFE
const handlePaste = useCallback(() => {
  (async () => {
    const createdEvent = await createEvent(tempEvent);
    // ...
  })(); // ← handlePaste завершается СРАЗУ, не дожидаясь!
}, [...]);
```

При IIFE пользователь мог начать drag ДО того как `createEvent()` завершится, и событие имело **временный ID** в момент drag!

## 🔄 Как это работает теперь

### Правильная последовательность (handleModalSave):
```
[0ms] MODAL SAVE → createEvent()
[50ms] createEvent() → server.create() → real ID: e37353
[100ms] updateHistoryEventId(temp → e37353)
[101ms] await Promise(setEvents + saveHistory) ← ЖДЁМ!
[150ms] saveHistory() выполнилась ✅
[151ms] handleModalSave завершён ← Теперь можно drag
[200ms] DRAG START → история УЖЕ содержит шаг CREATE ✅
[500ms] DRAG END → saveHistory() сохраняет шаг DRAG ✅
[1000ms] UNDO → restore(15 events with e37353) ✅ Событие восстановлено!
```

### Правильная последовательность (handlePaste):
```
[0ms] PASTE (async) → createEvent()
[50ms] createEvent() → server.create() → real ID: e37356
[51ms] setEventsState(замена ev_temp_... → e37356) ✅
[100ms] updateHistoryEventId(temp → e37356)
[101ms] await Promise(setEvents + saveHistory) ← ЖДЁМ!
[150ms] saveHistory() выполнилась ✅
[151ms] handlePaste завершён ← Событие УЖЕ с реальным ID!
[200ms] DRAG START → событие имеет ID e37356 (НЕ временный!) ✅
[500ms] DRAG END → saveHistory() сохраняет drag с реальным ID ✅
[1000ms] UNDO → restore(15 events with e37356) ✅ Событие восстановлено!
```

## ✅ Преимущества

1. **Гарантированный порядок** - история всегда сохраняется ДО начала drag
2. **Нет race conditions** - `await` блокирует продолжение handleModalSave/handlePaste
3. **Событие с реальным ID** - drag работает с реальным ID (НЕ временным!)
4. **Простота** - добавление `async` + `await` + убирание IIFE
5. **Надёжность** - работает для модалки и paste (copy-paste)
6. **Обратная совместимость** - не ломает существующий функционал

## 🧪 Тестирование

### Сценарий:
1. Открыть календарь
2. Создать событие через модалку (двойной клик → заполнить → Сохранить)
3. **СРАЗУ** (< 1 сек) начать drag этого события
4. Подождать завершения drag
5. Нажать **Ctrl+Z** (undo)

### Ожидаемый результат:
✅ Событие вернётся на место drag (НЕ удалится)

### Логи:
```
📝 История: обновлен ID ev_temp_... → e37353 (create from modal)
📝 История: сохранение после создания события (модалка) ✅
🚀 DRAG: Flush pending операций перед началом drag
🚀 DRAG: Начат drag события e37353
💾 HISTORY: Сохранена операция drag с ID e37353
↩️ UNDO: Восстановление события с ID e37353
✅ Событие восстановлено! ✅
```

## 📝 Связанные исправления

- **v3.3.7 Часть 1**: Flush pending changes перед drag/resize
- **v3.3.7 Часть 2**: Sync history before drag (этот документ)
- **v3.3.6**: Синхронизация изменённых событий после undo/redo
- **v3.3.3**: Синхронизация удалённых событий после undo/redo
- **v3.3.2**: Синхронизация проектов при undo/redo
- **v3.3.1**: Защита истории от сохранения событий без проектов

## 🏷️ Версия
v3.3.7 (2025-11-18) - ФИНАЛЬНОЕ ИСПРАВЛЕНИЕ
