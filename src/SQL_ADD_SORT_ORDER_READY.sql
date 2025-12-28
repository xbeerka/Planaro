-- =====================================================
-- МИГРАЦИЯ: Добавление sort_order в grades и companies
-- =====================================================
-- Статус: ✅ READY TO EXECUTE
-- Дата: 2024-12-16
--
-- ВНИМАНИЕ: Выполните этот скрипт в Supabase Dashboard → SQL Editor
-- После выполнения необходимо redeploy Edge Function
-- =====================================================

-- ====================
-- 1. GRADES: Add sort_order
-- ====================

-- Добавляем колонку sort_order (NOT NULL с default)
ALTER TABLE grades 
ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

-- Устанавливаем начальные значения на основе id (группировка по workspace_id)
WITH numbered AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (PARTITION BY workspace_id ORDER BY id) - 1 AS new_sort_order
  FROM grades
)
UPDATE grades
SET sort_order = numbered.new_sort_order
FROM numbered
WHERE grades.id = numbered.id;

-- Создаём индекс для быстрой сортировки
CREATE INDEX IF NOT EXISTS idx_grades_workspace_sort 
ON grades(workspace_id, sort_order);

-- Проверка результата
SELECT 
  id,
  name,
  workspace_id,
  sort_order,
  'grades' as table_name
FROM grades
ORDER BY workspace_id, sort_order;

-- ====================
-- 2. COMPANIES: Add sort_order
-- ====================

-- Добавляем колонку sort_order (NOT NULL с default)
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

-- Устанавливаем начальные значения на основе id (группировка по workspace_id)
WITH numbered AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (PARTITION BY workspace_id ORDER BY id) - 1 AS new_sort_order
  FROM companies
)
UPDATE companies
SET sort_order = numbered.new_sort_order
FROM numbered
WHERE companies.id = numbered.id;

-- Создаём индекс для быстрой сортировки
CREATE INDEX IF NOT EXISTS idx_companies_workspace_sort 
ON companies(workspace_id, sort_order);

-- Проверка результата
SELECT 
  id,
  name,
  workspace_id,
  sort_order,
  'companies' as table_name
FROM companies
ORDER BY workspace_id, sort_order;

-- ====================
-- ✅ МИГРАЦИЯ ЗАВЕРШЕНА
-- ====================
-- 
-- СЛЕДУЮЩИЕ ШАГИ:
-- 1. ✅ Проверьте результаты запросов выше
-- 2. ✅ Redeploy Edge Function: supabase functions deploy make-server-73d66528
-- 3. ✅ Обновите код сервера (уберите fallback в трансформации)
-- 4. ✅ Обновите .order('id') на .order('sort_order') в запросах
-- 5. ✅ Протестируйте Drag & Drop в UI
-- 
-- ====================
