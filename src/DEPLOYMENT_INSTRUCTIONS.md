# Инструкции по развертыванию Edge Function

## Проблема
Вы видите ошибки:
```
⚠️ Heartbeat: сетевая ошибка - сервер может быть недоступен
⚠️ OnlineUsers: сетевая ошибка, сервер может быть недоступен
❌ Failed to fetch
```

## Причина
Edge Function `make-server-73d66528` не развернут на Supabase или недоступен.

## Решение

### Вариант 1: Развертывание через Supabase CLI (рекомендуется)

1. Установите Supabase CLI если еще не установлен:
```bash
npm install -g supabase
```

2. Войдите в Supabase:
```bash
supabase login
```

3. Свяжите проект:
```bash
supabase link --project-ref zhukuvbdjyneoloarlqy
```

4. Разверните функцию:
```bash
supabase functions deploy make-server-73d66528
```

### Вариант 2: Через Supabase Dashboard

1. Откройте [Supabase Dashboard](https://supabase.com/dashboard/project/zhukuvbdjyneoloarlqy)
2. Перейдите в раздел "Edge Functions"
3. Создайте новую функцию с именем `make-server-73d66528`
4. Скопируйте содержимое файла `/supabase/functions/server/index.tsx`
5. Сохраните и деплойте

### Проверка развертывания

После развертывания проверьте работоспособность:

```bash
curl https://zhukuvbdjyneoloarlqy.supabase.co/functions/v1/make-server-73d66528/health
```

Ожидаемый ответ:
```json
{"status":"ok","timestamp":"2025-11-07T..."}
```

## Переменные окружения

Убедитесь что следующие переменные окружения установлены в Supabase Dashboard:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL`

Эти переменные уже должны быть установлены автоматически.

## Troubleshooting

### Ошибка: "Function not found"
- Функция не была развернута или имя неправильное
- Проверьте список функций в Dashboard

### Ошибка: "CORS"
- CORS уже настроен в коде (`origin: "*"`)
- Если проблема сохраняется, проверьте настройки в Supabase Dashboard

### Ошибка: "Unauthorized"
- Проверьте что токен передается в заголовке `Authorization: Bearer <token>`
- Токен должен быть получен через `supabase.auth.signIn()`

## Структура функции

```
/supabase/functions/
  └── server/
      ├── index.tsx    # Основной файл с Hono сервером
      └── kv_store.tsx # KV Store утилиты (НЕ ИЗМЕНЯТЬ)
```

## Endpoint Prefix

Все endpoints начинаются с `/make-server-73d66528/`:

- `/make-server-73d66528/health` - health check
- `/make-server-73d66528/events` - события
- `/make-server-73d66528/resources` - сотрудники
- `/make-server-73d66528/projects` - проекты
- `/make-server-73d66528/departments` - департаменты
- `/make-server-73d66528/presence/heartbeat` - heartbeat для presence
- `/make-server-73d66528/presence/online/:workspaceId` - список онлайн пользователей
- и т.д.

## После развертывания

1. Перезагрузите приложение в браузере
2. Ошибки "Failed to fetch" должны исчезнуть
3. Heartbeat и OnlineUsers должны работать корректно
