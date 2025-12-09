# Event Gluing Padding Fix v9.1

## Проблема

После рефакторинга алгоритма склейки событий (v9.0) появилась проблема с неправильным применением padding:

### Кейс 1: События с частичным пересечением (0-100%, 25-100%, 0-100%)
- ❌ **Week 0**: имел двойной gap вместо одинарного
- ❌ **Week 1**: смещен на 1 gap вправо (корректно), но ширина некорректная
- ❌ **Week 2**: НЕ увеличен влево на 1 gap

### Кейс 2: События с частичным пересечением (0-100%, 0-75%, 0-100%)
- ✅ **Week 4**: OK
- ❌ **Week 5**: увеличен на 1 gap по ширине (лишний)
- ❌ **Week 6**: НЕ увеличен влево на 1 gap

## Корневая причина

**Устаревшая логика проверки соседей в SchedulerMain.tsx:**

```typescript
// ❌ СТАРЫЙ КОД (неправильно)
const hasAnyLeftNeighbor = !showGaps ? false : 
  (neighborInfo?.hasFullLeftNeighbor);  // undefined!
const hasAnyRightNeighbor = !showGaps ? false : 
  (neighborInfo?.hasFullRightNeighbor); // undefined!
```

**Проблема:**
- Интерфейс `EventNeighborsInfo` (v9.0) **НЕ содержит** полей `hasFullLeftNeighbor` и `hasFullRightNeighbor`
- Эти поля всегда `undefined` → приводятся к `false`
- Поэтому **ВСЕ события** получали padding: `paddingLeft = config.cellPaddingLeft`, `paddingRight = config.cellPaddingRight`
- После применения расширения (`expandLeftMultiplier`, `expandRightMultiplier`) получался **двойной gap**

**Алгоритм v9.0 работал правильно:**
```
✅ Week 0 units=0-3: expandRight=1
✅ Week 1 units=1-3: expandLeft=1, expandRight=1
✅ Week 2 units=0-3: expandLeft=1
```

Но padding не убирался → расширение добавлялось к полному padding → визуально неправильно.

## Решение

**Использовать `expandLeftMultiplier` и `expandRightMultiplier` для определения склейки:**

```typescript
// ✅ НОВЫЙ КОД (правильно)
const hasAnyLeftNeighbor = !showGaps ? false : 
  (neighborInfo?.expandLeftMultiplier ?? 0) > 0;
const hasAnyRightNeighbor = !showGaps ? false : 
  (neighborInfo?.expandRightMultiplier ?? 0) > 0;
```

**Логика:**
- Если `expandLeftMultiplier > 0` → событие склеено слева → `paddingLeft = 0`
- Если `expandRightMultiplier > 0` → событие склеено справа → `paddingRight = 0`
- Расширение применяется **после** установки padding → корректная ширина

## Результат

### Кейс 1 (0-100%, 25-100%, 0-100%)
- ✅ **Week 0**: `expandRight=1`, `paddingRight=0` → width увеличена на gap → склеено с Week 1
- ✅ **Week 1**: `expandLeft=1`, `expandRight=1`, `paddingLeft=0`, `paddingRight=0` → смещение влево + расширение в обе стороны
- ✅ **Week 2**: `expandLeft=1`, `paddingLeft=0` → смещение влево + расширение → склеено с Week 1

### Кейс 2 (0-100%, 0-75%, 0-100%)
- ✅ **Week 4**: `expandRight=1`, `paddingRight=0` → склеено с Week 5
- ✅ **Week 5**: `expandLeft=1`, `expandRight=1`, `paddingLeft=0`, `paddingRight=0` → корректная ширина
- ✅ **Week 6**: `expandLeft=1`, `paddingLeft=0` → склеено с Week 5

## Файлы изменены

- `/components/scheduler/SchedulerMain.tsx`: строки 1390-1398
  - Заменена логика определения `hasAnyLeftNeighbor` и `hasAnyRightNeighbor`
  - Используется `expandLeftMultiplier` и `expandRightMultiplier` из `EventNeighborsInfo`

## Тестирование

1. Создайте события одного проекта:
   - Неделя 0: 0-100% (units 0-3)
   - Неделя 1: 25-100% (units 1-3)
   - Неделя 2: 0-100% (units 0-3)

2. Проверьте визуально:
   - События должны быть склеены (нет зазоров)
   - Все ширины корректные
   - Внутренние скругления на правильных углах

3. Повторите для кейса 0-75%:
   - Неделя 0: 0-100%
   - Неделя 1: 0-75% (units 0-2)
   - Неделя 2: 0-100%

## Версия

- **v9.1** - Исправление применения padding при склейке событий
- **Дата**: 2025-12-04
- **Статус**: ✅ ИСПРАВЛЕНО

## См. также

- `/EVENT_NEIGHBORS_v8.0_CLEAN_ARCHITECTURE.md` - Архитектура алгоритма склейки
- `/QUICK_TEST_NEIGHBORS_v8.0.md` - Тестовые кейсы
- `/Guidelines.md` - UI/UX правила для событий
