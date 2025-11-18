# ⚡ Delta Sync - Быстрая синхронизация событий

> **v3.3.0** - Восстановлена быстрая синхронизация (4 секунды вместо 10-30 секунд)

---

## 🎯 Что это?

**Delta Sync** - умная система автоматической синхронизации событий между пользователями.

### Ключевые особенности
- ⚡ **Быстро**: изменения появляются через 4 секунды
- 📉 **Эффективно**: передаются только изменённые события
- 🛡️ **Безопасно**: защита от конфликтов при drag/drop
- 🔄 **Надёжно**: обнаружение удалений через Full Sync

---

## 🚀 Как это работает?

```
┌─────────────────┐
│  Пользователь A │  Создаёт/изменяет событие
└────────┬────────┘
         │
         ▼
    ┌────────┐
    │  База  │  Событие сохраняется + updated_at
    └────┬───┘
         │
         ▼ (4 сек)
┌─────────────────┐
│  Пользователь B │  Delta Sync получает изменение → UI обновляется
└─────────────────┘
```

### Алгоритм
1. **Каждые 4 секунды**: Delta Sync запрашивает только изменённые события
2. **Каждые 30 секунд**: Full Sync загружает все события (обнаружение удалений)
3. **При drag/drop**: синхронизация блокируется (нет конфликтов)
4. **После изменений**: 2 секунды пропуска (нет "мигания")

---

## 📊 Производительность

| Метрика | Значение | Комментарий |
|---------|----------|-------------|
| Задержка Delta Sync | 4-6 сек | ⚡ Быстро! |
| Задержка Full Sync | 30-35 сек | 🔄 Удаления |
| Запросов в минуту | ~17 req/min | 📈 Умеренная нагрузка |
| Трафик Delta Sync | 1-10 KB | 📉 Только изменённые |
| Трафик Full Sync | 10-100 KB | 📦 Все события |

### Сравнение с предыдущей версией

| | v1.9.4 (старое) | v3.3.0 (новое) | Улучшение |
|-|-----------------|----------------|-----------|
| Задержка | 10-30 сек | 4-6 сек | **5x быстрее** ⚡ |
| Интервал | Динамический | Фиксированный 4 сек | Стабильнее |
| Full Sync | 60 сек | 30 сек | **2x быстрее** |
| Нагрузка | 6-10 req/min | 17 req/min | ~2x выше (OK) |

---

## 🛠️ Техническая реализация

### Frontend (`/contexts/SchedulerContext.tsx`)

```javascript
// Интервалы
const DELTA_SYNC_INTERVAL = 4000;   // ⚡ 4 секунды
const FULL_SYNC_INTERVAL  = 30000;  // 🔄 30 секунд

// Delta Sync
const { events, timestamp } = await eventsApi.getChanges(
  accessToken,
  workspaceId,
  lastSyncTimestampRef.current  // Только изменённые после timestamp
);

// Full Sync (каждые 30 секунд)
const allEvents = await eventsApi.getAll(accessToken, workspaceId);
```

### Backend (`/supabase/functions/server/index.tsx`)

```javascript
// Delta Sync endpoint
app.get("/make-server-73d66528/events/changes", async (c) => {
  const since = c.req.query('since'); // ISO timestamp
  
  const query = since
    ? 'SELECT * FROM events WHERE workspace_id = $1 AND updated_at > $2'
    : 'SELECT * FROM events WHERE workspace_id = $1';
  
  const { rows } = await db.query(query, [workspaceId, since]);
  
  return c.json({
    events: rows,
    timestamp: new Date().toISOString()  // Для следующего запроса
  });
});
```

### API Client (`/services/api/events.ts`)

```javascript
export const eventsApi = {
  getChanges: (token: string, workspaceId: string, since?: string) => {
    const endpoint = since 
      ? `/events/changes?workspace_id=${workspaceId}&since=${since}`
      : `/events/changes?workspace_id=${workspaceId}`;
    
    return apiRequest<{ events: SchedulerEvent[]; timestamp: string }>(
      endpoint, 
      { token }
    );
  }
};
```

---

## 🛡️ Защиты

### 1. Блокировка при взаимодействии
```javascript
if (isUserInteracting) {
  console.log('⏸️ Delta Sync: пропуск (пользователь взаимодействует)');
  return;
}
```

### 2. Блокировка после локальных изменений
```javascript
const timeSinceLastChange = Date.now() - lastLocalChangeRef.current;
if (timeSinceLastChange < 2000) {
  console.log('⏸️ Delta Sync: пропуск (недавнее локальное изменение)');
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
const filtered = events.filter(e => 
  !deletedEventIdsRef.current.has(e.id)
);
```

---

## 📚 Документация

### Основная документация
- **`/DELTA_SYNC_v3.3.0.md`** - Полная документация с деталями реализации
- **`/QUICK_DELTA_SYNC.md`** - Быстрая шпаргалка для разработчиков
- **`/TEST_DELTA_SYNC.md`** - Руководство по тестированию
- **`/SYNC_INTERVALS_CHEATSHEET.md`** - Справочник по всем интервалам

### Связанная документация
- **`/guidelines/Guidelines.md`** - Общее руководство (раздел "Delta Sync v3.3.0")
- **`/CHANGELOG.md`** - История изменений (запись v3.3.0)
- **`/SIMPLE_POLLING_READY.md`** - Старая документация Simple Polling

---

## 🧪 Быстрое тестирование

```bash
# 1. Открой воркспейс в двух браузерах (разные пользователи)

# 2. Пользователь A: создай событие

# 3. Пользователь B: консоль → должно появиться через 4 сек:
📥 Delta Sync: получено 1 изменений
✅ Delta Sync: применено 1 изменений

# 4. Пользователь A: удали событие

# 5. Пользователь B: через 30 сек:
🔄 Full Sync: загрузка ВСЕХ событий
🗑️ Full Sync: обнаружено 1 удалённых событий
```

**Если работает → Delta Sync v3.3.0 настроен правильно!** ✅

---

## 🐛 Troubleshooting

### Задержка > 10 секунд
```bash
# Проверь интервал в /contexts/SchedulerContext.tsx
const DELTA_SYNC_INTERVAL = 4000;  // Должно быть 4000!
```

### "Мигание" событий
```bash
# Проверь защиту в /contexts/SchedulerContext.tsx
if (timeSinceLastChange < 2000) return;  // Должна быть проверка!
```

### "Воскрешение" удалённых событий
```bash
# Проверь фильтрацию в deleteEvent()
deletedEventIdsRef.current.add(id);  // Должно добавляться!
```

---

## 🎉 Готово!

**Delta Sync v3.3.0 работает из коробки.**  
Просто открой воркспейс и наслаждайся быстрой синхронизацией! ⚡

---

## 📞 Поддержка

- **Проблемы?** Проверь `/TEST_DELTA_SYNC.md`
- **Вопросы?** Читай `/DELTA_SYNC_v3.3.0.md`
- **Быстрая справка?** Открой `/QUICK_DELTA_SYNC.md`

**Версия**: 3.3.0  
**Дата**: 2025-11-18  
**Статус**: ✅ РАБОТАЕТ
