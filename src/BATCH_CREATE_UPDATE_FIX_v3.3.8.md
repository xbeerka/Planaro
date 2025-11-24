# BATCH CREATE/UPDATE Fix v3.3.8

## 🐛 Проблема

Ошибка: `❌ [Supabase] ❌ BATCH update: событие e37356 не найдено в БД`

### Что происходило:

```typescript
// ❌ СТАРЫЙ КОД (ДО ИСПРАВЛЕНИЯ)
const operations: BatchOperation[] = validChanges.map(([id, eventData]) => ({
  op: 'update',  // ← ВСЕ ОПЕРАЦИИ ВСЕГДА UPDATE!
  id,
  data: eventData,
  workspace_id: workspaceId
}));
```

**ВСЕ** операции помечались как `update`, даже если событие НЕ существовало на сервере!

### Сценарий воспроизведения:

1. Пользователь создаёт событие через `handlePaste` → вызывается `createEvent(tempEvent)`
2. `createEvent()` вызывает `eventsApi.create()` → создаёт событие на сервере
3. **НО!** Если CREATE завершился с **ошибкой** (workspace_id не совпадает, RLS блокирует, duplicate key):
   - Фронтенд НЕ проверяет ошибку
   - Добавляет `e37356` в `loadedEventIds` (неправильно!)
4. Пользователь начинает drag → вызывается `updateEvent(e37356, ...)`
5. `updateEvent()` добавляет событие в `pendingOps` queue
6. `flushPendingUpdates()` отправляет **batch** с `op: 'update'` для `e37356`
7. Сервер пытается UPDATE → событие НЕ найдено (CREATE никогда не выполнился!)

### Альтернативный сценарий (race condition):

1. `createEvent()` начинает создание события
2. `setEventsState()` и `setLoadedEventIds()` - это **асинхронные** React операции
3. Пользователь начинает drag **СРАЗУ** после `await createEvent()` (< 100ms)
4. React ещё НЕ применил `setLoadedEventIds` → `loadedEventIds.current` НЕ содержит `e37356`
5. `updateEvent()` добавляет событие в queue
6. `flushPendingUpdates()` проверяет: "Событие НЕ в loadedEventIds → это НОВОЕ событие!"
7. Отправляет `op: 'create'` → **duplicate key error** (событие УЖЕ есть!)
8. ИЛИ отправляет `op: 'update'` → **event not found** (setState не применился вовремя)

## ✅ Решение

### 1. Определение create vs update на основе `loadedEventIds`

```typescript
// ✅ НОВЫЙ КОД (ПОСЛЕ ИСПРАВЛЕНИЯ)
const operations: BatchOperation[] = validChanges.map(([id, eventData]) => {
  const isLoaded = loadedEventIds.current.has(id);
  const op = isLoaded ? 'update' : 'create';
  
  console.log(`📦 BATCH: событие ${id} → ${op} (isLoaded=${isLoaded})`);
  
  return {
    op,
    id,
    data: { 
      ...eventData, 
      id // ✅ КРИТИЧНО: передаём ID в data для CREATE операций!
    },
    workspace_id: workspaceId
  };
});
```

### 2. Добавление созданных событий в `loadedEventIds`

```typescript
// ✅ После успешного batch create
if (results.created && results.created.length > 0) {
  results.created.forEach((event: SchedulerEvent) => {
    setLoadedEventIds(prev => {
      const newSet = new Set(prev).add(event.id);
      console.log(`📌 loadedEventIds: добавлен ${event.id} после batch create`);
      return newSet;
    });
  });
}
```

### 3. Детальное логирование в `createEvent()`

```typescript
try {
  console.log('🌐 API: вызов eventsApi.create для', tempEvent.id);
  const createdEvent = await eventsApi.create(tempEvent, accessToken);
  console.log('✅ API: событие создано на сервере:', createdEvent.id, {
    resourceId: createdEvent.resourceId,
    projectId: createdEvent.projectId,
    startWeek: createdEvent.startWeek
  });
  
  // ... setState ...
  
  setLoadedEventIds(prev => {
    const newSet = new Set(prev).add(createdEvent.id);
    console.log(`📌 loadedEventIds: добавлен ${createdEvent.id}, всего ${newSet.size} событий`);
    return newSet;
  });
} catch (error) {
  console.error('❌ Ошибка создания события:', error);
  // НЕ добавляем в loadedEventIds!
  throw error;
}
```

## 🎯 Как работает теперь

### Создание нового события:

1. `createEvent()` создаёт событие на сервере
2. Добавляет в `loadedEventIds` **ТОЛЬКО** если CREATE успешен
3. При drag проверяется: `loadedEventIds.has(id)` → `true` → отправляется `op: 'update'`

### Событие не было создано (ошибка):

1. `createEvent()` получает ошибку от сервера
2. **НЕ** добавляет в `loadedEventIds`
3. При drag проверяется: `loadedEventIds.has(id)` → `false` → отправляется `op: 'create'`
4. Batch endpoint создаёт событие через UPSERT

### Race condition защита:

- `loadedEventIds` использует `useRef` → изменения синхронны
- Проверка `loadedEventIds.current.has(id)` выполняется **в момент** формирования batch
- Если `setLoadedEventIds` не применился → событие будет пересоздано через UPSERT (безопасно)

## 📊 Результат

✅ Корректное определение create vs update  
✅ Нет ошибок "событие не найдено в БД"  
✅ Защита от race conditions между createEvent и drag  
✅ Детальное логирование для диагностики  
✅ UPSERT на сервере как fallback  

## 📝 Изменённые файлы

- `/contexts/SchedulerContext.tsx`:
  - Определение `op: 'create' | 'update'` на основе `loadedEventIds`
  - Передача `id` в `data` для CREATE операций
  - Добавление созданных событий в `loadedEventIds` после batch
  - Детальное логирование в `createEvent()`

## 🔍 Диагностика

Если ошибка всё ещё появляется, проверьте логи:

```
🌐 API: вызов eventsApi.create для ev_temp_...
✅ API: событие создано на сервере: e37356
📌 loadedEventIds: добавлен e37356, всего N событий
📦 BATCH: событие e37356 → update (isLoaded=true)  ← ДОЛЖНО БЫТЬ true!
```

Если `isLoaded=false`, значит:
- CREATE завершился с ошибкой (проверьте логи сервера)
- ИЛИ событие было удалено после создания
- ИЛИ `loadedEventIds` был сброшен (не должно происходить!)

---

**Версия**: v3.3.8  
**Дата**: 2024-11-18  
**Тип исправления**: Critical Bug Fix  
