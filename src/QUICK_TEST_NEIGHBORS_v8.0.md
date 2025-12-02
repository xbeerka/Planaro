# Quick Test Guide - Event Neighbors v8.0

## 🎯 Основные кейсы для тестирования

### 1️⃣ Базовая горизонтальная склейка
```
Проект A: [Event1]━━[Event2]━━[Event3]
```

**Ожидание:**
- Все события: `expandLeft=1`, `expandRight=1`
- Средние события: скругления убраны (углы прямые)
- Первое: `roundTL=true, roundBL=true`
- Последнее: `roundTR=true, roundBR=true`

**Проверка консоли:**
```
📐 STAGE 1: Collecting Geometry...
✅ STAGE 1 Complete: 3 events analyzed
⚙️ STAGE 3: Applying Expansion Rules...
✅ STAGE 3 Complete: 3 expansion decisions made
```

---

### 2️⃣ Форма Б над А (Rule 2A)
```
Проект A:          [NeighborL]
                   ━━━━━━━━
Проект B (Б):         [EventB] ← Внутренние углы снизу
                   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Проект C (А):         [EventA] ← Внешние углы сверху
```

**Ожидание:**
- `EventB.expandLeft = 1` (расширяется)
- `NeighborL.expandRight = 0` (сбрасывается)
- `EventA.expandLeft = 0` или `1` (базовое правило)

**Проверка консоли:**
```
📐 RULE: Б {EventB.id} over А {EventA.id} (left)
```

**Как проверить:**
1. Создайте EventB с соседом слева (NeighborL)
2. NeighborL должен выступать ниже EventB (innerBottomProjectId)
3. EventA должен иметь соседа выровненного по верху (alignedTop)
4. EventB должен касаться EventA снизу

---

### 3️⃣ Форма В над Г (Rule 2B)
```
Проект A:          [NeighborL]
                   ━━━━━━━━
Проект B (В):         [EventV] ← Внешние углы снизу
                   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Проект C (Г):         [EventG] ← Внутренние углы сверху
```

**Ожидание:**
- `EventV.expandLeft = 0` (сбрасывается)
- `NeighborL.expandRight = 2` (базовое 1 + boost 1)

**Проверка консоли:**
```
📐 RULE: В {EventV.id} over Г {EventG.id} (left)
```

**Как проверить:**
1. EventV должен иметь соседа слева (NeighborL)
2. NeighborL должен быть выровнен по низу EventV (alignedBottom)
3. EventG должен иметь соседа выступающего выше (innerTopProjectId)
4. EventV должен касаться EventG сверху

---

### 4️⃣ Откусывание (Biting - Rule 3)
```
Проект A:   [OtherProj1] [EventMiddle] [OtherProj2]
```

**Условие:**
- `EventMiddle` не имеет соседей своего проекта
- `OtherProj1.expandRight >= 1`
- `OtherProj2.expandLeft >= 1`
- `totalPressure >= 2`

**Ожидание:**
- `EventMiddle.expandLeft = -1`
- `EventMiddle.expandRight = -1`

**Проверка консоли:**
```
🔪 BITING: {EventMiddle.id} left (pressure=2)
🔪 BITING: {EventMiddle.id} right (pressure=2)
```

---

### 5️⃣ Скрытие названий (Name Hiding)
```
Проект A: [LongEvent (5 weeks)]━━[ShortEvent (1 week)]
```

**Ожидание:**
- `LongEvent.flags` НЕ содержит `MASK_HIDE_NAME` (название видимо)
- `ShortEvent.flags` содержит `MASK_HIDE_NAME` (название скрыто)

**Проверка:**
```typescript
const shortInfo = result.get(shortEvent.id);
const hasHideFlag = !!(shortInfo.flags & MASK_HIDE_NAME);
console.log("Short event name hidden:", hasHideFlag); // true
```

---

## 🔍 Отладка по этапам

### Включить DEBUG логи
```typescript
// В /utils/eventNeighbors.ts
const DEBUG = true; // Строка 6
```

### Проверка STAGE 1 (Geometry)
**Что смотреть:**
- Количество соседей (left.neighbors, right.neighbors)
- Покрытие (hasFull, hasPartial, hasBoth)
- Внутренние углы (innerTopProjectId, innerBottomProjectId)

**Пример лога:**
```
📐 STAGE 1: Collecting Geometry...
✅ STAGE 1 Complete: 10 events analyzed
```

### Проверка STAGE 2 (Topology)
**Что смотреть:**
- Горизонтальная склейка (hasHorizontalGlue)
- Вертикальные стеки (stacksAbove, stacksBelow)
- Формы (hasInnerCorners, hasOuterCorners)

**Пример лога:**
```
🔍 STAGE 2: Classifying Topology...
✅ STAGE 2 Complete: 10 events classified
```

### Проверка STAGE 3 (Rules)
**Что смотреть:**
- Применение правил (RULE 1, 2A, 2B, 3)
- Значения expandLeft/expandRight
- Причины (reason)

**Пример лога:**
```
⚙️ STAGE 3: Applying Expansion Rules...
📐 RULE: Б e123 over А e456 (left)
🔪 BITING: e789 left (pressure=2)
✅ STAGE 3 Complete: 10 expansion decisions made
```

---

## 🛠️ Инструменты для проверки

### 1. Console.log в браузере
```typescript
const result = calculateEventNeighbors(events, projects);
console.log("Results:", Array.from(result.entries()));
```

### 2. Проверка флагов
```typescript
const info = result.get(event.id);

// Corner rounding
const roundTL = !!(info.flags & MASK_ROUND_TL);
const roundTR = !!(info.flags & MASK_ROUND_TR);
const roundBL = !!(info.flags & MASK_ROUND_BL);
const roundBR = !!(info.flags & MASK_ROUND_BR);

// Coverage
const fullLeft = !!(info.flags & MASK_FULL_LEFT);
const partialLeft = !!(info.flags & MASK_PARTIAL_LEFT);
const bothLeft = !!(info.flags & MASK_BOTH_LEFT);

// Name hiding
const hideName = !!(info.flags & MASK_HIDE_NAME);

console.log({
  roundTL, roundTR, roundBL, roundBR,
  fullLeft, partialLeft, bothLeft,
  hideName,
  expandLeft: info.expandLeftMultiplier,
  expandRight: info.expandRightMultiplier,
});
```

### 3. Визуальная проверка в UI
- Проверьте что расширения применяются корректно (gaps между событиями)
- Проверьте что углы скругляются правильно
- Проверьте что названия скрываются для коротких событий

---

## ⚠️ Частые проблемы

### Проблема 1: Правило не срабатывает
**Причина:** Геометрия не соответствует условию
**Решение:** 
1. Проверьте STAGE 1 логи - есть ли соседи?
2. Проверьте STAGE 2 логи - правильно ли классифицирован стек?
3. Проверьте условие правила в коде

### Проблема 2: Неправильное расширение
**Причина:** Несколько правил применяются одновременно
**Решение:**
1. Проверьте reason в ExpansionDecision
2. Проверьте порядок правил в STAGE 3
3. Используйте `Math.max()` для накопления расширения

### Проблема 3: Углы не скругляются
**Причина:** Флаги установлены в STAGE 4, но геометрия не соответствует
**Решение:**
1. Проверьте innerProjectId в STAGE 1
2. Проверьте alignedTop/alignedBottom
3. Проверьте hasFull

---

## 📊 Контрольный чек-лист

### Перед тестированием
- [ ] `DEBUG = true` в eventNeighbors.ts
- [ ] Консоль браузера открыта
- [ ] Тестовые события созданы

### После тестирования
- [ ] Все правила сработали (логи в консоли)
- [ ] Визуально корректные расширения
- [ ] Углы скруглены правильно
- [ ] Названия скрыты корректно

### Если есть баг
- [ ] Записан сценарий воспроизведения
- [ ] Скопированы логи из консоли
- [ ] Проверена геометрия в STAGE 1
- [ ] Проверена топология в STAGE 2
- [ ] Определено какое правило должно сработать

---

## 🚀 Быстрый старт

1. **Откройте приложение** в браузере
2. **Откройте консоль** (F12)
3. **Создайте тестовые события** для нужного кейса
4. **Проверьте логи** в консоли
5. **Проверьте визуальный результат** на календаре

**Готово!** Если что-то не так - смотрите раздел "Отладка по этапам".

---

**Версия**: 8.0  
**Дата**: 2025-11-29  
**Совместимость**: Event Neighbors v8.0
