# Блокировка взаимодействий с временными событиями v3.3.9

## Проблема
При быстром Drag&Drop временных событий (с `id.startsWith('ev_temp_')`) возникала проблема:
1. Пользователь создаёт событие → создаётся локально с временным ID
2. Пользователь сразу начинает drag → событие ещё НЕ создано на сервере
3. Drag завершается → сохраняется история с временным ID
4. Событие создаётся на сервере → получает реальный ID
5. При Undo → восстанавливается событие с временным ID
6. **РЕЗУЛЬТАТ**: событие удаляется, так как временный ID не существует на сервере

## Решение
**Визуальная блокировка временных событий до создания на сервере**

### 1. Проп `isBlocked` в SchedulerEvent
```typescript
interface SchedulerEventProps {
  // ...
  isBlocked?: boolean; // ✅ Заблокировано для взаимодействия (временные ID)
  // ...
}
```

### 2. Вычисление флага блокировки
```typescript
// SchedulerMain.tsx
const isBlocked = event.id.startsWith('ev_temp_');
```

### 3. Визуальная индикация
- **Спиннер**: показывается для `isPending || isBlocked`
- **Класс CSS**: `pending` применяется для `isPending || isBlocked`
  - Opacity: 0.6
  - Diagonal stripes
  - Анимация: transition 0.15s

### 4. Блокировка взаимодействий
#### a) Скрытие ручек resize
```typescript
{!scissorsMode && !isCtrlPressed && !isBlocked && (
  // Resize handles
)}
```

#### b) Блокировка drag
```typescript
onPointerDown={(e, ev) => {
  if (isPending || isBlocked) return; // ✅
  startDrag(e, target, ev);
}}
```

#### c) Блокировка resize
```typescript
onHandlePointerDown={(e, ev, edge) => {
  if (isPending || isBlocked) return; // ✅
  startResize(e, eventEl, ev, edges);
}}
```

#### d) Блокировка редактирования (контекстное меню)
```typescript
const handleContextEdit = () => {
  if (contextMenu.event?.id.startsWith('ev_temp_')) {
    showToast('Событие ещё создаётся на сервере, подождите...', 'warning');
    return;
  }
  // ...
}
```

#### e) Блокировка удаления
```typescript
const handleContextDelete = () => {
  if (contextMenu.event?.id.startsWith('ev_temp_')) {
    showToast('Событие ещё создаётся на сервере, подождите...', 'warning');
    return;
  }
  // ...
}
```

#### f) Блокировка копирования
```typescript
const handleContextCopy = () => {
  if (contextMenu.event?.id.startsWith('ev_temp_')) {
    showToast('Событие ещё создаётся на сервере, подождите...', 'warning');
    return;
  }
  // ...
}
```

### 5. Обновление React.memo сравнения
```typescript
const shouldSkipRender = (
  // ...
  prevProps.isBlocked === nextProps.isBlocked && // ✅ Сравниваем isBlocked
  // ...
);
```

## Результат
- ✅ Временные события визуально заблокированы (спиннер + stripes)
- ✅ Нельзя drag/resize/edit/delete/copy до создания на сервере
- ✅ Задержка ~500ms между созданием и разблокировкой (незаметна)
- ✅ История ВСЕГДА содержит реальные ID
- ✅ Undo/Redo работает корректно

## Дополнительно: Увеличение TTL пометки удаления
```typescript
// SchedulerContext.tsx - syncDeletedEventsToServer
setTimeout(() => {
  deletedEvents.forEach(event => {
    deletedEventIdsRef.current.delete(event.id);
  });
}, 60000); // ✅ БЫЛО: 10000 (10 сек) → СТАЛО: 60000 (60 сек)
```

**Причина**: Минимум 2 Full Sync'a (каждые 30 сек) должны пройти с пометкой удаления.  
**Результат**: Защита от "воскрешения" удалённых событий при Undo/Redo.

## Файлы изменены
1. `/components/scheduler/SchedulerEvent.tsx` - добавлен проп `isBlocked`, обновлён рендеринг
2. `/components/scheduler/SchedulerMain.tsx` - вычисление `isBlocked`, блокировка взаимодействий
3. `/contexts/SchedulerContext.tsx` - увеличено время TTL пометки удаления до 60 сек

---

**Версия**: 3.3.9  
**Дата**: 2025-11-18  
**Статус**: ✅ Реализовано
