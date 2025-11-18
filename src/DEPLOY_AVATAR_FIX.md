# Деплой исправления обновления аватарки

## Что исправлено
Аватарка теперь обновляется мгновенно без перезагрузки страницы благодаря `force_refresh: true` в ProfileModal.

## Шаги деплоя

### 1. Убедись что файлы изменены
```bash
# Проверь что изменения применены
git diff components/workspace/ProfileModal.tsx
# Должна быть строка: force_refresh: true

git diff supabase/functions/server/index.tsx
# Должен быть cache-busting: const cacheBustedUrl = `${publicUrl}?t=${Date.now()}`;
```

### 2. Deploy Edge Function
```bash
cd /path/to/project

supabase functions deploy make-server-73d66528
```

**Ожидаемый вывод:**
```
Bundling make-server-73d66528...
Deploying make-server-73d66528 (version X)
✅ Deployed Function make-server-73d66528 version X
```

### 3. Проверь что функция работает
```bash
curl https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-73d66528/health
```

**Ожидаемый ответ:**
```json
{"status":"ok","timestamp":"2024-10-21T..."}
```

### 4. Проверь версию в Supabase Dashboard
1. Открой Supabase Dashboard
2. Перейди в Edge Functions
3. Найди `make-server-73d66528`
4. Проверь что версия обновилась

### 5. Тестирование (см. AVATAR_UPDATE_TEST.md)
```bash
# Открой файл с чеклистом
cat AVATAR_UPDATE_TEST.md
```

## Rollback (если что-то пошло не так)

### Откатить Edge Function
```bash
# Найти предыдущую версию
supabase functions list

# Откатиться на предыдущую версию (замени VERSION_NUMBER)
supabase functions deploy make-server-73d66528 --version VERSION_NUMBER
```

### Откатить код
```bash
git checkout HEAD -- components/workspace/ProfileModal.tsx
git checkout HEAD -- supabase/functions/server/index.tsx
```

## Что ломается если НЕ задеплоить

❌ Cache-busting НЕ работает - браузер кэширует старые аватарки
❌ Логирование НЕ показывает user_metadata - сложно дебажить
✅ ProfileModal `force_refresh` работает (клиентский код) 

**Вывод:** Деплой КРИТИЧЕН для полного исправления, но частичное улучшение уже работает.

## Время выполнения
- Deploy: 1 минута
- Проверка: 1 минута
- Тестирование: 5 минут
- **Итого: 7 минут**

## Готово!
После деплоя аватарки обновляются мгновенно и кэш браузера не мешает.
