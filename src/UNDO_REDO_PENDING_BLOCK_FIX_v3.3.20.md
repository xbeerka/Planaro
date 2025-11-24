# Исправление блокировки Undo/Redo для pending событий (v3.3.20)

## 🐛 Проблемы

### Проблема 1: Undo не блокируется при pending событиях
**Симптом:** Можно нажать Undo когда событие загружается (с временным ID)

**Причина:** В `handleUndo` отсутствует проверка на временные ID (которая есть в `handleRedo`)

**Код до исправления:**
```typescript
const handleUndo = useCallback(async () => {
  // ✅ Есть проверка hasPendingOperations()
  if (hasPendingOperations()) { ... }
  
  // ❌ НЕТ проверки на временные ID!
  
  // ✅ Есть блокировка одновременных операций
  if (isUndoRedoInProgressRef.current) { ... }
  
  // ... логика Undo
});
```

**Код в handleRedo (правильный):**
```typescript
const handleRedo = useCallback(async () => {
  // ✅ Есть проверка hasPendingOperations()
  if (hasPendingOperations()) { ... }
  
  // ✅ ЕСТЬ проверка на временные ID
  const hasPendingEvents = events.some(e => e.id.startsWith('ev_temp_'));
  if (hasPendingEvents) {
    console.log('⏸️ REDO: Заблокировано - есть события в процессе создания');
    // ... toast + return
  }
  
  // ... логика Redo
});
```

---

### Проблема 2: Redo блокируется даже когда событие загрузилось
**Симптом:** После создания события toast висит, Redo нельзя нажать

**Причина:** История НЕ обновляется после создания события на сервере

**Последовательность событий:**
1. ✅ Создаём событие → временный ID `ev_temp_123` в state и истории
2. ✅ Событие сохраняется на сервере → реальный ID `e12345`
3. ✅ State обновляется → `ev_temp_123` заменяется на `e12345`
4. ❌ **История НЕ обновляется** → остаётся `ev_temp_123`
5. ❌ При Redo восстанавливается событие с `ev_temp_123` из истории
6. ❌ Проверка `events.some(e => e.id.startsWith('ev_temp_'))` видит временный ID
7. ❌ Redo блокируется → toast висит

**Код до исправления** (`syncRestoredEventsToServer`):
```typescript
// ✅ State обновляется (строки 1334-1344)
setEventsState(prev => {
  const syncedIds = new Set([...results.created, ...results.updated].map(e => e.id));
  return prev.map(e => {
    if (syncedIds.has(e.id)) {
      const serverEvent = [...results.created, ...results.updated].find(se => se.id === e.id);
      return serverEvent || e; // ← Временный ID заменяется на реальный в state
    }
    return e;
  });
});

// ❌ История НЕ обновляется (строки 1357-1361)
if (updateHistoryEventId) {
  events.forEach(event => {
    updateHistoryEventId(event.id, event.id); // ← Обновляет ID на ТАКОЙ ЖЕ ID! БЕСПОЛЕЗНО!
  });
}
```

---

## ✅ Решения

### Исправление 1: Добавлена проверка временных ID в handleUndo

**Файл:** `/components/scheduler/SchedulerMain.tsx`

**Изменения:**
```typescript
const handleUndo = useCallback(async () => {
  // ... flush pending changes
  
  // ✅ v3.3.15: КРИТИЧНО - блокируем Undo если есть активные pending операции
  if (hasPendingOperations()) {
    console.log('⏸️ UNDO: Заблокировано - есть pending операции');
    // ... toast + return
  }
  
  // ✅ v3.3.20: КРИТИЧНО - блокируем Undo если есть события с временными ID
  // Это симметрично с handleRedo и предотвращает баг при быстром Undo после создания
  const hasPendingEvents = events.some(e => e.id.startsWith('ev_temp_'));
  if (hasPendingEvents) {
    console.log('⏸️ UNDO: Заблокировано - есть события в процессе создания');
    queueMicrotask(() => {
      try {
        showToast({
          type: 'warning',
          message: 'Подождите',
          description: 'Дождитесь завершения создания событий'
        });
      } catch (err) {
        console.error('❌ Ошибка показа toast:', err);
      }
    });
    return;
  }
  
  // ... остальная логика Undo
});
```

**Результат:**
- ✅ `handleUndo` и `handleRedo` теперь симметричны
- ✅ Оба блокируются при наличии событий с временными ID
- ✅ Нельзя нажать Undo когда событие грузится

---

### Исправление 2: Обновление ID в истории после создания на сервере

**Файл:** `/contexts/SchedulerContext.tsx`

**Изменения:**
```typescript
const syncRestoredEventsToServer = useCallback(async (events, updateHistoryEventId?) => {
  // ... разделение на eventsToCreate и eventsToUpdate
  // ... batch операции create + update
  // ... получение results с сервера
  
  // ✅ State обновляется (было уже)
  setEventsState(prev => {
    const syncedIds = new Set([...results.created, ...results.updated].map(e => e.id));
    return prev.map(e => {
      if (syncedIds.has(e.id)) {
        const serverEvent = [...results.created, ...results.updated].find(se => se.id === e.id);
        return serverEvent || e;
      }
      return e;
    });
  });
  
  // ✅ v3.3.20: КРИТИЧНО - обновляем ID в истории для созданных событий!
  // Это исправляет баг когда Redo блокируется из-за временных ID в истории
  if (updateHistoryEventId && results.created.length > 0) {
    console.log(`📝 История: обновление ID для ${results.created.length} созданных событий...`);
    
    // Создаём map: временный ID → реальный ID
    const tempToRealIdMap = new Map<string, string>();
    eventsToCreate.forEach((tempEvent, index) => {
      const createdEvent = results.created[index];
      if (createdEvent) {
        tempToRealIdMap.set(tempEvent.id, createdEvent.id);
        console.log(`   ${tempEvent.id} → ${createdEvent.id}`);
      }
    });
    
    // Обновляем ID в истории
    tempToRealIdMap.forEach((realId, tempId) => {
      updateHistoryEventId(tempId, realId);
    });
    
    console.log(`📝 История: обновлено ${tempToRealIdMap.size} ID`);
  }
  
  console.log('✅ Восстановленные события успешно синхронизированы с сервером');
});
```

**Результат:**
- ✅ История обновляется после создания события на сервере
- ✅ Временные ID заменяются на реальные ID во ВСЕЙ истории
- ✅ При следующем Redo восстанавливается событие с реальным ID
- ✅ Redo НЕ блокируется после загрузки события

---

## 🔍 Технические детали

### Почему нужны обе проверки?

**hasPendingOperations()** - проверяет очередь debounced сохранений:
```typescript
const hasPendingOperations = useCallback(() => {
  return pendingOps.size > 0;
}, [pendingOps]);
```
- Блокирует Undo/Redo если есть несохранённые изменения в очереди
- Защищает от потери изменений

**hasPendingEvents** - проверяет временные ID в state:
```typescript
const hasPendingEvents = events.some(e => e.id.startsWith('ev_temp_'));
```
- Блокирует Undo/Redo если событие создаётся на сервере
- Защищает от "воскрешения" событий (баг v3.3.12)
- Предотвращает восстановление событий с временными ID

### Почему важно обновлять историю?

**Без обновления истории:**
```
Создание → ev_temp_123 (state + история)
Сохранение → e12345 (state), ev_temp_123 (история) ← ПРОБЛЕМА!
Undo → восстановление из истории
Redo → восстановление ev_temp_123 из истории ← БЛОКИРОВКА!
```

**С обновлением истории:**
```
Создание → ev_temp_123 (state + история)
Сохранение → e12345 (state + история) ← ПРАВИЛЬНО!
Undo → восстановление из истории
Redo → восстановление e12345 из истории ← РАБОТАЕТ!
```

---

## 📊 Последовательность вызовов

### Undo после создания события

**До исправления:**
```
1. Создание события → ev_temp_123
2. Событие грузится на сервере (200-500ms)
3. Пользователь нажимает Undo ← РАЗРЕШЕНО! (баг)
4. Undo удаляет событие из state
5. createEvent завершается → e12345
6. Delta Sync загружает e12345 из БД
7. Событие "воскресает" ← ПРОБЛЕМА!
```

**После исправления:**
```
1. Создание события → ev_temp_123
2. Событие грузится на сервере (200-500ms)
3. Пользователь нажимает Undo ← ЗАБЛОКИРОВАНО! (toast)
4. createEvent завершается → e12345
5. История обновляется: ev_temp_123 → e12345
6. Пользователь может нажать Undo ← РАЗРЕШЕНО
7. Undo удаляет e12345
8. Синхронизация с сервером → DELETE e12345
9. Событие НЕ "воскресает" ← ПРАВИЛЬНО!
```

### Redo после создания события

**До исправления:**
```
1. Создание события → ev_temp_123 (state + история)
2. Сохранение → e12345 (state), ev_temp_123 (история) ← БАГ!
3. Undo → удаление e12345
4. Пользователь нажимает Redo
5. Проверка: events.some(e => e.id.startsWith('ev_temp_'))
6. История содержит ev_temp_123 ← ЛОЖНОЕ СРАБАТЫВАНИЕ!
7. Redo ЗАБЛОКИРОВАН ← toast висит
```

**После исправления:**
```
1. Создание события → ev_temp_123 (state + история)
2. Сохранение → e12345 (state + история) ← ИСПРАВЛЕНО!
3. Undo → удаление e12345
4. Пользователь нажимает Redo
5. Проверка: events.some(e => e.id.startsWith('ev_temp_'))
6. История содержит e12345 ← НЕТ ВРЕМЕННЫХ ID!
7. Redo РАЗРЕШЁН ← работает!
```

---

## ✅ Результат

### Исправленные баги
1. ✅ **Undo блокируется при pending событиях** - добавлена симметричная проверка
2. ✅ **Redo разблокируется после загрузки** - история обновляется с реальными ID
3. ✅ **События не "воскресают"** - баг v3.3.12 полностью исправлен
4. ✅ **Симметричная логика** - handleUndo и handleRedo работают одинаково

### Поведение
- ✅ Нельзя нажать Undo когда событие грузится
- ✅ Нельзя нажать Redo когда событие грузится
- ✅ Можно нажать Redo после того как событие загрузилось
- ✅ Toast исчезает после завершения создания события
- ✅ Undo/Redo работает корректно в любой последовательности

### Защиты
- ✅ Блокировка при pending операциях (debounced save)
- ✅ Блокировка при временных ID (создание на сервере)
- ✅ Блокировка одновременных операций (isUndoRedoInProgressRef)
- ✅ Обновление истории после создания на сервере
- ✅ Flush pending changes перед Undo/Redo

---

## 📝 Затронутые файлы

1. `/components/scheduler/SchedulerMain.tsx`
   - Добавлена проверка временных ID в `handleUndo`
   - Симметрия с `handleRedo`

2. `/contexts/SchedulerContext.tsx`
   - Обновление ID в истории после создания в `syncRestoredEventsToServer`
   - Корректная логика замены временных ID на реальные

---

**Версия:** v3.3.20  
**Дата:** 2025-11-19  
**Статус:** ✅ Исправлено и протестировано
