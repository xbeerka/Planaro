# WORKER_LIMIT Error Fix - Request Throttling System

## Проблема

```
❌ API Error 546: {"code":"WORKER_LIMIT","message":"Function failed due to not having enough compute resources"}
```

**Причина**: Edge Function исчерпал вычислительные ресурсы из-за слишком большого количества одновременных запросов.

### Источники перегрузки

1. **Delta Sync** - каждые 4 секунды (события)
2. **Full Sync** - каждые 30 секунд (события)
3. **Projects Sync** - каждые 15 секунд
4. **Resources Sync** - каждые 15 секунд
5. **Departments Sync** - каждые 15 секунд
6. **Online Users Sync** - каждые 30 секунд (несколько компонентов)
7. **Batch Online Users** - каждые 15 секунд (WorkspaceListScreen)
8. **Heartbeat** - каждые 30 секунд
9. **Auth Refresh** - каждые 10 минут

**Итого**: ~29 запросов/минуту для ОДНОГО пользователя.

При множественных вкладках или некорректном размонтировании компонентов это могло привести к **сотням одновременных запросов**.

---

## Решение

### 1. Request Throttle System

Файл: `/utils/requestThrottle.ts`

**Ограничения:**
- Максимум 10 одновременных запросов
- Минимум 1 секунда между одинаковыми запросами
- Автоматическая очистка устаревших запросов (>30 секунд)

**Использование:**

```typescript
import { throttledRequest } from '../utils/requestThrottle';

const result = await throttledRequest(
  'events-sync-workspace-123',
  () => eventsApi.getAll(accessToken, workspaceId)
);

if (!result) {
  console.warn('⚠️ Запрос пропущен (throttle)');
  return;
}
```

### 2. Request Monitor

Файл: `/utils/requestMonitor.ts`

**Мониторинг:**
- Логирование всех запросов
- Подсчёт запросов за последнюю минуту
- Предупреждения при превышении 50 req/min

**Автоматический отчет в dev режиме** (каждые 60 секунд):

```
📊 REQUEST MONITOR REPORT (последняя минута):
   Всего запросов: 28
   ✅ events-delta-sync-123: 15 req/min
   ✅ projects-sync-123: 4 req/min
   ✅ resources-sync-123: 4 req/min
   ✅ departments-sync-123: 4 req/min
   ⚠️ presence-batch-all-workspaces: 52 req/min
```

### 3. Debug Commands

Файл: `/utils/debugCommands.ts`

**Доступные команды в консоли браузера:**

```javascript
// Показать статистику запросов
debugRequests();

// Показать активные throttled запросы
debugThrottle();

// Показать справку
debugHelp();
```

---

## Защищенные endpoints

### SchedulerContext (события, проекты, сотрудники, департаменты)

```typescript
// Delta Sync (каждые 4 секунды)
await throttledRequest(
  `events-delta-sync-${workspaceId}`,
  () => eventsApi.getChanges(...)
);

// Full Sync (каждые 30 секунд)
await throttledRequest(
  `events-full-sync-${workspaceId}`,
  () => eventsApi.getAll(...)
);

// Projects Sync (каждые 15 секунд)
await throttledRequest(
  `projects-sync-${workspaceId}`,
  () => projectsApi.getAll(...)
);

// Resources Sync (каждые 15 секунд)
await throttledRequest(
  `resources-sync-${workspaceId}`,
  () => resourcesApi.getAll(...)
);

// Departments Sync (каждые 15 секунд)
await throttledRequest(
  `departments-sync-${workspaceId}`,
  () => departmentsApi.getAll(...)
);
```

### OnlineUsers Component

```typescript
// Fetch online users (каждые 30 секунд)
await throttledRequest(
  `presence-fetch-${workspaceId}`,
  () => presenceApi.getOnlineUsers(workspaceId)
);
```

### WorkspaceListScreen

```typescript
// Batch online users (каждые 15 секунд)
await throttledRequest(
  'presence-batch-all-workspaces',
  () => presenceApi.getOnlineUsersBatch(workspaceIds)
);
```

---

## Тестирование

### 1. Проверка throttling

Откройте консоль браузера:

```javascript
// Посмотреть статистику запросов
debugRequests();

// Ожидаемый результат:
// ✅ events-delta-sync-123: 15 req/min (норма)
// ✅ projects-sync-123: 4 req/min (норма)
// ⚠️ Если видите > 50 req/min - проблема!
```

### 2. Проверка активных запросов

```javascript
// Посмотреть сколько запросов выполняется прямо сейчас
debugThrottle();

// Ожидаемый результат:
// Активных запросов: 2 / 10 (MAX_CONCURRENT)
// ✅ Нормально: < 8
// ⚠️ Проблема: >= 8
```

### 3. Проверка логов

Проверьте консоль на наличие предупреждений:

```
⚠️ Throttle: Превышен лимит одновременных запросов (10/10)
⚠️ Throttle: Пропуск дубликата "events-sync-workspace-123" (прошло 500ms)
⚠️ REQUEST MONITOR: Высокая частота запросов "presence-batch": 52 запросов/мин
```

### 4. Stress Test

Откройте 5 вкладок с приложением и посмотрите статистику:

```javascript
debugRequests();

// Если видите:
// ⚠️ events-delta-sync: 75 req/min
// ⚠️ presence-batch: 75 req/min
// 
// Значит есть утечка (компоненты не размонтируются)
```

---

## Преимущества

✅ **Защита от перегрузки** - максимум 10 одновременных запросов  
✅ **Дедупликация** - предотвращает множественные одинаковые запросы  
✅ **Мониторинг** - отслеживание частоты запросов в реальном времени  
✅ **Debug commands** - диагностика в консоли браузера  
✅ **Graceful degradation** - пропуск избыточных запросов вместо краша  
✅ **Автоматическая очистка** - удаление устаревших запросов  

---

## Дополнительная оптимизация

Если проблема повторится, можно:

1. **Увеличить интервалы синхронизации**:
   - Delta Sync: 4 → 10 секунд
   - Full Sync: 30 → 60 секунд
   - Projects/Resources/Departments: 15 → 30 секунд

2. **Уменьшить MAX_CONCURRENT**:
   - С 10 до 5 одновременных запросов

3. **Увеличить COOLDOWN_MS**:
   - С 1 секунды до 2-3 секунд

---

## Версия

- **Дата**: 2025-12-05
- **Версия**: 1.0.0
- **Статус**: ✅ Исправлено и протестировано
