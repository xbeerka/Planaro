# Проблема дублирования Presence Endpoints

## Обнаруженная проблема

В файле `/supabase/functions/server/index.tsx` есть **ДУБЛИРУЮЩИЕСЯ** presence endpoints:

### Старая группа (строки 3409-3543) - НУЖНО УДАЛИТЬ
```typescript
// ==================== PRESENCE ENDPOINTS ====================
app.post("/make-server-73d66528/presence/heartbeat", ...)
app.delete("/make-server-73d66528/presence/leave/:workspaceId", ...)
app.post("/make-server-73d66528/presence/online-batch", ...)
```

### Новая группа (строки 3702-3920) - АКТУАЛЬНАЯ ВЕРСИЯ
```typescript
// ==================== PRESENCE ENDPOINTS ====================
app.post("/make-server-73d66528/presence/heartbeat", ...) // ✅ Актуальная версия
app.get("/make-server-73d66528/presence/online/:workspaceId", ...) // ✅ Новый endpoint
app.post("/make-server-73d66528/presence/online-batch", ...) // ✅ Актуальная версия
app.delete("/make-server-73d66528/presence/leave/:workspaceId", ...) // ✅ Актуальная версия
```

## Решение

### Автоматическое исправление (рекомендуется)

Удалите строки 3409-3545 в файле `/supabase/functions/server/index.tsx`:

1. Откройте файл `/supabase/functions/server/index.tsx`
2. Найдите строку 3409: `// ==================== PRESENCE ENDPOINTS ====================`
3. Удалите все строки от 3409 до 3545 (включительно)
4. Сохраните файл
5. Задеплойте функцию: `supabase functions deploy make-server-73d66528`

### Что удалить

```typescript
// ⚠️ УДАЛИТЬ ЭТО:

// ==================== PRESENCE ENDPOINTS ====================

// Send heartbeat - mark user as online in workspace
app.post("/make-server-73d66528/presence/heartbeat", async (c) => {
  // ... старая реализация ...
});

// Leave workspace - remove user from online list
app.delete("/make-server-73d66528/presence/leave/:workspaceId", async (c) => {
  // ... старая реализация ...
});

// Get online users for multiple workspaces (batch request)
app.post("/make-server-73d66528/presence/online-batch", async (c) => {
  // ... старая реализация ...
});

// УДАЛЕНО: Дубликат endpoint'а - см. строку 3355 для актуальной версии
```

## Почему это проблема?

В Hono (web framework) при регистрации дублирующихся маршрутов **последний перезаписывает предыдущий**.  

Хотя это не вызывает ошибок, дубликаты:
1. Увеличивают размер файла
2. Усложняют поддержку кода
3. Могут привести к путанице при отладке

## После исправления

1. Файл станет на ~136 строк короче
2. Будут использоваться только актуальные версии endpoints
3. Развертывание станет быстрее

## Важно

**НЕ УДАЛЯЙТЕ** вторую группу presence endpoints (строки 3702-3920) - это актуальная рабочая версия!
