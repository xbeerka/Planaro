-- ⚡ ИСПРАВЛЕНИЕ UNIQUE CONSTRAINT ДЛЯ GRADES
-- Скопируйте эти команды и выполните в SQL Editor Supabase Dashboard

-- 1️⃣ Удаляем старый constraint (только на name)
ALTER TABLE grades DROP CONSTRAINT IF EXISTS grades_name_key;

-- 2️⃣ Создаём новый constraint (workspace_id + name)
ALTER TABLE grades ADD CONSTRAINT grades_workspace_name_unique 
  UNIQUE (workspace_id, name);

-- ✅ Готово! Теперь грейды уникальны ВНУТРИ воркспейса
-- Разные воркспейсы могут иметь грейды с одинаковыми именами

-- 🧪 Проверка (необязательно):
-- SELECT constraint_name, constraint_type 
-- FROM information_schema.table_constraints 
-- WHERE table_name = 'grades' AND constraint_type = 'UNIQUE';
