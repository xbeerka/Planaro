# Collaborative Cursors - Real-time отображение курсоров

## 📋 Обзор

Функция **Collaborative Cursors** позволяет пользователям видеть курсоры других пользователей в реальном времени внутри одного workspace. Каждый курсор отображается с уникальным цветом и именем пользователя.

**Технология**: Native WebSocket через Supabase Edge Functions

---

## 🎯 Как это работает

### 1. Подключение к WebSocket

Когда пользователь открывает календарь (SchedulerMain):
1. CursorPresence компонент создаёт WebSocket соединение
2. Подключается к: `wss://{projectId}.supabase.co/functions/v1/make-server-73d66528/cursors/:workspaceId?token={accessToken}`
3. Сервер проверяет JWT token и авторизует пользователя
4. Соединение добавляется в Map активных соединений workspace

### 2. Отправка координат курсора

При движении мыши (throttle 50ms):
1. Клиент отправляет JSON: `{type: 'cursor', x, y, timestamp}`
2. Сервер получает сообщение
3. Сервер добавляет метаданные пользователя из JWT: `{userId, email, displayName, avatarUrl, color}`
4. Broadcast всем **другим** пользователям в том же workspace

### 3. Получение курсоров других пользователей

Клиент получает WebSocket сообщения:
- `cursor` - координаты и данные пользователя
- `connected` - подтверждение подключения
- `disconnected` - отключение пользователя

Курсоры рендерятся как SVG элементы с именем пользователя.

### 4. Автоматическая очистка

**Client-side**:
- Курсоры старше 5 секунд удаляются (TTL)
- Проверка каждую секунду

**Server-side**:
- При `socket.onclose` соединение удаляется из Map
- Пустые workspace очищаются из глобального Map

### 5. Reconnect при обрыве

При обрыве соединения:
1. Клиент ждёт с exponential backoff (1s, 2s, 4s, 8s, 16s)
2. Максимум 5 попыток
3. Макс. задержка: 30 секунд
4. После успешного reconnect счётчик сбрасывается

---

## 🏗️ Архитектура

```
┌─────────────────┐          WebSocket           ┌──────────────────────┐
│   Browser #1    │◄──────────────────────────►  │  Edge Function       │
│                 │   wss://.../cursors/1        │                      │
│  CursorPresence │                              │  WebSocket Endpoint  │
│   - track x,y   │                              │                      │
│   - send cursor │                              │  Map<workspaceId,    │
│   - render      │                              │    Map<userId, ws>>  │
└─────────────────┘                              │                      │
                                                  │  Broadcast to all    │
┌─────────────────┐          WebSocket           │  except sender       │
│   Browser #2    │◄──────────────────────────►  │                      │
│                 │   wss://.../cursors/1        │                      │
│  CursorPresence │                              │                      │
└─────────────────┘                              └──────────────────────┘

┌─────────────────┐          WebSocket           
│   Browser #3    │◄──────────────────────────►  (workspace #2)
│                 │   wss://.../cursors/2        (isolated)
│  CursorPresence │                              
└─────────────────┘                              
```

---

## 📁 Файлы

### Backend

**`/supabase/functions/server/index.tsx`**

```typescript
// WebSocket endpoint
app.get("/make-server-73d66528/cursors/:workspaceId", async (c) => {
  // 1. Extract token from query params
  const accessToken = url.searchParams.get('token');
  
  // 2. Verify user via Supabase Auth
  const { data: { user } } = await userClient.auth.getUser();
  
  // 3. Upgrade to WebSocket
  const { socket, response } = Deno.upgradeWebSocket(c.req.raw);
  
  // 4. Store connection in Map
  workspaceConnections.get(workspaceId).set(userId, {ws, displayName, email, ...});
  
  // 5. Broadcast cursor positions
  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    connections.forEach((conn) => {
      if (conn.ws.readyState === WebSocket.OPEN) {
        conn.ws.send(JSON.stringify({...data, userId, email, displayName, color}));
      }
    });
  };
});
```

**Хранилище соединений**:
```typescript
const workspaceConnections = new Map<string, Map<string, any>>();

// Пример структуры:
{
  "1": Map {
    "uuid-123": { ws: WebSocket, displayName: "Иван", email: "ivan@kode.ru", color: "hsl(180, 70%, 50%)" },
    "uuid-456": { ws: WebSocket, displayName: "Мария", email: "maria@kode.ru", color: "hsl(240, 70%, 50%)" }
  },
  "2": Map {
    "uuid-789": { ws: WebSocket, displayName: "Петр", email: "petr@kode.ru", color: "hsl(60, 70%, 50%)" }
  }
}
```

### Frontend

**`/components/scheduler/CursorPresence.tsx`**

Основные секции:
1. **State**: Map с курсорами других пользователей
2. **connectWebSocket()**: Создание и управление WebSocket соединением
3. **handleMouseMove()**: Throttled отправка координат
4. **Cleanup**: Удаление устаревших курсоров
5. **Render**: SVG курсор + имя пользователя

**Ключевые особенности**:
- ✅ Throttle 50ms для координат
- ✅ Reconnect с exponential backoff
- ✅ TTL 5 секунд для неактивных курсоров
- ✅ Не показывает свой курсор
- ✅ Уникальный цвет на основе hash(email)

**`/components/scheduler/SchedulerMain.tsx`**

```tsx
<CursorPresence
  workspaceId={workspace.id}
  accessToken={accessToken}
/>
```

---

## 🎨 UI/UX

### Визуальный стиль

**Курсор**:
- SVG стрелка (24×24px)
- Цвет: `hsl(hue, 70%, 50%)` где hue = hash(email) % 360
- Белый stroke для контраста
- Drop shadow: `drop-shadow-lg`

**Имя пользователя**:
- Badge справа от курсора
- Фон: тот же цвет что курсор
- Текст: белый
- Border: `border-white/20`
- Shadow: `shadow-lg`

### Позиционирование

```css
.cursor {
  position: fixed;
  z-index: 9999; /* Поверх всего */
  pointer-events: none; /* Не блокирует клики */
  transition: transform 100ms ease-out; /* Плавное движение */
}
```

### Координаты

Используются координаты относительно **viewport** (не document):
- `e.clientX` / `e.clientY` (не pageX/pageY)
- Это гарантирует что курсоры всегда в видимой области
- При скролле курсоры остаются на месте относительно экрана

---

## 🔧 Конфигурация

### Throttle

**Отправка координат**:
```typescript
const THROTTLE_MS = 50; // 50ms = 20 обновлений/сек
```

Меньше → более плавное движение, больше трафика  
Больше → меньше трафика, "дёрганное" движение

### Timeout для неактивных курсоров

```typescript
const CURSOR_TIMEOUT_MS = 5000; // 5 секунд
```

Если пользователь не двигает мышь 5 секунд → курсор исчезает.

### Reconnect

```typescript
const MAX_RECONNECT_ATTEMPTS = 5;
const getReconnectDelay = (attempt) => Math.min(1000 * Math.pow(2, attempt), 30000);

// Попытки:
// 1: 1 секунда
// 2: 2 секунды
// 3: 4 секунды
// 4: 8 секунд
// 5: 16 секунд
// Max: 30 секунд
```

---

## 🚀 Деплой

### 1. Задеплоить Edge Function

```bash
supabase functions deploy make-server-73d66528
```

### 2. Проверить health

```bash
curl https://{PROJECT_ID}.supabase.co/functions/v1/make-server-73d66528/health
```

Ожидается:
```json
{"status":"ok","timestamp":"2025-10-21T..."}
```

### 3. Проверить логи

Supabase Dashboard → Edge Functions → `make-server-73d66528` → Logs

Найдите:
```
🖱️ WebSocket cursor request для workspace: 1
✅ Пользователь авторизован: user@kode.ru
```

---

## 🧪 Тестирование

### Базовый тест (2 пользователя)

1. Откройте календарь в двух браузерах (обычный + инкогнито)
2. Войдите под разными аккаунтами (@kode.ru)
3. Откройте один и тот же workspace
4. Двигайте мышью
5. Должен появиться цветной курсор с именем

### Тест reconnect

1. Откройте DevTools → Network → WS
2. Найдите `cursors/1?token=...`
3. Закройте соединение (Right-click → Close)
4. Проверьте Console → должен начаться reconnect:
   ```
   🔌 WebSocket соединение закрыто
   🔄 Попытка переподключения 1/5 через 1000ms...
   ```

### Тест TTL (таймаут)

1. Откройте календарь в двух браузерах
2. В первом браузере не двигайте мышь 6 секунд
3. Во втором браузере курсор первого должен исчезнуть

### Тест isolation (разные workspace)

1. Браузер #1: откройте workspace #1
2. Браузер #2: откройте workspace #2
3. Курсоры НЕ должны быть видны друг другу
4. Откройте workspace #1 в обоих → теперь курсоры видны

---

## 📊 Производительность

### Network bandwidth

**На одного пользователя**:
- Отправка: 20 msg/сек × 100 bytes = 2 KB/сек
- Получение: N пользователей × 20 msg/сек × 100 bytes

**Пример (5 пользователей)**:
- Отправка: 2 KB/сек
- Получение: 4 × 2 KB/сек = 8 KB/сек
- **Итого**: ~10 KB/сек (80 Kbps) ← минимально

### Memory

**Server**:
- In-memory Map с WebSocket соединениями
- ~1 KB на соединение
- 50 пользователей = ~50 KB

**Client**:
- Map с курсорами
- ~1 KB на курсор
- 50 курсоров = ~50 KB

### CPU

**Server**:
- JSON parse/stringify
- Broadcast loop
- Минимальная нагрузка

**Client**:
- Throttle каждые 50ms
- DOM updates (transforms)
- GPU acceleration via CSS transitions

---

## 🐛 Отладка

### Курсор не появляется

**Checklist**:
1. ✅ Оба пользователя в одном workspace?
2. ✅ WebSocket соединение установлено? (DevTools → Network → WS)
3. ✅ Нет ошибок в Console?
4. ✅ Access token валиден? (не истёк)
5. ✅ Edge Function задеплоена?

**Логи сервера**:
```
🖱️ WebSocket cursor request для workspace: X
✅ Пользователь авторизован: user@kode.ru
🔌 WebSocket открыт: User Name (user@kode.ru) в workspace X
👥 Активных соединений в workspace X: 2
```

### Курсор "лагает"

**Возможные причины**:
1. Медленная сеть → увеличьте THROTTLE_MS
2. Много пользователей → рассмотрите server-side throttle
3. Edge Function перегружена → проверьте логи

**Решение**:
```typescript
const THROTTLE_MS = 100; // Было 50ms → станет 10 msg/сек вместо 20
```

### Соединение обрывается

**Проверки**:
1. Console → reconnect логи
2. Dashboard → Logs → ошибки Edge Function
3. Token не истёк? (живёт 1 час, обновляется автоматически)

**Reconnect логи** (нормальное поведение):
```
🔌 WebSocket соединение закрыто: 1006
🔄 Попытка переподключения 1/5 через 1000ms...
✅ WebSocket соединение установлено
```

---

## 🔐 Безопасность

### JWT Token в URL

WebSocket подключается с token в query string:
```
wss://.../cursors/1?token=eyJhbGciOiJ...
```

**Риски**:
- ⚠️ Token виден в URL
- ⚠️ Может попасть в логи прокси/CDN

**Митигация**:
- ✅ HTTPS (WSS) → зашифровано
- ✅ Token живёт 1 час → короткий срок
- ✅ Token проверяется на сервере
- ✅ Broadcast только внутри workspace → isolation

**Альтернатива** (если нужна повышенная безопасность):
Передавать token в первом WebSocket сообщении вместо URL.

### Isolation между workspace

Каждый workspace имеет отдельный Map соединений:
```typescript
workspaceConnections.get(workspaceId)
```

Broadcast происходит **только** внутри workspace → курсоры не "утекают".

---

## 🔮 Будущие улучшения

### 1. Cursor tooltip с аватаркой

Показывать аватарку пользователя рядом с курсором:

```tsx
{cursor.avatarUrl && (
  <img src={cursor.avatarUrl} className="w-6 h-6 rounded-full" />
)}
```

### 2. Cursor "trails" (шлейф)

Оставлять короткий след за курсором для более плавного визуала.

### 3. Adaptive throttle

Уменьшать частоту обновлений если пользователь не двигает мышь активно:
- Быстрое движение → 50ms throttle
- Медленное движение → 200ms throttle
- Нет движения → не отправлять

### 4. Cursor gestures

Показывать когда пользователь кликает или выделяет:
- Click → анимация пульсации
- Drag → изменение иконки курсора

### 5. Server-side rate limiting

Ограничивать количество сообщений от одного пользователя:
```typescript
const rateLimiter = new Map<userId, {count: number, resetAt: number}>();
```

---

## 📚 Связанные документы

- `/WEBSOCKET_CURSORS_READY.md` - инструкции по деплою
- `/CURSOR_PRESENCE_DISABLED.md` - история проблемы с Supabase Realtime
- `/FIX_CURSOR_PRESENCE_BUILD_ERROR.md` - попытки исправления

---

**Версия**: v1.9.0  
**Дата**: 2025-10-21  
**Статус**: ✅ Продакшн-готово  
**Технология**: Native WebSocket + Supabase Edge Functions
