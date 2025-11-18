# Изменения в SchedulerMain.tsx для виртуализации v2.5

## 📍 Точные изменения

### 1. Импорты (строки 1-43)

**Добавьте после импорта SchedulerGrid**:

```typescript
import { SchedulerGrid } from './SchedulerGrid';
import { VirtualizedSchedulerGrid } from './VirtualizedSchedulerGrid'; // + НОВЫЙ
import { useVirtualization } from '../../hooks/useVirtualization'; // + НОВЫЙ
```

### 2. После создания config (после строки ~221)

**Добавьте перед const { saveHistory... }**:

```typescript
// Кэшируем config для предотвращения лишних пересчётов и ре-рендеров
const config = useMemo(
  () => createLayoutConfig(weekPx, eventRowH, filteredDepartments, filteredResources),
  [weekPx, eventRowH, filteredDepartments, filteredResources]
);

// + НОВЫЙ КОД: Подсчёт общего количества строк для виртуализации
const totalRows = useMemo(() => {
  let total = 0;
  filteredDepartments.forEach(dept => {
    total++; // Строка департамента
    const deptResources = filteredResources.filter(r => r.departmentId === dept.id);
    total += deptResources.length; // Строки ресурсов
  });
  return total;
}, [filteredDepartments, filteredResources]);

// + НОВЫЙ КОД: Хук виртуализации
const virtualization = useVirtualization({
  containerRef: schedulerRef,
  totalRows,
  rowHeight: config.eventRowH,
  totalWeeks: 52,
  weekWidth: config.weekPx,
  resourceWidth: config.resourceW,
  overscan: 5
});

const { saveHistory, undo: historyUndo, redo: historyRedo, canUndo, canRedo, resetHistory } = useHistory([]);
```

### 3. Виртуализация событий (после sortedEventsWithZOrder, ~строка 1100+)

**Найдите**:
```typescript
// Сортируем события с учётом z-order
const sortedEventsWithZOrder = useMemo(() => {
  // ... код сортировки
}, [visibleEvents, eventZOrder]);
```

**Добавьте после**:
```typescript
// + НОВЫЙ КОД: Фильтруем события для рендеринга (только видимые недели)
const visibleEventsToRender = useMemo(() => {
  return sortedEventsWithZOrder.filter(event => {
    const eventWeekEnd = event.startWeek + event.weeksSpan;
    return (
      event.startWeek < virtualization.visibleEndWeek &&
      eventWeekEnd > virtualization.visibleStartWeek
    );
  });
}, [sortedEventsWithZOrder, virtualization.visibleStartWeek, virtualization.visibleEndWeek]);
```

### 4. JSX: Замена SchedulerGrid (примерно строка 1200+)

**Найдите**:
```typescript
<SchedulerGrid
  config={config}
  visibleDepartments={filteredDepartments}
  resources={filteredResources}
  grades={grades}
  companies={companies}
  workspace={workspace}
  onCellClick={handleCellClick}
  onCellMouseMove={handleCellMouseMove}
  onCellMouseLeave={handleCellMouseLeave}
  onBackToWorkspaces={onBackToWorkspaces}
  onSignOut={onSignOut}
  onOpenProfileModal={() => setProfileModalOpen(true)}
  onOpenSettingsModal={() => setSettingsModalOpen(true)}
  currentUserDisplayName={currentUserDisplayName}
  currentUserEmail={currentUserEmail}
  currentUserAvatarUrl={currentUserAvatarUrl}
  gridRef={gridRef}
/>
```

**Замените на**:
```typescript
<VirtualizedSchedulerGrid
  config={config}
  visibleDepartments={filteredDepartments}
  resources={filteredResources}
  grades={grades}
  companies={companies}
  workspace={workspace}
  onCellClick={handleCellClick}
  onCellMouseMove={handleCellMouseMove}
  onCellMouseLeave={handleCellMouseLeave}
  onBackToWorkspaces={onBackToWorkspaces}
  onSignOut={onSignOut}
  onOpenProfileModal={() => setProfileModalOpen(true)}
  onOpenSettingsModal={() => setSettingsModalOpen(true)}
  currentUserDisplayName={currentUserDisplayName}
  currentUserEmail={currentUserEmail}
  currentUserAvatarUrl={currentUserAvatarUrl}
  gridRef={gridRef}
  virtualization={virtualization} // + НОВЫЙ ПРОП
/>
```

### 5. JSX: Рендер событий (примерно строка 1250+)

**Найдите**:
```typescript
{sortedEventsWithZOrder.map(event => {
  const project = projects.find(p => p.id === event.projectId);
  // ... код рендера события
})}
```

**Замените на**:
```typescript
{visibleEventsToRender.map(event => {
  const project = projects.find(p => p.id === event.projectId);
  // ... тот же код рендера события
})}
```

## 📝 Полный diff

```diff
// Импорты
import { SchedulerGrid } from './SchedulerGrid';
+ import { VirtualizedSchedulerGrid } from './VirtualizedSchedulerGrid';
+ import { useVirtualization } from '../../hooks/useVirtualization';

// После config
const config = useMemo(...);

+ // Подсчёт строк для виртуализации
+ const totalRows = useMemo(() => {
+   let total = 0;
+   filteredDepartments.forEach(dept => {
+     total++;
+     const deptResources = filteredResources.filter(r => r.departmentId === dept.id);
+     total += deptResources.length;
+   });
+   return total;
+ }, [filteredDepartments, filteredResources]);

+ // Виртуализация
+ const virtualization = useVirtualization({
+   containerRef: schedulerRef,
+   totalRows,
+   rowHeight: config.eventRowH,
+   totalWeeks: 52,
+   weekWidth: config.weekPx,
+   resourceWidth: config.resourceW,
+   overscan: 5
+ });

// После sortedEventsWithZOrder
+ const visibleEventsToRender = useMemo(() => {
+   return sortedEventsWithZOrder.filter(event => {
+     const eventWeekEnd = event.startWeek + event.weeksSpan;
+     return (
+       event.startWeek < virtualization.visibleEndWeek &&
+       eventWeekEnd > virtualization.visibleStartWeek
+     );
+   });
+ }, [sortedEventsWithZOrder, virtualization.visibleStartWeek, virtualization.visibleEndWeek]);

// В JSX
- <SchedulerGrid
+ <VirtualizedSchedulerGrid
    config={config}
    // ... все остальные props без изменений
    gridRef={gridRef}
+   virtualization={virtualization}
  />

// Рендер событий
- {sortedEventsWithZOrder.map(event => (
+ {visibleEventsToRender.map(event => (
    <SchedulerEventComponent
      key={event.id}
      event={event}
      // ... props
    />
  ))}
```

## ⚠️ Важно

1. **Не удаляйте** SchedulerGrid - оставьте его для возможного fallback
2. **Проверьте** что все пропсы передаются в VirtualizedSchedulerGrid
3. **Убедитесь** что schedulerRef корректно передан
4. **Протестируйте** скролл, клик, drag & drop

## 🧪 Проверка

После изменений:
1. Откройте календарь
2. Проверьте что сетка рендерится
3. Прокрутите - должно быть плавно
4. Кликните по ячейке - должна открыться модалка
5. Перетащите событие - должно работать

Если что-то не работает:
- Проверьте консоль на ошибки
- Убедитесь что virtualization передан в VirtualizedSchedulerGrid
- Проверьте что все импорты корректны

---

**Время изменений**: 10 минут  
**Количество файлов**: 1 (SchedulerMain.tsx)  
**Риск**: Низкий (можно откатить)
