# 🔐 Критичное исправление авторизации

## Проблема
Авторизация сбрасывалась после обновления страницы. Сессия не сохранялась в KV Store.

## Корневая причина
**JSON.stringify двойной сериализацией!**

### Что происходило:
1. Сервер: `await kv.set('session:xxx', JSON.stringify(data))` → сохраняет **СТРОКУ** в JSONB колонку
2. PostgreSQL JSONB: автоматически сериализует строку ещё раз → `"{\\"user_id\\":\\"123\\"}"`
3. Сервер при чтении: `JSON.parse(sessionData)` → пытается распарсить двойную сериализацию → **ОШИБКА**

### Правильно:
1. Сервер: `await kv.set('session:xxx', data)` → сохраняет **ОБЪЕКТ**
2. PostgreSQL JSONB: сохраняет как нативный JSONB
3. Сервер при чтении: `const session = sessionData` → получает объект напрямую

## Исправления

### ✅ Исправлено в клиенте (`/App.tsx`):
- Проверка авторизации: `data.session.access_token` вместо `data.access_token`
- Периодическое обновление: `data.session.access_token` вместо `data.access_token`
- Добавлено детальное логирование

### ✅ Нужно исправить на сервере (`/supabase/functions/server/index.tsx`):

#### 1. Чтение сессии (строка 240-248):
```typescript
// БЫЛО:
let session;
try {
  session = JSON.parse(sessionData);
} catch (jsonError: any) {
  console.error('❌ Ошибка парсинга сессии из KV:', jsonError.message);
  return c.json({ error: 'Invalid session data', session: null }, 500);
}

// СТАЛО:
// ✅ ИСПРАВЛЕНО: KV Store возвращает объект напрямую (JSONB), не нужен JSON.parse
const session = sessionData;
```

#### 2. Обновление сессии при refresh (строка 330):
```typescript
// БЫЛО:
await kv.set(`session:${session_id}`, JSON.stringify(updatedSessionData));

// СТАЛО:
// ✅ ИСПРАВЛЕНО: KV Store принимает объект напрямую (JSONB), не нужен JSON.stringify
await kv.set(`session:${session_id}`, updatedSessionData);
```

#### 3. Сохранение сессии при логине (строка 439-449):
```typescript
// БЫЛО:
const sessionDataJson = JSON.stringify(sessionData);
console.log('💾 Сохранение сессии в KV store...');
console.log('   Key: session:' + sessionId.substring(0, 8) + '...');
console.log('   Data size:', sessionDataJson.length, 'bytes');

try {
  await kv.set(`session:${sessionId}`, sessionDataJson);
  console.log('✅ Сессия сохранена в KV store');
} catch (kvError: any) {
  console.error('❌ Ошибка сохранения в KV:', kvError.message);
  throw kvError;
}

// СТАЛО:
console.log('💾 Сохранение сессии в KV store...');
console.log('   Key: session:' + sessionId);
console.log('   User:', data.user.email);

try {
  // ✅ КРИТИЧНО: KV Store принимает объект напрямую (JSONB), не нужен JSON.stringify!
  await kv.set(`session:${sessionId}`, sessionData);
  console.log('✅ Сессия сохранена в KV store');
} catch (kvError: any) {
  console.error('❌ Ошибка сохранения в KV:', kvError.message);
  throw kvError;
}
```

#### 4. То же самое для endpoint регистрации (найти второй раз)

## Как проверить

1. Войдите в систему
2. Откройте консоль браузера → должны увидеть:
   ```
   ✅ Auth restored successfully
   ```
3. Обновите страницу → авторизация НЕ должна сбрасываться
4. Закройте браузер и откройте снова → авторизация НЕ должна сбрасываться
5. Подождите 10 минут → в консоли:
   ```
   ✅ Token refreshed successfully
   ```

## Важно

**KV Store таблица использует JSONB:**
```sql
CREATE TABLE kv_store_73d66528 (
  key TEXT NOT NULL PRIMARY KEY,
  value JSONB NOT NULL  -- ← JSONB, не TEXT!
);
```

**Функция set принимает объект:**
```typescript
export const set = async (key: string, value: any): Promise<void> => {
  const supabase = client()
  const { error } = await supabase.from("kv_store_73d66528").upsert({
    key,
    value  // ← передаётся объект напрямую, Supabase автоматически сериализует в JSONB!
  });
```

**НЕ НУЖЕН `JSON.stringify`!** Supabase сам конвертирует объект в JSONB.
**НЕ НУЖЕН `JSON.parse`!** Supabase возвращает объект напрямую.
