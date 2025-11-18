# Алгоритм склейки событий v3.1 - ФИНАЛЬНАЯ ВЕРСИЯ

## 🎯 Три типа склейки

### 1️⃣ **ПОЛНАЯ СКЛЕЙКА** (новое в v3.1!)
**Условия:**
- События одного проекта
- Смежные недели (соседние по горизонтали)
- **Одинаковая высота** (`unitsTall`)
- **Одинаковая позиция** (`unitStart`)

**Эффект:**
```
┌────────┬────────┐
│ Event1 │ Event2 │  ← Одинаковая высота и позиция
└────────┴────────┘
```

**Применяется:**
- ✅ Расширение на `gap × 1` в сторону соседа
- ✅ Убирание боковых скруглений (`roundTopLeft/Right = false`)
- ⚠️ Padding **ОСТАЮТСЯ** (простое соединение без убирания отступов)
- ❌ Внутренние углы НЕ создаются (нет ::before/::after)

**Код:**
```typescript
// eventNeighbors.ts
if (hasFullLeftNeighbor) {
  expandLeftMultiplier = 1; // gap × 1
}

// SchedulerMain.tsx - padding убираются ТОЛЬКО для "зажатых" событий
const hasAnyLeftNeighbor = neighborInfo?.hasBothLeftNeighbors;
let paddingLeft = hasAnyLeftNeighbor ? 0 : config.cellPaddingLeft;

// SchedulerEvent.tsx
const tl = roundTopLeft ? baseBorderRadius : 0;
const bl = roundBottomLeft ? baseBorderRadius : 0;
baseStyle.borderRadius = `${tl}px ${tr}px ${br}px ${bl}px`;
```

---

### 2️⃣ **ЧАСТИЧНАЯ СКЛЕЙКА** (1 внутренний угол)
**Условия:**
- События одного проекта
- Смежные недели
- **Разная высота** - сосед выходит за границы СВЕРХУ или СНИЗУ (но не с обеих сторон)

**Эффект:**
```
┌────────┬──────┐
│ Event1 │Event2│  ← Сосед выше, внутренний угол сверху
│        └──────┘
└────────┘
```

**Применяется:**
- ✅ Расширение на `gap × 1`
- ✅ Внутренний угол (::before/::after с цветом соседа)
- ✅ Убирание скругления в углу с внутренним углом
- ⚠️ Padding НЕ убираются (между событиями остаётся gap)

**Код:**
```typescript
// Внутренний угол сверху слева
if (nTop < eventTop) {
  hasInnerTopLeft = true;
  innerTopLeftColor = neighborProject?.backgroundColor;
}

// Скругление убирается
eventInfo.roundTopLeft = !(hasInnerTopLeft || ...);

// CSS ::before/::after создаёт визуальное скругление
.scheduler-event.inner-tl::before {
  background: var(--inner-tl-color);
  border-radius: var(--inner-radius-size);
}
```

---

### 3️⃣ **"ЗАЖАТОЕ" СОБЫТИЕ** (2 внутренних угла)
**Условия:**
- События одного проекта
- Смежные недели
- **2 соседа покрывают сверху И снизу** (текущее событие "зажато" между ними)

**Эффект:**
```
┌────────┬──────┐
│        │Event2│  ← Верхний сосед
│ Event1 ├──────┤  ← "Зажатое" событие
│        │Event3│  ← Нижний сосед
└────────┴──────┘
```

**Применяется:**
- ✅ Расширение на `gap × 1` (для каждого внутреннего угла, но не суммируется)
- ✅ Убирание боковых padding
- ✅ 2 внутренних угла (сверху и снизу)
- ✅ Убирание обоих боковых скруглений

**Код:**
```typescript
const hasBothLeftNeighbors = 
  hasTopLeftCovered && hasBottomLeftCovered && !hasFullLeftNeighbor && leftNeighbors.length >= 2;

// Убираем padding ТОЛЬКО для "зажатых"
const hasAnyLeftNeighbor = neighborInfo?.hasBothLeftNeighbors;
let paddingLeft = hasAnyLeftNeighbor ? 0 : config.cellPaddingLeft;
```

---

## 🔧 Упрощённая структура данных (v3.1)

### EventNeighborsInfo
```typescript
export interface EventNeighborsInfo {
  // Типы соседей
  hasFullLeftNeighbor: boolean;      // Полная склейка (одинаковая высота)
  hasPartialLeftNeighbor: boolean;   // Частичное покрытие (1 угол)
  hasBothLeftNeighbors: boolean;     // "Зажатое" событие (2 угла)
  
  hasFullRightNeighbor: boolean;
  hasPartialRightNeighbor: boolean;
  hasBothRightNeighbors: boolean;
  
  // Расширение событий
  expandLeftMultiplier: number;      // 0 или 1
  expandRightMultiplier: number;     // 0 или 1
  
  // 🆕 УПРОЩЁННАЯ ЛОГИКА: Позитивные флаги (какие углы скруглены)
  roundTopLeft: boolean;             // true = скруглён, false = НЕ скруглён
  roundTopRight: boolean;
  roundBottomLeft: boolean;
  roundBottomRight: boolean;
  
  // Цвета соседей для ::before/::after CSS
  innerTopLeftColor?: string;
  innerBottomLeftColor?: string;
  innerTopRightColor?: string;
  innerBottomRightColor?: string;
}
```

**Что убрали:**
- ❌ `hasInnerTopLeft/Right/Bottom*` - НЕ сохраняем в объект, вычисляем из `innerTopLeftColor`
- ❌ `removeTopLeftRadius` и т.д. - заменили на позитивную логику `roundTopLeft`

---

## 📐 Логика вычисления round* флагов

**Угол НЕ скруглён (`round* = false`) если:**
1. Есть сосед с полным покрытием (`hasFullLeftNeighbor`)
2. **ИЛИ** есть внутренний угол (вычисляется из `innerTopLeftColor !== 'transparent'`)
3. **ИЛИ** границы выровнены с соседом (`alignedTopLeft`)

**Код:**
```typescript
// Вычисляем hasInner* локально из цветов
const hasInnerTopLeft = eventInfo.innerTopLeftColor !== undefined && 
                       eventInfo.innerTopLeftColor !== 'transparent';

// Проверяем выравнивание границ
leftNeighbors.forEach(neighbor => {
  if (neighbor.unitStart === eventTop) alignedTopLeft = true;
});

// Финальное вычисление
eventInfo.roundTopLeft = !(eventInfo.hasFullLeftNeighbor || hasInnerTopLeft || alignedTopLeft);
```

---

## 🎨 Применение в UI

### 1. Расширение событий (SchedulerMain.tsx)
```typescript
if (neighborInfo?.expandLeftMultiplier) {
  const expandAmount = config.gap * neighborInfo.expandLeftMultiplier;
  left -= expandAmount;
  width += expandAmount;
}
```

### 2. Убирание padding
```typescript
const hasAnyLeftNeighbor = neighborInfo?.hasBothLeftNeighbors;
let paddingLeft = hasAnyLeftNeighbor ? 0 : config.cellPaddingLeft;
```

### 3. Скругления углов (SchedulerEvent.tsx)
```typescript
const tl = roundTopLeft ? baseBorderRadius : 0;
const tr = roundTopRight ? baseBorderRadius : 0;
const br = roundBottomRight ? baseBorderRadius : 0;
const bl = roundBottomLeft ? baseBorderRadius : 0;
baseStyle.borderRadius = `${tl}px ${tr}px ${br}px ${bl}px`;
```

### 4. Внутренние скругления (CSS ::before/::after)
```typescript
// Вычисляем hasInner* из цветов для CSS классов
const hasInnerTopLeft = innerTopLeftColor !== 'transparent';

// CSS переменные
(baseStyle as any)['--inner-tl-color'] = innerTopLeftColor;
(baseStyle as any)['--inner-radius-size'] = `${baseBorderRadius + config.gap}px`;
```

```css
.scheduler-event.inner-tl::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: var(--inner-radius-size);
  height: var(--inner-radius-size);
  background: var(--inner-tl-color);
  border-radius: 0 0 var(--inner-radius-size) 0;
  z-index: -1;
}
```

---

## 🚀 Преимущества v3.1

✅ **Упрощённая логика** - только `round*` флаги, никаких `hasInner*` и `removeTop*`  
✅ **Позитивная логика** - `roundTopLeft = true` означает "скруглён" (интуитивно)  
✅ **Меньше кода** - `hasInner*` вычисляются локально из `innerTopLeftColor`  
✅ **Полная склейка работает** - расширение на gap для одинаковой высоты (padding остаются)  
✅ **Единый источник истины** - цвета (`innerTopLeftColor`) определяют наличие внутренних углов  
✅ **Pixel-perfect** - все углы вычисляются корректно  

---

## 📝 Примеры

### Пример 1: Полная склейка
```
Событие A: week 1-2, units 0-1 (height = 2)
Событие B: week 2-3, units 0-1 (height = 2)

Результат:
- hasFullLeftNeighbor(B) = true
- expandLeftMultiplier(B) = 1
- paddingLeft(B) = 4px (НЕ убирается, простое соединение!)
- roundTopLeft(B) = false
- roundBottomLeft(B) = false
- Нет внутренних углов
```

### Пример 2: Частичная склейка
```
Событие A: week 1-2, units 0-2 (height = 3)
Событие B: week 2-3, units 1-2 (height = 2)

Результат:
- hasPartialLeftNeighbor(B) = true
- hasInnerTopLeft (локально) = true
- innerTopLeftColor(B) = backgroundColor(A)
- expandLeftMultiplier(B) = 1
- paddingLeft(B) = 4px (НЕ убирается!)
- roundTopLeft(B) = false (внутренний угол)
- roundBottomLeft(B) = true (нет выравнивания)
```

### Пример 3: "Зажатое" событие
```
Событие A: week 1-2, units 0-3 (height = 4)
Событие B: week 2-3, units 1-2 (height = 2)
Событие C: week 1-2, units 2-3 (height = 2)

Результат для B:
- hasBothLeftNeighbors(B) = true
- expandLeftMultiplier(B) = 1
- paddingLeft(B) = 0
- roundTopLeft(B) = false
- roundBottomLeft(B) = false
- Оба внутренних угла (сверху и снизу)
```

---

**Версия**: 3.1 (финальная)  
**Дата**: 2025-11-16  
**Изменения**: Добавлена поддержка полной склейки (одинаковая высота и позиция)