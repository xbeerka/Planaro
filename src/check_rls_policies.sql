-- Проверка RLS политик для notification_recipients

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'notification_recipients'
ORDER BY cmd, policyname;
