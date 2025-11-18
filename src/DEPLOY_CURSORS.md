# 🚀 Quick Deploy: Collaborative Cursors

## Что нужно сделать

### 1. Задеплоить Edge Function

```bash
supabase functions deploy make-server-73d66528
```

### 2. Проверить что работает

```bash
# Health check
curl https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-73d66528/health

# Ожидается: {"status":"ok","timestamp":"..."}
```

### 3. Протестировать

1. Откройте календарь в **двух разных браузерах** (Chrome обычный + Chrome инкогнито)
2. Войдите под **разными аккаунтами** (@kode.ru emails)
3. Откройте **один и тот же workspace**
4. Двигайте мышью в первом браузере
5. **Должен появиться** цветной курсор с именем пользователя во втором браузере

## Что должно произойти

### Console logs (Browser #1)
```
🖱️ Подключение к WebSocket Cursor Presence для workspace: 1
👤 Текущий пользователь: Иван Иванов ivan@kode.ru
🔌 Создание WebSocket соединения...
✅ WebSocket соединение установлено
🎉 Подключено к workspace: Connected to workspace 1 - активных пользователей: 1
```

### Console logs (Browser #2)
```
🖱️ Подключение к WebSocket Cursor Presence для workspace: 1
👤 Текущий пользователь: Мария Петрова maria@kode.ru
🔌 Создание WebSocket соединения...
✅ WebSocket соединение установлено
🎉 Подключено к workspace: Connected to workspace 1 - активных пользователей: 2
```

### Visual result
- В Browser #1: появляется курсор Марии (розовый/зелёный/синий цвет + имя)
- В Browser #2: появляется курсор Ивана (другой цвет + имя)
- Курсоры двигаются плавно когда пользователи двигают мышью

## Edge Function Logs

Откройте Supabase Dashboard → Edge Functions → `make-server-73d66528` → Logs

Должны быть:
```
🖱️ WebSocket cursor request для workspace: 1
✅ Пользователь авторизован: ivan@kode.ru
🔌 WebSocket открыт: Иван Иванов (ivan@kode.ru) в workspace 1
👥 Активных соединений в workspace 1: 1

🖱️ WebSocket cursor request для workspace: 1
✅ Пользователь авторизован: maria@kode.ru
🔌 WebSocket открыт: Мария Петрова (maria@kode.ru) в workspace 1
👥 Активных соединений в workspace 1: 2
```

## Troubleshooting

### Курсор не появляется

**Чек-лист**:
1. ✅ Оба пользователя в **одном workspace**?
2. ✅ WebSocket соединение установлено? (DevTools → Network → WS tab)
3. ✅ Нет ошибок в Console?
4. ✅ Edge Function задеплоена? (проверьте health endpoint)

**Проверка WebSocket в DevTools**:
1. Network tab → WS (WebSocket filter)
2. Должна быть строка: `cursors/1?token=...`
3. Status: `101 Switching Protocols` (зелёный)
4. Messages: должны идти JSON сообщения

### Соединение обрывается

Это нормально при cold start Edge Function. Reconnect происходит автоматически:

```
🔌 WebSocket соединение закрыто: 1006
🔄 Попытка переподключения 1/5 через 1000ms...
🔌 Создание WebSocket соединения...
✅ WebSocket соединение установлено
```

### "Unauthorized" ошибка

Проверьте что accessToken валиден:
- Токен живёт 1 час
- Обновляется автоматически при проверке сессии (каждые 10 минут)
- Если истёк → выйдите и войдите снова

## Готово! 🎉

Если всё работает:
- ✅ Курсоры других пользователей видны
- ✅ Плавная анимация
- ✅ Уникальный цвет для каждого пользователя
- ✅ Reconnect работает

---

**Полная документация**: `/docs/COLLABORATIVE_CURSORS.md`  
**Техническая информация**: `/WEBSOCKET_CURSORS_READY.md`
