-- ⚡ ИСПРАВЛЕНИЕ UNIQUE CONSTRAINT ДЛЯ COMPANIES
-- Скопируйте эти команды и выполните в SQL Editor Supabase Dashboard

-- 1️⃣ Удаляем старый constraint (только на name)
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_name_key;

-- 2️⃣ Создаём новый constraint (workspace_id + name)
ALTER TABLE companies ADD CONSTRAINT companies_workspace_name_unique 
  UNIQUE (workspace_id, name);

-- ✅ Готово! Теперь компании уникальны ВНУТРИ воркспейса
-- Разные воркспейсы могут иметь компании с одинаковыми именами

-- 🧪 Проверка (необязательно):
-- SELECT constraint_name, constraint_type 
-- FROM information_schema.table_constraints 
-- WHERE table_name = 'companies' AND constraint_type = 'UNIQUE';
