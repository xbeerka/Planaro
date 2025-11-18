# Деплой фикса Heartbeat и Leave

## Что было исправлено

✅ **Добавлен endpoint** `DELETE /presence/leave/:workspaceId` - мгновенное удаление presence  
✅ **Умное логирование** - не пугаем пользователя разовыми сетевыми сбоями  
✅ **Счетчик ошибок** - ERROR только после 3+ неудачных попыток подряд  

## Инструкции по деплою

### 1. Задеплой обновленную Edge Function

```bash
supabase functions deploy make-server-73d66528
```

**Ожидаемый вывод:**
```
Deploying make-server-73d66528 (project ref: YOUR_PROJECT_ID)
✓ Function deployed successfully
```

### 2. Проверь что новый endpoint работает

```bash
# Замени YOUR_PROJECT_ID и YOUR_ACCESS_TOKEN на свои значения
curl -X DELETE \
  https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-73d66528/presence/leave/test-workspace-123 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json"
```

**Ожидаемый ответ:**
```json
{"success":true}
```

### 3. Проверь логи в Supabase Dashboard

1. Открой **Supabase Dashboard**
2. Перейди в **Edge Functions** → **make-server-73d66528** → **Logs**
3. Найди логи:
   ```
   👋 Leave от user@kode.ru из workspace test-workspace-123
   ✅ Presence удалён: user@kode.ru больше не онлайн в workspace test-workspace-123
   ```

### 4. Тестирование на клиенте

1. Открой приложение в браузере
2. Войди в календарь воркспейса
3. Проверь консоль браузера:
   ```
   💓 Отправка heartbeat для workspace: 123
   💓 Heartbeat успешно отправлен
   ```
4. Вернись к списку воркспейсов
5. Проверь консоль:
   ```
   👋 Отправка leave для workspace: 123
   ✅ Leave успешно отправлен - пользователь удалён из онлайн списка
   ```

## Что смотреть в логах

### ✅ Нормальная работа

**Клиент (браузер):**
```
💓 Отправка heartbeat для workspace: 123
💓 Heartbeat успешно отправлен
👋 Отправка leave для workspace: 123
✅ Leave успешно отправлен
```

**Сервер (Edge Function):**
```
💓 Heartbeat от user@kode.ru в workspace 123
✅ Presence сохранён: user@kode.ru (с аватаркой)
👋 Leave от user@kode.ru из workspace 123
✅ Presence удалён: user@kode.ru больше не онлайн в workspace 123
```

### ⚠️ Разовая сетевая ошибка (не критично)

**Клиент:**
```
⚠️ Heartbeat: сетевая ошибка (попытка 1) - повтор через 30 сек
💓 Heartbeat успешно отправлен  ← счетчик сброшен
```

### ❌ Множественные ошибки (проблема с сервером)

**Клиент:**
```
⚠️ Heartbeat: сетевая ошибка (попытка 1) - повтор через 30 сек
⚠️ Heartbeat: сетевая ошибка (попытка 2) - повтор через 30 сек
❌ Heartbeat: сетевая ошибка (попытка 3)
💡 Убедитесь что Edge Function задеплоена: supabase functions deploy make-server-73d66528
```

## Rollback (если что-то пошло не так)

Если после деплоя появились проблемы:

```bash
# Откатись на предыдущую версию
supabase functions deploy make-server-73d66528 --version <previous-version>

# Или пересобери заново
supabase functions deploy make-server-73d66528
```

## Checklist

- [ ] Edge Function задеплоена (`supabase functions deploy make-server-73d66528`)
- [ ] Endpoint `/presence/leave/:workspaceId` отвечает `{"success":true}`
- [ ] Логи на сервере показывают "👋 Leave" при закрытии календаря
- [ ] Логи на клиенте показывают "💓 Heartbeat успешно отправлен"
- [ ] При разовой ошибке счетчик показывает "(попытка 1)"
- [ ] При 3+ ошибках подряд появляется инструкция про деплой

---

**Дата:** 2025-10-21  
**Автор:** AI Assistant  
**Статус:** Готово к деплою
