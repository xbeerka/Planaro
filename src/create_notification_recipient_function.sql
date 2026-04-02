-- =====================================================
-- ФУНКЦИЯ: Создание notification recipient с триггером Realtime
-- =====================================================
-- Эта функция работает с SECURITY DEFINER (от имени владельца БД),
-- обходит RLS, но триггерит Realtime события корректно.

CREATE OR REPLACE FUNCTION create_notification_recipient(
  p_notification_id BIGINT,
  p_user_id UUID
)
RETURNS TABLE(
  id BIGINT,
  notification_id BIGINT,
  user_id UUID,
  is_read BOOLEAN,
  read_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER -- 🔥 КЛЮЧЕВОЕ: работает с правами владельца БД
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO notification_recipients (
    notification_id,
    user_id,
    is_read,
    read_at,
    archived_at,
    created_at,
    updated_at
  ) VALUES (
    p_notification_id,
    p_user_id,
    false,
    NULL,
    NULL,
    NOW(),
    NOW()
  )
  RETURNING *;
END;
$$;

-- Даем права на выполнение функции для authenticated пользователей
GRANT EXECUTE ON FUNCTION create_notification_recipient(BIGINT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION create_notification_recipient(BIGINT, UUID) TO anon;
GRANT EXECUTE ON FUNCTION create_notification_recipient(BIGINT, UUID) TO service_role;

COMMENT ON FUNCTION create_notification_recipient IS 
'Создает notification_recipient с SECURITY DEFINER для обхода RLS и корректного Realtime триггера';