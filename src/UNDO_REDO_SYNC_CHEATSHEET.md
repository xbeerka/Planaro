# Undo/Redo Синхронизация - Шпаргалка

## 🎯 Краткое описание

После Undo/Redo **ВСЕ** восстановленные события синхронизируются с сервером:
- ✅ **CREATE** - события которых НЕТ на сервере (удалены другим пользователем)
- ✅ **UPDATE** - события которые ЕСТЬ на сервере (но с устаревшими данными)
- ✅ **DELETE** - события которые были удалены при Undo/Redo

---

## 📋 Три типа синхронизации

### 1️⃣ CREATE (восстановление удаленных)

**Когда**: Событие было удалено на сервере (другим пользователем), но есть в истории

```typescript
// Проверка
const existsOnServer = loadedEventIds.current.has(event.id);
if (!existsOnServer) {
  eventsToCreate.push(event); // ✅ Создать на сервере
}

// Batch операция
{ op: 'create', id: event.id, data: { ...eventData } }
```

**Пример**:
- Пользователь А удалил событие → сохранил
- Пользователь Б сделал Undo → событие восстановилось локально
- **Синхронизация**: CREATE на сервере → событие появилось для всех

---

### 2️⃣ UPDATE (обновление измененных)

**Когда**: Событие было изменено (высота, позиция, проект), потом восстановлено Undo/Redo

```typescript
// Проверка
const existsOnServer = loadedEventIds.current.has(event.id);
if (existsOnServer) {
  eventsToUpdate.push(event); // ✅ Обновить на сервере
}

// Batch операция
{ op: 'update', id: event.id, data: { unitsTall, startWeek, ... } }
```

**Пример**:
- Изменил высоту на 2 units → сохранил
- Сделал Undo → высота вернулась к 1 unit
- **Синхронизация**: UPDATE на сервере → высота 1 unit для всех
- **Full Sync через 30 сек**: загружает правильные данные (1 unit) ✅

---

### 3️⃣ DELETE (удаление при Undo/Redo)

**Когда**: Событие было в истории, но после Undo/Redo его нет

```typescript
// Проверка
const currentIds = new Set(currentEvents.map(e => e.id));
const deletedEvents = previousEvents.filter(e => !currentIds.has(e.id));

// Пометка
deletedEventIdsRef.current.add(event.id);

// Удаление на сервере
await eventsApi.delete(event.id);
```

**Пример**:
- Создал событие → сохранил
- Сделал Undo → событие удалилось локально
- **Синхронизация**: DELETE на сервере → событие удалено для всех
- **Full Sync через 30 сек**: НЕ возвращает удаленное (защита через `deletedEventIdsRef`) ✅

---

## 🔄 Поток выполнения

### Undo/Redo (handleUndo / handleRedo)

```typescript
// 1. Блокировка Delta Sync
resetDeltaSyncTimer(); // 5 секунд

// 2. Блокировка синхронизации проектов
resetProjectsSyncTimer(); // 5 секунд

// 3. Восстановление из истории
setEvents(uniqueEvents);
setProjects(state.projects);

// 4. Синхронизация восстановленных событий (CREATE + UPDATE)
await syncRestoredEventsToServer(uniqueEvents, updateHistoryEventId);

// 5. Синхронизация удаленных событий (DELETE)
await syncDeletedEventsToServer(uniqueEvents, previousEvents);
```

---

## 🛡️ Защита от race conditions

### Блокировки синхронизации (5 секунд)

```typescript
// Delta Sync
resetDeltaSyncTimer(); // lastLocalChangeRef.current = Date.now()

// Проекты
resetProjectsSyncTimer(); // lastProjectsChangeRef.current = Date.now()

// Сотрудники
resetResourcesSyncTimer(); // lastResourcesChangeRef.current = Date.now()

// Департаменты
resetDepartmentsSyncTimer(); // lastDepartmentsChangeRef.current = Date.now()
```

### Таймлайн

```
t=0ms    : Undo → восстановление из истории
t=0ms    : resetDeltaSyncTimer() → блокировка на 5 сек
t=0ms    : syncRestoredEventsToServer() → CREATE + UPDATE
t=0ms    : syncDeletedEventsToServer() → DELETE
t=100ms  : Delta Sync проверяет lastLocalChangeRef (< 5000ms) → ПРОПУСКАЕТСЯ ✅
t=4000ms : Delta Sync проверяет lastLocalChangeRef (< 5000ms) → ПРОПУСКАЕТСЯ ✅
t=5100ms : Delta Sync проверяет lastLocalChangeRef (> 5000ms) → ВЫПОЛНЯЕТСЯ ✅
```

---

## 📊 Производительность

### Batch операции (v3.3.6)

```typescript
// ✅ НОВОЕ: 1 batch запрос
const operations: BatchOperation[] = [
  ...eventsToCreate.map(e => ({ op: 'create', ... })),  // CREATE
  ...eventsToUpdate.map(e => ({ op: 'update', ... }))   // UPDATE
];

// 1 запрос вместо N последовательных
await fetch('/events/batch', { body: JSON.stringify({ operations }) });
```

### Логи

```javascript
📦 BATCH: всего операций для отправки: 7
📦 BATCH: 2 create + 5 update
✅ BATCH CREATE: создано 2 событий на сервере
✅ BATCH UPDATE: обновлено 5 событий на сервере
```

---

## 🐛 Исправленные проблемы

### v3.3.1: История без проектов
- **Проблема**: `saveHistory()` сохраняла события без проектов
- **Решение**: защита в `saveHistory()` - блокирует если `events.length > 0 && projects.length === 0`

### v3.3.2: Синхронизация проектов
- **Проблема**: Full Sync перезаписывал проекты после Undo/Redo
- **Решение**: `resetProjectsSyncTimer()` блокирует на 5 секунд

### v3.3.3: Удаленные события возвращались
- **Проблема**: Full Sync возвращал удаленные события
- **Решение**: `syncDeletedEventsToServer()` помечает и удаляет на сервере

### v3.3.5: Drag/Resize не синхронизировались
- **Проблема**: Delta Sync перезаписывал локальные изменения
- **Решение**: `resetDeltaSyncTimer()` в `useEventInteractions.ts`

### v3.3.6: Измененные события возвращались
- **Проблема**: Full Sync возвращал измененные события (высота, позиция)
- **Решение**: `syncRestoredEventsToServer()` теперь делает CREATE + UPDATE

---

## 🔍 Диагностика

### Правильные логи (v3.3.6)

```javascript
// ✅ UNDO
↩️ Undo: МГНОВЕННОЕ восстановление из истории
⏸️ Undo: сброс таймера дельта-синка (блокировка на 5 сек)
🔒 Undo: синхронизация проектов заблокирована на 5 секунд
🔄 Undo/Redo: синхронизация восстановленных событий с сервером...
🔄 Событие X не найдено на сервере, нужно создать
🔄 Событие Y найдено на сервере, нужно обновить
📦 BATCH: 1 create + 1 update
✅ BATCH CREATE: создано 1 событий на сервере
✅ BATCH UPDATE: обновлено 1 событий на сервере

// ✅ REDO
↪️ Redo: МГНОВЕННОЕ восстановление из истории
⏸️ Redo: сброс таймера дельта-синка (блокировка на 5 сек)
🔒 Redo: синхронизация проектов заблокирована на 5 секунды
```

### Неправильные логи (v3.3.5 и старше)

```javascript
// ❌ СТАРАЯ ВЕРСИЯ
✅ Все восстановленные события уже существуют на сервере
// ^ ОШИБКА! События ЕСТЬ на сервере, но с УСТАРЕВШИМИ данными!
```

---

## 📚 Документация

### Детальные описания
- `/UNDO_REDO_MODIFIED_EVENTS_FIX.md` - v3.3.6 (измененные события)
- `/UNDO_REDO_DELETED_EVENTS_SYNC.md` - v3.3.3 (удаленные события)
- `/UNDO_REDO_PROJECTS_SYNC_FIX.md` - v3.3.2 (проекты)
- `/UNDO_REDO_FIX_SUMMARY.md` - v3.3.1 (история без проектов)

### Тестирование
- `/TEST_UNDO_REDO_v3.3.6.md` - тест-кейсы для v3.3.6

### Изменения
- `/CHANGELOG.md` - все версии
- `/guidelines/Guidelines.md` - правила синхронизации

---

**Версия**: v3.3.6  
**Дата**: 2025-11-18  
**Статус**: ✅ Все проблемы решены
