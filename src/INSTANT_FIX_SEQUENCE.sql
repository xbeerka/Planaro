-- ⚡ МГНОВЕННОЕ ИСПРАВЛЕНИЕ SEQUENCE ДЛЯ GRADES
-- Скопируйте эту команду и выполните в SQL Editor Supabase Dashboard

SELECT setval(
  pg_get_serial_sequence('grades', 'id'), 
  COALESCE((SELECT MAX(id) FROM grades), 0) + 1, 
  false
);

-- ✅ После выполнения создание грейдов будет работать!
-- Следующий созданный грейд получит ID = MAX(id) + 1

-- 🧪 Проверка (необязательно):
-- SELECT last_value FROM grades_id_seq;
-- SELECT MAX(id) FROM grades;
