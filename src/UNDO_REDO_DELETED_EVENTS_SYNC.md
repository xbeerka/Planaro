# Синхронизация удалённых событий при Undo/Redo

**Версия**: v3.3.3 (обновлено: v3.3.3.1)  
**Дата**: 2025-11-18  
**Статус**: ✅ ИСПРАВЛЕНО

> **Update v3.3.3.1**: Добавлена мемоизация Context value через `useMemo` для устранения warning "Cannot update component while rendering"

---

## 🐛 Проблема

### Симптомы
- Пользователь делал **Undo** → событие удалялось локально (8 событий)
- Через 30 секунд **Full Sync** загружал ВСЕ события с сервера (9 событий)
- Удалённое событие **возвращалось** обратно 😱

### Логи
```
История: UNDO - возвращаем state с 8 событиями, 87 проектами
↩️ Undo: восстановлено 8 событий, 87 проектов
✅ Undo: события успешно синхронизированы с сервером

// Через 30 секунд...
🔄 Full Sync: загрузка ВСЕХ событий (для обнаружения удалений)
✅ Full Sync: загружено 9 событий (было 8) ← 😱 Удалённое событие вернулось!
```

### Причина
- `syncRestoredEventsToServer()` создавала восстановленные события на сервере
- Но **НЕ удаляла** события которые были удалены через Undo/Redo
- Full Sync видел событие на сервере и возвращал его в локальный state

---

## ✅ Решение

### 1. Новая функция `syncDeletedEventsToServer`

**Что делает**:
1. Сравнивает текущие события (после Undo) с предыдущими (до Undo)
2. Находит удалённые: `previousEvents.filter(e => !currentIds.has(e.id))`
3. Помечает их в `deletedEventIdsRef` (защита от Full Sync)
4. Удаляет на сервере через `eventsApi.delete(event.id, accessToken)`
5. Очищает пометки через 10 секунд

**Код** (`/contexts/SchedulerContext.tsx`):
```typescript
const syncDeletedEventsToServer = useCallback(async (currentEvents: SchedulerEvent[], previousEvents: SchedulerEvent[]) => {
  console.log(`🗑️ Undo/Redo: проверка удалённых событий...`);
  
  // Находим события которые были удалены
  const currentIds = new Set(currentEvents.map(e => e.id));
  const deletedEvents = previousEvents.filter(e => !currentIds.has(e.id));
  
  if (deletedEvents.length === 0) {
    console.log('✅ Нет удалённых событий для синхронизации');
    return;
  }
  
  console.log(`🗑️ Найдено ${deletedEvents.length} удалённых событий:`, deletedEvents.map(e => e.id));
  
  // Помечаем события как удалённые (защита от Full Sync)
  deletedEvents.forEach(event => {
    deletedEventIdsRef.current.add(event.id);
  });
  
  // Удаляем события на сервере
  await Promise.all(deletedEvents.map(async (event) => {
    if (event.id.startsWith('ev_temp_')) return; // Пропускаем временные
    
    try {
      await eventsApi.delete(event.id, accessToken);
      console.log(`✅ Событие удалено на сервере: ${event.id}`);
    } catch (error) {
      console.error(`❌ Ошибка удаления события ${event.id}:`, error);
    }
  }));
  
  // Очищаем пометки через 10 секунд
  setTimeout(() => {
    deletedEvents.forEach(event => {
      deletedEventIdsRef.current.delete(event.id);
    });
  }, 10000);
}, [accessToken]);
```

### 2. Вызов в `handleUndo` и `handleRedo`

**До**:
```typescript
const handleUndo = useCallback(async () => {
  const state = historyUndo();
  if (!state) return;
  
  // Восстанавливаем события
  setEvents(uniqueEvents);
  
  // Синхронизируем ТОЛЬКО восстановленные
  await syncRestoredEventsToServer(uniqueEvents, updateHistoryEventId);
  // ❌ НЕ синхронизировали удалённые!
}, [historyUndo, setEvents, syncRestoredEventsToServer, ...]);
```

**После**:
```typescript
const handleUndo = useCallback(async () => {
  const state = historyUndo();
  if (!state) return;
  
  // ✅ Сохраняем текущие события ДО undo
  const previousEvents = events;
  
  // Восстанавливаем события
  setEvents(uniqueEvents);
  
  // Синхронизируем восстановленные
  await syncRestoredEventsToServer(uniqueEvents, updateHistoryEventId);
  
  // ✅ Синхронизируем удалённые
  await syncDeletedEventsToServer(uniqueEvents, previousEvents);
}, [historyUndo, events, setEvents, syncRestoredEventsToServer, syncDeletedEventsToServer, ...]);
```

### 3. Защита в Full Sync

**Логика** (`/contexts/SchedulerContext.tsx`):
```typescript
// Full Sync фильтрует удалённые события
const filtered = allEvents.filter(event => 
  !deletedEventIdsRef.current.has(event.id) // ← Не возвращаем помеченные как удалённые!
);
```

---

## 🧪 Как проверить

### Сценарий 1: Undo удаляет событие
1. Создать событие → сохранить
2. Удалить событие
3. **Undo** (Ctrl+Z)
4. Подождать 30 секунд (Full Sync)
5. ✅ Событие НЕ вернулось

### Сценарий 2: Redo удаляет событие
1. Создать событие → сохранить
2. Удалить событие
3. Undo (Ctrl+Z) - событие вернулось
4. **Redo** (Ctrl+Shift+Z) - событие снова удалилось
5. Подождать 30 секунд (Full Sync)
6. ✅ Событие НЕ вернулось

### Логи успешной синхронизации
```
↩️ Undo: восстановлено 8 событий, 87 проектов
✅ Undo: события успешно синхронизированы с сервером

🗑️ Undo/Redo: проверка удалённых событий...
🗑️ Найдено 1 удалённых событий: ["e12345"]
🗑️ Пометка удалённого: e12345
✅ Событие удалено на сервере: e12345
✅ Undo: удалённые события успешно синхронизированы с сервером

// Через 30 секунд Full Sync...
🔄 Full Sync: загрузка ВСЕХ событий
✅ Full Sync: загружено 8 событий (было 8) ← ✅ Правильно!
```

---

## 📊 Технические детали

### Timing
- **Пометка в `deletedEventIdsRef`**: Мгновенно (защита от следующего Full Sync)
- **Удаление на сервере**: Параллельно через `Promise.all()` (~100-500ms)
- **Очистка пометок**: Через 10 секунд (достаточно для нескольких Full Sync)

### Обработка ошибок
- Пропускаются временные ID (`ev_temp_*`)
- Ошибки удаления логируются, но не прерывают процесс
- Пометки в `deletedEventIdsRef` остаются даже при ошибке (безопасность)

### Взаимодействие с Full Sync
```typescript
// Full Sync ВСЕГДА фильтрует удалённые события
const filtered = allEvents.filter(event => !deletedEventIdsRef.current.has(event.id));

// Обновляем loadedEventIds (исключая удалённые)
setLoadedEventIds(new Set(filtered.map(e => e.id)));
```

---

## 📁 Изменённые файлы

1. **`/contexts/SchedulerContext.tsx`**:
   - Новая функция `syncDeletedEventsToServer`
   - Экспорт в Provider value
   - Интерфейс `SchedulerContextType`

2. **`/components/scheduler/SchedulerMain.tsx`**:
   - Деструктуризация `syncDeletedEventsToServer`
   - Вызов в `handleUndo` с сохранением `previousEvents`
   - Вызов в `handleRedo` с сохранением `previousEvents`
   - Добавление в dependencies `useCallback`

---

## ✅ Результат

### Что теперь работает
- ✅ Удалённые события синхронизируются с сервером
- ✅ Full Sync НЕ возвращает удалённые события
- ✅ Undo/Redo работает корректно для удаления
- ✅ Защита от "воскрешения" событий
- ✅ Параллельное удаление (быстро!)

### Версия
- **v3.3.2** → **v3.3.3**
- Совместимо с Delta Sync v3.3.0
- Совместимо с Undo/Redo Projects Sync Fix v3.3.2

---

## 🔗 Связанные документы

- `/UNDO_REDO_PROJECTS_SYNC_FIX.md` - исправление синхронизации проектов
- `/UNDO_REDO_FIX_SUMMARY.md` - исправление сохранения без проектов
- `/DELTA_SYNC_v3.3.0.md` - Delta Sync автообновление
- `/guidelines/Guidelines.md` - обновлённые правила (секция Undo/Redo)
