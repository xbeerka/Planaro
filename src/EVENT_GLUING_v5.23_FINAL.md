# Алгоритм склейки событий v5.23 - ФИНАЛЬНАЯ ВЕРСИЯ

## 🎯 История версий

### v5.23 (2025-11-17) - ФИНАЛЬНАЯ ВЕРСИЯ ✅
**Исправлен баг в ПРОХОДЕ 5: откусывание теперь только при ДВОЙНОМ gap**

#### Что изменилось
- ✅ **v5.22**: Исправлено ПРОХОД 3 - правильная неделя для `roundBottomRight`
- ✅ **v5.23**: Исправлено ПРОХОД 5 - откусывание только при `expandMultiplier >= 2`

#### Проблема в v5.6-v5.22
- ❌ ПРОХОД 5 откусывал gap при `expandRightMultiplier > 0` (ЛЮБОЕ расширение)
- ❌ Откусывал даже для обычной склейки событий разных проектов
- ❌ Визуально: нежелательные зазоры между проектами

#### Решение в v5.23
- ✅ Откусывание только при `expandRightMultiplier >= 2` (ДВОЙНОЙ gap!)
- ✅ Нормальная склейка (`expandRight = 1`) больше не откусывается
- ✅ Визуально: корректные расстояния между всеми проектами

---

## 📚 Пять проходов алгоритма

### ПРОХОД 1: Базовое расширение
**Цель:** Определить базовое расширение для событий с внутренними углами.

**Правила:**
- События с внутренними углами расширяются на `1 gap` в сторону соседа
- При **полной склейке** (одинаковая высота) расширения **НЕТ** (padding уже убран)

```typescript
const hasInnerLeft = !!innerTopLeftColor || !!innerBottomLeftColor;
const hasInnerRight = !!innerTopRightColor || !!innerBottomRightColor;

let expandLeftMultiplier = (hasInnerLeft && !hasFullLeftNeighbor) ? 1 : 0;
let expandRightMultiplier = (hasInnerRight && !hasFullRightNeighbor) ? 1 : 0;
```

---

### ПРОХОД 2: Расширение навстречу
**Цель:** Если у правого соседа есть внутренние углы слева, текущее событие расширяется вправо навстречу.

**Правила:**
- Проверяем правых соседей: есть ли у них `innerTopLeftColor` или `innerBottomLeftColor`
- Если да → `expandRightMultiplier = 1`
- Аналогично для левых соседей

**Блокировка конфликтов (v3.6):**
- ❌ НЕ расширять если в той же ячейке есть событие **другого проекта** с соседом в пересечении
- Это предотвращает конфликты наложения расширений разных проектов

```typescript
// Проверяем правых соседей
const shouldExpandRight = rightNeighbors.some(neighbor => {
  const nInfo = neighbors.get(neighbor.id);
  return nInfo && (nInfo.innerTopLeftColor || nInfo.innerBottomLeftColor);
});

// 🎯 БЛОКИРОВКА: не расширять если конфликт с другим проектом
if (shouldExpandRight && !blockExpandRight && neighborInfo.expandRightMultiplier === 0) {
  neighborInfo.expandRightMultiplier = 1;
}
```

---

### ПРОХОД 3: Поджатие событий с внешними углами (v5.22 ✅)
**Цель:** Если в ячейке есть событие с внешним углом (только снизу!) и его высота >= высоты события с внутренним углом → поджимаем.

**КРИТИЧНО:** Правильная неделя для поиска!

#### Левая сторона (`roundBottomLeft`)
**Ищем на неделе:** `event.startWeek` (стартовая неделя события)

```typescript
if (neighborInfo.roundBottomLeft) {
  // Ищем ЛЮБЫЕ события которые ПОКРЫВАЮТ стартовую неделю
  const eventsWithInnerLeft = events.filter(e => {
    if (e.id === event.id) return false;
    if (e.resourceId !== event.resourceId) return false;
    
    // ✅ Покрытие стартовой недели!
    if (!(e.startWeek <= event.startWeek && (e.startWeek + e.weeksSpan) > event.startWeek)) return false;
    
    const eInfo = neighbors.get(e.id);
    return eInfo && (eInfo.innerTopLeftColor || eInfo.innerBottomLeftColor);
  });
  
  // Сравниваем высоту
  const shouldShrink = eventsWithInnerLeft.some(e => event.unitsTall >= e.unitsTall);
  
  if (shouldShrink) {
    neighborInfo.expandLeftMultiplier = 0;
  }
}
```

#### Правая сторона (`roundBottomRight`) - v5.22 ✅
**Ищем на неделе:** `event.startWeek + event.weeksSpan - 1` (ПОСЛЕДНЯЯ неделя события!)

```typescript
if (neighborInfo.roundBottomRight) {
  // 🎯 v5.22: Ищем на ПОСЛЕДНЕЙ неделе события!
  const lastWeek = event.startWeek + event.weeksSpan - 1;
  
  // Ищем ЛЮБЫЕ события которые ПОКРЫВАЮТ последнюю неделю
  const eventsWithInnerRight = events.filter(e => {
    if (e.id === event.id) return false;
    if (e.resourceId !== event.resourceId) return false;
    
    // ✅ Покрытие ПОСЛЕДНЕЙ недели!
    if (!(e.startWeek <= lastWeek && (e.startWeek + e.weeksSpan) > lastWeek)) return false;
    
    const eInfo = neighbors.get(e.id);
    return eInfo && (eInfo.innerTopRightColor || eInfo.innerBottomRightColor);
  });
  
  // Сравниваем высоту
  const shouldShrink = eventsWithInnerRight.some(e => event.unitsTall >= e.unitsTall);
  
  if (shouldShrink) {
    neighborInfo.expandRightMultiplier = 0;
    console.log(`✂️ [v5.22 ПОДЖАТИЕ RIGHT] Event ${event.id} (week ${event.startWeek}-${lastWeek}): expandRight = 0`);
  }
}
```

---

### ПРОХОД 4: Компенсация для соседей поджатых событий
**Цель:** Если событие было поджато в ПРОХОДЕ 3 → его соседи получают +1 gap для компенсации.

**Правила:**
- Если `expandLeftMultiplier = 0` и `roundBottomLeft = true` → левый сосед получает `expandRight += 1`
- Если `expandRightMultiplier = 0` и `roundBottomRight = true` → правый сосед получает `expandLeft += 1`

```typescript
if (neighborInfo.expandRightMultiplier === 0 && neighborInfo.roundBottomRight) {
  // Ищем правых соседей
  rightNeighbors.forEach(neighbor => {
    const nInfo = neighbors.get(neighbor.id);
    if (nInfo) {
      nInfo.expandLeftMultiplier += 1;
      console.log(`💰 [v5.4 КОМПЕНСАЦИЯ] Правый сосед ${neighbor.id}: expandLeft += 1`);
    }
  });
}
```

---

### ПРОХОД 5: Откусывание расширений при "вклинивании" (v5.23 ✅)
**Цель:** Если событие БЕЗ левого соседа, но слева есть событие **другого проекта** с **ДВОЙНЫМ** расширением (`expandRight >= 2`) → уменьшаем `expandLeft`.

**КРИТИЧНО:** Откусываем только при ДВОЙНОМ gap!

#### Что такое "вклинивание"?

**Определение:**
- Событие **БЕЗ** левого соседа своего проекта (не является продолжением)
- Слева находится событие **ДРУГОГО** проекта
- У этого события **ДВОЙНОЕ расширение** (`expandRight >= 2`)
- Текущее событие "вклинилось" в двойной gap → откусываем 1 gap

**Двойное расширение означает:**
- Событие расширилось дважды (ПРОХОД 1 + ПРОХОД 2, или ПРОХОД 1 + ПРОХОД 4)
- `expandRight = 1 + 1 = 2` или больше
- Визуально: очень широкий gap между событиями разных проектов

**Что НЕ является вклиниванием:**
- Событие слева имеет `expandRight = 1` (обычное расширение из ПРОХОДА 1 или 2)
- Это **нормальная склейка** событий разных проектов
- Откусывать НЕ нужно - события корректно соприкасаются

#### Код

```typescript
// Проверяем левую сторону
const hasLeftNeighbor = events.some(e =>
  e.resourceId === event.resourceId &&
  e.projectId === event.projectId &&
  e.startWeek + e.weeksSpan === event.startWeek &&
  /* пересечение по высоте */
);

if (!hasLeftNeighbor) {
  const leftWeek = event.startWeek - 1;
  const otherProjectsLeft = events.filter(e =>
    e.resourceId === event.resourceId &&
    e.projectId !== event.projectId &&
    e.startWeek === leftWeek
  );
  
  for (const otherEvent of otherProjectsLeft) {
    const otherInfo = neighbors.get(otherEvent.id);
    
    // 🎯 v5.23: Проверяем ДВОЙНОЕ расширение (>= 2)!
    if (otherInfo && otherInfo.expandRightMultiplier >= 2) {
      neighborInfo.expandLeftMultiplier -= 1;
      console.log(`🪓 [v5.23 ОТКУСЫВАНИЕ LEFT] Event ${event.id}: expandLeft -= 1 (ДВОЙНОЙ expandRight=${otherInfo.expandRightMultiplier})`);
      break;
    }
  }
}
```

---

## 🎯 Визуальные примеры

### Пример 1: Нормальная склейка (НЕ откусываем)

```
Неделя 5     Неделя 6     Неделя 7
┌──────────┬──────────┬──────────┐
│ Proj1    │ Proj2    │          │
│ 0-50%    │ 0-50%    │          │ ← ✅ Proj2 НЕ откусывается
│ (inner   │ (expand  │          │    (expandRight=1 у Proj1)
│ Right)   │ Left=1)  │          │
│ expand=1 │          │          │
└──────────┴──────────┴──────────┘
```

**Анализ:**
- Proj1: имеет `innerBottomRight` (от соседа снизу) → `expandRight = 1` (ПРОХОД 1)
- Proj2: БЕЗ левого соседа своего проекта
- Proj2: слева Proj1 с `expandRight = 1` ← **НЕ двойной gap!**
- **v5.23:** Откусывание НЕ срабатывает (`expandRight < 2`) ✅
- Proj2: `expandLeft = 1` (расширяется навстречу Proj1)
- Визуально: события корректно соприкасаются

---

### Пример 2: Вклинивание (откусываем!)

```
Неделя 10    Неделя 11    Неделя 12
┌──────────┬──────────┬──────────┐
│ Proj1    │          │ Proj3    │
│ 0-50%    │ ДВОЙНОЙ  │ 0-50%    │ ← ✅ Proj3 откусывается
│ (inner   │   GAP    │ (expand  │    (expandRight=2 у Proj1!)
│ Right)   │          │ Left=0)  │
│ expand=2 │          │          │
└──────────┴──────────┴──────────┘
```

**Анализ:**
- Proj1: имеет `innerBottomRight` → `expandRight = 1` (ПРОХОД 1)
- Proj1: правый сосед (неделя 11) имеет `innerLeft` → `expandRight += 1` (ПРОХОД 2)
- Proj1: **ДВОЙНОЕ расширение** `expandRight = 2` ✅
- Proj3: БЕЗ левого соседа своего проекта
- Proj3: слева Proj1 с `expandRight = 2` ← **ДВОЙНОЙ gap!**
- **v5.23:** Откусывание срабатывает (`expandRight >= 2`) ✅
- Proj3: `expandLeft = 1 - 1 = 0` (откусили!)
- Визуально: двойной gap между Proj1 и Proj3

---

## 🚀 Преимущества v5.23

✅ **v5.22**: Правая сторона ищет на ПОСЛЕДНЕЙ неделе → поджатие для любой длины  
✅ **v5.23**: Откусывание только при двойном gap → нормальная склейка работает  
✅ **Универсальность**: работает для событий любой длины и высоты  
✅ **Предсказуемость**: все 5 проходов работают корректно и логично  
✅ **Визуальная точность**: правильные расстояния между всеми событиями  

---

## 📝 Диаграмма потока

```
ПРОХОД 1: Базовое расширение
  ↓
  • События с innerLeft/innerRight → expandLeft/Right = 1
  • Полная склейка → expand = 0
  ↓

ПРОХОД 2: Расширение навстречу
  ↓
  • Если правый сосед имеет innerLeft → expandRight += 1
  • Если левый сосед имеет innerRight → expandLeft += 1
  • Блокировка конфликтов с другими проектами
  ↓

ПРОХОД 3: Поджатие v5.22 ✅
  ↓
  • roundBottomLeft → ищем на неделе startWeek
  • roundBottomRight → ищем на неделе (startWeek + weeksSpan - 1) ← КРИТИЧНО!
  • Если найден сосед с внутренним углом И высота >= → expand = 0
  ↓

ПРОХОД 4: Компенсация
  ↓
  • Если событие поджато → его соседи получают +1 gap
  ↓

ПРОХОД 5: Откусывание v5.23 ✅
  ↓
  • Если "вклинились" между расширениями другого проекта
  • И expandMultiplier >= 2 (ДВОЙНОЙ gap!) ← КРИТИЧНО!
  • → expand -= 1 (может стать ОТРИЦАТЕЛЬНЫМ!)
  ↓

ФИНАЛ: expandLeftMultiplier, expandRightMultiplier
```

---

**Версия:** 5.23 (финальная) ✅  
**Дата:** 2025-11-17  
**Изменения:**  
- **v5.22**: Исправлено ПРОХОД 3 для `roundBottomRight` - теперь ищет на ПОСЛЕДНЕЙ неделе события  
- **v5.23**: Исправлено ПРОХОД 5 - откусывание только при `expandMultiplier >= 2` (двойной gap)  
**Файлы:** `/utils/eventNeighbors.ts`
