# Отладка обновления аватарки

## Проблема
Аватарка не обновляется после изменения профиля, даже после перезагрузки страницы.

## Корневая причина
ProfileModal НЕ передавал параметр `force_refresh: true` при запросе новой сессии после обновления профиля. Из-за этого сервер возвращал старый access_token со старыми user_metadata (без обновленного avatar_url).

## Исправление

### 1. ProfileModal.tsx (строка 177)
**Было:**
```typescript
body: JSON.stringify({ session_id: storedSessionId })
```

**Стало:**
```typescript
body: JSON.stringify({ 
  session_id: storedSessionId,
  force_refresh: true  // ← КРИТИЧНО! Принудительное обновление для получения свежих user_metadata
})
```

### 2. Cache-busting для аватарок (/supabase/functions/server/index.tsx, строка 3236)
**Было:**
```typescript
return c.json({ avatar_url: publicUrl });
```

**Стало:**
```typescript
// Add cache-busting parameter to prevent browser caching
const cacheBustedUrl = `${publicUrl}?t=${Date.now()}`;
return c.json({ avatar_url: cacheBustedUrl });
```

### 3. Улучшенное логирование
Добавлены детальные логи в серверные endpoints для диагностики:

- `/profile/update` - показывает avatar_url ДО и ПОСЛЕ обновления
- `/auth/session` - показывает user_metadata в обновленном токене при force_refresh
- `/presence/heartbeat` - показывает user_metadata в каждом heartbeat

## Flow обновления аватарки

1. Пользователь выбирает файл → клиентское сжатие до 200px (imageResize.ts)
2. ProfileModal → `/profile/upload-avatar` → загрузка в Storage → получение URL с `?t=timestamp`
3. ProfileModal → `/profile/update` → обновление user_metadata через `admin.updateUserById`
4. ProfileModal → `/auth/session` с `force_refresh: true` → принудительный refreshSession()
5. Сервер вызывает `supabaseAuth.auth.refreshSession()` → получает СВЕЖИЙ токен с обновленными user_metadata
6. App.tsx → `handleTokenRefresh()` → обновление accessToken в state и IndexedDB
7. OnlineUsers получает обновленный токен через props → `decodeSupabaseJWT()` → извлекает avatarUrl
8. При следующем heartbeat → сервер сохраняет avatarUrl в presence → другие пользователи видят обновленную аватарку

## Критические точки

### ✅ ОБЯЗАТЕЛЬНО: force_refresh
Без `force_refresh: true` сервер НЕ обновит токен и вернёт старые user_metadata.

### ✅ ОБЯЗАТЕЛЬНО: Cache-busting
Браузер может кэшировать аватарку по URL. Параметр `?t=timestamp` заставляет браузер загрузить новое изображение.

### ✅ ОБЯЗАТЕЛЬНО: Токен в OnlineUsers
OnlineUsers ВСЕГДА берёт текущего пользователя из токена (строка 36-49), а НЕ из presence. Это гарантирует актуальность avatarUrl.

## Как проверить что работает

### 1. Проверить логи сервера при обновлении профиля
```
💾 Обновление профиля для user@kode.ru: { display_name: 'John Doe', avatar_url: 'https://...?t=1729540800000' }
📝 Данные для обновления user_metadata: { name: 'John Doe', avatar_url: 'https://...?t=1729540800000' }
✅ Профиль обновлён для user@kode.ru
   User metadata после обновления: { name: 'John Doe', avatar_url: 'да (https://...)' }
```

### 2. Проверить логи при force_refresh
```
🔄 FORCE_REFRESH: принудительное обновление для получения свежих user_metadata
✅ Access token успешно обновлен
   Новый expires_at: 2024-10-21T12:00:00.000Z
   User metadata в обновленном токене: { name: 'John Doe', avatar_url: 'да (https://...)' }
```

### 3. Проверить логи heartbeat после обновления
```
💓 Heartbeat от user@kode.ru в workspace 123
   user_metadata: {"name":"John Doe","avatar_url":"https://...?t=1729540800000"}
✅ Presence сохранён: presence:123:uuid-here
   displayName: John Doe
   avatarUrl: https://...?t=1729540800000
```

### 4. Проверить IndexedDB (DevTools → Application → IndexedDB)
- Ключ: `auth_access_token`
- Значение: JWT токен (decode на jwt.io)
- Проверить что в payload есть `user_metadata.avatar_url`

### 5. Проверить Network (DevTools → Network)
При загрузке аватарки должен быть query параметр `?t=...`:
```
https://xxxxx.supabase.co/storage/v1/object/public/make-73d66528-avatars/avatars/user_123.jpg?t=1729540800000
```

## Troubleshooting

### Аватарка всё ещё не меняется
1. Откройте DevTools → Console
2. Обновите профиль
3. Ищите логи:
   - `🔄 Обновление токена для получения свежих user_metadata...`
   - `✅ Новый токен получен с обновленными user_metadata`
   - `✅ Токен обновлен, все компоненты получат свежие данные`
4. Если логов нет → проверьте что `onTokenRefresh` передается в ProfileModal
5. Если логи есть, но аватарка не меняется → проверьте Network tab, загружается ли новое изображение

### Старая аватарка в кэше браузера
1. Жесткая перезагрузка: Ctrl+Shift+R (Windows) или Cmd+Shift+R (Mac)
2. Очистить кэш: DevTools → Application → Storage → Clear site data
3. Проверить что URL аватарки содержит `?t=...` параметр

### Аватарка есть в токене, но не в presence
1. Проверьте логи heartbeat - должен быть avatarUrl
2. Если в heartbeat нет avatarUrl → проблема в декодировании токена на сервере
3. Если в heartbeat есть, но в batch нет → проблема в KV Store

### Аватарка есть у меня, но другие пользователи не видят
1. Проверьте что heartbeat отправляется каждые 30 секунд
2. Проверьте логи `/presence/heartbeat` - должен быть avatarUrl
3. Другие пользователи должны увидеть обновление в течение 15 секунд (следующий batch запрос)

## Деплой

После исправления НЕ ЗАБУДЬТЕ задеплоить Edge Function:

```bash
supabase functions deploy make-server-73d66528
```

Без деплоя изменения на сервере НЕ применятся!

## Версия
- Исправлено: 2024-10-21
- Версия: 1.8.8+hotfix
- Commit: avatar-update-force-refresh
