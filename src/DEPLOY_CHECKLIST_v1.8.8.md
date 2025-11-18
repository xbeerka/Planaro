# Деплой Checklist v1.8.8

## 📋 Перед деплоем

### 1. Проверка изменений
- [x] `/supabase/functions/server/index.tsx` - новый endpoint DELETE /presence/leave/:workspaceId
- [x] `/supabase/functions/server/index.tsx` - TTL изменён с 120 на 60 секунд
- [x] `/components/scheduler/OnlineUsers.tsx` - добавлена функция sendLeave()
- [x] `/App.tsx` - добавлена очистка кэша в handleBackToWorkspaces()
- [x] Документация обновлена (CHANGELOG, Guidelines, docs/)

### 2. Локальное тестирование
- [ ] Проект собирается без ошибок (`npm run build` или аналог)
- [ ] Нет TypeScript ошибок
- [ ] Нет console.error в критических местах
- [ ] Тесты пройдены локально (если есть)

---

## 🚀 Деплой на Supabase

### 3. Деплой Edge Function

```bash
# Перейти в корень проекта
cd /path/to/resource-scheduler

# Деплой
supabase functions deploy make-server-73d66528
```

**Ожидаемый вывод**:
```
Deploying make-server-73d66528 (project ref: zhukuvbdjyneoloarlqy)
Bundled make-server-73d66528 size: XXX KB
Deployed function make-server-73d66528 in X.Xs
```

- [ ] Деплой прошёл успешно
- [ ] Нет ошибок в выводе команды
- [ ] Bundle size разумный (<500KB)

### 4. Health Check

```bash
curl https://zhukuvbdjyneoloarlqy.supabase.co/functions/v1/make-server-73d66528/health
```

**Ожидаемый ответ**:
```json
{"status":"ok","timestamp":"2025-10-21T..."}
```

- [ ] Health endpoint отвечает 200 OK
- [ ] Timestamp актуальный

---

## ✅ Функциональное тестирование

### 5. Тест 1: Нет "мигания" (1 минута)

1. Откройте приложение в браузере
2. Войдите как test@kode.ru
3. Откройте календарь любого воркспейса
4. Подождите 5 секунд
5. Нажмите "Назад"
6. **Проверка**: Ваша аватарка НЕ должна появиться даже на мгновение

**Логи в консоли должны быть**:
```
🔙 Возврат к списку воркспейсов
🧹 Очистка текущего пользователя из presence кэша: test@kode.ru
✅ Кэш очищен от текущего пользователя
👋 Отправка leave для workspace: X
✅ Leave успешно отправлен - пользователь удалён из онлайн списка
```

- [ ] Нет "мигания" аватарки
- [ ] Логи корректные
- [ ] Плавный переход

### 6. Тест 2: Быстрое удаление (2 минуты, 2 браузера)

1. Браузер A (sa@kode.ru): откройте список воркспейсов
2. Браузер B (test@kode.ru): откройте календарь воркспейса #14
3. В браузере A: видите аватарку test@kode.ru в карточке #14
4. В браузере B: нажмите "Назад"
5. В браузере A: аватарка должна исчезнуть в течение **15 секунд**

- [ ] Аватарка исчезла за 0-15 секунд
- [ ] Нет ошибок в консоли обоих браузеров

### 7. Тест 3: Fallback при закрытии вкладки (2 минуты, 2 браузера)

1. Браузер A (sa@kode.ru): откройте список воркспейсов
2. Браузер B (test@kode.ru): откройте календарь воркспейса #14
3. В браузере A: видите аватарку test@kode.ru
4. В браузере B: **закройте вкладку** (крестик)
5. В браузере A: подождите 60 секунд

- [ ] Аватарка исчезла максимум через 60 секунд
- [ ] Fallback сработал (TTL истёк)

---

## 🔍 Проверка логов

### 8. Серверные логи

1. Откройте Supabase Dashboard
2. Edge Functions → make-server-73d66528 → Logs
3. Фильтр: последний час

**Ожидаемые логи при закрытии календаря**:
```
👋 Leave от test@kode.ru из workspace 14
✅ Presence удалён: presence:14:c2bb8098-cd3b-4c77-8aaf-55c095ed3b21
```

- [ ] Логи появляются при закрытии календаря
- [ ] Нет ошибок 500/401/400
- [ ] Endpoint `/presence/leave/:workspaceId` работает

### 9. Клиентские логи (браузер)

**DevTools → Console** при возврате из календаря:

- [ ] `🔙 Возврат к списку воркспейсов`
- [ ] `🧹 Очистка текущего пользователя из presence кэша`
- [ ] `✅ Кэш очищен от текущего пользователя`
- [ ] `👋 Отправка leave для workspace: X`
- [ ] `✅ Leave успешно отправлен`

**DevTools → Network** при возврате:

- [ ] DELETE запрос к `/presence/leave/:workspaceId`
- [ ] Статус: 200 OK
- [ ] Response: `{"success":true}`

---

## 🗄️ Проверка IndexedDB

### 10. Кэш очищается корректно

1. DevTools → Application → IndexedDB → planaro_storage → kv_store
2. Найдите ключ `cache_online_users_batch`
3. Откройте календарь → вернитесь назад
4. Обновите IndexedDB (правый клик → Refresh)

**Проверка**:
```json
{
  "data": {
    "14": [
      // Других пользователей может быть
      // НО вас (текущего пользователя) НЕТ
    ]
  },
  "timestamp": 1729512345678
}
```

- [ ] Текущий пользователь удалён из всех воркспейсов
- [ ] Другие пользователи остались (если были)
- [ ] Timestamp не изменился (кэш валиден)

---

## 🐛 Проверка граничных случаев

### 11. Быстрые переходы (стресс-тест)

1. Быстро переключайтесь: список → календарь → назад (10 раз)
2. Наблюдайте за аватарками

- [ ] Нет "мигания" ни разу
- [ ] Нет ошибок в консоли
- [ ] Плавные переходы

### 12. Несколько пользователей онлайн

1. Откройте 3 браузера (sa@, test@, third@)
2. Все откройте календарь воркспейса #14
3. В браузере sa@: нажмите "Назад"
4. В браузерах test@ и third@: должны видеть только друг друга (sa@ исчез)

- [ ] Аватарка sa@ исчезла в других браузерах
- [ ] Аватарки test@ и third@ остались
- [ ] Только ушедший пользователь удалён

---

## 📊 Performance

### 13. Нет деградации производительности

**До v1.8.8**:
- Возврат из календаря: ~200ms

**После v1.8.8**:
- Возврат из календаря: ~250ms (+50ms на очистку кэша)

- [ ] Переход не стал заметно медленнее
- [ ] Overhead <100ms приемлем
- [ ] UX улучшен (нет "мигания")

### 14. Memory footprint

**DevTools → Performance → Memory**:
- [ ] IndexedDB не растёт бесконтрольно
- [ ] Один ключ `cache_online_users_batch`
- [ ] Размер кэша разумный (<50KB)

---

## 📚 Документация

### 15. Проверка документации

- [x] `/CHANGELOG.md` - версия 1.8.8 описана
- [x] `/guidelines/Guidelines.md` - обновлена Presence система
- [x] `/DEPLOY_INSTRUCTIONS.md` - актуальные инструкции
- [x] `/docs/PRESENCE_LEAVE_FIX.md` - техническое описание
- [x] `/docs/TESTING_CACHE_CLEANUP.md` - тестовые сценарии
- [x] `/docs/QUICK_TEST_v1.8.8.md` - быстрая проверка
- [x] `/docs/RELEASE_NOTES_v1.8.8.md` - release notes
- [x] `/DEPLOY_CHECKLIST_v1.8.8.md` - этот файл

---

## ✅ Финальный чек-лист

### Критичные проверки
- [ ] Edge Function задеплоен
- [ ] Health endpoint работает
- [ ] Тест 1 (нет "мигания") пройден
- [ ] Тест 2 (быстрое удаление) пройден
- [ ] Тест 3 (fallback) пройден
- [ ] Серверные логи корректные
- [ ] Клиентские логи корректные
- [ ] IndexedDB кэш очищается

### Некритичные проверки
- [ ] Стресс-тест пройден
- [ ] Несколько пользователей онлайн работает
- [ ] Performance приемлем
- [ ] Memory footprint в норме

### Документация
- [x] CHANGELOG обновлён
- [x] Guidelines обновлён
- [x] Тестовые документы созданы
- [x] Release notes готовы

---

## 🎉 Релиз

**Если все пункты ✅** → v1.8.8 готова к продакшену!

**Команда для деплоя frontend** (если нужно):
```bash
# В зависимости от вашей настройки деплоя
npm run build
# или
vercel deploy --prod
# или другой способ
```

**Коммит изменений**:
```bash
git add .
git commit -m "v1.8.8: Fix presence 'ghosts' and 'flickering' issues

- Added explicit leave endpoint (DELETE /presence/leave/:workspaceId)
- Reduced presence TTL from 120 to 60 seconds
- Instant cache cleanup on back navigation (no flickering)
- Improved UX: online users list updates 6-8x faster
- Full backward compatibility, graceful degradation

See CHANGELOG.md and /docs/RELEASE_NOTES_v1.8.8.md for details"

git push origin main
```

---

**Версия**: 1.8.8  
**Дата**: 2025-10-21  
**Статус**: ✅ Готово к деплою  
**Приоритет**: Высокий (критические UX исправления)
