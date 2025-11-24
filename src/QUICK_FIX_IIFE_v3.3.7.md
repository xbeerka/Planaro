# Quick Fix: IIFE в handlePaste (v3.3.7)

## ❌ Проблема

При вставке события через copy-paste пользователь мог начать drag **ДО** того как событие получит реальный ID от сервера.

### Код ДО исправления:
```typescript
const handlePaste = useCallback(() => {
  // ...validation...
  
  // ❌ IIFE (fire-and-forget)
  (async () => {
    const createdEvent = await createEvent(tempEvent);
    updateHistoryEventId(tempEvent.id, createdEvent.id);
    await new Promise<void>(resolve => {
      setEvents(currentEvents => {
        saveHistory(currentEvents, eventZOrder, projects);
        resolve();
        return currentEvents;
      });
    });
  })(); // ← handlePaste завершается СРАЗУ!
}, [...]);
```

### Что происходило:
```
[0ms] handlePaste() вызвана
[1ms] IIFE запущена (async)
[2ms] handlePaste() ЗАВЕРШЕНА ← Пользователь может drag!
[50ms] createEvent() → server.create() → ID: e37356
[100ms] setEventsState(замена ev_temp → e37356)
[150ms] saveHistory() выполнилась
```

**Результат:** Пользователь начинал drag когда событие имело **временный ID** `ev_temp_...`!

### Логи:
```
📍 Перемещение завершено: { "id": "ev_temp_1763501474316" } ← ВРЕМЕННЫЙ ID!
✅ Событие создано: e37356 ← Реальный ID получен ПОСЛЕ drag
↩️ UNDO: Восстановление 14 событий ← Нет события с временным ID!
❌ Событие удалено!
```

## ✅ Решение

Сделали `handlePaste` **async** и **убрали IIFE**:

```typescript
const handlePaste = useCallback(async () => { // ← async добавлен
  // ...validation...
  
  // ✅ Убрали IIFE - теперь код выполняется напрямую
  try {
    const createdEvent = await createEvent(tempEvent);
    updateHistoryEventId(tempEvent.id, createdEvent.id);
    
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
  // ← handlePaste завершается ТОЛЬКО после создания и сохранения истории
}, [...]);
```

### Что происходит теперь:
```
[0ms] handlePaste() вызвана (async)
[50ms] createEvent() → server.create() → ID: e37356
[51ms] setEventsState(замена ev_temp → e37356) ✅
[100ms] updateHistoryEventId(temp → e37356)
[150ms] saveHistory() выполнилась ✅
[151ms] handlePaste() ЗАВЕРШЕНА ← Событие УЖЕ с реальным ID!
[200ms] Пользователь может drag → событие имеет ID e37356 ✅
```

## 📝 Изменения

### Файл: `/components/scheduler/SchedulerMain.tsx`

1. **Сделали функцию async:**
```diff
- const handlePaste = useCallback(() => {
+ const handlePaste = useCallback(async () => {
```

2. **Убрали IIFE:**
```diff
- (async () => {
-   try {
-     const createdEvent = await createEvent(tempEvent);
-     // ...
-   } catch (error) {
-     console.error("❌ Ошибка вставки события:", error);
-   }
- })();
+ try {
+   const createdEvent = await createEvent(tempEvent);
+   // ...
+ } catch (error) {
+   console.error("❌ Ошибка вставки события:", error);
+ }
```

## ✅ Результат

- Пользователь НЕ может начать drag пока событие не получит реальный ID
- При undo событие **НЕ удаляется** (есть в истории с реальным ID)
- Работает для **copy-paste** операций

## 🏷️ Версия
v3.3.7 (2025-11-18)
