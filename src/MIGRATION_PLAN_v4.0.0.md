# План миграции на Local-First v4.0.0

## Текущее состояние (v3.x)

### ✅ Уже работает правильно:
1. **История сохраняется явно** в хуках:
   - `useEventInteractions` → drag/resize → `onSaveHistory()`
   - `useGapInteractions` → gap drag → `onSaveHistory()`
   
2. **История сохраняется явно** при создании:
   - `handleModalSave` → создание через модалку → `saveHistory()`
   - `handlePaste` → вставка события → `saveHistory()`

### ❌ Нужно исправить:

1. **Автосохранение истории при изменении events** (строка 395-436)
   - УДАЛИТЬ - создаёт промежуточные состояния

2. **flushPendingChanges в Undo/Redo** (строки 458, 633)
   - УДАЛИТЬ - заменить на блокировку

3. **Проверка hasPendingOperations** - улучшить логику

## Изменения v4.0.0

### Шаг 1: Удалить автосохранение истории

**Файл:** `/components/scheduler/SchedulerMain.tsx`
**Строки:** 395-436

**Удалить:**
```typescript
// ✅ Автосохранение истории при изменении событий
const prevEventsRef = useRef<SchedulerEvent[]>([]);
const isUserEventChangeRef = useRef<boolean>(false);

React.useEffect(() => {
  // ... весь эффект автосохранения
}, [events, eventZOrder, projects, saveHistory]);
```

**Заменить на:**
```typescript
// ❌ УДАЛЕНО v4.0.0: Автосохранение истории при изменении событий
// 
// История теперь сохраняется ТОЛЬКО явно:
// 1. Drag/Drop → saveHistory() в useEventInteractions (handlePointerUp)
// 2. Resize → saveHistory() в useEventInteractions (handlePointerUp)
// 3. Gap Drag → saveHistory() в useGapInteractions (handleGapDragEnd)
// 4. Create → saveHistory() в handleModalSave
// 5. Paste → saveHistory() в handlePaste
// 6. Delete → saveHistory() сразу после setEvents() в context menu handler
//
// Преимущества:
// - Нет промежуточных состояний в истории
// - Polling не создаёт новые записи
// - Undo/Redo работают предсказуемо
```

### Шаг 2: Убрать flushPendingChanges из Undo/Redo

**Файл:** `/components/scheduler/SchedulerMain.tsx`
**Функция:** `handleUndo` (строка 454)

**Было:**
```typescript
const handleUndo = useCallback(async () => {
  // ✅ v3.3.14: Сначала флашим все pending изменения
  try {
    await flushPendingChanges(updateHistoryEventId);
    console.log('✅ UNDO: Pending изменения сохранены перед undo');
  } catch (err) {
    console.error('❌ UNDO: Ошибка flush pending:', err);
  }
  
  // ✅ v3.3.15: Блокируем Undo если есть pending операции
  if (hasPendingOperations()) {
    showToast({ ... });
    return;
  }
  
  // ... остальная логика
}, [...]);
```

**Стало:**
```typescript
const handleUndo = useCallback(() => { // ✅ Убрали async!
  // ✅ v4.0.0: КРИТИЧНО - блокируем Undo если есть pending изменения
  // Проверяем debounced save queue
  if (hasPendingOperations()) {
    console.log('⏸️ UNDO: Заблокировано - есть несохранённые изменения (debounced save)');
    showToast({
      type: 'warning',
      message: 'Подождите',
      description: 'Дождитесь завершения сохранения (500ms)'
    });
    return;
  }
  
  // ✅ v4.0.0: Дополнительная проверка временных ID
  const hasPendingEvents = events.some(e => e.id.startsWith('ev_temp_'));
  if (hasPendingEvents) {
    console.log('⏸️ UNDO: Заблокировано - есть события в процессе создания');
    showToast({
      type: 'warning',
      message: 'Подождите',
      description: 'Дождитесь завершения создания событий'
    });
    return;
  }
  
  // ✅ v3.3.11: Блокируем одновременные Undo операции
  if (isUndoRedoInProgressRef.current) {
    console.log('⏸️ UNDO: Другая операция Undo/Redo выполняется');
    return; // ✅ Убрали async ожидание - просто блокируем
  }
  
  const state = historyUndo();
  if (!state) {
    console.log('🔄 UNDO: История пуста');
    return;
  }
  
  try {
    isUndoRedoInProgressRef.current = true;
    console.log('🔄 UNDO: ↩️ Мгновенное восстановление из истории');
    
    const previousEvents = events;
    
    // ✅ Находим удалённые события и очищаем pending операции
    const currentIds = new Set(state.events.map(e => e.id));
    const deletedEvents = previousEvents.filter(e => !currentIds.has(e.id));
    
    if (deletedEvents.length > 0) {
      console.log(`🔄 UNDO: Очистка pending для ${deletedEvents.length} удалённых событий`);
      deletedEvents.forEach(event => {
        cancelPendingChange(event.id); // ✅ Убираем из debounced queue
      });
    }
    
    // ✅ Мгновенно восстанавливаем state
    setEvents(state.events);
    setEventZOrder(state.eventZOrder);
    setProjects(state.projects);
    
    console.log(`🔄 UNDO: ✅ Восстановлено ${state.events.length} событий`);
    
    // ✅ Блокируем polling на 2 секунды
    resetDeltaSyncTimer();
    resetProjectsSyncTimer();
    resetResourcesSyncTimer();
    resetDepartmentsSyncTimer();
    
    // ✅ Синхронизируем с сервером АСИНХРОННО (в фоне)
    // Это не блокирует UI - пользователь уже видит результат Undo
    Promise.all([
      syncRestoredEventsToServer(state.events, updateHistoryEventId),
      syncDeletedEventsToServer(state.events, previousEvents)
    ]).catch(err => {
      console.error('🔄 UNDO: ❌ Ошибка синхронизации:', err);
    });
    
  } finally {
    isUndoRedoInProgressRef.current = false;
  }
}, [
  historyUndo, 
  events, 
  setEvents, 
  setEventZOrder,
  setProjects,
  hasPendingOperations, 
  cancelPendingChange,
  resetDeltaSyncTimer,
  resetProjectsSyncTimer,
  resetResourcesSyncTimer,
  resetDepartmentsSyncTimer,
  syncRestoredEventsToServer,
  syncDeletedEventsToServer,
  updateHistoryEventId,
  showToast
]);
```

### Шаг 3: Аналогично для handleRedo

Те же изменения что и для `handleUndo`.

### Шаг 4: Добавить saveHistory при удалении

**Найти обработчик удаления события:**
```typescript
const handleDelete = useCallback((id: string) => {
  setEvents(prev => prev.filter(e => e.id !== id));
  
  // ✅ v4.0.0: Явное сохранение истории после удаления
  const newEvents = events.filter(e => e.id !== id);
  saveHistory(newEvents, eventZOrder, projects);
  
  // Удаляем на сервере (в фоне через debounced save)
  deleteEvent(id).catch(err => {
    console.error('❌ Ошибка удаления:', err);
  });
}, [events, setEvents, saveHistory, eventZOrder, projects, deleteEvent]);
```

### Шаг 5: Проверка hasPendingOperations

Убедиться что `hasPendingOperations` проверяет debounced queue:

**Файл:** `/contexts/SchedulerContext.tsx`

```typescript
// ✅ Проверка наличия pending операций
const hasPendingOperations = useCallback((): boolean => {
  // Проверяем debounced save queue
  const pendingCount = getPendingCount(); // from useDebouncedSave
  
  console.log(`🔍 hasPendingOperations: ${pendingCount} pending изменений`);
  
  return pendingCount > 0;
}, [getPendingCount]);
```

## Проверочный список

### ✅ Перед миграцией:
- [ ] Закоммитить текущее состояние
- [ ] Создать ветку `feature/local-first-v4`
- [ ] Прочитать `/UNDO_REDO_LOCAL_FIRST_v4.0.0.md`

### ✅ Во время миграции:
- [ ] Удалить автосохранение истории (Шаг 1)
- [ ] Убрать flushPendingChanges из handleUndo (Шаг 2)
- [ ] Убрать flushPendingChanges из handleRedo (Шаг 3)
- [ ] Добавить saveHistory при удалении (Шаг 4)
- [ ] Проверить hasPendingOperations (Шаг 5)

### ✅ После миграции:
- [ ] Тест: Создать событие → Undo
- [ ] Тест: Drag событие → Undo
- [ ] Тест: Быстрый drag → сразу Undo (< 500ms) → должен показать Toast
- [ ] Тест: 10 быстрых Undo подряд
- [ ] Тест: Drag → Undo → Redo → Undo → Redo
- [ ] Тест: Polling во время Undo
- [ ] Обновить Guidelines.md
- [ ] Обновить CHANGELOG.md
- [ ] Создать `/RELEASE_NOTES_v4.0.0.md`

## Ожидаемые улучшения

### Производительность
- **Undo/Redo:** ~1ms вместо 500ms+ (нет ожидания flush)
- **История:** меньше записей (нет промежуточных состояний)

### UX
- **Мгновенный Undo/Redo** - без задержек
- **Предсказуемое поведение** - только финальные состояния в истории
- **Защита от критикалов** - невозможно удалить все события

### Код
- **Меньше async** - проще отлаживать
- **Меньше race conditions** - явное сохранение истории
- **Проще логика** - нет автосохранения

## Откат миграции

Если что-то пойдёт не так:

```bash
git checkout main
git branch -D feature/local-first-v4
```

Либо восстановить автосохранение из коммита перед миграцией.

## Следующие шаги после v4.0.0

1. **Уменьшить debounce delay:** 500ms → 200ms
   - Меньше задержка "Подождите" при быстром Undo
   - Быстрее синхронизация с сервером

2. **Оптимизировать Delta Sync:** 4 секунды → 2 секунды
   - Быстрее получение изменений от других пользователей

3. **Добавить индикатор pending операций**
   - Визуально показывать что есть несохранённые изменения
   - Иконка "синхронизация" в тулбаре

**Версия документа:** v4.0.0 (2025-11-25)
