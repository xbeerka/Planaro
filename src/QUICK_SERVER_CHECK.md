# Быстрая проверка сервера - 2 минуты

## 🎯 Цель
Быстро определить доступен ли сервер и что делать если нет.

## ✅ Шаг 1: Проверка в браузере (30 секунд)

### 1.1 Откройте консоль браузера
- **Chrome/Edge:** `F12` или `Ctrl+Shift+I`
- **Firefox:** `F12` или `Ctrl+Shift+K`
- **Safari:** `Cmd+Option+I`

### 1.2 Перезагрузите страницу
Нажмите `F5` или `Ctrl+R`

### 1.3 Смотрите на логи в консоли

#### ✅ ХОРОШО - Сервер работает:
```
🏥 Проверка доступности сервера...
   URL: https://xxxxx.supabase.co/functions/v1/make-server-73d66528/health
   Project ID: xxxxx
✅ Сервер доступен: { status: "ok", timestamp: "..." }
```
**→ Всё ОК! Сервер работает. Проблема в чём-то другом.**

#### ❌ ПЛОХО - Сервер недоступен:
```
🏥 Проверка доступности сервера...
❌ Ошибка проверки сервера: TypeError: Failed to fetch
═══════════════════════════════════════════════════════════════
⚠️  КРИТИЧЕСКАЯ ОШИБКА: Edge Function недоступен
═══════════════════════════════════════════════════════════════
```
**→ Сервер не работает. Переходите к Шагу 2.**

## 🔧 Шаг 2: Деплой Edge Function (1 минута)

### 2.1 Откройте терминал в корне проекта

### 2.2 Выполните команду деплоя
```bash
supabase functions deploy make-server-73d66528
```

### 2.3 Проверьте результат

#### ✅ Успешный деплой:
```
Bundling make-server-73d66528...
Deploying make-server-73d66528 (version X)
✅ Deployed Function make-server-73d66528 version X
```
**→ Отлично! Переходите к Шагу 3.**

#### ❌ Ошибка деплоя:
```
Error: Failed to deploy function
```
**→ Проблема с кодом или настройками. См. полную диагностику в FIX_SERVER_UNAVAILABLE.md**

## ✅ Шаг 3: Проверка работоспособности (30 секунд)

### 3.1 Откройте URL в браузере
Замените `YOUR_PROJECT_ID` на ваш Project ID:
```
https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-73d66528/health
```

**Где взять Project ID?**
- Откройте консоль браузера (F12)
- Найдите строку `Project ID: xxxxx`
- Или в Supabase Dashboard → Settings → API → Project URL

### 3.2 Ожидаемый результат
```json
{"status":"ok","timestamp":"2024-10-21T12:00:00.000Z"}
```

### 3.3 Вернитесь в приложение и перезагрузите
- Нажмите `F5` в браузере
- Проверьте консоль - должно быть `✅ Сервер доступен`
- Ошибки heartbeat должны исчезнуть

## 🎯 Quick Commands

### Деплой
```bash
supabase functions deploy make-server-73d66528
```

### Проверка статуса (curl)
```bash
curl https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-73d66528/health
```

### Список функций
```bash
supabase functions list
```

### Логи функции
```bash
supabase functions logs make-server-73d66528
```

## 🔴 Если после деплоя всё ещё не работает

### Проблема 1: `supabase: command not found`
**Решение:** Установите Supabase CLI:
```bash
npm install -g supabase
```

### Проблема 2: `Login required`
**Решение:** Войдите в Supabase:
```bash
supabase login
```

### Проблема 3: Деплой проходит, но сервер не отвечает
**Решение:** Проверьте логи в Supabase Dashboard:
1. Откройте https://supabase.com/dashboard
2. Выберите ваш проект
3. Edge Functions → make-server-73d66528 → Logs
4. Ищите красные строки (ошибки)

### Проблема 4: 401 Unauthorized
**Решение:** Обновите anon key в `/utils/supabase/info.tsx`:
1. Supabase Dashboard → Settings → API
2. Скопируйте "anon/public" key
3. Вставьте в файл

### Проблема 5: Ничего не помогает
**Решение:** Откройте полную диагностику:
```
Смотрите файл: FIX_SERVER_UNAVAILABLE.md
```

## 📊 Индикаторы здорового сервера

✅ Health endpoint возвращает `{"status":"ok"}`
✅ В консоли браузера: `✅ Сервер доступен`
✅ Нет ошибок `⚠️ Heartbeat: сетевая ошибка`
✅ Онлайн пользователи отображаются
✅ Можно войти и создавать события

## ⏱️ Время выполнения
- Проверка: 30 секунд
- Деплой: 1 минута
- Проверка работоспособности: 30 секунд
- **Итого: 2 минуты**

---

**Версия:** 1.0  
**Последнее обновление:** 2024-10-21

**Связанные документы:**
- `FIX_SERVER_UNAVAILABLE.md` - полная диагностика
- `DEPLOY_AVATAR_FIX.md` - деплой исправлений аватарок
