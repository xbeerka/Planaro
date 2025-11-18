# Инструкция по деплою обновлений

## 📋 Что было изменено (v1.8.8)

### Серверная часть (критично!)
- `/supabase/functions/server/index.tsx`:
  - **Новый endpoint**: `DELETE /make-server-73d66528/presence/leave/:workspaceId` - явный уход из воркспейса
  - **TTL presence уменьшен**: с 120 до 60 секунд (строки 3170, 3234, 3295)
  - Исправление "призраков" в онлайн статусе

### Клиентская часть (критично!)
- `/components/scheduler/OnlineUsers.tsx`:
  - Новая функция `sendLeave()` - отправка DELETE запроса при размонтировании
  - useEffect cleanup вызывает `sendLeave()` при закрытии календаря

- `/App.tsx`:
  - **Мгновенная очистка кэша** в `handleBackToWorkspaces()`
  - Удаляет текущего пользователя из `cache_online_users_batch` перед возвратом
  - Устраняет "мигание" аватарки при переходе из календаря → список воркспейсов

## 🚀 Шаги для деплоя

### 1. Деплой Edge Function (ОБЯЗАТЕЛЬНО!)

```bash
# Убедитесь что находитесь в корневой директории проекта
cd /path/to/resource-scheduler

# Деплой Edge Function
supabase functions deploy make-server-73d66528
```

**Ожидаемый вывод:**
```
Deploying make-server-73d66528 (project ref: ...)
Bundled make-server-73d66528 size: XXX KB
Deployed function make-server-73d66528
```

### 2. Проверка деплоя

```bash
# Проверить health endpoint
curl https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-73d66528/health

# Ожидаемый ответ:
# {"status":"ok","timestamp":"2025-10-20T..."}
```

### 3. Функциональное тестирование

**Быстрая проверка (5 минут)**:
См. подробную инструкцию: `/docs/QUICK_TEST_v1.8.8.md`

**Основные сценарии**:
1. Откройте календарь → нажмите "Назад" → НЕ должно быть "мигания" вашей аватарки
2. В двух браузерах: один открывает календарь, другой видит онлайн → закрытие календаря → аватарка исчезает за 0-15 сек
3. Закрытие вкладки браузера → аватарка исчезает максимум через 60 сек (fallback)

### 4. Проверка логов

1. Открыть Supabase Dashboard
2. Edge Functions → make-server-73d66528 → Logs
3. Должны появиться новые логи при запуске:
   ```
   🔧 Инициализация Supabase клиента...
   URL: ✓ установлен
   SERVICE KEY: ✓ установлен
   ANON KEY: ✓ установлен
   ```

### 4. Тест автоматического обновления токенов

#### Способ 1: Быстрый тест (рекомендуется)

1. Войти в приложение
2. Открыть DevTools → Console
3. Выполнить в консоли:
```javascript
// Проверить текущую сессию
const sessionId = await (await indexedDB.databases())[0].name;
const db = await new Promise(r => {
  const req = indexedDB.open('check_auth_db');
  req.onsuccess = () => r(req.result);
});
const tx = db.transaction('storage', 'readonly');
const store = tx.objectStore('storage');
const req = store.get('auth_session_id');
req.onsuccess = () => console.log('Session ID:', req.result);
```

4. Проверить Supabase KV store:
   - Database → Tables → kv_store_73d66528
   - Найти ключ `session:<uuid>`
   - Убедиться что value содержит `refresh_token`

#### Способ 2: Полный тест (см. TEST_REFRESH_TOKEN.md)

Следовать инструкциям в файле `TEST_REFRESH_TOKEN.md`

## ⚠️ Важно!

### ДО деплоя
- ❌ Не изменять схему базы данных
- ❌ Не удалять существующие сессии из KV store
- ✅ Убедиться что все переменные окружения установлены

### ПОСЛЕ деплоя
- ✅ Проверить логи Edge Function
- ✅ Проверить что health endpoint отвечает
- ✅ Проверить что новые сессии сохраняют refresh_token
- ✅ Уведомить существующих пользователей о необходимости повторного входа (опционально)

## 🔍 Проверка корректности деплоя

### Контрольный список

- [ ] Edge Function деплоинута без ошибок
- [ ] Health endpoint отвечает `{"status":"ok"}`
- [ ] Логи Edge Function показывают инициализацию
- [ ] Новый вход создает сессию с refresh_token в KV store
- [ ] Проверка сессии через 1+ час не требует повторного входа
- [ ] Периодическая проверка сессии работает каждые 10 минут

## 🐛 Troubleshooting

### "Function not found"
```bash
# Проверить список функций
supabase functions list

# Если нет make-server-73d66528, задеплоить снова
supabase functions deploy make-server-73d66528
```

### "Internal Server Error"
1. Проверить логи в Dashboard
2. Искать ошибки в консоли
3. Проверить переменные окружения:
   ```bash
   supabase secrets list
   ```

### "Session expires after 1 hour"
1. Проверить логи сервера на наличие `🔄 Access token истек`
2. Проверить KV store на наличие `refresh_token`
3. Проверить что деплой прошел успешно (время последнего деплоя)

## 📊 Мониторинг

### После деплоя следить за:

1. **Логи Edge Function** (первые 24 часа)
   - Количество вызовов `/auth/session`
   - Количество обновлений токенов
   - Ошибки обновления

2. **KV Store размер** (первая неделя)
   - Количество активных сессий
   - Размер sessionData

3. **Feedback пользователей**
   - Жалобы на частые выходы из системы должны исчезнуть
   - Уведомления об улучшенной стабильности

## ✅ Готово!

После успешного деплоя:
- Access token автоматически обновляется каждый час
- Сессии живут 30 дней
- Пользователи не замечают обновления токенов
- Выход требуется только через 30 дней или вручную
