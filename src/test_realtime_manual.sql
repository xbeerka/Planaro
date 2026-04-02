-- =====================================================
-- ТЕСТ: Ручная проверка Realtime уведомлений
-- =====================================================
-- Выполни ВЕСЬ скрипт СРАЗУ в SQL Editor, держа открытой
-- вкладку браузера с приложением и DevTools Console.

-- ВАЖНО: Открой консоль браузера ДО выполнения скрипта!

-- ⚠️ ЗАМЕНИ на свой user_id из консоли браузера или из таблицы profiles
-- Твой user_id: b3b30d74-bfbb-4e6a-8e3b-764d00add95d

-- Создаем notification и сразу recipient в одной транзакции
DO $$
DECLARE
  new_notification_id INT;
  my_user_id UUID := 'b3b30d74-bfbb-4e6a-8e3b-764d00add95d'; -- ⚠️ ЗАМЕНИ на свой!
BEGIN
  -- Создаем notification
  INSERT INTO notifications (
    organization_id,
    workspace_id,
    actor_auth_user_id,
    type,
    title,
    body,
    data,
    created_at
  ) VALUES (
    NULL,
    NULL,
    my_user_id,
    'system',
    '🧪 Ручной тест Realtime',
    'Если ты видишь это уведомление в UI - Realtime работает!',
    '{"test": true, "manual": true}'::jsonb,
    NOW()
  ) RETURNING id INTO new_notification_id;
  
  RAISE NOTICE '✅ Notification created: id=%', new_notification_id;
  
  -- Создаем recipient запись (именно здесь должно сработать Realtime событие!)
  INSERT INTO notification_recipients (
    notification_id,
    user_id,
    is_read,
    read_at,
    archived_at,
    created_at,
    updated_at
  ) VALUES (
    new_notification_id,
    my_user_id,
    false,
    NULL,
    NULL,
    NOW(),
    NOW()
  );
  
  RAISE NOTICE '✅ Recipient created for notification_id=%', new_notification_id;
  RAISE NOTICE '🔔 ПРОВЕРЬ КОНСОЛЬ БРАУЗЕРА СЕЙЧАС!';
  RAISE NOTICE 'Должно быть: 🔔 Realtime notification_recipients event: INSERT';
END $$;

-- ПРОВЕРКА:
-- 1️⃣ Смотри на консоль браузера СРАЗУ после выполнения
-- 2️⃣ Должно быть: "🔔 Realtime notification_recipients event: INSERT {..."
-- 3️⃣ Должно быть: "🔔 Realtime: получено событие notification_recipients, перезагружаем..."
-- 4️⃣ Уведомление должно появиться в UI (колокольчик в шапке)

-- ✅ Если Realtime событие ПРИШЛО → Проблема в Edge Function
-- ❌ Если Realtime событие НЕ ПРИШЛО → Проблема в настройках Realtime в Dashboard