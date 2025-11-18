# Отладка счетчиков workspaces_summary

## Проблема
Счетчики проектов и пользователей показывают 0 вместо реальных значений.

## Решение

### 1. Серверные изменения
Добавлены endpoints:
- `GET /make-server-73d66528/workspaces` - получение списка воркспейсов
- `GET /make-server-73d66528/workspaces/:id/summary` - получение summary

### 2. Маппинг полей
View `workspaces_summary` содержит:
- `projects_count` → маппится в `project_count`
- `users_count` → маппится в `member_count`
- `department_count` → остается как есть

### 3. Fallback механизм
Если view возвращает нули, сервер делает ручной подсчет из таблиц:
```typescript
// Подсчет проектов
SELECT COUNT(*) FROM projects WHERE workspace_id = ?

// Подсчет пользователей
SELECT COUNT(*) FROM users WHERE workspace_id = ?

// Подсчет департаментов
SELECT COUNT(*) FROM departments WHERE workspace_id = ?
```

## Диагностика

### 1. Деплой сервера
```bash
supabase functions deploy make-server-73d66528
```

### 2. Проверка логов сервера
В Supabase Dashboard → Edge Functions → Logs должно появиться:

```
📊 Загрузка summary для workspace <id>
📊 RAW данные из workspaces_summary view: {...}
   Доступные поля: [...]
   projects_count (raw): X
   users_count (raw): Y
   department_count (raw): Z
```

Если видите:
```
⚠️ View вернула нули, делаем ручной подсчет...
📊 Ручной подсчет: { projects: X, users: Y, departments: Z }
```

Значит view `workspaces_summary` не возвращает данные (проблема с RLS или с самой view).

### 3. Проверка логов клиента
В консоли браузера должно быть:

```
🌐 Запрос summary для workspace: <id>
📥 Получен summary для workspace <id>: {...}
   project_count: X
   member_count: Y
   department_count: Z
🔍 Воркспейс "Название": projects=X, members=Y, departments=Z
```

## Возможные причины проблемы

### 1. View не создана или пустая
Проверьте в Supabase SQL Editor:
```sql
SELECT * FROM workspaces_summary;
```

Должны увидеть данные с полями `id`, `projects_count`, `users_count`, `department_count`.

### 2. RLS блокирует доступ к view
Проверьте RLS политики на view:
```sql
-- Посмотреть политики
SELECT * FROM pg_policies WHERE tablename = 'workspaces_summary';
```

Если view защищена RLS, нужно добавить политику:
```sql
-- Разрешить чтение для владельцев воркспейсов
CREATE POLICY "Users can read their workspace summaries"
ON workspaces_summary FOR SELECT
USING (
  id IN (
    SELECT id FROM workspaces 
    WHERE owner_id = auth.uid()
  )
);
```

### 3. Названия полей не совпадают
Проверьте структуру view:
```sql
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'workspaces_summary';
```

Должны быть поля:
- `id`
- `projects_count` (не `project_count`!)
- `users_count` (не `member_count`!)
- `department_count`

## Ожидаемый результат
После деплоя сервера счетчики должны показывать реальные значения:
- Проектов: количество из таблицы `projects` для данного workspace
- Людей: количество из таблицы `users` для данного workspace
- Департаментов: количество из таблицы `departments` для данного workspace

## Если проблема не решена

1. Проверьте логи Edge Function в Supabase Dashboard
2. Проверьте консоль браузера (F12 → Console)
3. Проверьте Network tab (F12 → Network) - запрос к `/workspaces/:id/summary` должен возвращать 200 OK
4. Если view пустая - используется fallback с ручным подсчетом (должно работать в любом случае)
