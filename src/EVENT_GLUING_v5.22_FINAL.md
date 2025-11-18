# Алгоритм склейки событий v5.22 - ФИНАЛЬНАЯ ВЕРСИЯ

## 🎯 История версий

### v5.22 (2025-11-17) - ФИНАЛЬНАЯ ВЕРСИЯ ✅
**Исправлен критический баг: ПРОХОД 3 для `roundBottomRight` теперь ищет на правильной неделе**

#### Проблема в v5.20
- ❌ ПРОХОД 3 искал соседей на неделе `event.startWeek` для ОБЕИХ сторон
- ❌ Для `roundBottomLeft` это было правильно (искать на стартовой неделе)
- ❌ Для `roundBottomRight` это было НЕПРАВИЛЬНО (нужно искать на ПОСЛЕДНЕЙ неделе!)
- ❌ Для длинных событий (Проект1 на 6-7) это работало **случайно**
- ❌ Для коротких событий (Проект2 на 7, длина 1) поджатие НЕ срабатывало

#### Решение в v5.22
- ✅ **`roundBottomRight`** ищет на **ПОСЛЕДНЕЙ** неделе события (`startWeek + weeksSpan - 1`)
- ✅ **`roundBottomLeft`** ищет на **СТАРТОВОЙ** неделе события (`startWeek`)
- ✅ Логика: внешний угол справа смотрит на ПОСЛЕДНЮЮ неделю, внешний угол слева — на ПЕРВУЮ
- ✅ Работает для событий **любой длины** (1 неделя или 10 недель)

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

### ПРОХОД 5: Откусывание расширений при "вклинивании"
**Цель:** Если событие БЕЗ левого соседа, но слева есть событие **другого проекта** с `expandRight > 0` → уменьшаем `expandLeft` (может стать **ОТРИЦАТЕЛЬНЫМ**!).

**Правила:**
- Проверяем: есть ли левый сосед **того же проекта**?
- Если НЕТ → ищем события **других проектов** слева с расширением
- Если найдено → `expandLeftMultiplier -= 1`

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
    if (otherInfo && otherInfo.expandRightMultiplier > 0) {
      neighborInfo.expandLeftMultiplier -= 1;
      console.log(`🪓 [v5.6 ОТКУСЫВАНИЕ LEFT] Event ${event.id}: expandLeft -= 1 → ${neighborInfo.expandLeftMultiplier}`);
      break;
    }
  }
}
```

---

## 🎯 Пример работы v5.22

### Сценарий: Короткий Проект2(7) длиной 1 неделя

```
Неделя 6    Неделя 7    Неделя 8
┌─────────┬─────────┬─────────┐
│ Proj1   │ Proj1   │ Proj2   │ 25-100% (unitsTall=0.75)
│ 0-75%   │ (6-7)   │         │
│         │ Proj2   ├─────────┤
│         │ 75-100% │ Proj1   │ 0-25% (unitsTall=0.25)
└─────────┴─────────┴─────────┘
```

#### До v5.22 (НЕ работало) ❌

**Проект1(6-7):**
- `startWeek = 6`, `weeksSpan = 2`
- ПРОХОД 3: `roundBottomRight = true` → искал на неделе **6** (startWeek)
- Проект2(7) находится на неделе **7** → **НЕ НАЙДЕН** ❌
- Поджатие НЕ срабатывало → `expandRight = 1` (расширяется вправо) ❌

**Проект1(8):**
- Левый сосед Проект1(6-7) расширяется вправо (`expandRight = 1`)
- ПРОХОД 2: Проект1(8) **НЕ расширяется влево** ❌
- Визуально: **зазор между событиями** ❌

---

#### После v5.22 (РАБОТАЕТ!) ✅

**Проект1(6-7):**
- `startWeek = 6`, `weeksSpan = 2`
- `lastWeek = 6 + 2 - 1 = 7` ✅
- ПРОХОД 3: `roundBottomRight = true` → ищет на неделе **7** (lastWeek)
- Проект2(7) находится на неделе **7** → **НАЙДЕН!** ✅
- Проект2(7) имеет `innerBottomRight` (от Проект1(6-7)) ✅
- Сравнение высоты: `unitsTall(Proj1) = 0.75 >= unitsTall(Proj2) = 0.25` ✅
- **Поджатие срабатывает!** `expandRight = 0` ✅

**Проект1(8):**
- ПРОХОД 4: Левый сосед Проект1(6-7) поджат (`expandRight = 0`)
- **Компенсация:** Проект1(8).`expandLeft += 1` ✅
- **Проект1(8) расширяется влево!** ✅
- Визуально: **события склеены без зазоров** ✅

---

## 🚀 Преимущества v5.22

✅ **Универсальность** - работает для событий ЛЮБОЙ длины (1 неделя или 10 недель)  
✅ **Логичность** - правая сторона ищет на ПОСЛЕДНЕЙ неделе (куда смотрит угол)  
✅ **Симметричность** - левая сторона ищет на ПЕРВОЙ неделе (куда смотрит угол)  
✅ **Предсказуемость** - поджатие всегда срабатывает корректно  
✅ **Компенсация** - ПРОХОД 4 гарантирует расширение соседей  

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

ПРОХОД 5: Откусывание
  ↓
  • Если "вклинились" между расширениями другого проекта → expand -= 1
  • Может стать ОТРИЦАТЕЛЬНЫМ!
  ↓

ФИНАЛ: expandLeftMultiplier, expandRightMultiplier
```

---

**Версия:** 5.22 (финальная) ✅  
**Дата:** 2025-11-17  
**Изменения:** Исправлено ПРОХОД 3 для `roundBottomRight` - теперь ищет на ПОСЛЕДНЕЙ неделе события  
**Файлы:** `/utils/eventNeighbors.ts`
