# Фикс ошибок Heartbeat и Leave

## Проблема

**Ошибка в консоли:**
```
⚠️ Heartbeat: сетевая ошибка, сервер может быть недоступен
```

Появлялась при открытии календаря воркспейса, даже если сервер был доступен.

## Причины

### 1. Отсутствовал endpoint для Leave

OnlineUsers компонент при размонтировании (закрытие календаря) отправлял DELETE запрос:
```typescript
// OnlineUsers.tsx - sendLeave()
const response = await fetch(
  `https://${projectId}.supabase.co/functions/v1/make-server-73d66528/presence/leave/${workspaceId}`,
  {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  }
);
```

**Проблема**: Endpoint `/presence/leave/:workspaceId` НЕ СУЩЕСТВОВАЛ на сервере!

**Результат**:
- Запрос падал с 404 или network error
- В консоли: `⚠️ Leave: сетевая ошибка`
- Presence не удалялся мгновенно (только через TTL 60 сек)

### 2. Слишком чувствительное логирование

Каждая ошибка heartbeat логировалась как WARNING, даже если это была разовая сетевая задержка:

```typescript
// ❌ БЫЛО - каждая ошибка = предупреждение
catch (error: any) {
  if (error.message?.includes('Failed to fetch')) {
    console.warn('⚠️ Heartbeat: сетевая ошибка, сервер может быть недоступен');
  }
}
```

**Проблема**: Пользователь видел предупреждения даже при нормальной работе (временные сетевые сбои).

### 3. Нет различия между разовым и системным сбоем

Heartbeat отправляется каждые 30 секунд. При временном сбое сети:
- 1 ошибка → WARNING (пугает пользователя)
- Через 30 сек успех → всё работает
- Но пользователь уже напуган

## Решение

### 1. Добавлен endpoint для Leave

```typescript
// supabase/functions/server/index.tsx
app.delete("/make-server-73d66528/presence/leave/:workspaceId", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    // Verify user
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(accessToken);
    if (authError || !user) {
      console.error('❌ Ошибка авторизации при leave:', authError);
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const workspaceId = c.req.param('workspaceId');

    console.log(`👋 Leave от ${user.email} из workspace ${workspaceId}`);

    // Remove presence from KV Store
    const presenceKey = `presence:${workspaceId}:${user.id}`;
    await kv.del(presenceKey);
    
    console.log(`✅ Presence удалён: ${user.email} больше не онлайн в workspace ${workspaceId}`);
    
    return c.json({ success: true });
  } catch (error: any) {
    console.error('❌ Ошибка leave:', error);
    return c.json({ error: error.message || 'Ошибка leave' }, 500);
  }
});
```

**Что делает:**
- Принимает DELETE запрос от OnlineUsers
- Проверяет авторизацию пользователя
- Удаляет запись `presence:${workspaceId}:${user.id}` из KV Store
- Логирует успешное удаление

**Результат**: Пользователь мгновенно исчезает из онлайн списка при закрытии календаря.

### 2. Умное логирование с счетчиком ошибок

```typescript
// OnlineUsers.tsx
const heartbeatFailureCount = useRef(0); // Счетчик последовательных ошибок

const sendHeartbeat = useCallback(async () => {
  try {
    const response = await fetch(...);
    
    if (response.ok) {
      console.log('💓 Heartbeat успешно отправлен');
      // ✅ Сброс счетчика при успехе
      heartbeatFailureCount.current = 0;
    } else {
      heartbeatFailureCount.current++;
      console.warn(`⚠️ Heartbeat: сервер вернул ошибку ${response.status} (попытка ${heartbeatFailureCount.current})`);
      
      // Показываем ERROR только после 3 неудачных попыток подряд
      if (heartbeatFailureCount.current >= 3) {
        console.error('❌ Heartbeat: множественные ошибки - проверьте развертывание сервера');
      }
    }
  } catch (error: any) {
    heartbeatFailureCount.current++;
    
    const errorMsg = error.name === 'AbortError' 
      ? 'таймаут запроса (10 секунд)'
      : error.message?.includes('Failed to fetch')
      ? 'сетевая ошибка - сервер может быть недоступен'
      : `ошибка: ${error.message || error}`;
    
    // Умное логирование в зависимости от количества ошибок
    if (heartbeatFailureCount.current >= 3) {
      console.error(`❌ Heartbeat: ${errorMsg} (попытка ${heartbeatFailureCount.current})`);
      console.error('💡 Убедитесь что Edge Function задеплоена: supabase functions deploy make-server-73d66528');
    } else {
      console.warn(`⚠️ Heartbeat: ${errorMsg} (попытка ${heartbeatFailureCount.current}) - повтор через 30 сек`);
    }
  }
}, [workspaceId, accessToken]);
```

**Логика:**
1. **Успешная отправка** → счетчик = 0
2. **1-2 ошибки подряд** → `console.warn` (не критично, повтор через 30 сек)
3. **3+ ошибок подряд** → `console.error` с инструкциями по деплою

### 3. Информативные сообщения

```
Сценарий 1: Разовая сетевая задержка
─────────────────────────────────────
💓 Heartbeat успешно отправлен
⚠️ Heartbeat: сетевая ошибка (попытка 1) - повтор через 30 сек
💓 Heartbeat успешно отправлен  ← счетчик сброшен
💓 Heartbeat успешно отправлен

Сценарий 2: Сервер недоступен
────────────────────────────
⚠️ Heartbeat: сетевая ошибка (попытка 1) - повтор через 30 сек
⚠️ Heartbeat: сетевая ошибка (попытка 2) - повтор через 30 сек
❌ Heartbeat: сетевая ошибка (попытка 3)
💡 Убедитесь что Edge Function задеплоена: supabase functions deploy make-server-73d66528
❌ Heartbeat: сетевая ошибка (попытка 4)
💡 Убедитесь что Edge Function задеплоена: supabase functions deploy make-server-73d66528
```

## Результаты

### До фикса:
```
❌ Каждая ошибка heartbeat → WARNING (пугает пользователя)
❌ Leave endpoint не существует → 404 error
❌ Presence не удаляется мгновенно при закрытии календаря
❌ Нет различия между разовым и системным сбоем
```

### После фикса:
```
✅ Разовые сбои → мягкое предупреждение (попытка N)
✅ Множественные сбои → ERROR с инструкциями
✅ Leave endpoint работает → мгновенное удаление presence
✅ Graceful degradation → не пугаем пользователя зря
✅ Автоматический retry через 30 секунд
```

## Тестирование

### Сценарий 1: Нормальная работа
1. Откройте календарь воркспейса
2. Проверьте консоль:
   ```
   💓 Отправка heartbeat для workspace: 123
   💓 Heartbeat успешно отправлен
   ```
3. Закройте календарь (вернитесь к списку)
4. Проверьте консоль:
   ```
   👋 Отправка leave для workspace: 123
   ✅ Leave успешно отправлен - пользователь удалён из онлайн списка
   ```

### Сценарий 2: Разовая сетевая ошибка
1. Симулируйте сетевую задержку (DevTools → Network → Slow 3G)
2. Откройте календарь
3. Если heartbeat не успел (timeout):
   ```
   ⚠️ Heartbeat: таймаут запроса (попытка 1) - повтор через 30 сек
   ```
4. Через 30 секунд (при нормальной сети):
   ```
   💓 Heartbeat успешно отправлен  ← счетчик сброшен
   ```

### Сценарий 3: Сервер недоступен
1. Остановите Edge Function или заблокируйте домен
2. Откройте календарь
3. Проверьте консоль (через каждые 30 сек):
   ```
   ⚠️ Heartbeat: сетевая ошибка (попытка 1) - повтор через 30 сек
   ⚠️ Heartbeat: сетевая ошибка (попытка 2) - повтор через 30 сек
   ❌ Heartbeat: сетевая ошибка (попытка 3)
   💡 Убедитесь что Edge Function задеплоена: supabase functions deploy make-server-73d66528
   ```

## Деплой

### ВАЖНО: Нужно задеплоить Edge Function

```bash
# 1. Деплой обновленной Edge Function
supabase functions deploy make-server-73d66528

# 2. Проверка что новый endpoint работает
curl -X DELETE \
  https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-73d66528/presence/leave/123 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Ожидаемый ответ:
# {"success":true}
```

### Проверка логов сервера

После деплоя проверьте логи в Supabase Dashboard:

```
Supabase Dashboard → Edge Functions → make-server-73d66528 → Logs

Ожидаемые логи:
👋 Leave от user@kode.ru из workspace 123
✅ Presence удалён: user@kode.ru больше не онлайн в workspace 123
```

## Обновленные файлы

```
✅ /components/scheduler/OnlineUsers.tsx
   - Добавлен heartbeatFailureCount ref
   - Умное логирование с счетчиком ошибок
   - Информативные сообщения

✅ /supabase/functions/server/index.tsx
   - Добавлен endpoint DELETE /presence/leave/:workspaceId
   - Мгновенное удаление presence из KV Store

✅ /CHANGELOG.md
   - Документирован фикс

✅ /docs/FIX_HEARTBEAT_ERRORS.md (этот файл)
   - Детальная документация
```

## Best Practices

### ✅ Graceful degradation для presence системы

Presence - не критичная функция. Если heartbeat временно не работает:
- Пользователь всё равно может работать с календарем
- Онлайн статус обновится при следующей попытке
- Не нужно показывать ERROR при каждой ошибке

### ✅ Счетчики для умного логирования

```typescript
// Используй ref для отслеживания последовательных ошибок
const errorCount = useRef(0);

// При успехе - сбрасывай
if (response.ok) {
  errorCount.current = 0;
}

// При ошибке - инкрементируй
if (error) {
  errorCount.current++;
  
  // Логируй по-разному в зависимости от количества
  if (errorCount.current >= 3) {
    console.error('Системная проблема');
  } else {
    console.warn('Разовая ошибка');
  }
}
```

### ✅ Информативные инструкции при системных ошибках

```typescript
if (errorCount.current >= 3) {
  console.error('❌ Проблема с сервером');
  console.error('💡 Что делать:', 'supabase functions deploy ...');
}
```

---

**Дата:** 2025-10-21  
**Версия:** 1.0  
**Статус:** ✅ Исправлено
