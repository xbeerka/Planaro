# 🚀 Deployment Instructions - v1.9.2

## ✅ Что исправлено

### Отключены Collaborative Cursors
- ❌ Компонент `CursorPresence` закомментирован в `SchedulerMain.tsx`
- ❌ WebSocket endpoint `/cursors/:workspaceId` закомментирован в `index.tsx`
- ✅ Приложение работает **стабильно** без WebSocket ошибок
- ✅ Онлайн пользователи продолжают работать через HTTP

## 📦 Что включено в v1.9.2

1. **Стабильная работа** - нет WebSocket ошибок в консоли
2. **Онлайн пользователи** - работают через HTTP presence систему
3. **Код сохранён** - collaborative cursors можно включить в будущем
4. **Документация** - `/COLLABORATIVE_CURSORS_DISABLED.md`

## 🔧 Deployment Steps

### 1. Задеплоить Edge Function

```bash
# Убедитесь что вы в корне проекта
cd /path/to/project

# Задеплоить Edge Function
supabase functions deploy make-server-73d66528
```

**Ожидаемый вывод**:
```
Deploying function make-server-73d66528...
✓ Function deployed successfully
```

### 2. Проверить health endpoint

```bash
curl https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-73d66528/health
```

**Ожидаемый ответ**:
```json
{
  "status": "ok",
  "timestamp": "2025-10-21T..."
}
```

### 3. Проверить что WebSocket endpoint отключен

```bash
# Попытка подключиться к WebSocket endpoint (должна вернуть ошибку или ничего)
curl https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-73d66528/cursors/1?token=test
```

**Не должно быть** логов про WebSocket в Edge Function Logs.

### 4. Проверить frontend

1. Откройте приложение в браузере
2. Войдите в календарь
3. Откройте DevTools → Console
4. **НЕ должно быть** ошибок:
   ```
   ❌ WebSocket ошибка: { "readyState": 3 }
   ```

5. **Должны работать**:
   - ✅ Онлайн пользователи в хедере
   - ✅ Heartbeat каждые 30 секунд
   - ✅ Аватарки пользователей
   - ✅ Leave при закрытии календаря

## 🧪 Тестирование

### Сценарий 1: Вход в календарь
1. Войдите в приложение
2. Выберите воркспейс
3. Откройте календарь

**Ожидается**:
- ✅ Нет WebSocket ошибок в консоли
- ✅ Онлайн пользователи показываются в хедере
- ✅ Ваша аватарка отображается

### Сценарий 2: Несколько пользователей
1. Откройте календарь в 2 браузерах
2. Войдите под разными аккаунтами
3. Выберите один и тот же воркспейс

**Ожидается**:
- ✅ В обоих браузерах показываются оба пользователя
- ✅ Heartbeat работает каждые 30 секунд
- ✅ При закрытии одного браузера - пользователь исчезает из другого

### Сценарий 3: Список воркспейсов
1. Откройте список воркспейсов
2. Откройте календарь
3. Вернитесь к списку воркспейсов

**Ожидается**:
- ✅ Нет "мигания" вашей аватарки в списке воркспейсов
- ✅ Leave выполняется корректно
- ✅ Кэш очищается

## 📊 Логи для проверки

### Edge Function Logs (Supabase Dashboard)

**Должны быть**:
```
✅ /health endpoint called
🔐 Вход пользователя: user@kode.ru
👋 Heartbeat от user@kode.ru в workspace 1
👋 Leave от user@kode.ru из workspace 1
```

**НЕ должно быть**:
```
❌ 🖱️ WebSocket cursor request для workspace: ...
❌ ⬆️ Попытка upgrade WebSocket...
❌ Ошибка upgrade WebSocket: ...
```

### Browser Console

**Должны быть**:
```
🖱️ Отправка heartbeat для workspace 1
👥 Онлайн пользователей: 2
👋 Leave из workspace 1
```

**НЕ должно быть**:
```
❌ WebSocket ошибка: { "readyState": 3 }
⚠️ Abnormal closure - возможно сервер недоступен
⚠️ Достигнут лимит попыток переподключения
```

## ✅ Чек-лист готовности

- [ ] 🔧 Edge Function задеплоена
- [ ] 🏥 Health endpoint отвечает
- [ ] ❌ Нет WebSocket ошибок в консоли
- [ ] ✅ Онлайн пользователи работают
- [ ] ✅ Heartbeat каждые 30 секунд
- [ ] ✅ Leave при закрытии календаря
- [ ] ✅ Batch запросы для списка воркспейсов
- [ ] ✅ Кэширование работает (TTL 45 сек)
- [ ] ✅ Аватарки отображаются

## 🔮 Следующие шаги

1. **Мониторинг** - следите за логами в первые дни после деплоя
2. **Обратная связь** - собирайте feedback от пользователей
3. **Будущее** - collaborative cursors через Supabase Realtime Presence

## 📚 Документация

- `/COLLABORATIVE_CURSORS_DISABLED.md` - почему отключены курсоры
- `/CHANGELOG.md` - полный список изменений
- `/guidelines/Guidelines.md` - обновлённое руководство

---

**Версия**: v1.9.2  
**Дата**: 2025-10-21  
**Тип**: Bugfix - Отключение нестабильных WebSocket cursors  
**Статус**: Ready for production ✅
