# Исправление проверки pending событий в Undo/Redo (v3.3.15)

## Проблема

При использовании Undo/Redo возникала критическая проблема:

1. Создаём событие → оно получает временный ID `ev_temp_1732005123456_78901`
2. Событие сохраняется в истории с временным ID
3. Событие создаётся на сервере → ID обновляется на реальный `e123`
4. Drag событие → сохраняется в истории
5. Undo → восстанавливаем СТАРЫЙ snapshot из истории
6. **БАГ**: В истории событие имеет временный ID `ev_temp_*`!
7. Проверка `events.some(e => e.id.startsWith('ev_temp_'))` возвращает `true`
8. Undo/Redo навсегда заблокированы, даже если событие давно создано!

### Симптомы

- ✅ Создал событие → оно загружается
- ✅ Drag событие → загружается
- ✅ Undo → событие восстанавливается и загружается
- ❌ Undo ещё раз → блокировка "Дождитесь завершения создания событий"
- ❌ Блокировка остаётся НАВСЕГДА, даже после всех загрузок
- ❌ Создание других событий не помогает — блокировка остаётся

## Причина

**Старая проверка** (НЕПРАВИЛЬНО):
```typescript
const hasPendingEvents = events.some(e => e.id.startsWith('ev_temp_'));
if (hasPendingEvents) {
  // блокировка
}
```

Проблема: события в `events` могут иметь временные ID из истории, даже если реально операция давно завершена!

## Решение

**Новая проверка** (ПРАВИЛЬНО):
```typescript
if (hasPendingOperations()) {
  // блокировка
}
```

### Что изменилось

1. **Добавлена функция в SchedulerContext**:
   ```typescript
   const hasPendingOperations = useCallback(() => {
     return pendingOps.getAllPending().length > 0;
   }, [pendingOps]);
   ```

2. **Проверяем РЕАЛЬНЫЕ pending операции**:
   - `pendingOps` — hook для управления очередью операций
   - `getAllPending()` — возвращает только АКТИВНЫЕ операции
   - Не зависит от ID событий в state/истории
   - Очищается после завершения операции на сервере

3. **Обновлён интерфейс контекста**:
   ```typescript
   interface SchedulerContextType {
     // ...
     hasPendingOperations: () => boolean; // ✅ Новая функция
   }
   ```

4. **Обновлены useCallback зависимости**:
   ```typescript
   }, [
     // ...
     hasPendingOperations, // ✅ Добавлено
     showToast            // ✅ Добавлено
   ]);
   ```

## Технические детали

### Lifecycle pending операции

1. **Создание события**:
   ```typescript
   pendingOps.addPending(tempId, 'create', undefined, eventData);
   ```

2. **Событие создаётся на сервере**:
   ```typescript
   const realEvent = await eventsApi.create(...);
   pendingOps.removePending(tempId); // ✅ Операция завершена
   ```

3. **Проверка в Undo**:
   ```typescript
   hasPendingOperations() // → false (операция удалена из очереди)
   ```

### Защита от "Cannot update component while rendering"

Оборачиваем showToast в `queueMicrotask`:
```typescript
queueMicrotask(() => {
  showToast({
    type: 'warning',
    message: 'Подождите',
    description: 'Дождитесь завершения сохранения изменений'
  });
});
```

## Результат

✅ Undo/Redo блокируется ТОЛЬКО при реальных pending операциях  
✅ После завершения операции блокировка снимается автоматически  
✅ Не зависит от временных ID в истории  
✅ Нет "вечной блокировки"  
✅ Toast уведомления работают корректно  
✅ Нет React warning в консоли  

## Затронутые файлы

- `/contexts/SchedulerContext.tsx` — добавлена `hasPendingOperations()`
- `/components/scheduler/SchedulerMain.tsx` — заменена проверка `ev_temp_*` на `hasPendingOperations()`

## Версия

**v3.3.15** (2025-11-19)

## Связанные исправления

- v3.3.14 — Flush pending перед Undo/Redo
- v3.3.12 — Первая версия блокировки (с багом)
- v3.3.10 — Очистка pending при Undo/Redo
