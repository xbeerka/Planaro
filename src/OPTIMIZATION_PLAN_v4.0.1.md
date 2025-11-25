# Оптимизация Undo/Redo v4.0.1

## Проблема
handleUndo и handleRedo в SchedulerMain.tsx имеют зависимость `events` в useCallback deps, что вызывает ре-рендеры при каждом изменении событий.

## Текущее состояние

### handleUndo deps (строка 641):
```typescript
}, [historyUndo, events, setEvents, setProjects, resetDeltaSyncTimer, resetProjectsSyncTimer, syncRestoredEventsToServer, syncDeletedEventsToServer, updateHistoryEventId, cancelPendingChange, flushPendingChanges, hasPendingOperations, showToast]);
```

### Проблемные места где используется `events`:
1. **Строка 495**: `const hasPendingEvents = events.some(e => e.id.startsWith('ev_temp_'));`
2. **Строка 548**: `const previousEvents = events;`

## Решение

### Оптимизация #1: Получение events через setEvents callback

Вместо прямого использования `events` из props, получаем их через setEvents callback:

```typescript
// ❌ БЫЛО (строка 495):
const hasPendingEvents = events.some(e => e.id.startsWith('ev_temp_'));

// ✅ СТАЛО:
let hasPendingEvents = false;
setEvents(currentEvents => {
  hasPendingEvents = currentEvents.some(e => e.id.startsWith('ev_temp_'));
  return currentEvents; // Возвращаем без изменений
});
```

```typescript
// ❌ БЫЛО (строка 548):
const previousEvents = events;

// ✅ СТАЛО:
let previousEvents: SchedulerEvent[] = [];
setEvents(currentEvents => {
  previousEvents = currentEvents;
  return currentEvents; // Возвращаем без изменений
});
```

### Оптимизация #2: Обновленные deps

```typescript
// ❌ БЫЛО:
}, [historyUndo, events, setEvents, setProjects, ...]);

// ✅ СТАЛО:
}, [historyUndo, setEvents, setProjects, setEventZOrder, ...]);
```

## Преимущества

1. ✅ **Меньше ре-рендеров** - handleUndo/handleRedo НЕ пересоздаются при изменении events
2. ✅ **Актуальные данные** - получаем события напрямую из state через callback
3. ✅ **Нет стейл closures** - всегда работаем с актуальными событиями
4. ✅ **Лучшая производительность** - особенно при частых изменениях events

## Применение

Нужно обновить:
1. `/components/scheduler/SchedulerMain.tsx` - handleUndo (строки 493-548, 641)
2. `/components/scheduler/SchedulerMain.tsx` - handleRedo (аналогично)

## Тестирование

После применения проверить:
1. ✅ Undo/Redo работают корректно
2. ✅ Блокировка при pending событиях
3. ✅ Синхронизация удалённых событий
4. ✅ Нет лишних ре-рендеров (можно добавить console.log в handleUndo)
