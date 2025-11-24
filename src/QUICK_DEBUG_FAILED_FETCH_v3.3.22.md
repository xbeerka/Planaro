# Быстрая диагностика "Failed to fetch" v3.3.22

## ❌ Ошибка
```
❌ Failed to fetch (попытка 1/3)
```

## 🔍 Что проверить СРАЗУ

### 1. Откройте консоль браузера (F12)
Найдите логи **ПЕРЕД** ошибкой:

#### ✅ ХОРОШО - Видны все параметры (v3.3.22+):
```
📦 BATCH: всего операций для отправки: 3
📦 BATCH: 2 create + 1 update
🔍 BATCH: Валидация параметров...
   projectId: "zhukuvbdjyneoloarlqy" (тип: string)
   accessToken: "eyJhbGciOiJIUzI1NiIsI..." (длина: 512)
   workspaceId: 14 (тип: number)
✅ BATCH: Валидация пройдена
📦 BATCH: Отправка запроса к: https://zhukuvbdjyneoloarlqy.supabase.co/functions/v1/make-server-73d66528/events/batch
📦 BATCH: Workspace ID: 14
❌ BATCH: Ошибка fetch: {name: 'TypeError', message: 'Failed to fetch', ...}
```
**→ Сервер недоступен. Переходите к пункту 2.**

#### ❌ ПЛОХО - Невалидный токен:
```
🔍 BATCH: Валидация параметров...
   accessToken: ОТСУТСТВУЕТ
❌ BATCH: accessToken невалиден!
```
**→ Проблема с авторизацией. Переходите к пункту 3.**

#### ❌ ПЛОХО - Невалидный projectId:
```
🔍 BATCH: Валидация параметров...
   projectId: "undefined" (тип: string)
❌ BATCH: projectId невалиден!
```
**→ Проблема с конфигурацией. Переходите к пункту 4.**

---

## 2. Проверка сервера

### Шаг 1: Health check
Откройте в браузере:
```
https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-73d66528/health
```

**✅ Сервер работает**:
```json
{"status":"ok","timestamp":"2025-11-19T..."}
```

**❌ Сервер не отвечает**:
```
Failed to fetch
```
или
```
{"error": "Function not found"}
```

### Шаг 2: Деплой сервера
```bash
# Проверьте статус
supabase functions list

# Деплойте заново
supabase functions deploy make-server-73d66528

# Проверьте логи
# Supabase Dashboard → Edge Functions → make-server-73d66528 → Logs
```

---

## 3. Проверка токена

### Откройте консоль и выполните:
```javascript
// Проверьте IndexedDB
const db = await indexedDB.open('auth-db');
db.onsuccess = () => {
  const tx = db.result.transaction('auth', 'readonly');
  const store = tx.objectStore('auth');
  const req = store.get('accessToken');
  req.onsuccess = () => console.log('Token:', req.result ? '✅ есть' : '❌ нет');
};
```

### Если токена нет:
1. Выйдите из системы
2. Войдите заново
3. Проверьте что токен сохранился

---

## 4. Проверка конфигурации

### Откройте `/utils/supabase/info.tsx`:
```typescript
export const projectId = "YOUR_PROJECT_ID"; // ← Должен быть заполнен!
export const publicAnonKey = "YOUR_ANON_KEY"; // ← Должен быть заполнен!
```

### Если пусто:
1. Supabase Dashboard → Settings → API
2. Скопируйте:
   - Project URL → возьмите ID из URL
   - Anon key → вставьте в publicAnonKey
3. Сохраните файл

---

## 5. Проверка Network Tab

### F12 → Network → Refresh страницы → попробуйте Undo

#### ✅ Запрос отправлен (любой status):
- **Status: 200** → Сервер работает, ошибка где-то в логике
- **Status: 401** → Проблема с авторизацией (токен)
- **Status: 500** → Ошибка на сервере (проверьте логи)
- **Status: 503** → База данных недоступна

#### ❌ Запрос не отправлен:
- **(failed)** → Сетевая ошибка, CORS или блокировка браузера
- **(canceled)** → Запрос был отменён

---

## 6. Проверка CORS

### Откройте логи сервера:
```
Supabase Dashboard → Edge Functions → make-server-73d66528 → Logs
```

#### Ищите:
```
Access-Control-Allow-Origin header is missing
```

#### Если есть CORS ошибка:
1. Проверьте что сервер использует `cors` middleware:
   ```typescript
   import { cors } from 'npm:hono/cors';
   
   app.use('*', cors({
     origin: '*',
     credentials: true
   }));
   ```
2. Проверьте что middleware установлен ДО маршрутов

---

## 7. Быстрый тест

### Создайте тестовый endpoint:
```typescript
// /supabase/functions/server/index.tsx
app.get("/make-server-73d66528/test-auth", async (c) => {
  const accessToken = c.req.header('Authorization')?.split(' ')[1];
  
  return c.json({
    hasToken: !!accessToken,
    tokenPreview: accessToken?.substring(0, 20),
    timestamp: new Date().toISOString()
  });
});
```

### Протестируйте через fetch:
```javascript
const accessToken = localStorage.getItem('accessToken'); // или из IndexedDB
const projectId = 'YOUR_PROJECT_ID';

const response = await fetch(
  `https://${projectId}.supabase.co/functions/v1/make-server-73d66528/test-auth`,
  {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  }
);

console.log(await response.json());
// Ожидается: { hasToken: true, tokenPreview: "eyJhbGciOiJIUzI1NiIsI...", timestamp: "..." }
```

---

## 8. Checklist

- [ ] Сервер деплоен (`supabase functions list`)
- [ ] Health check возвращает OK
- [ ] Токен есть в IndexedDB
- [ ] projectId заполнен в `/utils/supabase/info.tsx`
- [ ] В консоли видны логи `🔍 BATCH: Валидация параметров...`
- [ ] В Network Tab видны запросы к `/events/batch`
- [ ] Нет ошибок CORS в логах сервера

---

## 🎯 Быстрый фикс

### Самая частая причина: сервер не деплоен

```bash
# 1. Деплой
supabase functions deploy make-server-73d66528

# 2. Проверка
curl https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-73d66528/health

# 3. Должны увидеть:
# {"status":"ok","timestamp":"..."}
```

### Если curl не работает:
```bash
# Проверьте переменные окружения
supabase secrets list

# Должны быть:
# - SUPABASE_URL
# - SUPABASE_ANON_KEY
# - SUPABASE_SERVICE_ROLE_KEY
# - SUPABASE_DB_URL
```

---

## 📝 Новые логи v3.3.22

После исправления вы увидите **ДЕТАЛЬНЫЕ** логи с валидацией:

### ✅ Успешный запрос:
```
📦 BATCH: всего операций для отправки: 3
📦 BATCH: 2 create + 1 update
🔍 BATCH: Валидация параметров...
   projectId: "zhukuvbdjyneoloarlqy" (тип: string)
   accessToken: "eyJhbGciOiJIUzI1NiIsI..." (длина: 512)
   workspaceId: 14 (тип: number)
✅ BATCH: Валидация пройдена
📦 BATCH: Отправка запроса к: https://zhukuvbdjyneoloarlqy.supabase.co/functions/v1/make-server-73d66528/events/batch
📦 BATCH: Workspace ID: 14
✅ BATCH: Получен ответ от сервера (status: 200)
✅ BATCH CREATE: создано 2 событий на сервере
✅ BATCH UPDATE: обновлено 1 событий на сервере
```

### ❌ Сетевая ошибка (v3.3.22+):
```
📦 BATCH: всего операций для отправки: 3
📦 BATCH: 2 create + 1 update
🔍 BATCH: Валидация параметров...
   projectId: "zhukuvbdjyneoloarlqy" (тип: string)
   accessToken: "eyJhbGciOiJIUzI1NiIsI..." (длина: 512)
   workspaceId: 14 (тип: number)
✅ BATCH: Валидация пройдена
📦 BATCH: Отправка запроса к: https://zhukuvbdjyneoloarlqy.supabase.co/functions/v1/make-server-73d66528/events/batch
📦 BATCH: Workspace ID: 14
❌ BATCH: Ошибка fetch: {name: 'TypeError', message: 'Failed to fetch', ...}
❌ Ошибка синхронизации восстановленных событий: Error: Network error: Failed to fetch. Check server availability and CORS settings.
❌ Тип ошибки: Error
❌ Сообщение: Network error: Failed to fetch. Check server availability and CORS settings.
```

### ❌ Таймаут (v3.3.22+):
```
📦 BATCH: Отправка запроса к: https://zhukuvbdjyneoloarlqy.supabase.co/functions/v1/make-server-73d66528/events/batch
❌ BATCH: Таймаут 15 секунд истёк
❌ BATCH: Запрос прерван по таймауту (15 сек)
❌ Ошибка синхронизации восстановленных событий: Error: Request timeout after 15 seconds. Server may be overloaded or Edge Function not responding.
```

### ❌ Невалидный токен (v3.3.22+):
```
📦 BATCH: всего операций для отправки: 3
📦 BATCH: 2 create + 1 update
🔍 BATCH: Валидация параметров...
   projectId: "zhukuvbdjyneoloarlqy" (тип: string)
   accessToken: ОТСУТСТВУЕТ
   workspaceId: 14 (тип: number)
❌ BATCH: accessToken невалиден! {hasToken: false, type: 'undefined'}
Error: Invalid access token. Please re-login.
```

### ❌ Невалидный projectId (v3.3.22+):
```
🔍 BATCH: Валидация параметров...
   projectId: "undefined" (тип: string)
   ...
❌ BATCH: projectId невалиден! {projectId: 'undefined', type: 'string'}
Error: Invalid project ID: "undefined". Check /utils/supabase/info.tsx
```

---

## 💡 Совет

Если вы видите "Failed to fetch" **только при Undo/Redo**, но обычные операции работают:
1. Проверьте что функция `syncRestoredEventsToServer` вызывается с правильными параметрами
2. Убедитесь что `accessToken` передаётся в `SchedulerProvider`
3. Проверьте что `workspaceId` установлен

---

**Версия**: v3.3.22  
**Дата**: 2025-11-19  
**Затронутые файлы**: `/contexts/SchedulerContext.tsx`  
**Изменения в v3.3.22**:
- ✅ Строгая валидация projectId, accessToken, workspaceId перед запросом
- ✅ Таймаут 15 секунд для fetch запросов (AbortController)
- ✅ Детальное логирование типов и значений всех параметров
- ✅ Улучшенная диагностика ошибок fetch (таймаут, сеть, CORS)
- ✅ Понятные сообщения об ошибках с инструкциями по исправлению
