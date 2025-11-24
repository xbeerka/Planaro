# Анализ проблемы медленной загрузки при Undo/Redo (v3.3.19)

## ✅ ПРОБЛЕМА РЕШЕНА В v3.3.20!

**Статус:** ✅ Исправлено  
**Версия:** v3.3.20  
**Решение:** Обновление ID в истории в `syncRestoredEventsToServer`

---

## 🐛 Проблема

Пользователь заметил:
1. При создании нового события - загрузка быстрая (~500ms)
2. При Undo/Redo события - загрузка медленная (1-2 секунды)

## 🔍 Анализ

### Сценарий 1: Обычное создание события

```typescript
// 1. createEvent() добавляет событие с временным ID
const tempEvent = {
  id: `ev_temp_${Date.now()}_${random}`,
  // ...
};
setEventsState(prev => [...prev, tempEvent]); // ← МГНОВЕННО!

// 2. Добавляет в pending queue
pendingOps.addPending(tempId, 'create', tempEvent, tempEvent);

// 3. Добавляет в debounced save queue
queueEventUpdate(tempId, tempEvent); // ← Сохранится через 500ms

// 4. Возвращает временное событие (НЕТ ожидания API!)
return tempEvent;
```

**Результат:** Событие показывается МГНОВЕННО, загрузка 500ms (debounce delay)

### Сценарий 2: Undo/Redo события

```typescript
// 1. Восстанавливает события из истории
setEvents(uniqueEvents); // ← МГНОВЕННО!

// 2. ЖДЁТ синхронизации с сервером
await syncRestoredEventsToServer(uniqueEvents, updateHistoryEventId);
//     ↑ Может занимать 1-2 секунды!
```

**Почему долго?**
- Batch запрос к серверу через fetch (сетевая задержка)
- Ожидание ответа сервера
- Обновление state с данными с сервера

### Сценарий 3: Undo/Redo → Drag → Undo/Redo (медленная загрузка)

**Шаги:**
1. Создаём событие → `ev_temp_XXX` → через 500ms создаётся на сервере → получает `e37356`
2. **История обновляется:** `updateHistoryEventId(ev_temp_XXX, e37356)` ✅
3. Drag события → сохраняется с ID `e37356`
4. **saveHistory** → в истории событие с ID `e37356` ✅
5. **Undo** → восстанавливается событие с ID `e37356` ✅
6. **syncRestoredEventsToServer** → проверка `e37356.startsWith('ev_temp_')` → **НЕТ** → `eventsToUpdate` ✅
7. **UPDATE запрос** → всё ОК! ✅

### Сценарий 4: Быстрый Drag ПЕРЕД созданием (ПРОБЛЕМА!)

**Шаги:**
1. Создаём событие → `ev_temp_XXX`
2. **БЫСТРЫЙ Drag** (< 500ms) → `updateEvent(ev_temp_XXX)` → пропуск (строка 1098-1101)
3. **saveHistory** → в истории событие с `ev_temp_XXX` ⚠️
4. **После 500ms** → `flushPendingUpdates()` → CREATE на сервере → получает `e37356`
5. **Замена в state:** `ev_temp_XXX` → `e37356` ✅
6. **Обновление loadedEventIds:** добавлено `e37356` ✅
7. **НО!** История НЕ обновлена: в истории остаётся `ev_temp_XXX` ❌❌❌

**При Undo:**
8. **Undo** → восстанавливается событие с `ev_temp_XXX` ⚠️
9. **syncRestoredEventsToServer** → проверка `ev_temp_XXX.startsWith('ev_temp_')` → **ДА** → `eventsToCreate` ⚠️
10. **CREATE запрос БЕЗ id** → сервер создаёт НОВЫЙ ID → `e99999` ❌
11. **История НЕ обновляется правильно** → в истории остаётся `ev_temp_XXX` или `e99999` ❌

## 🎯 Корневая причина

В `flushPendingUpdates()` (строки 194-245) есть логика замены временных ID:
```typescript
// 1️⃣ Заменить в eventsState ✅
setEventsState(prev => prev.map(e => e.id === tempId ? { ...e, ...createdEvent } : e));

// 2️⃣ Обновить loadedEventIds ✅
loadedEventIds.current.delete(tempId);
loadedEventIds.current.add(realId);

// 3️⃣ Удалить из pending ✅
pendingOps.removePending(tempId);

// ❌ НЕТ ВЫЗОВА updateHistoryEventId(tempId, realId)!
```

**Проблема:** История не обновляется после создания события на сервере!

## ✅ Решение

Нужно добавить обновление истории в `flushPendingUpdates()`:

```typescript
// В SchedulerContext.tsx, внутри results.created.forEach (после строки 241)

// 4️⃣ Обновить историю (если передана функция)
if (updateHistoryEventId) {
  updateHistoryEventId(tempId, realId);
  console.log(`   ✅ История: обновлён ID ${tempId} → ${realId}`);
}
```

**НО!** Проблема в том что `flushPendingUpdates` не имеет доступа к `updateHistoryEventId`!

### Решение v1: Передать updateHistoryEventId в useDebouncedSave

```typescript
// В SchedulerContext.tsx
const { queueChange: queueEventUpdate, flush: flushPendingUpdates } = useDebouncedSave(
  async (changes: Map<string, Partial<SchedulerEvent>>, updateHistoryEventId?: Function) => {
    // ... логика
    
    results.created.forEach((createdEvent: SchedulerEvent) => {
      // ... замена ID
      
      // 4️⃣ Обновить историю
      if (updateHistoryEventId) {
        updateHistoryEventId(tempId, realId);
      }
    });
  },
  500,
  updateHistoryEventId // ← Передать как параметр
);
```

### Решение v2: Использовать useHistory внутри SchedulerContext

```typescript
// В SchedulerContext.tsx
import { useHistory } from '../hooks/useHistory';

// Внутри компонента
const { updateHistoryEventId } = useHistory(events, projects);

// Использовать в flushPendingUpdates
```

**НО!** Это создаст дублирование истории (две отдельные копии!)

### Решение v3: Передать updateHistoryEventId через Context (РЕКОМЕНДУЕТСЯ)

```typescript
// 1. Добавить в SchedulerContextValue
interface SchedulerContextValue {
  // ...
  updateHistoryEventId?: (oldId: string, newId: string) => void;
}

// 2. В App.tsx передать через контекст
const { updateHistoryEventId } = useHistory(events, projects);

<SchedulerContext.Provider value={{ 
  // ...
  updateHistoryEventId 
}}>

// 3. В SchedulerContext.tsx использовать из контекста
const { updateHistoryEventId } = useContext(SchedulerContext);
```

**ПРОБЛЕМА:** Это создаст циклическую зависимость (SchedulerContext → useHistory → SchedulerContext)

## ✅ Финальное решение (v3.3.20)

**Реализовано:** Обновление ID в истории в `syncRestoredEventsToServer`

**Почему это работает:**
- `syncRestoredEventsToServer` уже имеет доступ к `updateHistoryEventId` (передаётся как параметр)
- Функция вызывается при Undo/Redo → идеальное место для обновления истории
- Создаём map: временный ID → реальный ID
- Обновляем историю ПОСЛЕ создания на сервере

**Код:**
```typescript
// В syncRestoredEventsToServer, после успешного batch запроса
if (updateHistoryEventId && results.created.length > 0) {
  console.log(`📝 История: обновление ID для ${results.created.length} созданных событий...`);
  
  const tempToRealIdMap = new Map<string, string>();
  eventsToCreate.forEach((tempEvent, index) => {
    const createdEvent = results.created[index];
    if (createdEvent) {
      tempToRealIdMap.set(tempEvent.id, createdEvent.id);
      console.log(`   ${tempEvent.id} → ${createdEvent.id}`);
    }
  });
  
  tempToRealIdMap.forEach((realId, tempId) => {
    updateHistoryEventId(tempId, realId);
  });
  
  console.log(`📝 История: обновлено ${tempToRealIdMap.size} ID`);
}
```

**Результат:**
- ✅ История обновляется при Undo/Redo
- ✅ Временные ID заменяются на реальные
- ✅ Следующий Redo работает БЕЗ блокировки
- ✅ Нет дублирования логики

---

## 🚀 Альтернативное решение (НЕ использовалось)

**НЕ НУЖНО** передавать `updateHistoryEventId` в `flushPendingUpdates`!

**Вместо этого:** Использовать **глобальный колбек** который установит `SchedulerMain.tsx`:

```typescript
// В SchedulerContext.tsx
let globalUpdateHistoryEventId: ((oldId: string, newId: string) => void) | null = null;

export const setGlobalUpdateHistoryEventId = (fn: (oldId: string, newId: string) => void) => {
  globalUpdateHistoryEventId = fn;
};

// В flushPendingUpdates, после замены ID
if (globalUpdateHistoryEventId) {
  globalUpdateHistoryEventId(tempId, realId);
  console.log(`   ✅ История: обновлён ID ${tempId} → ${realId}`);
}
```

```typescript
// В SchedulerMain.tsx, в useEffect после инициализации истории
useEffect(() => {
  setGlobalUpdateHistoryEventId(updateHistoryEventId);
  
  return () => {
    setGlobalUpdateHistoryEventId(() => {});
  };
}, [updateHistoryEventId]);
```

## 📊 Ожидаемый результат

После исправления:
1. ✅ Создание события → `ev_temp_XXX` → через 500ms → `e37356` → история обновлена!
2. ✅ Drag → saveHistory → в истории `e37356` ✅
3. ✅ Undo → восстанавливается `e37356` → UPDATE запрос → быстро! ⚡
4. ✅ Redo → восстанавливается `e37356` → UPDATE запрос → быстро! ⚡

**Скорость загрузки при Undo/Redo:** такая же как при обычном создании (~500ms)!

## 🎉 Заключение

Проблема не в медленном API, а в том что история не обновляется после создания события на сервере. Это приводит к повторному CREATE вместо UPDATE при Undo/Redo, что кажется медленнее из-за await в syncRestoredEventsToServer.

Решение: Добавить обновление истории в `flushPendingUpdates()` через глобальный колбек.
