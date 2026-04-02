-- =====================================================
-- FIX v2: Realtime уведомления - Service Role INSERT
-- =====================================================
-- Проблема: Edge Function использует Service Role для INSERT,
-- но Realtime проверяет RLS для обычного пользователя.
-- Результат: запись создается в БД, но Realtime событие блокируется.

-- Решение: Разрешить Service Role создавать записи для любых пользователей,
-- но обычные пользователи могут создавать только для себя.

-- 1️⃣ Установить REPLICA IDENTITY FULL (если еще не установлено)
ALTER TABLE public.notification_recipients REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- 2️⃣ Включить RLS
ALTER TABLE public.notification_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 3️⃣ Удалить старые политики
DROP POLICY IF EXISTS "Users can view own notification recipients" ON public.notification_recipients;
DROP POLICY IF EXISTS "Users can insert own notification recipients" ON public.notification_recipients;
DROP POLICY IF EXISTS "Users can update own notification recipients" ON public.notification_recipients;
DROP POLICY IF EXISTS "Users can delete own notification recipients" ON public.notification_recipients;
DROP POLICY IF EXISTS "Service role can manage all notification recipients" ON public.notification_recipients;

-- 4️⃣ Создать новые политики с поддержкой Service Role

-- SELECT: пользователь видит только свои записи (Service Role видит всё)
CREATE POLICY "Users can view own notification recipients"
  ON public.notification_recipients
  FOR SELECT
  USING (
    auth.uid() = user_id 
    OR auth.jwt()->>'role' = 'service_role'
  );

-- INSERT: Service Role может создавать для любых пользователей,
-- обычные пользователи - только для себя
CREATE POLICY "Service role and users can insert notification recipients"
  ON public.notification_recipients
  FOR INSERT
  WITH CHECK (
    auth.jwt()->>'role' = 'service_role'
    OR auth.uid() = user_id
  );

-- UPDATE: пользователь может обновлять только свои записи (Service Role - всё)
CREATE POLICY "Users can update own notification recipients"
  ON public.notification_recipients
  FOR UPDATE
  USING (
    auth.uid() = user_id
    OR auth.jwt()->>'role' = 'service_role'
  )
  WITH CHECK (
    auth.uid() = user_id
    OR auth.jwt()->>'role' = 'service_role'
  );

-- DELETE: пользователь может удалять только свои записи (Service Role - всё)
CREATE POLICY "Users can delete own notification recipients"
  ON public.notification_recipients
  FOR DELETE
  USING (
    auth.uid() = user_id
    OR auth.jwt()->>'role' = 'service_role'
  );

-- 5️⃣ Политики для notifications

DROP POLICY IF EXISTS "Users can view notifications they received" ON public.notifications;
DROP POLICY IF EXISTS "Service role can manage notifications" ON public.notifications;

-- SELECT: пользователь видит уведомления, где он recipient (Service Role - всё)
CREATE POLICY "Users can view notifications they received"
  ON public.notifications
  FOR SELECT
  USING (
    auth.jwt()->>'role' = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.notification_recipients
      WHERE notification_recipients.notification_id = notifications.id
        AND notification_recipients.user_id = auth.uid()
    )
  );

-- INSERT: только Service Role может создавать уведомления
CREATE POLICY "Service role can insert notifications"
  ON public.notifications
  FOR INSERT
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- UPDATE: только Service Role может обновлять уведомления
CREATE POLICY "Service role can update notifications"
  ON public.notifications
  FOR UPDATE
  USING (auth.jwt()->>'role' = 'service_role')
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- DELETE: только Service Role может удалять уведомления
CREATE POLICY "Service role can delete notifications"
  ON public.notifications
  FOR DELETE
  USING (auth.jwt()->>'role' = 'service_role');

-- 6️⃣ Проверка
-- SELECT relname, relreplident FROM pg_class WHERE relname IN ('notification_recipients', 'notifications');
-- Ожидается: relreplident = 'f' (FULL)

-- SELECT schemaname, tablename, policyname, cmd
-- FROM pg_policies
-- WHERE tablename IN ('notification_recipients', 'notifications')
-- ORDER BY tablename, cmd;
