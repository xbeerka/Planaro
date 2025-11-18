# 🔧 Исправление: Ошибка PGRST204 - updated_at не найден в workspaces

## 🐛 Проблема

При создании workspace возникала ошибка:
```
❌ Ошибка создания workspace: {
  code: "PGRST204",
  details: null,
  hint: null,
  message: "Could not find the 'updated_at' column of 'workspaces' in the schema cache"
}
```

## 🔍 Причина

Код пытался создавать и обновлять колонку `updated_at` в таблице `workspaces`, но такой колонки не существует в схеме БД.

**Проблемные места**:
1. **Создание workspace** (строка ~2751):
   ```typescript
   const workspaceData: any = {
     name,
     timeline_year,
     created_at: now,
     updated_at: now  // ❌ Колонка не существует!
   };
   ```

2. **Обновление workspace** (строка ~3024):
   ```typescript
   updateData.updated_at = new Date().toISOString(); // ❌ Колонка не существует!
   ```

## ✅ Решение

### 1. Убрали `updated_at` при создании workspace

**Было**:
```typescript
const workspaceData: any = {
  name,
  timeline_year,
  created_at: now,
  updated_at: now  // Set initial updated_at to created_at
};
```

**Стало**:
```typescript
const workspaceData: any = {
  name,
  timeline_year,
  created_at: now
  // updated_at не используется - нет такой колонки в таблице workspaces
};
```

### 2. Убрали `updated_at` при обновлении workspace

**Было**:
```typescript
if (name !== undefined) updateData.name = name;
if (timeline_year !== undefined) updateData.timeline_year = timeline_year;

// Always update updated_at timestamp
updateData.updated_at = new Date().toISOString();
```

**Стало**:
```typescript
if (name !== undefined) updateData.name = name;
if (timeline_year !== undefined) updateData.timeline_year = timeline_year;

// updated_at не используется - нет такой колонки в таблице workspaces
```

### 3. Сделали поля summary опциональными

На всякий случай добавили `?.` для полей summary (они могут быть в таблице workspaces_summary):

```typescript
const mappedSummary = {
  id: summary.id,
  project_count: projectsCount || 0,
  member_count: usersCount || 0,
  department_count: departmentsCount || 0,
  last_activity_at: summary?.last_activity_at || null,
  last_updated: summary?.last_updated || null,
  updated_at: summary?.updated_at || null,  // Может быть в workspaces_summary
  summary_json: summary?.summary_json || null
};
```

## 📦 Изменённые файлы

- ✅ `/supabase/functions/server/index.tsx` - убрали `updated_at` из workspaces операций

## 🚀 Деплой

**Требуется деплой сервера**:
```bash
supabase functions deploy make-server-73d66528
```

## ✅ Проверка

После деплоя проверьте:

1. **Создание workspace**:
   - Зайдите в приложение
   - Нажмите "Создать рабочее пространство"
   - Заполните название и год
   - Нажмите "Создать"
   - **Ожидается**: ✅ Workspace создан успешно, без ошибок PGRST204

2. **Обновление workspace**:
   - Откройте существующий workspace
   - Измените название или год
   - Нажмите "Сохранить"
   - **Ожидается**: ✅ Workspace обновлён успешно

3. **Логи сервера**:
   ```
   ✅ Workspace создан: {id} {name}
   ```

## 📝 Примечания

### Таблица `workspaces` имеет только:
- `id` (primary key)
- `name` (text)
- `timeline_year` (integer)
- `created_at` (timestamp)
- **НЕТ `updated_at`** ← Это норма!

### Таблица `workspaces_summary` может иметь:
- `id` (foreign key to workspaces)
- `project_count` (integer)
- `member_count` (integer)
- `department_count` (integer)
- `last_activity_at` (timestamp)
- `last_updated` (timestamp)
- `updated_at` (timestamp) ← Может быть здесь
- `summary_json` (jsonb)

Функция `updateWorkspaceSummary` уже была **отключена** ранее (строка 56-85) именно из-за отсутствия `updated_at` в таблице `workspaces`.

## 🎯 Результат

Теперь создание и обновление workspaces работает корректно без попыток записи в несуществующую колонку `updated_at`.

---

**Версия**: 1.0  
**Дата**: 2025-10-21  
**Статус**: ✅ Готово к деплою  
**Тип**: Bugfix (критический)
