# ⚡ Интервалы синхронизации - Справочник

**Версия**: 3.3.0  
**Дата**: 2025-11-18

---

## 📋 Таблица интервалов

| Тип данных | Интервал | Метод | Комментарий |
|------------|----------|-------|-------------|
| **События (Delta)** | **4 сек** ⚡ | Delta Sync | Только изменённые события с timestamp |
| **События (Full)** | **30 сек** 🔄 | Full Sync | Все события + обнаружение удалений |
| **Проекты** | 15 сек | Full Sync | Полная синхронизация |
| **Сотрудники** | 15 сек | Full Sync | Полная синхронизация |
| **Департаменты** | 15 сек | Full Sync | Полная синхронизация |

---

## 🎯 События - Delta Sync (БЫСТРО!)

### Константы
```javascript
const DELTA_SYNC_INTERVAL = 4000;   // ⚡ 4 секунды
const FULL_SYNC_INTERVAL  = 30000;  // 🔄 30 секунд
```

### Алгоритм
```javascript
fullSyncCounter++;
const isFullSync = fullSyncCounter * DELTA_SYNC_INTERVAL >= FULL_SYNC_INTERVAL;

if (isFullSync) {
  // Раз в 30 секунд: Full Sync
  fullSyncCounter = 0;
  const allEvents = await eventsApi.getAll(accessToken, workspaceId);
  // ... merge + detect deletions
} else {
  // Каждые 4 секунды: Delta Sync
  const { events, timestamp } = await eventsApi.getChanges(
    accessToken,
    workspaceId,
    lastSyncTimestampRef.current
  );
  // ... merge changes
}
```

### Endpoint
```
GET /events/changes?workspace_id=X&since=2025-11-18T10:30:00.000Z

Response:
{
  events: [...], // Только изменённые события
  timestamp: "2025-11-18T10:30:15.000Z"
}
```

---

## 📊 Проекты - Full Sync (15 секунд)

### Константа
```javascript
const PROJECTS_SYNC_INTERVAL = 15000; // 15 секунд
```

### Алгоритм
```javascript
const serverProjects = await projectsApi.getAll(accessToken, workspaceId);

setProjects(prev => {
  const hasChanges = JSON.stringify(prev) !== JSON.stringify(serverProjects);
  if (hasChanges) {
    // Обновляем state и кэш
    return serverProjects;
  }
  return prev;
});
```

---

## 👥 Сотрудники - Full Sync (15 секунд)

### Константа
```javascript
const RESOURCES_SYNC_INTERVAL = 15000; // 15 секунд
```

### Алгоритм
```javascript
const serverResources = await resourcesApi.getAll(accessToken, workspaceId);

setResources(prev => {
  const hasChanges = JSON.stringify(prev) !== JSON.stringify(serverResources);
  if (hasChanges) {
    // Обновляем state и кэш
    return serverResources;
  }
  return prev;
});
```

---

## 🏢 Департаменты - Full Sync (15 секунд)

### Константа
```javascript
const DEPARTMENTS_SYNC_INTERVAL = 15000; // 15 секунд
```

### Алгоритм
```javascript
const serverDepartments = await departmentsApi.getAll(accessToken, workspaceId);

setDepartments(prev => {
  const hasChanges = JSON.stringify(prev) !== JSON.stringify(serverDepartments);
  if (hasChanges) {
    // Обновляем state и кэш
    return serverDepartments;
  }
  return prev;
});
```

---

## 🛡️ Защита от конфликтов

### 1. Блокировка при взаимодействии пользователя
```javascript
if (isUserInteracting) {
  console.log('⏸️ Sync: пропуск (пользователь взаимодействует)');
  return;
}
```

### 2. Пропуск после локальных изменений
```javascript
const timeSinceLastChange = Date.now() - lastLocalChangeRef.current;
if (timeSinceLastChange < 2000) {
  console.log('⏸️ Sync: пропуск (недавнее локальное изменение)');
  return;
}
```

### 3. Защита от "воскрешения" удалённых
```javascript
const deletedEventIdsRef = useRef<Set<string>>(new Set());

// При удалении
deleteEvent(id) {
  deletedEventIdsRef.current.add(id);
}

// При синхронизации
const filtered = merged.filter(event => 
  !deletedEventIdsRef.current.has(event.id)
);
```

---

## 📈 Нагрузка на сервер

### События
```
Delta Sync:  15 req/min (каждые 4 сек)
Full Sync:   2 req/min (каждые 30 сек)
ИТОГО:      17 req/min
```

### Другие данные
```
Проекты:      4 req/min (каждые 15 сек)
Сотрудники:   4 req/min (каждые 15 сек)
Департаменты: 4 req/min (каждые 15 сек)
ИТОГО:       12 req/min
```

### Общая нагрузка на пользователя
```
События:      17 req/min
Другие:       12 req/min
──────────────────────────
ВСЕГО:        29 req/min  (умеренная нагрузка)
```

---

## 🎯 Когда использовать Delta vs Full Sync

### Delta Sync (БЫСТРО!)
✅ **Когда использовать:**
- Данные меняются очень часто (события)
- Важна минимальная задержка (<5 секунд)
- Можно определить "изменённые с момента X"
- Есть `updated_at` или подобное поле в БД

❌ **Когда НЕ использовать:**
- Данные меняются редко
- Нужно обнаруживать удаления быстро
- Нет возможности фильтровать по timestamp

### Full Sync (СТАНДАРТ)
✅ **Когда использовать:**
- Данные меняются редко (проекты, сотрудники)
- Важно обнаруживать удаления
- Простой endpoint `getAll()`
- Небольшой объём данных (<1000 записей)

❌ **Когда НЕ использовать:**
- Большой объём данных (>10000 записей)
- Данные меняются очень часто
- Нужна минимальная задержка

---

## 📚 См. также

- `/DELTA_SYNC_v3.3.0.md` - Полная документация Delta Sync
- `/SIMPLE_POLLING_READY.md` - Документация Simple Polling
- `/guidelines/Guidelines.md` - Общее руководство
- `/CHANGELOG.md` - История изменений
