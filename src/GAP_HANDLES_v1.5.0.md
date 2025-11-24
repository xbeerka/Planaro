# Gap Handles - Двусторонний Resize v1.5.0

## 🎯 Описание

Новая фича позволяет **одновременно изменять два соседних события**, перетаскивая границу между ними при зажатой **Cmd/Ctrl** клавише.

## ✨ Как работает

### 1. Активация
- Зажмите **Cmd** (macOS) или **Ctrl** (Windows/Linux)
- Наведите курсор на **промежуток между двумя событиями**
- Появится синяя **пипка** (ручка) с кружками

### 2. Типы промежутков

#### Вертикальные gaps (между событиями сверху-снизу)
- События должны быть на **одном ресурсе** и **одной неделе**
- События должны **касаться друг друга** по вертикали
- Курсор: `ns-resize` (стрелки вверх-вниз)
- Изменение: верхнее событие меняет `unitsTall`, нижнее меняет `unitStart` и `unitsTall`

#### Горизонтальные gaps (между событиями слева-справа)
- События должны быть на **одном ресурсе**
- События должны **касаться друг друга** по горизонтали
- События должны **перекрываться по вертикали**
- Курсор: `ew-resize` (стрелки влево-вправо)
- Изменение: левое событие меняет `weeksSpan`, правое меняет `startWeek` и `weeksSpan`

### 3. Перетаскивание
- Зажмите ЛКМ на пипке
- Двигайте курсор вверх/вниз (vertical) или влево/вправо (horizontal)
- Оба события изменяются **одновременно**
- Граница двигается вместе с курсором

### 4. Валидация
- События не могут исчезнуть (минимум 1 unit / 1 week)
- События не могут выйти за пределы сетки (0-15 units, 0-51 weeks)
- Если изменение невалидно - ничего не происходит

## 🎨 Визуальный стиль

### Вертикальный handle
```
━━━●━━━━━●━━━━━●━━━
```
- Горизонтальная синяя линия
- 3 кружка (слева, в центре, справа)
- Высота: 8px
- Цвет: `rgba(59, 130, 246, 0.6)` с свечением

### Горизонтальный handle
```
┃
●
┃
●
┃
●
┃
```
- Вертикальная синяя линия
- 3 кружка (сверху, в центре, снизу)
- Ширина: 8px
- Цвет: `rgba(59, 130, 246, 0.6)` с свечением

## 📁 Архитектура

### Новые файлы

1. **`/types/scheduler.ts`** - интерфейс `EventGap`
   ```typescript
   interface EventGap {
     id: string;
     type: 'vertical' | 'horizontal';
     resourceId: string;
     week?: number;           // для vertical
     unitBoundary?: number;   // для vertical
     unitStart?: number;      // для horizontal
     weekBoundary?: number;   // для horizontal
     event1: SchedulerEvent;  // верхнее или левое
     event2: SchedulerEvent;  // нижнее или правое
   }
   ```

2. **`/utils/eventGaps.ts`** - поиск gaps и расчёт изменений
   - `findEventGaps()` - находит все gaps между событиями
   - `findVerticalGaps()` - вертикальные промежутки
   - `findHorizontalGaps()` - горизонтальные промежутки
   - `calculateGapResize()` - вычисляет новые размеры событий

3. **`/components/scheduler/EventGapHandles.tsx`** - компонент рендеринга handles
   - Показывается только при `isCommandKeyHeld = true`
   - Рендерит все активные gaps
   - Обрабатывает `onPointerDown` для начала drag

4. **`/hooks/useGapInteractions.ts`** - логика drag gap handles
   - `startGapDrag()` - начало перетаскивания
   - `onGapMove()` - движение handle
   - `onGapEnd()` - завершение и сохранение

### Интеграция в SchedulerMain

```tsx
// Импорты
import { useGapInteractions } from "../../hooks/useGapInteractions";
import { EventGapHandles } from "./EventGapHandles";
import { findEventGaps } from "../../utils/eventGaps";

// Хук для gap drag
const { startGapDrag } = useGapInteractions({...});

// Поиск gaps (только при Cmd)
const eventGaps = useMemo(() => {
  if (!isCtrlPressed) return [];
  return findEventGaps(visibleEvents, filteredResources, filteredDepartments);
}, [isCtrlPressed, visibleEvents, filteredResources, filteredDepartments]);

// Рендер handles
<EventGapHandles
  gaps={eventGaps}
  config={config}
  resources={filteredResources}
  visibleDepartments={filteredDepartments}
  isCommandKeyHeld={isCtrlPressed}
  onGapMouseDown={startGapDrag}
/>
```

## 🚀 Преимущества

1. **Быстрое редактирование** - два события за одно действие
2. **Интуитивно** - граница двигается туда куда курсор
3. **Визуально понятно** - синие пипки появляются только при Cmd
4. **Безопасно** - валидация предотвращает некорректные изменения
5. **Undo/Redo** - полностью поддерживается
6. **Polling блокировка** - Delta Sync не перезапишет изменения

## 🎯 Use Cases

### 1. Сдвиг границы между проектами
```
До:
[Project A: 0-2 units]
[Project B: 2-4 units]

После drag вниз на 1 unit:
[Project A: 0-3 units]   ← +1 unit
[Project B: 3-4 units]   ← -1 unit, сдвиг на +1
```

### 2. Балансировка длительности проектов
```
До:
[Project A: week 0-10]
[Project B: week 10-20]

После drag влево на 2 weeks:
[Project A: week 0-8]    ← -2 weeks
[Project B: week 8-20]   ← +2 weeks, сдвиг на -2
```

### 3. Точная настройка загрузки ресурса
```
До:
Resource: John
  [Task 1: 0-4 units]
  [Task 2: 4-8 units]

После drag вверх на 1 unit:
Resource: John
  [Task 1: 0-3 units]    ← -1 unit
  [Task 2: 3-8 units]    ← +1 unit, сдвиг на -1
```

## 📝 Логирование

```typescript
// Начало drag
console.log('🎯 Gap drag начат:', {
  type: 'vertical',
  event1: 'evt-123',
  event2: 'evt-456',
  boundary: 2
});

// Завершение drag
console.log('✅ Gap drag завершён с изменениями:', {
  delta: -1,
  event1: { unitsTall: 3 },
  event2: { unitStart: 3, unitsTall: 4 }
});

// Сохранение
console.log('✅ Gap изменения сохранены на сервер');
```

## 🔧 Настройки

- **Клавиша активации**: Cmd/Ctrl (через `isCtrlPressed` из `useKeyboardShortcuts`)
- **z-index handles**: 200 (выше событий, но ниже модальных окон)
- **Throttle**: Нет (мгновенное обновление при движении)
- **Блокировка polling**: 2 секунды после завершения drag

## ⚡ Производительность

- **Поиск gaps**: `O(n log n)` где n - количество событий
  - Группировка по ресурсам: O(n)
  - Сортировка событий внутри группы: O(n log n)
  - Поиск соседей: O(n)
  
- **Рендер handles**: `O(g)` где g - количество gaps (обычно < 50)

- **Оптимизация**: Gaps вычисляются только при `isCtrlPressed = true`

## 🐛 Edge Cases

1. **Нет gaps** - handle не показывается
2. **События не касаются** - gap не создаётся
3. **Невалидное изменение** - drag игнорируется
4. **Отмена drag** - события восстанавливаются
5. **Pending события** - gap handles работают независимо

## 🎓 Документация

- **Guidelines.md**: Секция "События" → "Gap Handles (v1.5.0)"
- **CHANGELOG.md**: v1.5.0
- **Тесты**: Создать события → зажать Cmd → навести на промежуток → drag

## 🔮 Будущие улучшения

1. **Диагональные gaps** - между событиями по диагонали
2. **Multi-gap drag** - перетаскивание нескольких границ одновременно
3. **Snap to grid** - привязка к юнитам/неделям
4. **Анимация** - плавное появление/исчезновение handles
5. **Тултип** - подсказка какие события изменяются

---

**Версия**: 1.5.0  
**Дата**: 2025-11-18  
**Статус**: ✅ Готово к тестированию
