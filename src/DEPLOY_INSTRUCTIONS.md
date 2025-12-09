# 🚀 Инструкции по развертыванию Edge Function

## Проблема
```
⚠️ Edge Function: таймаут (5 сек) - возможно функция не развернута
⚠️ Сервер недоступен - приложение не будет работать корректно
```

## Решение

### 1️⃣ Разверните Edge Function

Откройте терминал и выполните команду:

```bash
supabase functions deploy make-server-73d66528
```

### 2️⃣ Проверьте статус развертывания

После деплоя проверьте что функция работает:

```bash
curl https://zhukuvbdjyneoloarlqy.supabase.co/functions/v1/make-server-73d66528/health
```

Ожидаемый ответ:
```json
{"status":"ok","timestamp":"2025-12-05T..."}
```

### 3️⃣ Проверьте переменные окружения

Убедитесь что все переменные окружения установлены в Supabase Dashboard:

1. Откройте: https://supabase.com/dashboard/project/zhukuvbdjyneoloarlqy/settings/functions
2. Проверьте наличие:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_DB_URL`

### 4️⃣ Посмотрите логи функции

Если функция все еще не работает, проверьте логи:

1. Откройте: https://supabase.com/dashboard/project/zhukuvbdjyneoloarlqy/logs/edge-functions
2. Найдите функцию `make-server-73d66528`
3. Проверьте ошибки при запуске

## Частые проблемы

### Проблема: "Function not found"
**Решение:** Функция не развернута. Выполните `supabase functions deploy make-server-73d66528`

### Проблема: "Timeout after 5 seconds"
**Решение:** 
1. Функция может запускаться слишком долго (холодный старт)
2. Проверьте что нет бесконечных циклов в коде
3. Проверьте что база данных доступна

### Проблема: "Застрявший запрос events-delta-sync"
**Решение:**
1. Это может быть вызвано недоступностью базы данных
2. Проверьте что Supabase проект активен и не в режиме паузы
3. Перезагрузите приложение (F5)

## Быстрая диагностика

Выполните эти команды по порядку:

```bash
# 1. Проверка здоровья функции
curl https://zhukuvbdjyneoloarlqy.supabase.co/functions/v1/make-server-73d66528/health

# 2. Если не работает - деплой
supabase functions deploy make-server-73d66528

# 3. Повторная проверка
curl https://zhukuvbdjyneoloarlqy.supabase.co/functions/v1/make-server-73d66528/health
```

## Если ничего не помогло

1. **Проверьте статус Supabase**: https://status.supabase.com/
2. **Проверьте что проект активен**: https://supabase.com/dashboard/projects
3. **Свяжитесь с поддержкой Supabase** если проблема не решается

---

**После развертывания** перезагрузите приложение в браузере (F5) чтобы убедиться что все работает корректно.
