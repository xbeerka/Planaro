# Test Cases - Event Neighbors v8.0

## 🧪 Набор тестовых кейсов для проверки алгоритма

### ✅ Тест 1: Простая горизонтальная склейка

**Конфигурация:**
```
Сотрудник: Employee1
Проект A: 
  - Event1: week 1-2, units 0-5
  - Event2: week 3-4, units 0-5
  - Event3: week 5-6, units 0-5
```

**Ожидаемый результат:**
```javascript
// Event1
{
  expandLeft: 0,  // Нет соседа слева
  expandRight: 1, // Есть Event2 справа
  roundTL: true,  // Внешний угол
  roundBL: true,  // Внешний угол
  roundTR: false, // Склейка с Event2
  roundBR: false, // Склейка с Event2
}

// Event2
{
  expandLeft: 1,  // Есть Event1 слева
  expandRight: 1, // Есть Event3 справа
  roundTL: false, // Склейка с Event1
  roundBL: false, // Склейка с Event1
  roundTR: false, // Склейка с Event3
  roundBR: false, // Склейка с Event3
}

// Event3
{
  expandLeft: 1,  // Есть Event2 слева
  expandRight: 0, // Нет соседа справа
  roundTL: false, // Склейка с Event2
  roundBL: false, // Склейка с Event2
  roundTR: true,  // Внешний угол
  roundBR: true,  // Внешний угол
}
```

**Визуально:**
```
[Event1]━━━━[Event2]━━━━[Event3]
```

**Правило:** RULE 1 (Base horizontal glue expansion)

---

### ✅ Тест 2: Форма Б над А (Rule 2A)

**Конфигурация:**
```
Сотрудник: Employee1

Проект A:
  - NeighborL: week 1-2, units 0-5

Проект B (форма Б):
  - EventB: week 3-4, units 2-4

Проект C (форма А):
  - EventA: week 5-6, units 5-7
```

**Расположение:**
```
units
  0  [NeighborL]
  1  [NeighborL]
  2  [NeighborL]      [EventB] ← Внутренние углы снизу (форма Б)
  3  [NeighborL]      [EventB]
  4  [NeighborL]      [EventB]
  5  [NeighborL]                [EventA] ← Внешние углы сверху (форма А)
  6                             [EventA]
  7                             [EventA]
     week 1-2         week 3-4  week 5-6
```

**Условия для Rule 2A:**
- EventB касается EventA снизу: `bottom(EventB) + 1 == top(EventA)` → `4 + 1 == 5` ✅
- EventB имеет соседа слева (NeighborL): ✅
- NeighborL выступает ниже EventB: `bottom(NeighborL) > bottom(EventB)` → `5 > 4` ✅
- EventA имеет соседа выровненного по верху: ❌ (НЕТ соседа у EventA на week 5-6)

**Внимание:** Для срабатывания Rule 2A нужно добавить соседа к EventA!

**Исправленная конфигурация:**
```
Проект D:
  - EventD: week 5-6, units 5-7 (тот же проект что EventA или aligned)
```

**Ожидаемый результат:**
```javascript
// EventB (форма Б)
{
  expandLeft: 1,     // RULE 2A: Расширяется
  expandRight: 0,    // Нет соседа справа
  reason: "stack-rule-B-over-A-left"
}

// NeighborL (сосед EventB слева)
{
  expandLeft: 0,     // Нет соседа слева
  expandRight: 0,    // RULE 2A: Сброшено (было 1)
  reason: "stack-rule-B-neighbor-reset"
}

// EventA (форма А)
{
  expandLeft: 0 или 1, // Зависит от базового правила
  expandRight: 0,      // Нет соседа справа
}
```

**Визуально:**
```
[NeighborL] (default width)
━━━━━━━━
   [EventB] ← (+1 gap left)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   [EventA]
```

**Правило:** RULE 2A (Б over А)

---

### ✅ Тест 3: Форма В над Г (Rule 2B)

**Конфигурация:**
```
Сотрудник: Employee1

Проект A:
  - NeighborL: week 1-2, units 2-7

Проект B (форма В):
  - EventV: week 3-4, units 2-4

Проект C (форма Г):
  - EventG: week 5-6, units 5-7
```

**Расположение:**
```
units
  0  
  1  
  2  [NeighborL]      [EventV] ← Внешние углы снизу (форма В)
  3  [NeighborL]      [EventV]
  4  [NeighborL]      [EventV]
  5  [NeighborL]                [EventG] ← Внутренние углы сверху (форма Г)
  6  [NeighborL]                [EventG]
  7  [NeighborL]                [EventG]
     week 1-2         week 3-4  week 5-6
```

**Условия для Rule 2B:**
- EventV касается EventG сверху: `bottom(EventV) + 1 == top(EventG)` → `4 + 1 == 5` ✅
- EventV имеет соседа слева (NeighborL): ✅
- NeighborL выровнен по низу EventV: `bottom(NeighborL) == bottom(EventV)` → Нет, `7 != 4` ❌

**Исправленная конфигурация:**
Нужно чтобы NeighborL был выровнен по низу EventV:
```
Проект A:
  - NeighborL: week 1-2, units 2-4 (aligned bottom с EventV)
```

**Или добавить еще один событие:**
```
Проект A:
  - NeighborL1: week 1-2, units 0-1
  - NeighborL2: week 1-2, units 2-4 (aligned bottom)
  - NeighborL3: week 1-2, units 5-7
```

**Ожидаемый результат:**
```javascript
// EventV (форма В)
{
  expandLeft: 0,     // RULE 2B: Сброшено
  expandRight: 0,    // Нет соседа справа
  reason: "stack-rule-V-over-G-left"
}

// NeighborL2 (сосед EventV слева, aligned bottom)
{
  expandLeft: 0,     // Нет соседа слева
  expandRight: 2,    // RULE 2B: Boost (+1) + базовое (+1) = 2
  reason: "stack-rule-V-neighbor-boost"
}

// EventG (форма Г)
{
  expandLeft: 0,     // Нет соседа слева (или базовое)
  expandRight: 0,    // Нет соседа справа
}
```

**Визуально:**
```
[NeighborL2] ← (+2 gaps right)
━━━━━━━━
   [EventV] ← (default width)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   [EventG]
```

**Правило:** RULE 2B (В over Г)

---

### ✅ Тест 4: Откусывание (Biting - Rule 3)

**Конфигурация:**
```
Сотрудник: Employee1

Проект A:
  - OtherProj1: week 1-2, units 0-5

Проект B:
  - EventMiddle: week 3-4, units 0-5

Проект C:
  - OtherProj2: week 5-6, units 0-5
```

**Расположение:**
```
[OtherProj1] [EventMiddle] [OtherProj2]
```

**Условия для Rule 3:**
- EventMiddle НЕ имеет соседей своего проекта (Проект B): ✅
- OtherProj1 справа от EventMiddle (другой проект): ✅
- OtherProj2 слева от EventMiddle (другой проект): ✅
- OtherProj1.expandRight >= 1: Нужно установить (базовое правило НЕ даст, т.к. разные проекты)
- OtherProj2.expandLeft >= 1: Нужно установить

**Проблема:** Базовое правило (RULE 1) работает только для СВОЕГО проекта!

**Решение:** Добавить соседей для OtherProj1 и OtherProj2:
```
Проект A:
  - EventA0: week 0-1, units 0-5
  - OtherProj1: week 1-2, units 0-5

Проект B:
  - EventMiddle: week 3-4, units 0-5

Проект C:
  - OtherProj2: week 5-6, units 0-5
  - EventC1: week 7-8, units 0-5
```

**Теперь:**
- OtherProj1.expandRight = 1 (базовое, EventMiddle - другой проект, но есть EventA0 слева)
- OtherProj2.expandLeft = 1 (базовое, EventMiddle - другой проект, но есть EventC1 справа)

**Внимание:** Базовое правило даёт expandRight/Left только при hasInnerConnection (сосед СВОЕГО проекта).

**Итоговая конфигурация:**
```
Проект A:
  - EventA0: week 0-1, units 0-5
  - OtherProj1: week 2-3, units 0-5

Проект B:
  - EventMiddle: week 4-5, units 0-5

Проект C:
  - OtherProj2: week 6-7, units 0-5
  - EventC1: week 8-9, units 0-5
```

**Ожидаемый результат:**
```javascript
// OtherProj1
{
  expandLeft: 1,   // Есть EventA0 (свой проект)
  expandRight: 1,  // Базовое расширение к EventA0 справа (но EventMiddle - другой проект)
}

// EventMiddle
{
  expandLeft: -1,  // RULE 3: Откусывание (totalPressure >= 2)
  expandRight: -1, // RULE 3: Откусывание
  reason: "biting-left" / "biting-right"
}

// OtherProj2
{
  expandLeft: 1,   // Базовое расширение
  expandRight: 1,  // Есть EventC1 (свой проект)
}
```

**Визуально:**
```
[EventA0]━[OtherProj1] [EventMiddle] [OtherProj2]━[EventC1]
                       ↑ squeezed   ↑
```

**Правило:** RULE 3 (Biting)

**Важно:** Для срабатывания Biting нужно чтобы соседи имели expandRight/Left >= 1 от базового правила!

---

### ✅ Тест 5: Скрытие названий (Name Hiding)

**Конфигурация:**
```
Сотрудник: Employee1

Проект A:
  - LongEvent: week 1-6, units 0-5 (5 недель)
  - ShortEvent: week 7-8, units 0-5 (2 недели)
```

**Расположение:**
```
[LongEvent]━━━━━━━━━━━━[ShortEvent]
```

**Условия для Name Hiding:**
- ShortEvent.weeksSpan <= 2: ✅ (2 недели)
- ShortEvent имеет соседа слева (LongEvent): ✅
- LongEvent видимый (НЕ скрыт): ✅ (длинное событие всегда видимо)

**Ожидаемый результат:**
```javascript
// LongEvent
{
  flags: НЕ содержит MASK_HIDE_NAME, // Название видимо
}

// ShortEvent
{
  flags: содержит MASK_HIDE_NAME, // Название скрыто
}
```

**Проверка:**
```javascript
const longInfo = result.get(longEvent.id);
const shortInfo = result.get(shortEvent.id);

console.log("Long event name visible:", !(longInfo.flags & MASK_HIDE_NAME)); // true
console.log("Short event name hidden:", !!(shortInfo.flags & MASK_HIDE_NAME)); // true
```

**Правило:** STAGE 5 (Name Hiding)

---

## 🔧 Инструкция по запуску тестов

### 1. Подготовка тестовых данных

Создайте события в браузере или используйте mock данные:

```typescript
const testEvents: SchedulerEvent[] = [
  // Test 1: Horizontal glue
  {
    id: "e1",
    resourceId: "emp1",
    projectId: "projA",
    startWeek: 1,
    weeksSpan: 2,
    unitStart: 0,
    unitsTall: 6,
  },
  {
    id: "e2",
    resourceId: "emp1",
    projectId: "projA",
    startWeek: 3,
    weeksSpan: 2,
    unitStart: 0,
    unitsTall: 6,
  },
  // ... add more
];
```

### 2. Запуск алгоритма

```typescript
import { calculateEventNeighbors } from './utils/eventNeighbors';

const result = calculateEventNeighbors(testEvents, projects);
console.log("Results:", result);
```

### 3. Проверка результатов

```typescript
const event1Info = result.get("e1");
console.log({
  expandLeft: event1Info.expandLeftMultiplier,
  expandRight: event1Info.expandRightMultiplier,
  roundTL: !!(event1Info.flags & MASK_ROUND_TL),
  roundTR: !!(event1Info.flags & MASK_ROUND_TR),
  roundBL: !!(event1Info.flags & MASK_ROUND_BL),
  roundBR: !!(event1Info.flags & MASK_ROUND_BR),
});
```

### 4. Визуальная проверка

Откройте приложение в браузере и проверьте:
- [ ] Расширения (gaps) применяются корректно
- [ ] Углы скругляются правильно
- [ ] Названия скрываются для коротких событий
- [ ] Формы А/Б/В/Г отображаются корректно

---

## 📊 Контрольный чек-лист

### Перед началом
- [ ] `DEBUG = true` в `/utils/eventNeighbors.ts`
- [ ] Консоль браузера открыта
- [ ] Тестовые данные подготовлены

### Тест 1: Horizontal glue
- [ ] Event1.expandRight = 1
- [ ] Event2.expandLeft = 1, expandRight = 1
- [ ] Event3.expandLeft = 1
- [ ] Углы скруглены корректно

### Тест 2: Б над А
- [ ] EventB.expandLeft = 1
- [ ] NeighborL.expandRight = 0
- [ ] Лог: `📐 RULE: Б ... over А ...`

### Тест 3: В над Г
- [ ] EventV.expandLeft = 0
- [ ] NeighborL.expandRight = 2
- [ ] Лог: `📐 RULE: В ... over Г ...`

### Тест 4: Biting
- [ ] EventMiddle.expandLeft = -1
- [ ] EventMiddle.expandRight = -1
- [ ] Лог: `🔪 BITING: ... (pressure=2)`

### Тест 5: Name Hiding
- [ ] LongEvent - название видимо
- [ ] ShortEvent - название скрыто

---

## 🐛 Отладка

### Если тест не прошел

1. **Проверьте STAGE 1 (Geometry)**
   - Есть ли соседи? (left.neighbors, right.neighbors)
   - Правильное покрытие? (hasFull, hasPartial)
   - Внутренние углы определены? (innerProjectId)

2. **Проверьте STAGE 2 (Topology)**
   - Правильная классификация стека? (topHasInnerBottom, bottomHasOuterTop)
   - Горизонтальная склейка определена? (hasHorizontalGlue)

3. **Проверьте STAGE 3 (Rules)**
   - Какое правило должно сработать?
   - Логи содержат правильное сообщение? (`📐 RULE:`, `🔪 BITING:`)
   - Проверьте условия правила в коде

4. **Проверьте STAGE 4 (Corner Flags)**
   - Флаги установлены корректно?
   - Условия скругления соблюдены?

5. **Проверьте STAGE 5 (Name Hiding)**
   - Сортировка по времени работает?
   - Цепочка скрытия корректна?

---

**Версия**: 8.0  
**Дата**: 2025-11-29  
**Совместимость**: Event Neighbors v8.0
