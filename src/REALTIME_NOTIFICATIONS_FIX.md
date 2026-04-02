# 🔔 Исправление Realtime уведомлений - INSERT события не приходят

## 🔴 Проблема

DELETE события приходят через Realtime, но INSERT события НЕ приходят, хотя данные успешно сохраняются в БД.

## 🎯 Причина

**REPLICA IDENTITY DEFAULT** — по умолчанию PostgreSQL отправляет в Realtime событиях только PRIMARY KEY (`id`), без других колонок типа `user_id`. 

RLS политики для SELECT проверяют `user_id` в событии, но его там нет → INSERT блокируется → клиент не получает событие.

DELETE работает, потому что RLS для DELETE использует только `id` (PRIMARY KEY всегда есть).

## ✅ Решение

Установить **REPLICA IDENTITY FULL** для таблиц `notification_recipients` и `notifications`. Это заставит PostgreSQL отправлять **ВСЕ колонки** в Realtime событиях, что позволит RLS политикам работать корректно.

## 📋 Шаги исправления

### 1️⃣ Открыть SQL Editor в Supabase Dashboard

1. Перейти в Supabase Dashboard: https://supabase.com/dashboard
2. Выбрать проект **Planaro**
3. Открыть **SQL Editor** (слева в меню)

### 2️⃣ Выполнить SQL скрипт

1. Создать новый Query
2. Скопировать содержимое файла `/fix_realtime_notifications.sql`
3. Нажать **Run** (Ctrl+Enter)

### 3️⃣ Включить Realtime для таблиц (если еще не включен)

1. Перейти в **Settings → API → Realtime**
2. Найти таблицы `notification_recipients` и `notifications`
3. Включить переключатель **Enable** для обеих таблиц
4. Убедиться, что включены события **INSERT**, **UPDATE**, **DELETE**

### 4️⃣ Проверить результат

В SQL Editor выполнить проверочные запросы:

```sql
-- Проверка REPLICA IDENTITY (ожидается 'f' = FULL)
SELECT relname, relreplident 
FROM pg_class 
WHERE relname IN ('notification_recipients', 'notifications');

-- Проверка RLS политик
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('notification_recipients', 'notifications')
ORDER BY tablename, cmd;
```

**Ожидаемый результат:**
- `relreplident = 'f'` (FULL) для обеих таблиц
- Должны быть политики для SELECT, INSERT, UPDATE, DELETE

### 5️⃣ Перезагрузить фронтенд

1. Обновить страницу приложения (F5)
2. Подождать подключения Realtime (см. консоль: `🔌 Realtime notifications status: SUBSCRIBED`)
3. Отправить инвайт с другого аккаунта
4. Проверить, что событие `INSERT` пришло в консоли:
   ```
   🔔 Realtime notification_recipients event: INSERT {...}
   ```

## 🧪 Тестирование

### Сценарий 1: Получение инвайта
1. Открыть две вкладки с разными аккаунтами (@kode.ru)
2. Вкладка 1: отправить инвайт для Вкладки 2
3. Вкладка 2: должна получить Realtime событие INSERT
4. Консоль Вкладки 2: `🔔 Realtime notification_recipients event: INSERT {...}`

### Сценарий 2: Удаление уведомления
1. Удалить уведомление
2. Консоль: `🔔 Realtime notification_recipients event: DELETE {...}`
3. UI: уведомление должно исчезнуть БЕЗ "моргания"

### Сценарий 3: Прочтение уведомления
1. Кликнуть на непрочитанное уведомление
2. Консоль: `🔔 Realtime notification_recipients event: UPDATE {...}`
3. UI: уведомление должно стать прочитанным (галочка исчезнет)

## 🐛 Если проблема осталась

### Проверка 1: Realtime включен?
```sql
-- В SQL Editor
SELECT * FROM _realtime.extensions;
-- Должна быть строка с enabled = true
```

### Проверка 2: RLS работает?
```sql
-- Проверить, что RLS включен
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('notification_recipients', 'notifications');
-- rowsecurity должен быть true
```

### Проверка 3: Токен валидный?
В консоли браузера после подключения:
```javascript
// Проверить токен
const { data, error } = await supabase.auth.getSession();
console.log('Session:', data.session);
console.log('User ID:', data.session?.user?.id);
```

### Проверка 4: Лог Supabase Edge Function
1. Перейти в **Edge Functions → Logs**
2. Найти запрос на создание инвайта
3. Проверить, что инвайт успешно создан (200 OK)
4. Проверить, что `notification_recipients` запись создана

## 📝 Дополнительная информация

### Что такое REPLICA IDENTITY?

PostgreSQL использует **REPLICA IDENTITY** для определения, какие данные отправлять в события репликации (в том числе Realtime).

- **DEFAULT** (по умолчанию): отправляется только PRIMARY KEY
- **FULL**: отправляются ВСЕ колонки (до и после изменения)

### Почему DELETE работал без FULL?

RLS политика для DELETE:
```sql
USING (auth.uid() = user_id)
```

Supabase Realtime **заполняет** `user_id` из OLD record в БД перед проверкой RLS, поэтому для DELETE достаточно PRIMARY KEY.

Но для INSERT OLD record не существует, поэтому Supabase берет данные из payload события. Если там нет `user_id` (REPLICA IDENTITY DEFAULT), RLS блокирует событие.

### Безопасность REPLICA IDENTITY FULL

RLS политики проверяются **ДО** отправки события клиенту, поэтому установка FULL **НЕ раскрывает** чужие данные. Клиент получит только те события, на которые у него есть права по RLS.

## 🎉 Результат

После применения исправления:
- ✅ INSERT события приходят мгновенно
- ✅ DELETE события работают без "моргания"
- ✅ UPDATE события синхронизируются корректно
- ✅ Уведомления показываются в реальном времени

---

**Версия**: 1.0.0  
**Дата**: 31 марта 2026  
**Статус**: READY TO APPLY
