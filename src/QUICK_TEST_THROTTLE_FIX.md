# Quick Test - Throttle Initial Load Fix

Быстрый тест для проверки что throttle НЕ блокирует первый запрос.

---

## ✅ Тест 1: Initial Load (главный тест!)

1. **Очистите кэш браузера** (Ctrl+Shift+Delete)
2. Откройте приложение
3. Войдите в воркспейс
4. Откройте консоль (F12)

**Ожидаемый результат:**

```
✅ НЕТ предупреждений типа:
   ⚠️ Throttle: Пропуск дубликата "events-delta-sync-22" (прошло 1ms)
   ⚠️ Delta Sync: пропущен (throttle)

✅ Видите только нормальные логи:
   🔄 Delta Sync: загрузка изменённых событий...
   🔄 Projects Sync: загрузка проектов...
   🔄 Resources Sync: загрузка сотрудников...
   🔄 Departments Sync: загрузка департаментов...
```

**Если видите блокировки** - hotfix НЕ работает!

---

## ✅ Тест 2: Повторные запросы (polling)

1. Подождите 4 секунды
2. Проверьте консоль

**Ожидаемый результат:**

```
✅ Delta Sync выполняется каждые 4 секунды
✅ Нет предупреждений о блокировках
```

Подождите 15 секунд:

```
✅ Projects/Resources/Departments Sync выполняются каждые 15 секунд
✅ Нет предупреждений о блокировках
```

---

## ✅ Тест 3: Debug команды

Введите в консоли:

```javascript
debugRequests()
```

**Ожидаемый результат (после 60 секунд работы):**

```
📊 REQUEST MONITOR REPORT (последняя минута):
   Всего запросов: 28
   ✅ events-delta-sync-22: 15 req/min
   ✅ events-full-sync-22: 2 req/min
   ✅ projects-sync-22: 4 req/min
   ✅ resources-sync-22: 4 req/min
   ✅ departments-sync-22: 4 req/min
```

Введите:

```javascript
debugThrottle()
```

**Ожидаемый результат:**

```
🔒 ACTIVE THROTTLED REQUESTS:
   Активных запросов: 0-3 / 10 (MAX_CONCURRENT)
   ✅ Нормально
```

---

## ✅ Тест 4: Множественные вкладки

1. Откройте приложение в **3 вкладках**
2. Войдите в один воркспейс во всех вкладках
3. Подождите 60 секунд
4. В любой вкладке: `debugRequests()`

**Ожидаемый результат:**

```
✅ events-delta-sync-22: 15 req/min (НЕ 45 req/min!)
✅ projects-sync-22: 4 req/min (НЕ 12 req/min!)
```

Throttle должен дедуплицировать запросы между вкладками.

---

## ❌ Что ПРОВЕРИТЬ если тест ПРОВАЛИЛСЯ

### Проблема: Видите блокировки при initial load

```
⚠️ Throttle: Пропуск дубликата "events-delta-sync-22" (прошло 1ms)
```

**Проверьте:**
1. Файл `/utils/requestThrottle.ts` содержит флаг `completed`
2. В `canMakeRequest()` есть проверка `!pending.completed`
3. В `completeRequest()` есть `request.completed = true`

### Проблема: Высокая частота запросов (>50 req/min)

```
⚠️ events-delta-sync: 75 req/min
```

**Причина**: Утечка setInterval (компоненты не размонтируются)

**Решение**: Проверить useEffect cleanup функции в `SchedulerContext.tsx`

### Проблема: Debug команды не работают

```
Uncaught ReferenceError: debugRequests is not defined
```

**Причина**: Модуль не импортирован

**Решение**: Проверить что в `/App.tsx` есть `import './utils/debugCommands';`

---

## 🎯 Критерии успеха

✅ **Initial Load**: Нет блокировок при первой загрузке  
✅ **Polling**: Delta/Full/Projects/Resources/Departments sync работают  
✅ **Debug Commands**: `debugRequests()` и `debugThrottle()` работают  
✅ **Частота запросов**: ~28 req/min для одного воркспейса  
✅ **Множественные вкладки**: Дедупликация работает (~28 req/min для всех вкладок)  

---

## 📝 Версия

- **Дата**: 2025-12-05
- **Версия**: 1.0.2 (hotfix)
- **Статус**: ✅ Готово к тестированию
