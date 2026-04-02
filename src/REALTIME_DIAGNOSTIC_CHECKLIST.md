# 🔔 Чеклист диагностики Realtime уведомлений

## Шаг 1: Проверить, включен ли Realtime для таблицы

1. Открыть **Supabase Dashboard** → https://supabase.com/dashboard
2. Выбрать проект **Planaro**
3. Перейти в **Database → Replication**
4. Найти таблицу `notification_recipients`
5. **Убедиться, что:**
   - ✅ Включен переключатель напротив таблицы
   - ✅ Включены события: **INSERT**, **UPDATE**, **DELETE**

**Если Realtime НЕ включен** — это и есть причина проблемы!

---

## Шаг 2: Проверить RLS политики

Выполнить в **SQL Editor**:

```sql
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'notification_recipients'
ORDER BY cmd;
```

**Ожидаемый результат:**

| tablename                  | policyname                     | cmd    | qual                                       |
|----------------------------|--------------------------------|--------|--------------------------------------------|
| notification_recipients    | Users can view...              | SELECT | auth.uid() = user_id OR role=service_role |
| notification_recipients    | Service role can insert...     | INSERT | role=service_role OR auth.uid()=user_id   |
| notification_recipients    | Users can update...            | UPDATE | auth.uid() = user_id OR role=service_role |
| notification_recipients    | Users can delete...            | DELETE | auth.uid() = user_id OR role=service_role |

**Если политик нет или они другие** — нужно выполнить `/fix_realtime_notifications_v2.sql`

---

## Шаг 3: Проверить REPLICA IDENTITY

Выполнить в **SQL Editor**:

```sql
SELECT 
  relname as table_name,
  CASE relreplident
    WHEN 'd' THEN 'DEFAULT (только PK)'
    WHEN 'f' THEN 'FULL (все колонки)'
    WHEN 'i' THEN 'INDEX'
    WHEN 'n' THEN 'NOTHING'
  END as replica_identity
FROM pg_class
WHERE relname IN ('notification_recipients', 'notifications');
```

**Ожидаемый результат:**

| table_name                  | replica_identity        |
|-----------------------------|-------------------------|
| notification_recipients     | FULL (все колонки)      |
| notifications               | FULL (все колонки)      |

**Если DEFAULT** — нужно выполнить `/fix_realtime_notifications_v2.sql`

---

## Шаг 4: Проверить создание уведомления на сервере

1. Открыть **Edge Functions → Logs** в Supabase Dashboard
2. Отправить инвайт с фронтенда
3. Найти лог запроса `POST /organizations/:id/members`
4. **Проверить:**
   - ✅ `📝 Notification created: id=XXX` (не null)
   - ✅ `✅ notification_recipients created: {...}`
   - ✅ Нет ошибок типа `❌ Failed to insert notification_recipients`

**Если есть ошибки** — проблема на сервере (RLS блокирует Service Role)

---

## Шаг 5: Проверить Realtime на клиенте

1. Открыть **DevTools → Console**
2. Должны быть логи:
   - ✅ `🔌 Подписка на Realtime уведомления для ...`
   - ✅ `🔌 Realtime notifications status: SUBSCRIBED`
   - ❌ **НЕТ** `🔔 Realtime notification_recipients event: INSERT` ← ПРОБЛЕМА

3. Проверить, что подписка активна:
```javascript
// В консоли браузера
console.log(supabase.getChannels());
// Должен быть канал с названием "notifications:USER_ID:..."
```

---

## Шаг 6: Ручная проверка Realtime в SQL Editor

Попробуй **вручную** создать запись в SQL Editor:

```sql
-- Получить свой user_id
SELECT auth.uid();
-- Результат: b3b30d74-bfbb-4e6a-8e3b-764d00add95d

-- Вручную вставить запись (замени USER_ID на свой)
INSERT INTO notification_recipients (notification_id, user_id)
VALUES (999, 'b3b30d74-bfbb-4e6a-8e3b-764d00add95d');

-- Если ошибка "new row violates row-level security policy" - проблема в RLS
-- Если ошибка "foreign key constraint" - ок, это нормально (notification 999 не существует)
-- Если успешно - проверь консоль браузера, пришло ли Realtime событие
```

**Если Realtime событие НЕ пришло** — проблема в настройках Realtime в Dashboard.

---

## Шаг 7: Nuclear Option - Пересоздать подписку

Если всё остальное в порядке, попробуй пересоздать Realtime подписку.

В `/services/api/notifications.ts` измени:

```typescript
const channelName = `notifications:${userId}:${Date.now()}`;
```

на:

```typescript
// Используем простое имя канала (без timestamp)
const channelName = `notifications:${userId}`;

// И отписываемся от старого канала перед созданием нового
supabaseClient.removeAllChannels();
```

---

## Итого: Вероятные причины

По убыванию вероятности:

1. **🔥 REALTIME НЕ ВКЛЮЧЕН** в Database → Replication для `notification_recipients`
2. **RLS политики блокируют** SELECT для созданной Service Role записи
3. **REPLICA IDENTITY DEFAULT** вместо FULL
4. **Старая подписка висит** и блокирует новую
5. Браузер кэширует старое WebSocket соединение

---

## Быстрый тест

Открой **две вкладки**:

**Вкладка 1** (отправитель):
```javascript
// В консоли браузера
const { data, error } = await supabase.rpc('test_notification_insert', { target_user: 'b3b30d74-bfbb-4e6a-8e3b-764d00add95d' });
```

**Вкладка 2** (получатель):
- Должно прийти Realtime событие в консоль

Если не пришло — **100% проблема в настройках Realtime в Dashboard**.
