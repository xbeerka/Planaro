# Быстрый тест исправления "Failed to fetch" v3.3.22

## 🎯 Цель
Проверить что исправление v3.3.22 корректно валидирует параметры, таймаутит зависшие запросы и логирует детальную информацию об ошибках.

---

## ✅ Тест 1: Успешный запрос с валидацией

### Действия:
1. Откройте календарь воркспейса
2. Создайте событие (Ctrl+Click)
3. Измените событие (drag/resize)
4. Нажмите Ctrl+Z (Undo)

### Ожидаемый результат в консоли:
```
📦 BATCH: всего операций для отправки: 1
📦 BATCH: 0 create + 1 update
🔍 BATCH: Валидация параметров...
   projectId: "zhukuvbdjyneoloarlqy" (тип: string)
   accessToken: "eyJhbGciOiJIUzI1NiIsI..." (длина: 512)
   workspaceId: 14 (тип: number)
✅ BATCH: Валидация пройдена
📦 BATCH: Отправка запроса к: https://zhukuvbdjyneoloarlqy.supabase.co/functions/v1/make-server-73d66528/events/batch
📦 BATCH: Workspace ID: 14
✅ BATCH: Получен ответ от сервера (status: 200)
✅ BATCH CREATE: создано 0 событий на сервере
✅ BATCH UPDATE: обновлено 1 событий на сервере
```

### Критерии успеха:
- ✅ Видны ВСЕ параметры с их типами
- ✅ Валидация пройдена
- ✅ Логируется статус ответа
- ✅ Событие восстановилось после Undo

---

## ❌ Тест 2: Невалидный accessToken

### Подготовка:
```javascript
// Откройте консоль и выполните:
indexedDB.deleteDatabase('auth-db');
// Обновите страницу
```

### Ожидаемый результат:
```
🔍 BATCH: Валидация параметров...
   projectId: "zhukuvbdjyneoloarlqy" (тип: string)
   accessToken: ОТСУТСТВУЕТ
   workspaceId: 14 (тип: number)
❌ BATCH: accessToken невалиден! {hasToken: false, type: 'undefined'}
Error: Invalid access token. Please re-login.
```

### Критерии успеха:
- ✅ Валидация БЛОКИРУЕТ запрос
- ✅ Понятное сообщение об ошибке
- ✅ Инструкция "Please re-login"

---

## ⏱️ Тест 3: Таймаут запроса

### Подготовка (симуляция):
Временно измените таймаут в коде на 1 секунду:
```typescript
// В /contexts/SchedulerContext.tsx найдите:
const timeoutId = setTimeout(() => {
  console.error('❌ BATCH: Таймаут 15 секунд истёк');
  controller.abort();
}, 15000);

// Замените на:
}, 1000); // ← 1 секунда для теста
```

### Действия:
1. Создайте событие
2. Сделайте drag
3. Нажмите Ctrl+Z

### Ожидаемый результат:
```
📦 BATCH: Отправка запроса к: https://zhukuvbdjyneoloarlqy.supabase.co/functions/v1/make-server-73d66528/events/batch
❌ BATCH: Таймаут 1 секунд истёк
❌ BATCH: Запрос прерван по таймауту (1 сек)
❌ Ошибка синхронизации восстановленных событий: Error: Request timeout after 1 seconds. Server may be overloaded or Edge Function not responding.
```

### Критерии успеха:
- ✅ Запрос прервался через 1 секунду
- ✅ Понятное сообщение об ошибке
- ✅ НЕТ бесконечного ожидания

**ВАЖНО**: Верните таймаут обратно на 15000 после теста!

---

## 🌐 Тест 4: Сетевая ошибка

### Подготовка (симуляция):
В DevTools:
1. F12 → Network tab
2. Включите "Offline" режим (галочка)

### Действия:
1. Создайте событие
2. Сделайте drag
3. Нажмите Ctrl+Z

### Ожидаемый результат:
```
✅ BATCH: Валидация пройдена
📦 BATCH: Отправка запроса к: https://zhukuvbdjынeoloarlqy.supabase.co/functions/v1/make-server-73d66528/events/batch
❌ BATCH: Ошибка fetch: {name: 'TypeError', message: 'Failed to fetch', cause: undefined, stack: '...'}
❌ Ошибка синхронизации восстановленных событий: Error: Network error: Failed to fetch. Check server availability and CORS settings.
```

### Критерии успеха:
- ✅ Детальное логирование ошибки fetch
- ✅ Понятное сообщение об ошибке
- ✅ Инструкции по диагностике

---

## 🔍 Тест 5: Невалидный projectId (edge case)

### Подготовка (для разработчиков):
Временно измените `/utils/supabase/info.tsx`:
```typescript
export const projectId = "undefined" // ← Симуляция ошибки
```

### Ожидаемый результат:
```
🔍 BATCH: Валидация параметров...
   projectId: "undefined" (тип: string)
   ...
❌ BATCH: projectId невалиден! {projectId: 'undefined', type: 'string'}
Error: Invalid project ID: "undefined". Check /utils/supabase/info.tsx
```

### Критерии успеха:
- ✅ Валидация БЛОКИРУЕТ запрос
- ✅ Указание на файл конфигурации
- ✅ НЕТ попытки отправить запрос

**ВАЖНО**: Верните projectId обратно после теста!

---

## 📊 Checklist успешного исправления

- [ ] Тест 1 (успешный запрос): ✅ пройден
- [ ] Тест 2 (невалидный токен): ✅ пройден
- [ ] Тест 3 (таймаут): ✅ пройден
- [ ] Тест 4 (сетевая ошибка): ✅ пройден
- [ ] Тест 5 (невалидный projectId): ✅ пройден
- [ ] Логи детальные и понятные: ✅ да
- [ ] Нет "Failed to fetch" без контекста: ✅ да
- [ ] Таймауты работают: ✅ да
- [ ] Валидация блокирует невалидные запросы: ✅ да

---

## 🎯 Быстрая проверка после деплоя

1. Откройте консоль (F12)
2. Выполните любое действие с Undo/Redo
3. Проверьте что видны логи:
   ```
   🔍 BATCH: Валидация параметров...
   ```
4. Если НЕ видны → исправление НЕ применилось

---

**Версия**: v3.3.22  
**Дата**: 2025-11-19  
**Автор**: AI Assistant  
**Статус**: ✅ Готово к тестированию
