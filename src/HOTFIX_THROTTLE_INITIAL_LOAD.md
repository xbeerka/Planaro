# Hotfix - Throttle блокирует первый запрос

**Дата**: 2025-12-05  
**Версия**: 1.0.2  
**Тип**: Hotfix

---

## 🐛 Проблема

При загрузке страницы все sync запросы блокировались throttle:

```
⚠️ Throttle: Пропуск дубликата "events-delta-sync-22" (прошло 1ms)
⚠️ Delta Sync: пропущен (throttle)
⚠️ Throttle: Пропуск дубликата "departments-sync-22" (прошло 1ms)
⚠️ Departments Sync: пропущен (throttle)
⚠️ Throttle: Пропуск дубликата "resources-sync-22" (прошло 1ms)
⚠️ Resources Sync: пропущен (throttle)
⚠️ Throttle: Пропуск дубликата "projects-sync-22" (прошло 1ms)
⚠️ Projects Sync: пропущен (throttle)
```

**Причина**: 

Throttle применял COOLDOWN (1000ms) сразу при регистрации запроса. Когда все useEffect срабатывали одновременно (при монтировании), они считались "дубликатами" и блокировались.

**Старая логика**:
```typescript
// ❌ ПРОБЛЕМА: cooldown с момента НАЧАЛА запроса
const pending = this.pendingRequests.get(requestId);
if (pending) {
  const elapsed = now - pending.timestamp; // timestamp = начало запроса
  if (elapsed < COOLDOWN_MS) { // 1000ms
    return false; // Блокируем даже первый запрос!
  }
}
```

---

## ✅ Решение

Изменена логика throttle: **cooldown применяется только после ЗАВЕРШЕНИЯ запроса**.

### Новая логика

1. **Блокировка параллельных запросов** - если запрос уже выполняется, блокируем дубликат
2. **Cooldown после завершения** - после завершения запроса блокируем следующий на 500ms
3. **Первый запрос всегда проходит** - нет блокировки при initial load

**Новый код**:
```typescript
// ✅ РЕШЕНИЕ: разделяем "в процессе" и "завершён"
interface PendingRequest {
  id: string;
  timestamp: number;
  completed?: boolean; // Новый флаг!
}

canMakeRequest(requestId: string): boolean {
  const pending = this.pendingRequests.get(requestId);
  
  // 1. Блокируем если уже выполняется (НЕ завершён)
  if (pending && !pending.completed) {
    console.warn('⚠️ Throttle: уже выполняется');
    return false;
  }
  
  // 2. Cooldown только для ЗАВЕРШЁННЫХ запросов
  if (pending && pending.completed) {
    const elapsed = now - pending.timestamp; // timestamp = момент завершения
    if (elapsed < COOLDOWN_MS) {
      console.warn('⚠️ Throttle: cooldown');
      return false;
    }
  }
  
  return true; // Первый запрос всегда проходит!
}

completeRequest(requestId: string): void {
  const request = this.pendingRequests.get(requestId);
  if (request) {
    request.completed = true;
    request.timestamp = Date.now(); // Обновляем для cooldown!
  }
}
```

### Параметры

- `MAX_CONCURRENT = 10` (без изменений)
- `COOLDOWN_MS = 500` (было 1000ms) - уменьшен для быстрого повтора

---

## 🔧 Исправленный файл

### `/utils/requestThrottle.ts`

**Изменения:**

1. Добавлен флаг `completed` в `PendingRequest`
2. Изменён `canMakeRequest()` - разделение логики для активных/завершённых
3. Изменён `completeRequest()` - помечает как завершённый + обновляет timestamp
4. Изменён `getActiveCount()` - считает только НЕ завершённые запросы
5. Уменьшен `COOLDOWN_MS` с 1000ms до 500ms

---

## 🧪 Тестирование

### Шаг 1: Проверка initial load

1. Откройте приложение
2. Войдите в воркспейс
3. Проверьте консоль

**Ожидаемый результат:**

```
✅ НЕТ предупреждений при первой загрузке
✅ Все sync запросы выполняются успешно
```

**НЕ должно быть:**

```
❌ ⚠️ Throttle: Пропуск дубликата (прошло 1ms)
❌ ⚠️ Delta Sync: пропущен (throttle)
```

### Шаг 2: Проверка повторных запросов

1. Подождите 4 секунды (Delta Sync интервал)
2. Проверьте консоль

**Ожидаемый результат:**

```
✅ Delta Sync выполняется каждые 4 секунды
✅ Нет блокировок между интервалами
```

### Шаг 3: Проверка блокировки дубликатов

1. Откройте консоль
2. Быстро выполните два запроса подряд (внутри 500ms):

```javascript
// Эмуляция быстрого повтора (для теста)
const test = async () => {
  await fetch('/.../events?workspace_id=22');
  await fetch('/.../events?workspace_id=22'); // Сразу после первого
};
```

**Ожидаемый результат:**

```
⚠️ Throttle: Пропуск дубликата "events-..." (уже выполняется Xms)
```

Второй запрос блокируется пока первый не завершён.

### Шаг 4: Проверка cooldown

1. Выполните запрос
2. Подождите 100ms
3. Выполните тот же запрос

**Ожидаемый результат:**

```
⚠️ Throttle: Пропуск "events-..." (cooldown 400ms)
```

Запрос блокируется до истечения 500ms cooldown.

---

## 📊 Поведение до/после

### Сценарий: Initial Load (все запросы одновременно)

| Запрос | До (v1.0.0) | После (v1.0.2) |
|--------|------------|----------------|
| events-delta-sync | ✅ Выполнен | ✅ Выполнен |
| projects-sync | ❌ Блокирован (1ms) | ✅ Выполнен |
| resources-sync | ❌ Блокирован (1ms) | ✅ Выполнен |
| departments-sync | ❌ Блокирован (1ms) | ✅ Выполнен |

### Сценарий: Повторный запрос через 4 секунды

| Запрос | До (v1.0.0) | После (v1.0.2) |
|--------|------------|----------------|
| events-delta-sync | ✅ Выполнен | ✅ Выполнен |

### Сценарий: Дубликат запроса (в процессе выполнения)

| Запрос | До (v1.0.0) | После (v1.0.2) |
|--------|------------|----------------|
| events-delta-sync #1 | ✅ Выполняется | ✅ Выполняется |
| events-delta-sync #2 | ❌ Блокирован (cooldown) | ❌ Блокирован (уже выполняется) |

### Сценарий: Быстрый повтор после завершения (<500ms)

| Запрос | До (v1.0.0) | После (v1.0.2) |
|--------|------------|----------------|
| events-delta-sync #1 | ✅ Завершён | ✅ Завершён |
| events-delta-sync #2 (+100ms) | ❌ Блокирован (cooldown) | ❌ Блокирован (cooldown 400ms) |

---

## 📝 Влияние

- **Initial Load**: ✅ Теперь все запросы выполняются (было: блокировались)
- **Polling**: ✅ Без изменений (интервалы > 500ms)
- **Защита от дубликатов**: ✅ Работает (блокирует параллельные)
- **Cooldown**: ✅ Уменьшен с 1000ms до 500ms (быстрее повтор)

---

## 🎯 Checklist

- [x] Добавлен флаг `completed` в `PendingRequest`
- [x] Изменена логика `canMakeRequest()`
- [x] Изменена логика `completeRequest()`
- [x] Изменена логика `getActiveCount()`
- [x] Уменьшен `COOLDOWN_MS` до 500ms
- [x] Протестировано initial load
- [x] Протестировано polling
- [x] Создана документация `/HOTFIX_THROTTLE_INITIAL_LOAD.md`

---

## 📦 Версия

- **Release**: v1.0.2 (hotfix)
- **Parent**: v1.0.1 (dev check fix)
- **Статус**: ✅ Исправлено
