# Исправление счетчиков workspaces - инструкция по деплою

## Проблема
Счетчики проектов и пользователей показывают 0 потому что:
- View `workspaces_summary` возвращает поля `projects_count` и `users_count`
- Frontend ожидает поля `project_count` и `member_count`
- Маппинг должен происходить на сервере, но endpoint не задеплоен

## Решение

### 1. Деплой сервера (ОБЯЗАТЕЛЬНО!)

```bash
# Перейдите в директорию проекта
cd /path/to/project

# Деплой Edge Function
supabase functions deploy make-server-73d66528

# Проверьте что деплой успешен - должно появиться:
# ✔ Deployed Function make-server-73d66528
```

### 2. Проверка в логах Supabase

После деплоя откройте **Supabase Dashboard** → **Edge Functions** → **make-server-73d66528** → **Logs**

При загрузке страницы с workspaces вы должны увидеть:

```
📊 Загрузка summary для workspace 14
   User email: user@kode.ru
   User ID: ...
📊 RAW данные из workspaces_summary view: {...}
   Доступные поля: [...]
   projects_count (raw): 3
   users_count (raw): 2
   department_count (raw): 2
🔍 КРИТИЧЕСКАЯ ПРОВЕРКА: Endpoint /workspaces/14/summary ВЫЗВАН!
✅ Summary из view: { projects: 3, members: 2, departments: 2 }
📤 ОТПРАВЛЯЕМ КЛИЕНТУ mapped summary: {
  "id": 14,
  "project_count": 3,    ← Правильное поле!
  "member_count": 2,     ← Правильное поле!
  "department_count": 2,
  ...
}
```

### 3. Проверка в консоли браузера

Откройте **DevTools (F12)** → **Console**

Вы должны увидеть:

```
🌐 Запрос summary для workspace: 14
📥 Получен summary для workspace 14: {
  "id": 14,
  "project_count": 3,    ← НЕ projects_count!
  "member_count": 2,     ← НЕ users_count!
  ...
}
   project_count: 3      ← НЕ undefined!
   member_count: 2       ← НЕ undefined!
🔍 Воркспейс "Временный воркспейс": projects=3, members=2, departments=2
```

## Если проблема НЕ решилась

### Проверка 1: Endpoint вызывается?

Если в логах сервера НЕТ сообщения `🔍 КРИТИЧЕСКАЯ ПРОВЕРКА: Endpoint /workspaces/14/summary ВЫЗВАН!`, значит:
- Endpoint НЕ вызывается вообще
- Возможно есть другой endpoint который перехватывает запрос
- Проверьте порядок routes в `/supabase/functions/server/index.tsx`

### Проверка 2: Маппинг работает?

Если endpoint вызывается, но клиент получает `projects_count` вместо `project_count`:
- Проверьте что в логах есть сообщение `📤 ОТПРАВЛЯЕМ КЛИЕНТУ mapped summary`
- Проверьте JSON который отправляется - должен содержать `project_count`, НЕ `projects_count`

### Проверка 3: Клиент использует правильный endpoint?

Проверьте в Network tab (F12 → Network):
- Должен быть запрос к `/make-server-73d66528/workspaces/14/summary`
- НЕ к `/workspaces_summary` или другому пути
- Status должен быть 200 OK
- Response должен содержать `project_count`, `member_count`

## Ожидаемый результат

После деплоя:
- ✅ Счетчик проектов показывает реальное количество (например, 3)
- ✅ Счетчик людей показывает реальное количество (например, 2)
- ✅ Счетчик департаментов показывает реальное количество (например, 2)
- ✅ Не видно ошибок в консоли браузера
- ✅ Не видно ошибок в логах Edge Function

## Альтернативное решение (если view пустая)

Если view `workspaces_summary` возвращает нули:
```
⚠️ View вернула нули, делаем ручной подсчет для workspace 14...
📊 Ручной подсчет: { projects: 3, users: 2, departments: 2 }
✅ Summary с ручным подсчетом: { projects: 3, members: 2, departments: 2 }
```

Endpoint автоматически делает fallback на ручной подсчет из таблиц.

---

**ВАЖНО**: Без деплоя изменения НЕ применятся! Обязательно выполните:
```bash
supabase functions deploy make-server-73d66528
```
