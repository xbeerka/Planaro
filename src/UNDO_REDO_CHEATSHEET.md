# 🔄 Система Undo/Redo - Шпаргалка для разработчиков

## 🎯 Основные правила

### ✅ ВСЕГДА делай так:
```typescript
// При сохранении истории
saveHistory(events, eventZOrder, projects);

// При сбросе истории
resetHistory(events, eventZOrder, projects);
```

### ❌ НИКОГДА не делай так:
```typescript
// БЕЗ третьего параметра projects - приведёт к ошибкам!
saveHistory(events, eventZOrder);
resetHistory(events, eventZOrder);
```

## 📦 Что хранится в истории?

Каждая запись в истории содержит:
```typescript
interface HistoryState {
  events: SchedulerEvent[];        // Все события
  eventZOrder: Map<string, number>; // Z-индексы для перекрывающихся событий
  projects: Project[];              // ВСЕ проекты (ОБЯЗАТЕЛЬНО!)
}
```

## 🛡️ Защита от коррупции данных

### Проверка при сохранении (saveHistory)
```typescript
// Если есть события но НЕТ проектов → НЕ сохраняем!
if (events.length > 0 && projects.length === 0) {
  console.error('❌ КРИТИЧЕСКАЯ ОШИБКА: события без проектов!');
  return; // Блокируем сохранение
}
```

### Проверка при восстановлении (undo/redo)
```typescript
// Если state содержит события но НЕТ проектов → НЕ восстанавливаем!
if (state.events.length > 0 && state.projects.length === 0) {
  console.error('❌ КРИТИЧЕСКАЯ ОШИБКА: попытка восстановить события без проектов!');
  return null; // Блокируем Undo/Redo
}
```

## 📝 Когда вызывать saveHistory?

### 1. После каждого изменения событий
```typescript
// Создание события
const newEvent = await createEvent(eventData);
saveHistory([...events, newEvent], eventZOrder, projects);

// Обновление события
const updatedEvents = events.map(e => e.id === id ? updated : e);
saveHistory(updatedEvents, eventZOrder, projects);

// Удаление события
const filteredEvents = events.filter(e => e.id !== id);
saveHistory(filteredEvents, eventZOrder, projects);
```

### 2. После изменения z-order
```typescript
const newEventZOrder = new Map(eventZOrder);
newEventZOrder.set(eventId, maxZ + 1);
saveHistory(events, newEventZOrder, projects);
```

### 3. После изменения проектов (пользовательское действие)
```typescript
// В SchedulerMain.tsx есть автоматическое отслеживание
// через isUserProjectChangeRef для сохранения при изменении проектов
```

## 🔄 Когда вызывать resetHistory?

### 1. После начальной загрузки данных
```typescript
useEffect(() => {
  if (!isLoading && !historyInitializedRef.current) {
    console.log('📝 Инициализация истории');
    resetHistory(events, eventZOrder, projects);
    historyInitializedRef.current = true;
  }
}, [isLoading, events, projects, eventZOrder]);
```

### 2. После сохранения в модалках
```typescript
// UsersManagementModal, ProjectsManagementModal
<Modal
  onResetHistory={() => {
    console.log('📝 Сброс истории после изменений (с проектами)');
    resetHistory(events, eventZOrder, projects);
  }}
/>
```

## 🆔 Обновление ID в истории

### Когда временный ID заменяется на реальный
```typescript
// После создания события на сервере
const tempId = 'ev_temp_1732005123456_0.123';
const realId = 'e12345';

updateHistoryEventId(tempId, realId); // Обновит ID во ВСЕЙ истории

// Аналогично для проектов
updateHistoryProjectId(oldId, newId);
```

## 🐛 Типичные ошибки

### ❌ Ошибка 1: Не передаём проекты
```typescript
// НЕПРАВИЛЬНО
resetHistory(events, eventZOrder);

// ПРАВИЛЬНО
resetHistory(events, eventZOrder, projects);
```

### ❌ Ошибка 2: Сохраняем историю до загрузки проектов
```typescript
// НЕПРАВИЛЬНО - projects ещё не загружены!
useEffect(() => {
  saveHistory(events, eventZOrder, []); 
}, [events]);

// ПРАВИЛЬНО - ждём загрузки
useEffect(() => {
  if (!isLoading) {
    saveHistory(events, eventZOrder, projects);
  }
}, [events, projects, isLoading]);
```

### ❌ Ошибка 3: Параллельное восстановление множественных событий
```typescript
// НЕПРАВИЛЬНО - race conditions!
await Promise.all(eventsToRestore.map(e => createEvent(e)));

// ПРАВИЛЬНО - последовательное восстановление
for (const event of eventsToRestore) {
  await createEvent(event);
}
```

## 📊 Лимиты

- **MAX_HISTORY**: 50 записей
- При превышении: самая старая запись удаляется
- Каждая запись: глубокая копия (JSON.parse(JSON.stringify()))

## 🔍 Отладка

### Логи при сохранении
```
📝 История: СОХРАНЕНИЕ
📝 История: 15 записей, index: 14
🔧 История: используем проекты из предыдущего состояния (12 шт)
```

### Логи при Undo/Redo
```
📝 История: UNDO - текущий index 5, всего записей 15
📝 История: UNDO - возвращаем state с 42 событиями, 12 проектами (index 4)
✅ История: восстановлено 3/3 событий
```

### Ошибки
```
❌ История: КРИТИЧЕСКАЯ ОШИБКА - попытка восстановить state с событиями но без проектов!
❌ История: это приведёт к удалению всех событий. Отменяем Undo.
```

## 📚 Связанные файлы

- `/hooks/useHistory.ts` - основная логика
- `/components/scheduler/SchedulerMain.tsx` - использование истории
- `/guidelines/Guidelines.md` - раздел "↩️ Система Undo/Redo"
- `/CHANGELOG.md` - история изменений

## 🚀 Проверка перед коммитом

1. ✅ Все вызовы `saveHistory()` передают `projects`?
2. ✅ Все вызовы `resetHistory()` передают `projects`?
3. ✅ История инициализируется ПОСЛЕ загрузки данных?
4. ✅ Нет race conditions при восстановлении множественных событий?
5. ✅ Логирование достаточно детальное для отладки?

---

**Версия**: 1.0 (2025-11-18)  
**Автор**: AI Assistant  
**Связанное исправление**: "Защита истории от сохранения событий без проектов"
