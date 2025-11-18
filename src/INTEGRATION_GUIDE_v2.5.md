# Руководство по интеграции виртуализации (v2.5)

## 🎯 Что сделано

Созданы новые компоненты для оптимизации рендеринга календаря:

1. **`/hooks/useVirtualization.ts`** - хук для виртуализации строк и недель
2. **`/components/scheduler/VirtualizedSchedulerGrid.tsx`** - виртуализированная сетка календаря
3. **`/styles/globals.css`** - CSS оптимизации (CSS containment, GPU acceleration)
4. **Документация** - `/PERFORMANCE_OPTIMIZATION_v2.5.md`

## 📝 Как интегрировать

### Вариант 1: Полная замена (рекомендуется)

Замените `SchedulerGrid` на `VirtualizedSchedulerGrid` в `SchedulerMain.tsx`:

```typescript
// 1. Добавьте импорт useVirtualization
import { useVirtualization } from '../../hooks/useVirtualization';

// 2. Замените импорт SchedulerGrid на VirtualizedSchedulerGrid
import { VirtualizedSchedulerGrid } from './VirtualizedSchedulerGrid';

// 3. В компоненте SchedulerMain, после создания config, добавьте:
const virtualization = useVirtualization({
  containerRef: schedulerRef,
  totalRows: (() => {
    // Подсчитываем общее количество строк (департаменты + ресурсы)
    let total = 0;
    filteredDepartments.forEach(dept => {
      total++; // Строка департамента
      const deptResources = filteredResources.filter(r => r.departmentId === dept.id);
      total += deptResources.length; // Строки ресурсов
    });
    return total;
  })(),
  rowHeight: config.eventRowH, // Высота строки ресурса
  totalWeeks: 52,
  weekWidth: config.weekPx,
  resourceWidth: config.resourceW,
  overscan: 5 // Количество строк/недель для prerendering
});

// 4. Замените <SchedulerGrid /> на <VirtualizedSchedulerGrid />
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
  virtualization={virtualization} // Новый проп!
/>

// 5. ОПЦИОНАЛЬНО: Виртуализируйте события
// Рендерите только события в видимых неделях
const visibleEventsToRender = useMemo(() => {
  return sortedEventsWithZOrder.filter(event => {
    const eventWeekEnd = event.startWeek + event.weeksSpan;
    // Событие видимо если оно пересекается с видимым диапазоном недель
    return (
      event.startWeek < virtualization.visibleEndWeek &&
      eventWeekEnd > virtualization.visibleStartWeek
    );
  });
}, [sortedEventsWithZOrder, virtualization.visibleStartWeek, virtualization.visibleEndWeek]);

// 6. В рендере событий замените sortedEventsWithZOrder на visibleEventsToRender
{visibleEventsToRender.map(event => (
  <SchedulerEventComponent
    key={event.id}
    event={event}
    // ... остальные props
  />
))}
```

### Вариант 2: Постепенная миграция (для тестирования)

Добавьте toggle для переключения между обычной и виртуализированной версией:

```typescript
// В SchedulerMain добавьте state:
const [useVirtualization, setUseVirtualization] = useState(false);

// Добавьте кнопку переключения в Toolbar:
<button onClick={() => setUseVirtualization(!useVirtualization)}>
  {useVirtualization ? 'Стандартная сетка' : 'Виртуализация'}
</button>

// Условный рендеринг:
{useVirtualization ? (
  <VirtualizedSchedulerGrid {...props} virtualization={virtualization} />
) : (
  <SchedulerGrid {...props} />
)}
```

## 🧪 Тестирование

### 1. Проверьте базовый функционал:
- ✅ Скролл работает плавно
- ✅ Sticky заголовки (месяцы, недели, ресурсы) работают
- ✅ Клик по ячейке создает событие
- ✅ Hover highlight работает
- ✅ События рендерятся корректно

### 2. Проверьте производительность:
- ✅ Откройте DevTools → Performance
- ✅ Запишите профиль при скролле
- ✅ FPS должен быть стабильно ~60
- ✅ Layout/Paint быстрые (<16ms)

### 3. Стресс-тест:
- ✅ Создайте 50+ сотрудников
- ✅ Сгенерируйте события
- ✅ Прокрутите весь календарь
- ✅ Zoom in/out
- ✅ Проверьте память (DevTools → Memory)

## 🐛 Возможные проблемы

### Проблема: События "прыгают" при скролле
**Решение**: Убедитесь что `left` и `top` событий вычисляются относительно всей сетки, а не видимой области.

### Проблема: Sticky заголовки не работают
**Решение**: Проверьте z-index и position: sticky в CSS.

### Проблема: Плохая производительность
**Решение**: 
1. Проверьте что `overscan` не слишком большой (рекомендуется 5)
2. Проверьте что useCallback используется для всех колбэков
3. Проверьте что нет лишних console.log в рендер-функциях

### Проблема: События не кликабельны
**Решение**: Убедитесь что `pointer-events: auto` на событиях и контейнере событий.

## 📊 Метрики для мониторинга

### Chrome DevTools → Performance:
- **FPS**: должен быть 55-60 при скролле
- **Scripting**: <10ms на frame
- **Rendering**: <5ms на frame
- **Painting**: <5ms на frame

### Chrome DevTools → Memory:
- **DOM Nodes**: должно быть <2000 (было >10000)
- **Heap size**: должно быть <100MB (было >200MB)

### Chrome DevTools → Layers:
- Не должно быть >50 layers
- Проверьте что `will-change` не везде

## 🚀 Что дальше

После успешной интеграции виртуализации, можно:

1. **Добавить виртуализацию событий по вертикали** (юнитам)
2. **Оптимизировать фильтры** через debounce
3. **Добавить Web Workers** для генерации событий
4. **Кэшировать данные** в IndexedDB
5. **Использовать Intersection Observer** для департаментов

## ❓ Вопросы?

Если возникли проблемы:
1. Проверьте консоль браузера на ошибки
2. Откройте DevTools → React DevTools → Profiler
3. Проверьте что все пропсы передаются корректно
4. Проверьте что нет бесконечных ре-рендеров

---

**Версия**: v2.5  
**Дата**: 2025-10-22  
**Статус**: 🟢 Ready for integration  
**Тестировано**: ❌ Requires testing
