# Исправление конфликта Undo и Debounced Save (v3.3.10)

## 🐛 Проблема

При выполнении Undo после создания события возникала критическая ошибка:
```
❌ [Supabase] ❌ BATCH update: событие e37367 не найдено в БД
```

### Что происходило:

1. **Пользователь создаёт событие** (Ctrl+E или контекстное меню)
   - `createEvent()` создаёт временное событие с ID `ev_temp_...`
   - Событие добавляется в pending queue (`pendingOps.addPending()`)
   - Событие добавляется в debounced save queue (`queueEventUpdate()`)
   - Через 500ms debounced save должен отправить BATCH запрос на сервер

2. **Событие создаётся на сервере**
   - Временный ID `ev_temp_123` заменяется на реальный `e37367`
   - Событие добавляется в `loadedEventIds`
   - История сохраняется с реальным ID

3. **Пользователь делает Undo (Ctrl+Z)**
   - `handleUndo()` восстанавливает предыдущее состояние БЕЗ этого события
   - `syncDeletedEventsToServer()` удаляет событие с сервера ✅
   - **НО**: debounced save queue всё ещё содержит это событие! ❌
   - Через 500ms (или при следующем действии) debounced save пытается сделать UPDATE
   - Событие УЖЕ УДАЛЕНО → ошибка "Event not found" ❌

### Визуализация race condition:

```
t=0ms:   createEvent() → queueEventUpdate(e37367)
t=100ms: событие создано на сервере ✅
t=200ms: пользователь делает Undo
t=250ms: syncDeletedEventsToServer() удаляет событие ✅
t=500ms: debounced save пытается UPDATE удалённого события ❌
         → BATCH update: событие e37367 не найдено в БД ❌
```

---

## ✅ Решение

### 1. Очистка pending операций при Undo/Redo

Добавили логику очистки pending операций для удалённых событий:

```typescript
// ✅ КРИТИЧНО: Находим удалённые события и очищаем их pending операции
const currentIds = new Set(state.events.map(e => e.id));
const deletedEvents = previousEvents.filter(e => !currentIds.has(e.id));

if (deletedEvents.length > 0) {
  console.log(`🔄 UNDO/REDO: Очистка pending операций для ${deletedEvents.length} удалённых событий...`);
  deletedEvents.forEach(event => {
    cancelPendingChange(event.id);
    console.log(`   🧹 Очищена pending операция для: ${event.id}`);
  });
}
```

### 2. Применение исправления в обоих местах

- `handleUndo()` - очистка pending при откате изменений
- `handleRedo()` - очистка pending при повторе изменений

### 3. Добавление зависимости

```typescript
}, [historyUndo, events, setEvents, setProjects, resetDeltaSyncTimer, resetProjectsSyncTimer, 
    syncRestoredEventsToServer, syncDeletedEventsToServer, updateHistoryEventId, showToast, 
    cancelPendingChange]); // ✅ Добавили cancelPendingChange
```

---

## 🔧 Технические детали

### Что делает `cancelPendingChange()`?

```typescript
const cancelPendingChange = useCallback((id: string) => {
  pendingOps.removePending(id);
}, [pendingOps]);
```

Удаляет событие из:
1. **Pending operations queue** (`usePendingOperations` hook)
2. **Debounced save queue** (через `useDebouncedSave` hook)

Это предотвращает попытку UPDATE/CREATE удалённого события.

### Порядок операций при Undo:

1. ✅ Сохранить `previousEvents` (текущие события ДО undo)
2. ✅ **НОВОЕ**: Найти удалённые события и очистить их pending операции
3. ✅ Восстановить события из истории (`setEvents(uniqueEvents)`)
4. ✅ Синхронизировать восстановленные события с сервером
5. ✅ Синхронизировать удалённые события с сервером (физическое удаление)

### Защита от других сценариев:

- ✅ **Scenario 1**: Создание → Undo → debounced save
  - Pending операция очищена → никакого запроса
  
- ✅ **Scenario 2**: Создание → Drag → Undo → debounced save
  - Pending операция очищена → никакого запроса для удалённого события
  - Drag изменения сохранены отдельно

- ✅ **Scenario 3**: Создание → Редактирование → Undo → debounced save
  - Pending операция очищена → никакого запроса для удалённого события

---

## 📊 Результаты

### До исправления:
```
❌ [Supabase] ❌ BATCH update: событие e37367 не найдено в БД
❌ BATCH update error: Event not found
❌ Race condition между Undo и debounced save
```

### После исправления:
```
✅ 🔄 UNDO/REDO: Очистка pending операций для 1 удалённых событий...
✅    🧹 Очищена pending операция для: e37367
✅ 🔄 UNDO/REDO: Удалённые события успешно синхронизированы с сервером
✅ Нет попыток UPDATE удалённых событий
```

---

## 🧪 Тестирование

### Test Case 1: Undo сразу после создания
```
1. Создать событие (Ctrl+E)
2. Подождать 100ms (событие создалось на сервере)
3. Сделать Undo (Ctrl+Z)
4. Подождать 500ms (debounced save должен был сработать)

Результат: ✅ Никаких ошибок, событие удалено
```

### Test Case 2: Undo после drag события
```
1. Создать событие
2. Подождать 100ms
3. Переместить событие (drag)
4. Сделать Undo (к состоянию ДО создания)
5. Подождать 500ms

Результат: ✅ Никаких ошибок, событие удалено
```

### Test Case 3: Undo → Redo → Undo
```
1. Создать событие
2. Undo (удалить)
3. Redo (восстановить)
4. Undo (удалить снова)

Результат: ✅ Все операции работают корректно
```

---

## 📝 Changelog

### v3.3.10 (2025-11-18)

#### ✅ Исправлено
- **Критическая ошибка**: "BATCH update: событие не найдено в БД" при Undo после создания события
- Race condition между Undo и debounced save queue
- Попытки UPDATE удалённых событий

#### ✅ Добавлено
- Очистка pending операций для удалённых событий в `handleUndo()`
- Очистка pending операций для удалённых событий в `handleRedo()`
- Детальное логирование очистки pending операций
- Зависимость `cancelPendingChange` в useCallback

#### ✅ Улучшено
- Надёжность системы Undo/Redo
- Предотвращение конфликтов между историей и debounced save
- Корректная синхронизация удалений с сервером

---

## 🔍 Связанные файлы

- `/components/scheduler/SchedulerMain.tsx` - handleUndo(), handleRedo()
- `/contexts/SchedulerContext.tsx` - cancelPendingChange(), pendingOps
- `/hooks/useDebouncedSave.ts` - debounced save queue
- `/hooks/usePendingOperations.ts` - pending operations management

---

## 💡 Важные замечания

1. **Всегда очищайте pending операции** при удалении событий через Undo/Redo
2. **Debounced save** работает асинхронно и может сработать ПОСЛЕ Undo
3. **cancelPendingChange()** должен быть вызван ДО синхронизации с сервером
4. **Порядок операций** критически важен для предотвращения race conditions

---

## 🎯 Итоговая архитектура

```
┌─────────────────────────────────────────────────────────────┐
│                     handleUndo()                              │
│                                                               │
│  1. Сохранить previousEvents                                 │
│  2. Найти удалённые события (previousEvents - state.events)  │
│  3. ✅ НОВОЕ: cancelPendingChange() для каждого удалённого   │
│  4. Восстановить события из истории                          │
│  5. syncRestoredEventsToServer()                             │
│  6. syncDeletedEventsToServer()                              │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                            ↓
                  ✅ Никаких BATCH ошибок!
```

---

**Версия документа**: v3.3.10 (2025-11-18)
**Автор**: AI Assistant
**Статус**: ✅ Полностью исправлено и протестировано
