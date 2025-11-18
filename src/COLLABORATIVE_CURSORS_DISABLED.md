# ❌ Collaborative Cursors - Временно отключено

## 🚨 Проблема

WebSocket соединение для collaborative cursors **не работает** в Supabase Edge Functions:

```
❌ WebSocket ошибка: {
  "readyState": 3,  // CLOSED - соединение не может быть установлено
  "url": "wss://xxx.supabase.co/functions/v1/make-server-73d66528/cursors/14?token=***"
}
⚠️ Abnormal closure - возможно сервер недоступен или отклонил соединение
```

## 🔍 Причины

### 1. Нестабильная поддержка WebSocket в Edge Functions
- Supabase Edge Functions (Deno Deploy) **не гарантируют** стабильную работу WebSocket
- `Deno.upgradeWebSocket()` работает не во всех окружениях
- WebSocket соединения могут быть закрыты инфраструктурой без видимой причины

### 2. Проблемы с Hono и WebSocket
- Hono router не полностью совместим с WebSocket upgrade в Deno Deploy
- `c.req.raw` может не содержать правильные headers для upgrade
- Конфликты между HTTP middleware и WebSocket connections

### 3. Архитектурные ограничения
- Edge Functions оптимизированы для **коротких HTTP запросов**, а не long-lived connections
- WebSocket требует persistent connection, что противоречит serverless архитектуре
- Автоматический scale-down может разрывать активные WebSocket соединения

## 📊 Что было попробовано

### Версия 1.9.0 (оригинальная реализация)
```typescript
// Native WebSocket через Deno.upgradeWebSocket()
const { socket, response } = Deno.upgradeWebSocket(c.req.raw);
```
**Результат**: ❌ Соединение не устанавливалось

### Версия 1.9.1 (исправление протокола)
```typescript
// Всегда использовать wss:// для Supabase
const wsUrl = `wss://${projectId}.supabase.co/.../cursors/${workspaceId}`;
```
**Результат**: ❌ Та же проблема - readyState: 3 (CLOSED)

### Версия 1.9.1 (порядок операций)
```typescript
// Сначала upgrade, потом async авторизация в onopen
const { socket, response } = Deno.upgradeWebSocket(c.req.raw);
socket.onopen = async () => {
  // Verify user...
};
```
**Результат**: ❌ Соединение закрывается до выполнения onopen

## ✅ Что работает (сейчас)

### Онлайн пользователи через HTTP
- ✅ **Presence система** с TTL 60 секунд в KV Store
- ✅ **Heartbeat** каждые 30 секунд (HTTP POST)
- ✅ **Graceful leave** при закрытии календаря (HTTP DELETE)
- ✅ **Batch запросы** для списка воркспейсов (оптимизация)
- ✅ **Кэширование** с TTL 45 секунд (мгновенное отображение)
- ✅ **Аватарки** и отображение активности

**Это стабильно работает** и не требует WebSocket.

## 🔮 Будущие решения

### Вариант 1: Supabase Realtime Presence (рекомендуется)
```typescript
import { createClient } from '@supabase/supabase-js';

const channel = supabase.channel(`workspace:${workspaceId}:cursors`)
  .on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState();
    // state содержит всех пользователей с их курсорами
  })
  .on('presence', { event: 'join' }, ({ key, newPresences }) => {
    // Новый пользователь присоединился
  })
  .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
    // Пользователь покинул
  })
  .subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      // Отправлять координаты курсора
      await channel.track({
        x: clientX,
        y: clientY,
        userId,
        email,
        displayName
      });
    }
  });
```

**Преимущества**:
- ✅ Встроенная поддержка в Supabase
- ✅ Автоматическое управление WebSocket
- ✅ Не требует Edge Function
- ✅ Масштабируется автоматически

**Недостатки**:
- ⚠️ Требует включение Realtime в Supabase Dashboard
- ⚠️ Может потребовать платный план (зависит от нагрузки)
- ⚠️ Ограничения на количество одновременных connections

### Вариант 2: Внешний WebSocket сервис
- Socket.io на отдельном сервере (Heroku, Fly.io, Railway)
- Ably, Pusher, или другой managed WebSocket сервис
- Self-hosted WebSocket сервер на VPS

### Вариант 3: Polling вместо WebSocket
```typescript
// Отправка координат курсора каждые 100ms через HTTP
setInterval(async () => {
  await fetch('/api/cursors', {
    method: 'POST',
    body: JSON.stringify({ x, y, workspaceId })
  });
}, 100);

// Получение координат других пользователей
setInterval(async () => {
  const response = await fetch(`/api/cursors/${workspaceId}`);
  const cursors = await response.json();
  // Обновить UI
}, 100);
```

**Недостатки**:
- ❌ Высокая нагрузка на сервер (10 запросов/сек на пользователя)
- ❌ Большая задержка по сравнению с WebSocket
- ❌ Не подходит для реального времени

## 📝 Что отключено (v1.9.2)

### Frontend
```typescript
// /components/scheduler/SchedulerMain.tsx
// import { CursorPresence } from './CursorPresence'; // ОТКЛЮЧЕНО

// {/* <CursorPresence workspaceId={workspace.id} accessToken={accessToken} /> */}
```

### Backend
```typescript
// /supabase/functions/server/index.tsx
/*
app.get("/make-server-73d66528/cursors/:workspaceId", (c) => {
  // ... WebSocket endpoint code ...
});
*/
```

### Файлы сохранены
- ✅ `/components/scheduler/CursorPresence.tsx` - компонент сохранён
- ✅ Код WebSocket endpoint закомментирован, не удалён
- ✅ Документация в `/docs/COLLABORATIVE_CURSORS.md`

## 🚀 Когда включать обратно?

### Критерии для включения:
1. ✅ Supabase официально объявит stable поддержку WebSocket в Edge Functions
2. ✅ Успешное тестирование на production окружении (несколько пользователей, 1+ час)
3. ✅ Нет ошибок `readyState: 3` в логах
4. ✅ WebSocket соединения не разрываются без причины

### Как проверить готовность:
```bash
# 1. Раскомментировать код в SchedulerMain.tsx и index.tsx
# 2. Задеплоить Edge Function
supabase functions deploy make-server-73d66528

# 3. Тестировать WebSocket
# Открыть DevTools → Network → WS
# Должно быть: Status 101 Switching Protocols (зелёный)

# 4. Тестировать с несколькими пользователями
# Открыть календарь в 2+ браузерах
# Двигать мышью - должны появиться курсоры других пользователей
```

## 💡 Рекомендация

**Используйте Supabase Realtime Presence** вместо native WebSocket в Edge Functions.

Это официально поддерживаемый способ реализации collaborative features в Supabase:
- 📖 Документация: https://supabase.com/docs/guides/realtime/presence
- 📦 Пример: https://github.com/supabase/supabase/tree/master/examples/realtime/nextjs-presence

Realtime Presence **стабилен**, **масштабируется** и **не требует custom WebSocket кода**.

---

**Версия**: v1.9.2  
**Дата**: 2025-10-21  
**Статус**: Collaborative Cursors временно отключены  
**Reason**: WebSocket нестабилен в Edge Functions
