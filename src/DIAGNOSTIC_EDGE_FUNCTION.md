# 🔍 Диагностика: Почему Edge Function не триггерит Realtime?

## ✅ Что мы выяснили:

1. ✅ **Realtime РАБОТАЕТ** — ручной INSERT триггерит событие
2. ✅ **RLS политики правильные** — Service Role может создавать записи
3. ✅ **REPLICA IDENTITY FULL** установлен
4. ✅ **Код Edge Function выглядит правильно**

## 🤔 Возможные причины:

### Гипотеза 1: Транзакции и задержки
Edge Function создает записи в транзакции, и Realtime может не успевать отправить событие до коммита.

### Гипотеза 2: Разные Supabase клиенты
Ручной INSERT использует твой JWT токен, Edge Function использует Service Role. Возможно, Realtime игнорирует события от Service Role.

### Гипотеза 3: Батчинг событий
Supabase Realtime может батчить события и отправлять их с задержкой.

### Гипотеза 4: Фильтры Realtime
Хотя мы убрали фильтр `eq('user_id', userId)` из подписки, может быть проблема на уровне сервера.

## 🧪 Тест для проверки гипотез

### Шаг 1: Отправь инвайт через UI

1. Открой консоль браузера (F12)
2. Открой **Supabase Dashboard → Edge Functions → Logs**
3. Отправь инвайт через UI
4. **Проверь логи Edge Function:**
   - ✅ `📝 Notification created: id=XXX`
   - ✅ `✅ notification_recipients created: {...}`
   - ✅ `✅ RLS CHECK OK: Запись читается после создания`
   - ✅ `🔔 Org invite notification → USER_ID (email)`

5. **Проверь консоль браузера:**
   - ❓ Пришло ли `🔔 Realtime notification_recipients event: INSERT`?

### Шаг 2: Проверь задержку

Иногда Realtime события приходят с задержкой 1-3 секунды. Подожди 5 секунд после отправки инвайта и проверь:
- Появилось ли событие в консоли с задержкой?
- Появилось ли уведомление в UI?

### Шаг 3: Проверь БД напрямую

После отправки инвайта выполни в SQL Editor:

```sql
-- Получи ID последнего созданного уведомления
SELECT * FROM notifications 
ORDER BY created_at DESC 
LIMIT 1;

-- Получи recipient для этого уведомления
SELECT * FROM notification_recipients 
WHERE notification_id = (
  SELECT id FROM notifications 
  ORDER BY created_at DESC 
  LIMIT 1
);
```

Если записи есть в БД, но Realtime событие не пришло — проблема в Realtime триггерах.

### Шаг 4: Сравни ручной INSERT и Edge Function INSERT

**Ручной тест (работает):**
```sql
INSERT INTO notification_recipients (
  notification_id, user_id, is_read, read_at, archived_at, created_at, updated_at
) VALUES (
  40, 'b3b30d74-bfbb-4e6a-8e3b-764d00add95d', false, NULL, NULL, NOW(), NOW()
);
```

**Edge Function (не работает?):**
```typescript
.insert({ notification_id: notif.id, user_id: profile.id })
```

Разница: в ручном тесте мы **явно** указываем `created_at` и `updated_at`, а Edge Function полагается на default values.

## 🔧 Попробуй исправление

Давай явно укажем timestamps в Edge Function:

```typescript
const { data: recipientData, error: recipientErr } = await supabase
  .from('notification_recipients')
  .insert({ 
    notification_id: notif.id, 
    user_id: profile.id,
    is_read: false,
    read_at: null,
    archived_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  })
  .select('*');
```

## 📝 Чек-лист действий:

- [ ] Отправить инвайт через UI
- [ ] Проверить логи Edge Function (есть ли ошибки?)
- [ ] Проверить консоль браузера (пришло ли Realtime событие?)
- [ ] Подождать 5 секунд (может быть задержка)
- [ ] Проверить БД напрямую (есть ли записи?)
- [ ] Попробовать исправление с явными timestamps

---

**Следующий шаг:** Отправь инвайт через UI и скопируй сюда:
1. Логи из Edge Function
2. Логи из консоли браузера
3. Результат SQL запроса из Шага 3

Это поможет точно определить проблему.
