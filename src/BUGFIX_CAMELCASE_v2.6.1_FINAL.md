# ✅ BUGFIX v2.6.1 FINAL - CamelCase Database Columns

## 📅 Дата: 2025-10-23

---

## 🎯 Главная проблема

**БД использует camelCase, а код использовал snake_case!**

### В базе данных Supabase:
```sql
-- Таблица projects
CREATE TABLE projects (
  id BIGSERIAL PRIMARY KEY,
  name TEXT,
  backgroundColor TEXT,  -- ← CAMEL CASE!
  textColor TEXT,        -- ← CAMEL CASE!
  pattern_id BIGINT,     -- ← snake_case для FK
  workspace_id BIGINT
);
```

### В коде было:
```typescript
// ❌ НЕПРАВИЛЬНО - использовал snake_case
backgroundColor: project.background_color  // БД не знает такую колонку!
textColor: project.text_color              // БД не знает такую колонку!

// При INSERT
background_color: body.backgroundColor     // БД не знает такую колонку!
text_color: body.textColor                 // БД не знает такую колонку!
```

### Теперь исправлено:
```typescript
// ✅ ПРАВИЛЬНО - используем camelCase как в БД
backgroundColor: project.backgroundColor   // Прямое соответствие с БД
textColor: project.textColor               // Прямое соответствие с БД

// При INSERT
backgroundColor: body.backgroundColor      // Прямое соответствие с БД
textColor: body.textColor                  // Прямое соответствие с БД
```

---

## 🔧 Что было исправлено

### 1. GET /polling/batch/:workspaceId
```typescript
// ❌ Было
backgroundColor: project.background_color || '#3a87ad'
textColor: project.text_color || '#ffffff'

// ✅ Стало
backgroundColor: project.backgroundColor || '#3a87ad'
textColor: project.textColor || '#ffffff'
```

### 2. GET /projects
```typescript
// ❌ Было
backgroundColor: p.background_color || undefined
textColor: p.text_color || undefined

// ✅ Стало
backgroundColor: p.backgroundColor || undefined
textColor: p.textColor || undefined
```

### 3. POST /projects (INSERT)
```typescript
// ❌ Было
const projectData = {
  name: body.name,
  workspace_id: body.workspace_id,
  background_color: body.backgroundColor || null,  // ← Не та колонка!
  text_color: body.textColor || null,              // ← Не та колонка!
  pattern_id: patternId
};

// ✅ Стало
const projectData = {
  name: body.name,
  workspace_id: body.workspace_id,
  backgroundColor: body.backgroundColor || null,   // ← Правильно!
  textColor: body.textColor || null,               // ← Правильно!
  pattern_id: patternId
};
```

### 4. POST /projects (RESPONSE)
```typescript
// ❌ Было
backgroundColor: data.background_color || undefined
textColor: data.text_color || undefined

// ✅ Стало
backgroundColor: data.backgroundColor || undefined
textColor: data.textColor || undefined
```

### 5. PUT /projects/:id (UPDATE)
```typescript
// ❌ Было
const projectData: any = {};
if (body.backgroundColor !== undefined) projectData.background_color = body.backgroundColor;
if (body.textColor !== undefined) projectData.text_color = body.textColor;

// ✅ Стало
const projectData: any = {};
if (body.backgroundColor !== undefined) projectData.backgroundColor = body.backgroundColor;
if (body.textColor !== undefined) projectData.textColor = body.textColor;
```

### 6. PUT /projects/:id (RESPONSE)
```typescript
// ❌ Было
backgroundColor: data[0].background_color || undefined
textColor: data[0].text_color || undefined

// ✅ Стало
backgroundColor: data[0].backgroundColor || undefined
textColor: data[0].textColor || undefined
```

---

## 📊 Статистика

- **6 исправлений** в `/supabase/functions/server/index.tsx`
- **4 endpoints** затронуты:
  - `GET /polling/batch/:workspaceId`
  - `GET /projects`
  - `POST /projects`
  - `PUT /projects/:id`
- **12 строк кода** изменено (по 2 поля в 6 местах)

---

## 🧪 Как протестировать

### 1. Создание проекта
```bash
1. Открой "Управление проектами"
2. Нажми "Добавить проект"
3. Введи название
4. Выбери цвета (или оставь автогенерацию)
5. Нажми "Сохранить"
6. ✅ Проект должен сохраниться БЕЗ ошибки 500
7. ✅ Цвета должны отобразиться в списке
```

### 2. Редактирование проекта
```bash
1. Кликни на проект в списке
2. Измени цвет фона (backgroundColor)
3. Измени цвет текста (textColor)
4. Нажми "Сохранить"
5. ✅ Изменения должны сохраниться БЕЗ ошибки 500
6. ✅ Новые цвета должны отобразиться
```

### 3. События с цветами проекта
```bash
1. Создай событие на календаре
2. Выбери проект с кастомными цветами
3. ✅ Событие должно отобразиться с правильными цветами
4. ✅ При наведении цвета должны быть корректными
```

---

## 🚀 Деплой

### ⚠️ ОБЯЗАТЕЛЬНО задеплой Edge Function!

```bash
supabase functions deploy make-server-73d66528
```

**Без деплоя**:
- ❌ Будет ошибка 500 при создании проектов
- ❌ Будет ошибка 500 при редактировании проектов
- ❌ Проекты не будут загружаться

**После деплоя**:
- ✅ Создание проектов работает
- ✅ Редактирование работает
- ✅ Загрузка данных работает

---

## 📝 Почему это важно

### Supabase PostgREST правила:
1. **Имена колонок чувствительны к регистру** в некоторых случаях
2. **PostgREST возвращает данные с теми же именами**, что и в БД
3. **INSERT/UPDATE требуют точных имён колонок**

### Пример ошибки:
```javascript
// Если в БД колонка: backgroundColor (camelCase)
const { data } = await supabase
  .from('projects')
  .insert({ background_color: '#ff0000' })  // ❌ ОШИБКА!
  
// PostgREST не найдет колонку background_color → 500 error
// {"error": "Could not find the 'background_color' column..."}
```

### Правильно:
```javascript
// Если в БД колонка: backgroundColor (camelCase)
const { data } = await supabase
  .from('projects')
  .insert({ backgroundColor: '#ff0000' })  // ✅ Работает!
```

---

## 🎓 Урок на будущее

### Всегда проверяй РЕАЛЬНУЮ схему БД!

```bash
# В Supabase Dashboard → Database → Tables → projects → Structure
# Смотри точное название колонок
```

### Не полагайся на конвенции!

- ❌ НЕ думай "в БД всегда snake_case"
- ✅ ПРОВЕРЬ реальное название колонки
- ✅ Используй ТОЧНОЕ соответствие

### Frontend → Backend → Database

```typescript
// Frontend (всегда camelCase)
const project = { backgroundColor: '#ff0000', textColor: '#ffffff' };

// Backend API (camelCase для удобства)
app.post('/projects', async (c) => {
  const body = await c.req.json(); // { backgroundColor, textColor }
  
  // Database INSERT (должно совпадать с реальной схемой!)
  await supabase.from('projects').insert({
    backgroundColor: body.backgroundColor,  // ← Совпадает с БД
    textColor: body.textColor                // ← Совпадает с БД
  });
});
```

---

## ✅ Checklist для деплоя

- [x] Исправлены все 6 мест в server/index.tsx
- [x] Обновлена документация (Guidelines.md)
- [x] BUGFIX_DROPDOWN_v2.6.1.md обновлён
- [x] BUGFIX_FINAL_v2.6.1.md обновлён
- [ ] **ЗАДЕПЛОЙ Edge Function**: `supabase functions deploy make-server-73d66528`
- [ ] Протестируй создание проекта
- [ ] Протестируй редактирование проекта
- [ ] Коммит в Git: `fix(db): use camelCase for backgroundColor/textColor v2.6.1`

---

## 🎉 Результат

После деплоя:
- ✅ Проекты создаются без ошибок
- ✅ Проекты редактируются без ошибок
- ✅ Цвета отображаются корректно
- ✅ Dropdown Menu работает (предыдущий bugfix)
- ✅ Код синхронизирован с реальной схемой БД

**Готово к продакшену!** 🚀
