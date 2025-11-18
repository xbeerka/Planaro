# Исправление: Обновление аватарки профиля

## Дата: 2024-10-21
## Версия: 1.8.8+hotfix

## Проблема
Аватарка не обновлялась после изменения профиля, даже после перезагрузки страницы.

## Корневая причина
ProfileModal НЕ передавал `force_refresh: true` при запросе новой сессии, из-за чего сервер возвращал старый токен со старыми user_metadata.

## Исправления

### 1. ProfileModal.tsx (критическое)
```diff
  body: JSON.stringify({ 
    session_id: storedSessionId,
+   force_refresh: true  // Принудительное обновление токена
  })
```

**Эффект:** Сервер теперь вызывает `refreshSession()` и возвращает свежий токен с обновленными user_metadata, включая новый avatarUrl.

### 2. /supabase/functions/server/index.tsx - Cache-busting
```diff
  const { data: { publicUrl } } = supabase.storage
    .from(bucketName)
    .getPublicUrl(filePath);

+ // Add cache-busting parameter to prevent browser caching
+ const cacheBustedUrl = `${publicUrl}?t=${Date.now()}`;

- return c.json({ avatar_url: publicUrl });
+ return c.json({ avatar_url: cacheBustedUrl });
```

**Эффект:** Браузер не использует закэшированную версию аватарки, всегда загружает новую.

### 3. Улучшенное логирование
Добавлены детальные логи в endpoints:
- `/profile/update` - показывает user_metadata ДО и ПОСЛЕ обновления
- `/auth/session` - показывает user_metadata при force_refresh
- `/presence/heartbeat` - показывает user_metadata в каждом heartbeat

**Эффект:** Упрощает диагностику проблем с аватарками.

## Flow обновления (правильный)

1. Пользователь выбирает файл → сжатие на клиенте до 200px
2. `/profile/upload-avatar` → загрузка в Storage → `URL?t=timestamp`
3. `/profile/update` → обновление user_metadata через `admin.updateUserById`
4. `/auth/session?force_refresh=true` → `refreshSession()` → СВЕЖИЙ токен
5. `handleTokenRefresh()` → обновление accessToken в App.tsx
6. OnlineUsers получает новый токен → `decodeSupabaseJWT()` → avatarUrl
7. Heartbeat → сервер сохраняет avatarUrl в presence
8. Другие пользователи получают avatarUrl через batch запрос

## Затронутые файлы

- ✏️ `/components/workspace/ProfileModal.tsx` - добавлен force_refresh
- ✏️ `/supabase/functions/server/index.tsx` - cache-busting + логирование
- ✅ `/components/scheduler/OnlineUsers.tsx` - без изменений (уже правильно)
- ✅ `/App.tsx` - без изменений (handleTokenRefresh уже правильно)

## Testing

См. `/AVATAR_UPDATE_TEST.md` для полного чеклиста.

**Быстрая проверка:**
1. Обновить аватарку в профиле
2. Проверить что Toast показывает "Профиль обновлён!" БЕЗ перезагрузки
3. Проверить что аватарка в хедере обновилась
4. Войти в воркспейс → проверить что аватарка в списке онлайн пользователей

## Breaking Changes
Нет

## Обратная совместимость
Полная. Старые аватарки продолжают работать, новые получают cache-busting параметр.

## Deployment

```bash
supabase functions deploy make-server-73d66528
```

⚠️ **ВАЖНО:** Без деплоя изменения на сервере НЕ применятся!

## Метрики

- Время исправления: ~30 минут
- Затронуто файлов: 2
- Строк кода изменено: ~15
- Критичность: HIGH (аватарки - важная часть UX)

## Дополнительные материалы

- `/AVATAR_UPDATE_DEBUG.md` - подробная диагностика
- `/AVATAR_UPDATE_TEST.md` - чеклист тестирования
