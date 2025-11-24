# Архитектура v4.0.0 - Локальное создание событий

## 🎯 Проблема (v3.3.9)

В предыдущей версии `createEvent` делал немедленный API запрос:

```typescript
const createEvent = async (event) => {
  const tempId = `ev_temp_${Date.now()}`;
  
  // 1. Добавляем локально
  setEventsState(prev => [...prev, { id: tempId, ...event }]);
  
  // 2. ❌ СРАЗУ API ЗАПРОС!
  const created = await eventsApi.create(event);
  
  // 3. Заменяем временный ID на реальный
  setEventsState(prev => prev.map(e => e.id === tempId ? created : e));
  
  return created;
}
```

**Проблемы:**
- ❌ Race condition между CREATE (немедленный) и UPDATE (debounced)
- ❌ При быстром drag после copy+paste событие могло удалиться при undo
- ❌ Непредсказуемое поведение с историей

## ✅ Решение (v4.0.0)

События создаются **ПОЛНОСТЬЮ ЛОКАЛЬНО** до момента batch flush:

### 1️⃣ createEvent - локальное создание

```typescript
const createEvent = async (event) => {
  const tempEvent = { id: `ev_temp_${Date.now()}_${random}`, ...event };
  
  // 1. Добавляем в state
  setEventsState(prev => [...prev, tempEvent]);
  
  // 2. Добавляем в pending queue
  pendingOps.addPending(tempEvent.id, 'create', tempEvent, tempEvent);
  
  // 3. Добавляем в debounced queue
  queueEventUpdate(tempEvent.id, tempEvent);
  
  // 4. ✅ Возвращаем ЛОКАЛЬНОЕ событие (БЕЗ API запроса!)
  return tempEvent;
}
```

### 2️⃣ updateEvent - через debounced queue

```typescript
const updateEvent = async (id, updates) => {
  // ✅ Пропускаем временные ID (они ещё не созданы на сервере)
  if (id.startsWith('ev_temp_')) {
    return;
  }
  
  // Добавляем в pending queue
  pendingOps.addPending(id, 'update', original, updated);
  
  // Добавляем в debounced queue
  queueEventUpdate(id, updates);
}
```

### 3️⃣ flushPendingUpdates - batch операции

```typescript
async (changes: Map<string, Partial<SchedulerEvent>>) => {
  // ✅ РАЗРЕШАЕМ временные ID ev_temp_*
  const validChanges = Array.from(changes.entries()).filter(([id]) => {
    if (id.startsWith('ev_temp_')) return true; // ✅ Будут созданы
    
    const numericPart = id.replace('e', '');
    const isOldTemporaryId = numericPart.length > 10;
    return !isOldTemporaryId; // ❌ Старые временные ID
  });
  
  // Определяем op: 'create' vs 'update'
  const operations = validChanges.map(([id, data]) => {
    const isTemporary = id.startsWith('ev_temp_');
    const op = isTemporary ? 'create' : (loadedEventIds.has(id) ? 'update' : 'create');
    
    // ✅ НЕ передаём временный ID в data
    const finalData = { ...data };
    if (!isTemporary) {
      finalData.id = id;
    }
    
    return { op, id, data: finalData, workspace_id };
  });
  
  // Отправляем batch запрос
  const results = await fetch('/events/batch', {
    method: 'POST',
    body: JSON.stringify({ operations })
  });
  
  // ✅ Заменяем временные ID на реальные
  if (results.created) {
    const createOps = operations.filter(op => op.op === 'create');
    
    results.created.forEach((createdEvent, index) => {
      const tempId = createOps[index].id;
      const realId = createdEvent.id;
      
      // 1. Заменить в eventsState
      setEventsState(prev => prev.map(e => 
        e.id === tempId ? { ...e, ...createdEvent } : e
      ));
      
      // 2. Обновить loadedEventIds
      setLoadedEventIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(tempId);
        newSet.add(realId);
        return newSet;
      });
      
      // 3. Удалить из pending
      pendingOps.removePending(tempId);
    });
  }
}
```

### 4️⃣ Блокировка drag/resize для временных событий

```typescript
const startDrag = (e, el, evData) => {
  // 🚫 БЛОКИРОВКА для временных событий
  if (evData.id.startsWith('ev_temp_')) {
    console.log('🚫 DRAG ЗАБЛОКИРОВАН: ждём создания на сервере');
    e.preventDefault();
    return;
  }
  
  // ... обычный drag
}
```

**Почему блокировка нужна:**
- История сохраняет текущее состояние с ID событий
- Если drag происходит ДО flush → история содержит `ev_temp_XXX`
- После flush ID меняется → история НЕ обновляется автоматически
- Undo → пытается восстановить `ev_temp_XXX` → событие не найдено

**Задержка:** ~500ms (debounce delay) - незаметна для пользователя

## 📊 Сравнение v3.3.9 vs v4.0.0

| Аспект | v3.3.9 | v4.0.0 |
|--------|--------|--------|
| API запрос при создании | ✅ Немедленный | ❌ Отложенный (batch) |
| Временные ID | `ev_temp_XXX` | `ev_temp_XXX` |
| Замена ID | Сразу после CREATE | После batch flush |
| Drag временных событий | 🚫 Заблокирован | 🚫 Заблокирован |
| Race condition | ❌ Возможна | ✅ Исключена |
| Batch операции | CREATE сразу, UPDATE batch | ВСЁ через batch |
| Производительность | Средняя | Высокая |

## 🔄 Поток данных

```
1. Copy+Paste
   ↓
2. createEvent → ev_temp_123 (локально)
   ↓
3. queueEventUpdate → debounced queue
   ↓
4. [500ms debounce]
   ↓
5. flushPendingUpdates → batch CREATE
   ↓
6. Server → e37316
   ↓
7. Replace ev_temp_123 → e37316 в:
   - eventsState ✅
   - loadedEventIds ✅
   - pending queue ✅
   ↓
8. Drag/resize доступен (блокировка снята)
```

## 🎯 Преимущества

1. **Нет race conditions** - все операции через единый batch
2. **Предсказуемое поведение** - события создаются локально
3. **Лучшая производительность** - меньше API запросов
4. **Правильная история** - drag доступен только для реальных ID

## ⚠️ Ограничения

1. **Задержка 500ms** перед drag нового события (незаметна)
2. **Временные ID видны пользователю** (в dev режиме)

## 🔍 Дебаггинг

Логи для отслеживания:

```
📝 createEvent: добавление временного события ev_temp_XXX
⏳ createEvent: событие добавлено в pending queue (op: create)
📦 BATCH v4.0.0: временное событие ev_temp_XXX будет создано
✅ BATCH: создано 1 событий
🔄 BATCH: замена ev_temp_XXX → e37316
   ✅ eventsState: заменён
   ✅ loadedEventIds: заменён
```

---

**Версия**: 4.0.0  
**Дата**: 2025-11-18  
**Автор**: AI Assistant  
