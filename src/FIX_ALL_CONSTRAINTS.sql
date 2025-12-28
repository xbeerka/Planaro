-- ⚡ ПОЛНОЕ ИСПРАВЛЕНИЕ ВСЕХ ПРОБЛЕМ БД
-- Скопируйте ВСЕ команды и выполните в SQL Editor Supabase Dashboard

-- ========================================
-- 🎯 GRADES: UNIQUE CONSTRAINT
-- ========================================

-- Удаляем старый constraint (только на name)
ALTER TABLE grades DROP CONSTRAINT IF EXISTS grades_name_key;

-- Создаём новый constraint (workspace_id + name)
ALTER TABLE grades ADD CONSTRAINT grades_workspace_name_unique 
  UNIQUE (workspace_id, name);

-- ========================================
-- 🎯 COMPANIES: UNIQUE CONSTRAINT
-- ========================================

-- Удаляем старый constraint (только на name)
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_name_key;

-- Создаём новый constraint (workspace_id + name)
ALTER TABLE companies ADD CONSTRAINT companies_workspace_name_unique 
  UNIQUE (workspace_id, name);

-- ========================================
-- 🎯 GRADES: SEQUENCE FIX
-- ========================================

-- Синхронизируем sequence с реальными данными
SELECT setval(
  pg_get_serial_sequence('grades', 'id'), 
  COALESCE((SELECT MAX(id) FROM grades), 0) + 1, 
  false
);

-- ========================================
-- 🎯 COMPANIES: SEQUENCE FIX (на всякий случай)
-- ========================================

-- Синхронизируем sequence с реальными данными
SELECT setval(
  pg_get_serial_sequence('companies', 'id'), 
  COALESCE((SELECT MAX(id) FROM companies), 0) + 1, 
  false
);

-- ========================================
-- ✅ ГОТОВО!
-- ========================================

-- 🧪 Проверка constraints:
-- SELECT table_name, constraint_name, constraint_type 
-- FROM information_schema.table_constraints 
-- WHERE table_name IN ('grades', 'companies') 
-- AND constraint_type = 'UNIQUE'
-- ORDER BY table_name, constraint_name;

-- 🧪 Проверка sequences:
-- SELECT 
--   'grades' as table_name,
--   last_value as seq,
--   (SELECT MAX(id) FROM grades) as max_id
-- FROM grades_id_seq
-- UNION ALL
-- SELECT 
--   'companies' as table_name,
--   last_value as seq,
--   (SELECT MAX(id) FROM companies) as max_id
-- FROM companies_id_seq;
