# Delta Sync - Настройки синхронизации

## ⚙️ Текущие параметры (2025-11-17)

### Debounced Save (накопление изменений)
```typescript
const DEBOUNCE_DELAY = 2000; // 2 секунды
```

**Как работает:**
1. Пользователь перетаскивает/изменяет событие → **мгновенно** видно локально
2. Таймер ждёт **2 секунды** бездействия
3. Если продолжаешь двигать → таймер сбрасывается
4. Через 2 секунды → **BATCH запрос** на сервер (все накопленные изменения)

**Преимущества:**
- ⚡ Мгновенный UI (0ms задержка)
- 📦 Пакетное сохранение (1 запрос вместо N)
- 🔄 Оптимистичное обновление (локальный state = источник истины)

---

### Delta Sync (автоматическая синхронизация)
```typescript
const SYNC_INTERVAL = 4000; // 4 секунды
```

**Как работает:**
1. Загружаются **ТОЛЬКО изменённые** события с сервера
2. Первый sync через **4 секунды** после загрузки
3. Периодический sync каждые **4 секунды**
4. Пропускается если:
   - Пользователь взаимодействует с событиями (`isUserInteracting = true`)
   - Было локальное изменение < 2 секунд назад

**Endpoint:**
```typescript
GET /events/changes?workspace_id={id}&since={timestamp}
```

**Преимущества:**
- 📉 Трафик снижен в ~100 раз (вместо 500 событий → 2-5 изменённых)
- ⚡ Быстрая синхронизация между пользователями (4 секунды)
- 🛡️ Защита от конфликтов (пропуск во время взаимодействия)

---

## 🔍 Логирование

### Debounced Save
```
⏳ Добавление обновления в debounced queue: e36937
📦 BATCH: отправка 1 изменений на сервер...
📦 BATCH: отправляемые данные: [{ id, resourceId, startWeek, unitStart }]
📦 BATCH: response status: 200
✅ BATCH: успешно сохранено 1 событий
📦 BATCH: возвращённые данные с сервера: [...]
⏭️ BATCH: пропускаем обновление state (локальное состояние актуальнее)
```

### Delta Sync
```
🔄 Delta Sync: загрузка изменений... { since: "2025-11-17T..." }
📥 Delta Sync: получено 5 изменений
✅ Delta Sync: применено 5 изменений
```

---

## 📊 Производительность

### Сценарий использования:

**1 пользователь активно работает:**
- Во время drag: ~1-2 запроса/сек (debounced save)
- После завершения: ~1 запрос/2 сек (finalize save)
- В фоне: ~15 запросов/мин (delta sync)

**1 пользователь просматривает:**
- Только delta sync: ~15 запросов/мин

**Трафик:**
- ДО delta sync: ~500 событий × 15 req/min = 7500 событий/мин
- ПОСЛЕ delta sync: ~2-5 событий × 15 req/min = 30-75 событий/мин
- **Снижение трафика: ~100x** 🚀

---

## 🐛 Известные исправления

### Batch Update не обновлял resourceId (ИСПРАВЛЕНО 2025-11-17)

**Проблема:**
Сервер игнорировал поле `resourceId` при batch update → события "уезжали" на неправильного сотрудника.

**Исправление:**
```typescript
// /supabase/functions/server/index.tsx
if (body.resourceId !== undefined) {
  updateData.user_id = parseInt(body.resourceId.replace('r', ''));
}
```

**Дополнительно:**
- Убрано перезаписывание state данными с сервера
- Локальный state = источник истины (оптимистичное обновление)
- Добавлено детальное логирование для отладки

---

## 🔧 Файлы для изменения настроек

### Frontend (SchedulerContext.tsx)
```typescript
// Debounced Save
const { queueChange: queueEventUpdate, flush: flushPendingUpdates } = useDebouncedSave(
  async (changes: Map<string, Partial<SchedulerEvent>>) => { ... },
  2000 // ⏱️ Debounce delay
);

// Delta Sync
const SYNC_INTERVAL = 4000; // ⚡ Интервал синхронизации
```

### Backend (index.tsx)
```typescript
// Batch Update endpoint
app.post("/make-server-73d66528/events/batch", async (c) => {
  // Обработка update операций
  if (body.resourceId !== undefined) {
    updateData.user_id = parseInt(body.resourceId.replace('r', ''));
  }
  // ...
});

// Delta Sync endpoint
app.get("/make-server-73d66528/events/changes", async (c) => {
  // Возвращает только изменённые события
  const since = c.req.query('since');
  // ...
});
```

---

**Версия документа:** 1.0  
**Последнее обновление:** 2025-11-17  
**Авторы:** Resource Scheduler Team
