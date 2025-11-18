# Исправление: Сервер недоступен (Heartbeat errors)

## Проблема
```
⚠️ Heartbeat: сетевая ошибка - сервер может быть недоступен (попытка 1) - повтор через 30 сек
⚠️ OnlineUsers: сетевая ошибка, сервер может быть недоступен
```

## Диагностика

### Шаг 1: Откройте консоль браузера (F12)
Проверьте логи при загрузке приложения:

**Если сервер недоступен, вы увидите:**
```
🏥 Проверка доступности сервера...
   URL: https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-73d66528/health
   Project ID: YOUR_PROJECT_ID
❌ Ошибка проверки сервера: TypeError: Failed to fetch
═══════════════════════════════════════════════════════════════
⚠️  КРИТИЧЕСКАЯ ОШИБКА: Edge Function недоступен
═══════════════════════════════════════════════════════════════
```

**Если сервер доступен:**
```
🏥 Проверка доступности сервера...
✅ Сервер доступен: { status: "ok", timestamp: "..." }
```

### Шаг 2: Проверьте Network tab в DevTools
1. Откройте DevTools (F12)
2. Перейдите во вкладку Network
3. Перезагрузите страницу (F5)
4. Найдите запрос к `/make-server-73d66528/health`

**Возможные результаты:**

#### ❌ Запрос Failed (сетевая ошибка)
**Причина:** Edge Function не задеплоена или URL неправильный

**Решение:** Деплой Edge Function (см. ниже)

#### ❌ 404 Not Found
**Причина:** Неправильное имя функции или она не существует

**Решение:** Проверьте имя функции в Supabase Dashboard

#### ❌ 401 Unauthorized
**Причина:** Неправильный anon key

**Решение:** Проверьте `/utils/supabase/info.tsx`

#### ❌ 500 Internal Server Error
**Причина:** Ошибка в коде Edge Function

**Решение:** Проверьте логи в Supabase Dashboard

#### ❌ CORS Error
**Причина:** CORS не настроен в Edge Function

**Решение:** Проверьте что в `/supabase/functions/server/index.tsx` есть:
```typescript
import { cors } from 'npm:hono/cors';
app.use('*', cors({ origin: '*' }));
```

## Решение

### 1. Деплой Edge Function

```bash
# Перейдите в корень проекта
cd /path/to/your/project

# Деплой функции
supabase functions deploy make-server-73d66528
```

**Ожидаемый вывод:**
```
Bundling make-server-73d66528...
Deploying make-server-73d66528 (version X)
✅ Deployed Function make-server-73d66528 version X
```

**Если увидели ошибки при деплое:**
```bash
# Посмотрите детальные ошибки
supabase functions deploy make-server-73d66528 --debug
```

### 2. Проверка после деплоя

#### Способ 1: Через curl
```bash
curl https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-73d66528/health
```

**Ожидаемый ответ:**
```json
{"status":"ok","timestamp":"2024-10-21T12:00:00.000Z"}
```

#### Способ 2: Через браузер
Откройте в браузере:
```
https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-73d66528/health
```

Должен показать JSON с `{"status":"ok",...}`

#### Способ 3: Перезагрузка приложения
1. Перезагрузите страницу (F5)
2. Проверьте консоль - должно быть:
   ```
   🏥 Проверка доступности сервера...
   ✅ Сервер доступен: { status: "ok", ... }
   ```

### 3. Проверка логов Edge Function

Перейдите в Supabase Dashboard:
1. **Edge Functions** → **make-server-73d66528** → **Logs**
2. Проверьте что функция запускается и отвечает на запросы
3. Ищите ошибки (красные строки)

**Здоровые логи должны показывать:**
```
🏥 Health check endpoint called
✅ Server healthy
```

**При heartbeat:**
```
💓 Heartbeat от user@kode.ru в workspace 123
   user_metadata: {...}
✅ Presence сохранён: presence:123:uuid-here
```

## Частые причины проблемы

### Проблема 1: Edge Function не задеплоена после изменений
**Решение:** Всегда деплойте после изменений в `/supabase/functions/server/index.tsx`

### Проблема 2: Неправильный Project ID
**Проверьте файл:** `/utils/supabase/info.tsx`
```typescript
export const projectId = 'YOUR_PROJECT_ID';
export const publicAnonKey = 'YOUR_ANON_KEY';
```

**Где взять:**
- Supabase Dashboard → Settings → API → Project URL
- Project ID - это часть URL между `https://` и `.supabase.co`

### Проблема 3: Истек срок действия anon key
**Решение:** Обновите key в `/utils/supabase/info.tsx`

### Проблема 4: Функция была удалена
**Решение:** Разверните снова:
```bash
supabase functions deploy make-server-73d66528
```

### Проблема 5: Превышен лимит Edge Functions (Free plan)
**Проверьте:** Supabase Dashboard → Usage → Edge Functions
**Решение:** Апгрейд плана или ждите сброса лимитов

### Проблема 6: Ошибка в коде сервера после последних изменений
**Решение:** 
1. Проверьте логи в Dashboard
2. Откатитесь на предыдущую версию:
   ```bash
   supabase functions deploy make-server-73d66528 --version PREVIOUS_VERSION
   ```
3. Или исправьте ошибки и задеплойте снова

## Проверка текущего статуса

### Quick check
```bash
# Замените YOUR_PROJECT_ID на ваш Project ID
curl https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-73d66528/health
```

**Если ответ `{"status":"ok"}` - всё работает!**

### Проверка всех endpoints
```bash
# Health check
curl https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-73d66528/health

# Проверка наличия функции
supabase functions list

# Должно показать make-server-73d66528 в списке
```

## Автоматическая диагностика при ошибке

Приложение уже содержит автоматическую диагностику:

1. При загрузке проверяется health endpoint
2. Если недоступен - показывается **красный экран с инструкциями**
3. В консоли выводится детальная информация с шагами решения
4. В OnlineUsers компонент gracefully обрабатывает ошибки и показывает предупреждения

## Success Criteria

✅ Health check возвращает `{"status":"ok"}`
✅ В консоли: `✅ Сервер доступен`
✅ Нет ошибок heartbeat в консоли
✅ Онлайн пользователи отображаются корректно
✅ Можно войти в систему и работать с календарем

## Если ничего не помогло

1. **Проверьте интернет-соединение**
2. **Проверьте что Supabase проект активен** (не заблокирован, не удален)
3. **Создайте новый деплой с нуля:**
   ```bash
   supabase functions delete make-server-73d66528
   supabase functions deploy make-server-73d66528
   ```
4. **Проверьте переменные окружения в Supabase Dashboard:**
   - Settings → Edge Functions → Environment Variables
   - Должны быть: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL

## Контакты поддержки

Если проблема не решается:
1. Проверьте статус Supabase: https://status.supabase.com/
2. Supabase Discord: https://discord.supabase.com/
3. GitHub Issues: https://github.com/supabase/supabase/issues

---

**Версия документа:** 1.0
**Дата:** 2024-10-21
**Связанные файлы:**
- `/utils/healthCheck.ts` - проверка здоровья сервера
- `/components/scheduler/OnlineUsers.tsx` - heartbeat логика
- `/supabase/functions/server/index.tsx` - серверный код
