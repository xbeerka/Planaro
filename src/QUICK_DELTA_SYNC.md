# ⚡ Delta Sync - Быстрая шпаргалка

**TL;DR**: События синхронизируются каждые 4 секунды, удаления обнаруживаются через 30 секунд.

---

## 🎯 Интервалы

```javascript
DELTA_SYNC: 4 секунды   // ⚡ Быстро! Только изменённые
FULL_SYNC:  30 секунд   // 🔄 Для обнаружения удалений
```

---

## 📡 Endpoints

### Delta Sync (каждые 4 сек)
```
GET /events/changes?workspace_id=X&since=ISO_TIMESTAMP

Response:
{
  events: [...],           // Только изменённые после since
  timestamp: "ISO_STRING"  // Для следующего запроса
}
```

### Full Sync (каждые 30 сек)
```
GET /events?workspace_id=X

Response: SchedulerEvent[]  // Все события
```

---

## 🛡️ Защиты

### 1. Блокировка при drag/drop
```javascript
if (isUserInteracting) return; // ⏸️ Пропуск
```

### 2. Блокировка после изменений
```javascript
if (Date.now() - lastLocalChangeRef.current < 2000) return; // ⏸️ 2 сек
```

### 3. Защита от "воскрешения"
```javascript
const filtered = events.filter(e => 
  !deletedEventIdsRef.current.has(e.id)
);
```

---

## 📊 Нагрузка

```
Delta Sync:  15 req/min
Full Sync:   2 req/min
────────────────────────
ИТОГО:      17 req/min
```

---

## 🔍 Отладка

### Логи в консоли
```
📥 Delta Sync: получено N изменений     ← Есть изменения
✅ Delta Sync: применено N изменений

⏸️ Delta Sync: пропуск (пользователь взаимодействует)
⏸️ Delta Sync: пропуск (недавнее локальное изменение)

🔄 Full Sync: загрузка ВСЕХ событий
🗑️ Full Sync: обнаружено N удалённых событий
✅ Full Sync: загружено N событий
```

### Network Tab
```
Фильтр: /events/changes

Должно быть:
- ~15 запросов в минуту (каждые 4 сек)
- Параметр `since` увеличивается с каждым запросом
```

---

## 🐛 Проблемы?

| Симптом | Причина | Решение |
|---------|---------|---------|
| Задержка > 10 сек | Неправильный интервал | Проверь `DELTA_SYNC_INTERVAL = 4000` |
| "Мигание" событий | Нет защиты | Проверь `lastLocalChangeRef` |
| "Воскрешение" | Нет фильтрации | Проверь `deletedEventIdsRef` |
| Drag не работает | Нет блокировки | Проверь `isUserInteracting` |

---

## 📁 Файлы

- **Логика**: `/contexts/SchedulerContext.tsx` (строки 486-609)
- **API**: `/services/api/events.ts` - `getChanges()`
- **Сервер**: `/supabase/functions/server/index.tsx` - `/events/changes`

---

## 🎉 Готово!

**Delta Sync v3.3.0 работает из коробки. Просто открой воркспейс!** ⚡
