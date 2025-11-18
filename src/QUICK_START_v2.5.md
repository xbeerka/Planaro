# Quick Start - Виртуализация календаря v2.5

## ⚡ 5-минутная интеграция

### Шаг 1: Импорты (SchedulerMain.tsx)

```typescript
import { useVirtualization } from '../../hooks/useVirtualization';
import { VirtualizedSchedulerGrid } from './VirtualizedSchedulerGrid';
```

### Шаг 2: Подсчитайте общее количество строк

```typescript
// После создания config, перед useHistory
const totalRows = useMemo(() => {
  let total = 0;
  filteredDepartments.forEach(dept => {
    total++; // Департамент
    total += filteredResources.filter(r => r.departmentId === dept.id).length; // Ресурсы
  });
  return total;
}, [filteredDepartments, filteredResources]);
```

### Шаг 3: Добавьте useVirtualization

```typescript
const virtualization = useVirtualization({
  containerRef: schedulerRef,
  totalRows,
  rowHeight: config.eventRowH,
  totalWeeks: 52,
  weekWidth: config.weekPx,
  resourceWidth: config.resourceW,
  overscan: 5
});
```

### Шаг 4: Замените SchedulerGrid

Найдите в JSX:
```typescript
<SchedulerGrid
  config={config}
  // ... props
  gridRef={gridRef}
/>
```

Замените на:
```typescript
<VirtualizedSchedulerGrid
  config={config}
  // ... те же props
  gridRef={gridRef}
  virtualization={virtualization} // + новый проп
/>
```

### Шаг 5 (опционально): Виртуализация событий

Добавьте перед рендером событий:

```typescript
const visibleEventsToRender = useMemo(() => {
  return sortedEventsWithZOrder.filter(event => {
    const eventEnd = event.startWeek + event.weeksSpan;
    return event.startWeek < virtualization.visibleEndWeek && 
           eventEnd > virtualization.visibleStartWeek;
  });
}, [sortedEventsWithZOrder, virtualization]);
```

Замените в map:
```typescript
{visibleEventsToRender.map(event => ...)}
```

## ✅ Готово!

Откройте календарь и проверьте:
- Плавный скролл
- FPS ~60 (DevTools → Performance)
- DOM элементов <1000 (DevTools → Elements)

## 🎯 Ожидаемый результат

**До**: 13,000 DOM элементов, лаги при скролле  
**После**: ~500 DOM элементов, плавный скролл 60 FPS

---

**Время интеграции**: ~5 минут  
**Сложность**: ⭐⭐☆☆☆ (средняя)  
**Риски**: Низкие (можно откатить)
