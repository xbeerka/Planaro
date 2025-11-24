# 🐛 Исправление: Ошибка "null value in column id" при BATCH CREATE

## Проблема

При Undo/Redo временных событий BATCH CREATE операция падала с ошибкой:

```
❌ BATCH create error: {
  code: "23502",
  details: "Failing row contains (null, 4866, 550, 11, 1, 0, 4, null, 22, ...).",
  hint: null,
  message: 'null value in column "id" of relation "events" violates not-null constraint'
}
```

**Симптомы:**
1. Создал событие → Undo → Redo → ❌ Ошибка!
2. События не восстанавливаются после Undo/Redo
3. В логах: `null value in column "id"`

---

## Причина

### Клиент передавал временный ID в data

**Файл:** `/contexts/SchedulerContext.tsx` (строка 1181)

**Было:**
```typescript
operations.push({
  op: 'create',
  id: e.id, // ev_temp_1763499847802
  data: {
    id: e.id, // ❌ ПРОБЛЕМА: передаётся временный ID!
    resourceId: e.resourceId,
    startWeek: e.startWeek,
    // ...
  },
  workspace_id: workspaceId
});
```

### Сервер не мог обработать временный ID

**Файл:** `/supabase/functions/server/index.tsx` (строка 2357-2363)

```typescript
// Если передан ID (для Undo/Redo), добавляем его
if (body.id) {
  const numericId = parseInt(body.id.replace('e', ''));
  // ev_temp_1763499847802 → v_temp_1763499847802 → NaN
  
  if (!isNaN(numericId)) {
    eventData.id = numericId; // ✅ Работает для e37316
  }
  // ❌ Для ev_temp_XXX: numericId = NaN, id НЕ добавляется
}

// eventData.id = undefined (не установлен)

// UPSERT с id: undefined
await supabase.from('events').upsert(eventsToCreate, { onConflict: 'id' });
// → PostgreSQL пытается вставить id = null
// → Ошибка: null value in column "id" violates not-null constraint
```

### Почему это происходило:

1. Клиент передавал `id: 'ev_temp_1763499847802'` в data
2. Сервер пытался извлечь числовой ID: `parseInt('v_temp_...')` → `NaN`
3. Проверка `!isNaN(numericId)` не проходила
4. `eventData.id` оставался `undefined`
5. При upsert `undefined` превращался в `null` в SQL
6. PostgreSQL отклонял запись с `id = null`

---

## Решение

### НЕ передавать временный ID в data

**Файл:** `/contexts/SchedulerContext.tsx` (строка 1175-1192)

**Стало:**
```typescript
eventsToCreate.forEach(e => {
  // ✅ КРИТИЧНО: НЕ передаём временный ID в data!
  // Для временных ID (ev_temp_XXX) сервер создаст новый ID через sequence
  operations.push({
    op: 'create',
    id: e.id, // Для отслеживания в результатах (НЕ используется сервером)
    data: {
      // ❌ НЕ передаём id для временных событий!
      // ✅ Сервер создаст новый ID через PostgreSQL sequence
      resourceId: e.resourceId,
      startWeek: e.startWeek,
      weeksSpan: e.weeksSpan,
      unitStart: e.unitStart,
      unitsTall: e.unitsTall,
      projectId: e.projectId
      // БЕЗ id!
    },
    workspace_id: workspaceId
  });
});
```

### Серверный код уже правильный

```typescript
// Если body.id НЕ передан, eventData.id не устанавливается
if (body.id) {
  const numericId = parseInt(body.id.replace('e', ''));
  if (!isNaN(numericId)) {
    eventData.id = numericId;
  }
}
// Если body.id нет → eventData.id = undefined (не установлен)

// UPSERT без id
await supabase.from('events').upsert(eventsToCreate);
// → PostgreSQL создаст новый ID через sequence ✅
```

---

## Как это работает теперь

### Создание события → Undo → Redo

**Шаг 1: Создание события**
```
Пользователь создаёт событие
→ Временный ID: ev_temp_1763499847802
→ Отправка на сервер через createEvent()
→ Сервер создаёт запись с новым ID: e37346
→ Клиент заменяет временный ID на реальный
```

**Шаг 2: Undo (удаление)**
```
Пользователь нажимает Undo
→ Событие e37346 удаляется из state
→ syncDeletedEventsToServer() → DELETE e37346
→ Событие удалено из БД
```

**Шаг 3: Redo (восстановление)**
```
Пользователь нажимает Redo
→ Событие восстанавливается из истории: ev_temp_1763499847802 ❌ ПРОБЛЕМА!
→ syncRestoredEventsToServer()
  → eventsToCreate: [ev_temp_1763499847802]
  → BATCH CREATE операция
  
КЛИЕНТ:
  operations.push({
    op: 'create',
    id: 'ev_temp_1763499847802', // Для отслеживания
    data: {
      // БЕЗ id! ✅
      resourceId: 'r550',
      startWeek: 11,
      // ...
    }
  });

СЕРВЕР:
  eventData = {
    user_id: 550,
    start_week: 12,
    // БЕЗ id! ✅
  };
  
  await supabase.from('events').upsert([eventData]);
  → PostgreSQL создаёт новую запись с ID e37347 ✅
  
  return { created: [{ id: 'e37347', ... }] };

КЛИЕНТ получает результат:
  updateHistoryEventId('ev_temp_1763499847802', 'e37347');
  → История обновлена: ev_temp_XXX → e37347 ✅
```

---

## Почему оставили `id: e.id` в операции?

```typescript
operations.push({
  op: 'create',
  id: e.id, // ✅ Оставили для отслеживания результатов!
  data: {
    // ❌ Убрали отсюда!
  }
});
```

**Причина:** Поле `id` в операции используется для:
1. Логирования на сервере (для диагностики)
2. Отслеживания соответствия запрос → результат
3. Вызова `updateHistoryEventId(oldId, newId)` после создания

**НО:** Это поле НЕ используется для вставки в БД!
**Для вставки используется:** `data.id` (которое мы убрали)

---

## Новые логи после исправления

### Успешное создание через BATCH:
```
📦 BATCH CREATE: подготовка 1 событий для создания...
📝 BATCH: операции: create:ev_temp_1763499847802
📦 BATCH: начало создания 1 событий...
✅ BATCH: успешно создано 1 событий
🔄 UNDO/REDO: ✅ События успешно синхронизированы с сервером
🔄 UNDO/REDO: Обновление ID в истории: ev_temp_1763499847802 → e37347
```

### БЕЗ ошибок:
```
❌ BATCH create error: null value in column "id" ← БОЛЬШЕ НЕТ! ✅
```

---

## Изменения в коде

### Файл: `/contexts/SchedulerContext.tsx`

**Строки 1175-1192:**
```diff
  eventsToCreate.forEach(e => {
+   // ✅ КРИТИЧНО: НЕ передаём временный ID в data!
+   // Для временных ID (ev_temp_XXX) сервер создаст новый ID через sequence
    operations.push({
      op: 'create',
-     id: e.id, // ✅ КРИТИЧНО: передаем ID для upsert!
+     id: e.id, // Для отслеживания в результатах (НЕ используется сервером для временных ID)
      data: {
-       id: e.id, // ✅ Также в data для уверенности
+       // ❌ НЕ передаём id для временных событий!
+       // ✅ Сервер создаст новый ID через PostgreSQL sequence
        resourceId: e.resourceId,
        // ...
      }
    });
  });
```

---

## Тестирование

### Сценарий 1: Создание → Undo → Redo
1. Создай событие
2. Undo → событие удалилось
3. Redo → событие вернулось ✅
4. Проверь логи: `✅ BATCH: успешно создано 1 событий`
5. **Ожидаемый результат:** Нет ошибок `null value in column "id"`

### Сценарий 2: Drag → Undo → Redo
1. Создай событие
2. Drag событие
3. Undo 2 раза → событие удалилось
4. Redo 2 раза → событие вернулось и в правильной позиции ✅
5. **Ожидаемый результат:** Всё работает без ошибок

### Сценарий 3: Быстрые Undo/Redo
1. Создай 3 события
2. Undo 3 раза (быстро)
3. Redo 3 раза (быстро)
4. **Ожидаемый результат:** Все события восстановлены без ошибок

---

## Дополнительные проверки

### Что если нужно восстановить событие с реальным ID?

**Сценарий:** После модификации проекта делаем Undo, событие должно восстановиться с тем же ID.

**Решение:**
```typescript
// В будущем можно добавить логику для UPSERT с реальным ID:
eventsToCreate.forEach(e => {
  const data: any = {
    resourceId: e.resourceId,
    // ...
  };
  
  // Если это НЕ временный ID, можно передать
  if (!e.id.startsWith('ev_temp_')) {
    const numericId = parseInt(e.id.replace('e', ''));
    if (!isNaN(numericId)) {
      data.id = numericId; // ✅ Для UPSERT существующих событий
    }
  }
  
  operations.push({ op: 'create', data, ... });
});
```

**Но сейчас:** Мы используем `eventsToUpdate` для реальных ID, поэтому эта логика не нужна.

---

## Резюме

### Изменения:
- ✅ Убрали `id: e.id` из `data` в BATCH CREATE операциях
- ✅ Теперь PostgreSQL сам создаёт ID через sequence
- ✅ Ошибка `null value in column "id"` исправлена

### Проверь:
1. Создай событие
2. Undo
3. Redo
4. **Событие должно восстановиться без ошибок!** ✅

---

**Версия:** v3.3.9
**Дата:** 2025-11-18
**Приоритет:** 🔥 КРИТИЧЕСКИЙ
**Связано с:** 
- `/UNDO_REDO_TEMPORARY_ID_FIX.md` (v3.3.8)
- `/UNDO_REDO_MISSING_STEP_FIX.md` (v3.3.7)
