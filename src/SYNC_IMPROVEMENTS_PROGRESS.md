# Прогресс исправлений синхронизации v2.0

## ✅ ЧТО СДЕЛАНО (Шаг 1/5)

### 1. Создан `/hooks/usePendingOperations.ts`
✅ Hook для управления очередью pending операций
- `addPending()` - добавляет операцию в очередь
- `removePending()` - удаляет после успешного сохранения
- `hasPending()` - проверяет наличие pending операции
- `mergeWithServer()` - мерджит данные с сервера и pending операции
- `rollback()` - откатывает операцию при ошибке
- `clearStale()` - очищает устаревшие операции (>30 сек)

**Защита от race conditions:** Pending операции не перезаписываются при polling

---

### 2. Создан `/hooks/useDebouncedSave.ts`
✅ Hook для накопления и debounced сохранения изменений
- `queueChange()` - добавляет изменение в очередь
- `flush()` - сохраняет все накопленные изменения пакетом
- `saveImmediate()` - сохраняет без debounce (критичные операции)
- `cancelChange()` - отменяет pending изменение
- `hasPendingChange()` - проверяет наличие pending изменений

**Delay:** 500ms после последнего изменения
**Выигрыш:** 10-100x меньше запросов к серверу при быстрых изменениях

---

### 3. Интегрированы hooks в `/contexts/SchedulerContext.tsx`
✅ Импорты добавлены
✅ Hooks инициализированы

 после объявления refs
```typescript
// ✨ Pending Operations Queue - защита от race conditions
const pendingOps = usePendingOperations();

// ✨ Debounced Save - накопление изменений для пакетного сохранения
const { queueChange: queueEventUpdate, flush: flushPendingUpdates } = useDebouncedSave(
  async (id: string, event: Partial<SchedulerEvent>) => {
    // Реальное сохранение на сервере
    const updatedEvent = await eventsApi.update(id, event, accessToken);
    setEventsState(prev => prev.map(e => e.id === id ? updatedEvent : e));
    pendingOps.removePending(id);
    lastLocalChangeRef.current = Date.now();
  },
  500 // Debounce delay 500ms
);
```

---

## 🔄 ЧТО НУЖНО СДЕЛАТЬ (Шаги 2-5)

### Шаг 2: Обновить `updateEvent()` в SchedulerContext
❌ **TODO**: Использовать debounced save вместо прямого вызова API

**Текущий код:**
```typescript
const updateEvent = useCallback(async (id: string, event: Partial<SchedulerEvent>) => {
  // ... прямой вызов eventsApi.update()
});
```

**Новый код:**
```typescript
const updateEvent = useCallback(async (id: string, event: Partial<SchedulerEvent>) => {
  if (id.startsWith('ev_temp_')) return;
  
  // Сохраняем оригинал для rollback
  const originalEvent = events.find(e => e.id === id);
  
  // Добавляем в pending операции
  pendingOps.addPending(id, 'update', originalEvent, { ...originalEvent, ...event });
  
  // Добавляем в очередь debounced save
  queueEventUpdate(id, event);
});
```

---

### Шаг 3: Обновить polling с merge logic
❌ **TODO**: Использовать `pendingOps.mergeWithServer()` вместо прямой перезаписи

**Текущий код (pollEvents):**
```typescript
setEventsState(prev => {
  if (JSON.stringify(prev) !== JSON.stringify(data)) {
    return data; // ← Перезаписывает ВСЁ!
  }
  return prev;
});
```

**Новый код:**
```typescript
setEventsState(prev => {
  // Мерджим данные с сервера и pending операции
  const mergedEvents = pendingOps.mergeWithServer(data, prev);
  
  if (JSON.stringify(prev) !== JSON.stringify(mergedEvents)) {
    setStorageJSON(`cache_events_${workspaceId}`, mergedEvents);
    return mergedEvents;
  }
  return prev;
});
```

---

### Шаг 4: Исправить инициализацию истории
❌ **TODO**: Не создавать пустую историю

**Текущий код (SchedulerMain.tsx):**
```typescript
React.useEffect(() => {
  if (!isLoading && !historyInitializedRef.current) {
    resetHistory(events, eventZOrder); // ← Может быть пустым!
    historyInitializedRef.current = true;
  }
}, [isLoading]);
```

**Новый код:**
```typescript
React.useEffect(() => {
  if (!isLoading && !historyInitializedRef.current && events.length > 0) {
    resetHistory(events, eventZOrder); // ✅ Только если есть события
    historyInitializedRef.current = true;
  }
}, [isLoading, events.length]);
```

---

### Шаг 5: Undo/Redo с синхронизацией на сервер
❌ **TODO**: Отправлять изменённые события на сервер

**Текущий код (SchedulerMain.tsx):**
```typescript
const handleUndo = useCallback(() => {
  const state = historyUndo();
  if (state) {
    setEvents(state.events); // ❌ Только локально
    setEventZOrder(state.eventZOrder);
  }
}, [historyUndo, setEvents]);
```

**Новый код:**
```typescript
const handleUndo = useCallback(async () => {
  const state = historyUndo();
  if (!state) return;
  
  // Находим изменённые события
  const changedEvents = findChangedEvents(events, state.events);
  
  // Обновляем локально
  setEvents(state.events);
  setEventZOrder(state.eventZOrder);
  
  // Отправляем изменения на сервер
  for (const event of changedEvents) {
    await updateEvent(event.id, event); // ← Через debounced save
  }
}, [historyUndo, setEvents, events, updateEvent]);
```

---

## 📋 Следующий шаг

**Шаг 2:** Обновить `updateEvent()` в SchedulerContext для использования debounced save

Готов продолжить?
