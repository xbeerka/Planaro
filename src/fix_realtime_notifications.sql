-- =====================================================
-- FIX: Realtime уведомления - INSERT события не приходят
-- =====================================================
-- Проблема: REPLICA IDENTITY DEFAULT не отправляет user_id в payload,
-- из-за чего RLS политики блокируют INSERT события.
-- Решение: Установить REPLICA IDENTITY FULL для отправки всех колонок.

-- 1️⃣ Установить REPLICA IDENTITY FULL для notification_recipients
-- Это заставит PostgreSQL отправлять ВСЕ колонки в Realtime событиях
ALTER TABLE public.notification_recipients REPLICA IDENTITY FULL;

-- 2️⃣ Проверяем/создаем RLS политики для notification_recipients
-- Включаем RLS (если еще не включен)
ALTER TABLE public.notification_recipients ENABLE ROW LEVEL SECURITY;

-- Удаляем старые политики (если есть) и создаем новые

-- SELECT: пользователь может видеть только свои записи
DROP POLICY IF EXISTS "Users can view own notification recipients" ON public.notification_recipients;
CREATE POLICY "Users can view own notification recipients"
  ON public.notification_recipients
  FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: пользователь может создавать записи для себя
DROP POLICY IF EXISTS "Users can insert own notification recipients" ON public.notification_recipients;
CREATE POLICY "Users can insert own notification recipients"
  ON public.notification_recipients
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: пользователь может обновлять только свои записи (is_read, read_at)
DROP POLICY IF EXISTS "Users can update own notification recipients" ON public.notification_recipients;
CREATE POLICY "Users can update own notification recipients"
  ON public.notification_recipients
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: пользователь может удалять только свои записи
DROP POLICY IF EXISTS "Users can delete own notification recipients" ON public.notification_recipients;
CREATE POLICY "Users can delete own notification recipients"
  ON public.notification_recipients
  FOR DELETE
  USING (auth.uid() = user_id);

-- 3️⃣ Также устанавливаем REPLICA IDENTITY FULL для notifications
-- (на случай если захотим подписаться и на эту таблицу)
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- 4️⃣ Проверяем RLS политики для notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- SELECT: пользователь может видеть уведомления, где он recipient
DROP POLICY IF EXISTS "Users can view notifications they received" ON public.notifications;
CREATE POLICY "Users can view notifications they received"
  ON public.notifications
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.notification_recipients
      WHERE notification_recipients.notification_id = notifications.id
        AND notification_recipients.user_id = auth.uid()
    )
  );

-- 5️⃣ Включаем Realtime для обеих таблиц (если еще не включен)
-- Это можно сделать только через Supabase Dashboard:
-- Settings -> API -> Realtime -> Enable для notification_recipients и notifications

-- 6️⃣ Проверка: выполните эти запросы, чтобы убедиться, что всё настроено
-- SELECT relname, relreplident FROM pg_class WHERE relname IN ('notification_recipients', 'notifications');
-- Ожидаемый результат: relreplident = 'f' (FULL) для обеих таблиц

-- SELECT schemaname, tablename, policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE tablename IN ('notification_recipients', 'notifications')
-- ORDER BY tablename, cmd;
-- Проверьте, что политики созданы правильно
