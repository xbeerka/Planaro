# 🔧 Исправление WebSocket Cursors

## 🐛 Проблема

```
❌ WebSocket ошибка: { "isTrusted": true }
⚠️ Достигнут лимит попыток переподключения
```

## 🔍 Причины

### 1. **Неправильный протокол** (ГЛАВНАЯ ПРОБЛЕМА)
Код пытался определить протокол WebSocket (`ws://` или `wss://`) на основе `window.location.protocol`.

**Проблема**: Supabase Edge Functions **ВСЕГДА** работают через HTTPS, поэтому WebSocket должен **ВСЕГДА** использовать `wss://`.

**Было**:
```typescript
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrl = `${protocol}//${projectId}.supabase.co/...`;
```

**Стало**:
```typescript
const wsUrl = `wss://${projectId}.supabase.co/...`;
```

### 2. **Асинхронная авторизация ДО upgrade**
Сервер делал `await userClient.auth.getUser()` **ДО** попытки upgrade WebSocket. Это могло вызывать задержки и проблемы.

**Решение**: Перенесли авторизацию в обработчик `socket.onopen` — сначала upgrade, потом async проверка токена.

### 3. **Недостаточное логирование**
Ошибки WebSocket не давали информации о причине.

**Решение**: Добавили детальное логирование:
- URL без токена (для безопасности)
- Код закрытия (`event.code`) с расшифровкой
- Причина закрытия (`event.reason`)
- ReadyState при ошибке

---

## ✅ Что исправлено

### Frontend (`/components/scheduler/CursorPresence.tsx`)

1. **Протокол**: Всегда `wss://`
2. **Логирование URL**: Маскирует токен (`token=***`)
3. **Детальные ошибки**:
   ```typescript
   ws.onerror = (event) => {
     console.error('❌ WebSocket ошибка:', {
       type: event.type,
       target: event.target,
       readyState: ws.readyState,
       url: wsUrl.replace(/token=[^&]+/, 'token=***'),
       timestamp: new Date().toISOString()
     });
   };
   ```
4. **Коды закрытия**:
   ```typescript
   ws.onclose = (event) => {
     console.log('🔌 WebSocket соединение закрыто:', {
       code: event.code,
       reason: event.reason || '(no reason provided)',
       wasClean: event.wasClean,
       timestamp: new Date().toISOString()
     });
     
     if (event.code === 1006) {
       console.warn('⚠️ Abnormal closure - возможно сервер недоступен или отклонил соединение');
     } else if (event.code === 1008) {
       console.error('❌ Policy violation - возможно проблема с авторизацией');
     }
   };
   ```

### Backend (`/supabase/functions/server/index.tsx`)

1. **Upgrade сначала, auth потом**:
   ```typescript
   app.get("/make-server-73d66528/cursors/:workspaceId", (c) => {
     // 1. Получаем token из query
     const accessToken = url.searchParams.get('token');
     
     // 2. Проверяем upgrade header
     const upgrade = c.req.header('upgrade') || '';
     
     // 3. Делаем upgrade WebSocket (sync)
     const { socket, response } = Deno.upgradeWebSocket(c.req.raw);
     
     // 4. Авторизация в onopen (async)
     socket.onopen = async () => {
       const { data: { user } } = await userClient.auth.getUser();
       if (!user) {
         socket.close(1008, 'Unauthorized');
         return;
       }
       // ... дальше логика
     };
   });
   ```

2. **Детальное логирование**:
   ```typescript
   console.log('🖱️ WebSocket cursor request для workspace:', workspaceId);
   console.log('🔑 Token присутствует:', !!accessToken);
   console.log('🔧 Upgrade header:', upgrade);
   console.log('⬆️ Попытка upgrade WebSocket...');
   console.log('✅ WebSocket upgrade успешен');
   ```

3. **Переменные в правильной области видимости**:
   ```typescript
   let userId: string;
   let email: string;
   let displayName: string;
   // ... инициализация в onopen
   
   socket.onopen = async () => {
     userId = user.id;
     email = user.email || '';
     // ...
   };
   
   socket.onmessage = (event) => {
     // userId, email доступны здесь
   };
   ```

---

## 🚀 Деплой

```bash
supabase functions deploy make-server-73d66528
```

---

## 🧪 Тестирование

### 1. Проверка health endpoint

```bash
curl https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-73d66528/health
```

Ожидается: `{"status":"ok","timestamp":"..."}`

### 2. Проверка WebSocket в браузере

1. Откройте календарь (SchedulerMain)
2. Откройте DevTools → Console
3. Найдите логи:

**Клиент**:
```
🖱️ Подключение к WebSocket Cursor Presence для workspace: 1
👤 Текущий пользователь: Иван Иванов ivan@kode.ru
🔌 Создание WebSocket соединения: wss://xxx.supabase.co/.../cursors/1?token=***
✅ WebSocket соединение установлено
🎉 Подключено к workspace: Connected to workspace 1 - активных пользователей: 1
```

**Если ошибка**:
```
❌ WebSocket ошибка: {
  type: "error",
  readyState: 3,  // 3 = CLOSED
  url: "wss://...?token=***",
  timestamp: "2025-10-21T..."
}
🔌 WebSocket соединение закрыто: {
  code: 1006,
  reason: "(no reason provided)",
  wasClean: false
}
⚠️ Abnormal closure - возможно сервер недоступен или отклонил соединение
```

### 3. Проверка в Network tab

1. DevTools → Network → WS (WebSocket filter)
2. Должна быть строка: `cursors/1?token=...`
3. **Status**: `101 Switching Protocols` (зелёный)
4. **Messages**: должны идти JSON сообщения

**Если Status красный (500, 400, 401)**:
- 400 = Не WebSocket запрос (проверьте upgrade header)
- 401 = Неверный токен (проверьте что токен валиден)
- 500 = Ошибка сервера (проверьте Edge Function logs)

### 4. Проверка Edge Function Logs

Supabase Dashboard → Edge Functions → `make-server-73d66528` → Logs

**Нормальные логи**:
```
🖱️ WebSocket cursor request для workspace: 1
🔑 Token присутствует: true
🔧 Upgrade header: websocket
⬆️ Попытка upgrade WebSocket...
✅ WebSocket upgrade успешен
🔌 WebSocket соединение открыто, проверка авторизации...
✅ Пользователь авторизован: ivan@kode.ru
👤 Пользователь: Иван Иванов (ivan@kode.ru) в workspace 1
👥 Активных соединений в workspace 1: 1
```

**Логи с ошибкой**:
```
❌ Не WebSocket запрос, upgrade header: http
```
→ Клиент пытается подключиться по HTTP вместо WebSocket

```
❌ Неверный токен: JWT expired
```
→ Токен истёк, нужно обновить

```
❌ Ошибка upgrade WebSocket: TypeError: ...
```
→ Проблема с Deno.upgradeWebSocket, проверьте версию Deno

### 5. Тест Collaborative Cursors

1. Откройте календарь в **двух разных браузерах** (обычный + инкогнито)
2. Войдите под **разными аккаунтами** (@kode.ru)
3. Откройте **один и тот же workspace**
4. Двигайте мышью в первом браузере
5. **Должен появиться** цветной курсор с именем во втором браузере

**Ожидаемое**:
- ✅ Курсор другого пользователя виден
- ✅ Имя пользователя показывается
- ✅ Плавное движение (100ms transition)
- ✅ Уникальный цвет для каждого пользователя
- ✅ Свой курсор НЕ показывается

---

## 📊 WebSocket Close Codes

| Code | Значение | Причина |
|------|----------|---------|
| 1000 | Normal Closure | Нормальное закрытие |
| 1001 | Going Away | Страница закрылась/навигация |
| 1006 | Abnormal Closure | Сервер недоступен или не ответил |
| 1008 | Policy Violation | Ошибка авторизации |
| 1011 | Server Error | Внутренняя ошибка сервера |

---

## 🔍 Troubleshooting

### Проблема: "Abnormal closure" (code 1006)

**Возможные причины**:
1. ❌ Edge Function не задеплоена
2. ❌ Edge Function упала (проверьте логи)
3. ❌ Неправильный URL (проверьте projectId)
4. ❌ Firewall блокирует WebSocket

**Решение**:
```bash
# 1. Проверьте health
curl https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-73d66528/health

# 2. Задеплойте снова
supabase functions deploy make-server-73d66528

# 3. Проверьте логи
# Dashboard → Edge Functions → Logs
```

### Проблема: "Policy violation" (code 1008)

**Причина**: Неверный токен или токен истёк

**Решение**:
1. Проверьте что токен валиден (не истёк)
2. Выйдите и войдите снова
3. Проверьте что email @kode.ru

### Проблема: Курсор не появляется

**Checklist**:
1. ✅ WebSocket соединение установлено? (Network → WS tab)
2. ✅ Нет ошибок в Console?
3. ✅ Оба пользователя в одном workspace?
4. ✅ Двигаете мышью?

**Проверка**:
```javascript
// В Console первого браузера
// Должны быть логи отправки:
🖱️ Отправка cursor position
```

```javascript
// В Console второго браузера
// Должны быть логи получения:
🖱️ Получен cursor от: Иван Иванов
```

---

## ✅ Чек-лист готовности

- [x] ✅ Протокол изменён на `wss://`
- [x] ✅ Авторизация перенесена в `onopen`
- [x] ✅ Добавлено детальное логирование
- [x] ✅ Переменные в правильной области видимости
- [ ] 🔲 Edge Function задеплоена
- [ ] 🔲 WebSocket подключается без ошибок
- [ ] 🔲 Курсоры отображаются в двух браузерах

---

**Версия**: v1.9.1  
**Дата**: 2025-10-21  
**Тип**: Bugfix - WebSocket Cursors
