# Undo/Redo eventZOrder Fix (v3.3.22)

**Дата**: 2025-11-25  
**Статус**: ✅ ИСПРАВЛЕНО  

---

## 🐛 Проблема

При выполнении Undo после drag события:
1. ✅ Drag работает нормально
2. ✅ Событие успешно сохраняется
3. ❌ При Undo восстанавливается **пустое состояние** (0 событий)
4. ❌ Все события удаляются на сервере

### Логи проблемы:
```
🔄 UNDO/REDO: ↩️ Восстановлено 0 событий, 0 проектов  // ❌ Пустое состояние!
🔄 UNDO/REDO: Найдено 16 удалённых событий: [e37456, e37460, ...]
✅ Событие удалено на сервере: e37456
📝 Инициализация истории: 0 событий, 87 проектов  // ❌ Реинициализация!
```

---

## 🔍 Корневые причины

### 1. **eventZOrder не сохранялся в истории**
```typescript
// ❌ БЫЛО в useOptimisticHistory.ts:
interface HistoryState {
  events: SchedulerEvent[];
  projects: Project[];
  // eventZOrder: отсутствовал!
  timestamp: number;
}

// ❌ БЫЛО в undo():
return { 
  events: previous.events, 
  projects: previous.projects
  // eventZOrder: отсутствовал!
};

// ❌ БЫЛО в SchedulerMain.tsx (handleUndo):
setEventZOrder(state.eventZOrder); // TypeError: state.eventZOrder is undefined!
```

**Последствия**: 
- `state.eventZOrder` был `undefined`
- Ошибка приводила к некорректному восстановлению состояния

---

### 2. **Сброс флага истории при пустом состоянии**
```typescript
// ❌ БЫЛО в SchedulerMain.tsx:
React.useEffect(() => {
  if (events.length === 0 && historyInitializedRef.current) {
    console.log('🧹 Сброс флага истории (выход из воркспейса)');
    historyInitializedRef.current = false; // ❌ Сброс!
  }
}, [isLoading, events.length, ...]);
```

**Проблема**: 
- Когда Undo восстанавливал пустое состояние (0 событий), этот блок срабатывал
- Флаг сбрасывался → история реинициализировалась с пустым состоянием
- При следующем рендере `resetHistory([], eventZOrder, projects)` создавал пустую историю

---

### 3. **Асинхронная инициализация истории**
```typescript
// ❌ БЫЛО:
setTimeout(() => {
  resetHistory(events, eventZOrder, projects);
  historyInitializedRef.current = true;
}, 0);
```

**Проблема**: 
- История инициализировалась ПОСЛЕ первого рендера
- Между монтированием компонента и setTimeout(0) могло произойти взаимодействие
- Потенциальная race condition

---

## ✅ Решение

### 1. **Добавили eventZOrder в HistoryState**
```typescript
// ✅ СТАЛО в useOptimisticHistory.ts:
interface HistoryState {
  events: SchedulerEvent[];
  projects: Project[];
  eventZOrder: Map<string, number>; // ✅ Добавили!
  timestamp: number;
}

// ✅ Инициализация:
historyRef.current = {
  past: [],
  present: { 
    events: initialEvents, 
    projects: initialProjects,
    eventZOrder: new Map(), // ✅ Инициализируем!
    timestamp: Date.now() 
  },
  future: []
};

// ✅ resetHistory:
const resetHistory = useCallback((
  events: SchedulerEvent[], 
  projects: Project[],
  eventZOrder: Map<string, number> = new Map() // ✅ Добавили параметр!
) => {
  historyRef.current = {
    past: [],
    present: { 
      events: JSON.parse(JSON.stringify(events)), 
      projects: JSON.parse(JSON.stringify(projects)),
      eventZOrder: new Map(eventZOrder), // ✅ Клонируем!
      timestamp: Date.now()
    },
    future: []
  };
  notifyChange();
}, [notifyChange]);

// ✅ pushState:
const pushState = useCallback((
  events: SchedulerEvent[], 
  projects: Project[],
  eventZOrder: Map<string, number> = new Map() // ✅ Добавили параметр!
) => {
  // ...
  current.present = {
    events: JSON.parse(JSON.stringify(events)),
    projects: JSON.parse(JSON.stringify(projects)),
    eventZOrder: new Map(eventZOrder), // ✅ Клонируем!
    timestamp: Date.now()
  };
  // ...
}, [notifyChange]);

// ✅ undo:
const undo = useCallback(() => {
  // ...
  return { 
    events: previous.events, 
    projects: previous.projects,
    eventZOrder: previous.eventZOrder // ✅ Возвращаем!
  };
}, [notifyChange]);

// ✅ redo:
const redo = useCallback(() => {
  // ...
  return { 
    events: next.events, 
    projects: next.projects,
    eventZOrder: next.eventZOrder // ✅ Возвращаем!
  };
}, [notifyChange]);

// ✅ Экспорт getter:
return {
  // ...
  currentEventZOrder: historyRef.current.present.eventZOrder // ✅ Добавили!
};
```

---

### 2. **Обновили useHistory wrapper**
```typescript
// ✅ СТАЛО в useHistory.ts:
const {
  // ...
  currentEventZOrder, // ✅ Получаем!
} = useOptimisticHistory(initialEvents, initialProjects);

const saveHistory = (
  events: SchedulerEvent[],
  eventZOrder: Record<string, number> | Map<string, number>,
  projects: Project[]
) => {
  const zOrderMap = eventZOrder instanceof Map 
    ? eventZOrder 
    : new Map(Object.entries(eventZOrder).map(([k, v]) => [k, Number(v)]));
  
  pushState(events, projects, zOrderMap); // ✅ Передаём!
};

const resetHistory = (
  events: SchedulerEvent[],
  eventZOrder: Record<string, number> | Map<string, number>,
  projects: Project[]
) => {
  const zOrderMap = eventZOrder instanceof Map 
    ? eventZOrder 
    : new Map(Object.entries(eventZOrder).map(([k, v]) => [k, Number(v)]));
  
  originalResetHistory(events, projects, zOrderMap); // ✅ Передаём!
};

return {
  // ...
  currentEventZOrder, // ✅ Экспортируем!
};
```

---

### 3. **Убрали сброс флага при пустом состоянии**
```typescript
// ✅ СТАЛО в SchedulerMain.tsx:
React.useEffect(() => {
  if (!isLoading && !historyInitializedRef.current) {
    console.log(`📝 Инициализация истории: ${events.length} событий, ${projects.length} проектов`);
    
    // ✅ Инициализируем историю СИНХРОННО (не через setTimeout)
    resetHistory(events, eventZOrder, projects);
    historyInitializedRef.current = true;
  }
  
  // ❌ УБРАЛИ: сброс флага при events.length === 0
  // Это приводило к реинициализации истории с пустым состоянием при Undo
}, [isLoading, events.length, projects.length, eventZOrder, resetHistory]);

// ✅ Сбрасываем флаг ТОЛЬКО при размонтировании компонента
React.useEffect(() => {
  return () => {
    console.log('🧹 Сброс флага истории (размонтирование компонента)');
    historyInitializedRef.current = false;
  };
}, []);
```

---

### 4. **Добавили автосохранение истории при изменении событий**
```typescript
// ✅ ДОБАВЛЕНО в SchedulerMain.tsx:
const prevEventsRef = useRef<SchedulerEvent[]>([]);

React.useEffect(() => {
  if (!historyInitializedRef.current) {
    prevEventsRef.current = events;
    return;
  }
  
  const eventsChanged = JSON.stringify(prevEventsRef.current) !== JSON.stringify(events);
  
  if (eventsChanged) {
    // Проверка: НЕ сохраняем если есть события но НЕТ проектов
    if (events.length > 0 && projects.length === 0) {
      console.warn('⚠️ История: пропуск автосохранения - events загружены, но projects ещё нет');
      prevEventsRef.current = events;
      return;
    }
    
    // Пропускаем сохранение после недавнего Undo/Redo (< 2 сек)
    const timeSinceLastUndoRedo = Date.now() - lastUndoRedoTimeRef.current;
    if (timeSinceLastUndoRedo < 2000) {
      console.log('⏭️ Пропуск автосохранения: недавнее Undo/Redo');
      prevEventsRef.current = events;
      return;
    }
    
    console.log('📝 Автосохранение истории после изменения событий');
    saveHistory(events, eventZOrder, projects);
    prevEventsRef.current = events;
  }
}, [events, eventZOrder, projects, saveHistory]);
```

---

### 5. **Добавили подробное логирование**
```typescript
// ✅ resetHistory:
console.log(`📝 resetHistory: ${events.length} событий, ${projects.length} проектов, ${eventZOrder.size} z-order`);

// ✅ pushState:
console.log(`📝 pushState: добавлено в историю (past: ${current.past.length}, present: ${current.present.events.length} событий, ${current.present.projects.length} проектов, ${current.present.eventZOrder.size} z-order)`);

// ✅ undo:
console.log(`🔄 UNDO: восстановлено ${previous.events.length} событий, ${previous.projects.length} проектов, ${previous.eventZOrder.size} z-order (past: ${current.past.length}, future: ${current.future.length})`);

// ✅ redo:
console.log(`🔄 REDO: восстановлено ${next.events.length} событий, ${next.projects.length} проектов, ${next.eventZOrder.size} z-order (past: ${current.past.length}, future: ${current.future.length})`);
```

---

## 📋 Затронутые файлы

1. `/hooks/useOptimisticHistory.ts` - добавлен eventZOrder, логирование
2. `/hooks/useHistory.ts` - обновлены wrappers для передачи eventZOrder
3. `/components/scheduler/SchedulerMain.tsx`:
   - Убран сброс флага при `events.length === 0`
   - Синхронная инициализация истории (без setTimeout)
   - Сброс флага только при unmount
   - Автосохранение истории при изменении событий

---

## ✅ Результат

**ДО** исправления:
```
📝 Инициализация истории: 17 событий, 87 проектов
🔄 UNDO: история пуста (past.length = 0)  // ❌ Пустая история!
🔄 UNDO/REDO: ↩️ Восстановлено 0 событий, 0 проектов
🔄 UNDO/REDO: Найдено 16 удалённых событий
✅ Событие удалено на сервере: e37456
```

**ПОСЛЕ** исправления:
```
📝 resetHistory: 17 событий, 87 проектов, 0 z-order
📝 pushState: добавлено в историю (past: 1, present: 17 событий, 87 проектов, 1 z-order)
🔄 UNDO: восстановлено 17 событий, 87 проектов, 0 z-order (past: 0, future: 1)
🔄 UNDO/REDO: ↩️ Восстановлено 17 событий, 87 проектов  // ✅ Правильно!
```

---

## 🎯 Выводы

### Ключевые уроки:
1. **TypeScript типы не защищают от missing properties** - `state.eventZOrder` был undefined, но компилятор не предупредил
2. **Логика сброса флагов должна быть явной** - сброс при `events.length === 0` был скрытым багом
3. **Логирование критично** - без детальных логов проблему было бы невозможно найти
4. **Синхронность важна** - setTimeout(0) создавал потенциальную race condition

### Best Practices для Undo/Redo:
1. ✅ История должна хранить **ВСЕ** части состояния (events, projects, eventZOrder)
2. ✅ Инициализация должна быть **синхронной**
3. ✅ Сброс флагов должен быть **явным** (только при unmount)
4. ✅ Автосохранение должно учитывать **все источники изменений**
5. ✅ Логирование должно быть **подробным** на всех критических этапах

---

## 📚 Связанные документы

- `/UNDO_REDO_FIX_SUMMARY.md` (v3.3.1) - защита от сохранения событий без проектов
- `/UNDO_REDO_PROJECTS_SYNC_FIX.md` (v3.3.2) - синхронизация проектов при Undo/Redo
- `/UNDO_REDO_MODIFIED_EVENTS_FIX.md` (v3.3.6) - синхронизация измененных событий
- `/UNDO_REDO_RACE_CONDITION_FIX_v3.3.11.md` - блокировка одновременных операций
- `/UNDO_PENDING_EVENTS_FIX_v3.3.12.md` - блокировка Undo для pending событий

---

**Версия**: 3.3.22  
**Автор**: AI Assistant  
**Проверено**: ✅  
