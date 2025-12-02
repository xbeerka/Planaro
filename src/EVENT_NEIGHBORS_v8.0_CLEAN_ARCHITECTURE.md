# Event Neighbors v8.0 - Clean Architecture

## 🎯 Проблема старого кода

Версии 1.0-7.0 имели фундаментальные проблемы:

1. **Смешанная ответственность**: `expandLeftMultiplier`/`expandRightMultiplier` использовались одновременно для:
   - Базового расширения (склейка)
   - Применения правил стекинга (А/Б/В/Г)
   - Откусывания (biting)

2. **Неявные зависимости**: Результат зависел от порядка проходов (passes), каждый проход мог перезаписать результаты предыдущего

3. **Сложная логика**: 8 типов покрытия, проверки вперемешку, невозможно отладить

4. **Невозможность точечных правок**: Каждое исправление ломало другой кейс

## 🏗️ Новая архитектура

### Принцип разделения ответственности

Алгоритм разделен на **5 независимых этапов**:

```
STAGE 1: GEOMETRY       → Собираем факты (без решений)
STAGE 2: TOPOLOGY       → Классифицируем паттерны
STAGE 3: RULES          → Применяем правила расширения
STAGE 4: CORNER FLAGS   → Определяем скругления углов
STAGE 5: NAME HIDING    → Определяем видимость названий
```

Каждый этап:
- **Изолирован**: не зависит от других этапов
- **Явный**: все решения документированы
- **Отлаживаемый**: можно логировать результаты
- **Расширяемый**: добавление правил не ломает существующие

---

## 📐 STAGE 1: GEOMETRY (Сбор геометрических фактов)

### Цель
Собрать **ВСЕ** геометрические факты о соседях события, **НЕ принимая решений** о расширении.

### Что собираем

Для каждой стороны события (left/right):

```typescript
interface SideGeometry {
  // Списки соседей
  neighbors: SchedulerEvent[];           // Свой проект
  otherProjectNeighbors: SchedulerEvent[]; // Другие проекты
  
  // Покрытие
  hasFull: boolean;          // Сосед полностью покрывает (та же высота)
  hasPartial: boolean;       // Сосед покрывает часть
  hasBoth: boolean;          // Два соседа покрывают верх И низ
  
  hasTopCovered: boolean;    // Верх события покрыт
  hasBottomCovered: boolean; // Низ события покрыт
  
  // Выравнивание
  alignedTop: boolean;       // Есть сосед с той же верхней границей
  alignedBottom: boolean;    // Есть сосед с той же нижней границей
  
  // Внутренние углы
  innerTopProjectId?: string;    // Проект соседа, создающего внутренний угол сверху
  innerBottomProjectId?: string; // Проект соседа, создающего внутренний угол снизу
  
  // Связь
  hasInnerConnection: boolean; // ЛЮБОЙ сосед своего проекта перекрывается вертикально
}
```

### Функции

- `collectGeometry()` - основная функция, создает `Map<eventId, EventGeometry>`
- `analyzeSideGeometry()` - анализирует одну сторону (left или right)
- `findNeighbors()` - находит соседей с фильтрацией

### Важно

- **Никаких решений!** Только факты.
- **Никаких expandMultiplier!** Это будет в STAGE 3.

---

## 🔍 STAGE 2: TOPOLOGY (Классификация паттернов)

### Цель
Классифицировать топологические паттерны: горизонтальную склейку, вертикальные стеки, формы А/Б/В/Г.

### Паттерны

#### 1. Горизонтальная склейка (Horizontal Glue)
События одного проекта, касающиеся по горизонтали, одной высоты.

#### 2. Вертикальный стек (Vertical Stack)
События **разных проектов**, касающиеся вертикально.

```typescript
interface StackPattern {
  topEvent: SchedulerEvent;
  bottomEvent: SchedulerEvent;
  side: "left" | "right";
  
  // Конфигурация углов
  topHasInnerBottom: boolean;  // Верхнее событие - форма Б
  topHasOuterBottom: boolean;  // Верхнее событие - форма В
  
  bottomHasInnerTop: boolean;  // Нижнее событие - форма Г
  bottomHasOuterTop: boolean;  // Нижнее событие - форма А
}
```

### Формы событий

#### Форма А (Outer Top)
Событие имеет **внешние углы сверху** (соседи выровнены по верху или выше).

```
   [A] ← Внешние углы сверху
━━━━━━━━
[Сосед]
```

#### Форма Б (Inner Bottom)
Событие имеет **внутренние углы снизу** (соседи выступают ниже).

```
[Сосед]
━━━━━━━━
   [Б] ← Внутренние углы снизу
```

#### Форма В (Outer Bottom)
Событие имеет **внешние углы снизу** (соседи выровнены по низу или выше).

```
[Сосед]
━━━━━━━━
   [В] ← Внешние углы снизу
```

#### Форма Г (Inner Top)
Событие имеет **внутренние углы сверху** (соседи выступают выше).

```
   [Г] ← Внутренние углы сверху
━━━━━━━━
[Сосед]
```

### Функции

- `classifyTopology()` - основная функция, создает `Map<eventId, EventTopology>`
- `findVerticalStacks()` - находит вертикальные стеки (above/below)

### Важно

- **Никаких решений о расширении!** Только классификация.
- **Все паттерны явные**: можно логировать и отлаживать.

---

## ⚙️ STAGE 3: RULES (Применение правил расширения)

### Цель
**Явно** применить правила расширения на основе геометрии и топологии.

### Правила

#### RULE 1: Base Horizontal Glue Expansion
**Если** событие имеет горизонтальную связь (hasInnerConnection) **И** не полное покрытие (hasFull),  
**То** расширить на +1 gap.

```typescript
if (geometry.left.hasInnerConnection && !geometry.left.hasFull) {
  decision.expandLeft = 1;
}
```

#### RULE 2A: Vertical Stacking - Б over А
**Если** верхнее событие (форма Б) над нижним (форма А),  
**То**:
- Верхнее событие: `expandLeft/Right = 1`
- Соседи верхнего: `expandRight/Left = 0` (сброс)

```
[Сосед] (reset)
━━━━━━━━
   [Б] ← expandLeft = 1
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   [А]
```

**Код:**
```typescript
if (stack.topHasInnerBottom && stack.bottomHasOuterTop) {
  topDecision.expandLeft = Math.max(topDecision.expandLeft, 1);
  
  // Reset neighbors
  for (const neighbor of topGeometry.left.neighbors) {
    neighborDecision.expandRight = 0;
  }
}
```

#### RULE 2B: Vertical Stacking - В over Г
**Если** верхнее событие (форма В) над нижним (форма Г),  
**То**:
- Верхнее событие: `expandLeft/Right = 0` (сброс)
- Соседи верхнего: `expandRight/Left += 1` (boost)

```
[Сосед] ← expandRight += 1 (boost)
━━━━━━━━
   [В] ← expandLeft = 0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   [Г]
```

**Код:**
```typescript
if (stack.topHasOuterBottom && stack.bottomHasInnerTop) {
  topDecision.expandLeft = 0;
  
  // Boost neighbors
  for (const neighbor of topGeometry.left.neighbors) {
    neighborDecision.expandRight += 1;
  }
}
```

#### RULE 3: Biting (Откусывание)
**Если** событие НЕ имеет соседей своего проекта **И** события других проектов давят с двух сторон (totalPressure >= 2),  
**То** уменьшить расширение на -1.

```typescript
if (geometry.left.neighbors.length === 0) {
  let totalPressure = 0;
  
  for (const otherEvent of geometry.left.otherProjectNeighbors) {
    totalPressure += Math.max(1, otherDecision.expandRight);
  }
  
  if (totalPressure >= 2) {
    decision.expandLeft -= 1;
  }
}
```

### Функции

- `applyExpansionRules()` - основная функция, создает `Map<eventId, ExpansionDecision>`

### Важно

- **Каждое правило независимо**: можно отключить или изменить без поломки других
- **Порядок важен**: RULE 1 → RULE 2 → RULE 3
- **Логирование**: каждое правило логирует причину (reason)

---

## 🎨 STAGE 4: CORNER ROUNDING & FLAGS

### Цель
Определить какие углы скруглять, установить флаги покрытия.

### Логика

Угол **НЕ скругляется** если:
- Есть полное покрытие (hasFull), **ИЛИ**
- Есть внутренний угол (innerProjectId), **ИЛИ**
- Есть выравнивание (alignedTop/alignedBottom)

```typescript
if (leftCoverage.hasFull || leftCoverage.innerTopProjectId || leftCoverage.alignedTop) {
  flags &= ~MASK_ROUND_TL; // Не скруглять top-left
}
```

### Флаги покрытия

Устанавливаем битовые флаги:
- `MASK_FULL_LEFT` / `MASK_FULL_RIGHT` - полное покрытие
- `MASK_PARTIAL_LEFT` / `MASK_PARTIAL_RIGHT` - частичное покрытие
- `MASK_BOTH_LEFT` / `MASK_BOTH_RIGHT` - покрытие сверху И снизу

### Функции

- `determineCornerRounding()` - определяет флаги для одного события

---

## 👁️ STAGE 5: NAME HIDING

### Цель
Определить видимость названий событий.

### Логика

**Если** событие короткое (<= 2 недели) **И** имеет видимого соседа слева,  
**То** скрыть название.

```typescript
if (event.weeksSpan <= 2) {
  const leftNeighbor = geometry.left.neighbors[0];
  const leftVisible = leftNeighborInfo && !(leftNeighborInfo.flags & MASK_HIDE_NAME);
  
  if (leftVisible) {
    info.flags |= MASK_HIDE_NAME; // Скрыть
  }
}
```

### Важно

- **Обрабатываем слева направо**: сортировка по `resourceId` + `startWeek`
- **Рекурсивная логика**: видимость зависит от соседа слева

### Функции

- `determineNameHiding()` - основная функция, модифицирует `finalInfo`

---

## 🚀 Преимущества новой архитектуры

### ✅ Предсказуемость
Каждое правило явное и независимое. Результат не зависит от побочных эффектов.

### ✅ Отладка
Можно логировать каждый этап:
```
📐 STAGE 1: Collecting Geometry...
✅ STAGE 1 Complete: 50 events analyzed

🔍 STAGE 2: Classifying Topology...
✅ STAGE 2 Complete: 50 events classified

⚙️ STAGE 3: Applying Expansion Rules...
📐 RULE: Б e123 over А e456 (left)
🔪 BITING: e789 left (pressure=2)
✅ STAGE 3 Complete: 50 expansion decisions made
```

### ✅ Расширяемость
Хотите добавить новое правило? Просто добавьте в STAGE 3:
```typescript
// RULE 4: New custom rule
for (const event of events) {
  // ... your logic
}
```

### ✅ Корректность
Кейсы А/Б/В/Г обрабатываются **явно** через `StackPattern` и правила 2A/2B.

---

## 📊 Сравнение v7.0 vs v8.0

| Критерий | v7.0 (Старый) | v8.0 (Новый) |
|----------|---------------|--------------|
| **Этапы** | 4 прохода (passes) | 5 независимых этапов (stages) |
| **Логика** | Неявная, смешанная | Явная, разделенная |
| **expandMultiplier** | Используется везде | Только в STAGE 3 |
| **Порядок зависимости** | Критичен, ломает результат | Строгий, но явный |
| **Отладка** | Сложная, логи вперемешку | Простая, логи по этапам |
| **Добавление правил** | Ломает существующие | Изолированное, безопасное |
| **Кейсы А/Б/В/Г** | Неявные, зависят от порядка | Явные, через StackPattern |
| **Строк кода** | ~490 | ~700 (но читаемых!) |

---

## 🎯 Тестирование

### Кейс 1: Горизонтальная склейка
```
[Event1]━━[Event2]━━[Event3]
```
- **Ожидание**: все события `expandLeft=1`, `expandRight=1`
- **Правило**: RULE 1 (Base Horizontal Glue)

### Кейс 2: Форма Б над А
```
[NeighborL]
━━━━━━━━
   [Event_B] ← Inner bottom
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   [Event_A] ← Outer top
```
- **Ожидание**: 
  - `Event_B.expandLeft = 1`
  - `NeighborL.expandRight = 0`
- **Правило**: RULE 2A (Б over А)

### Кейс 3: Форма В над Г
```
[NeighborL]
━━━━━━━━
   [Event_V] ← Outer bottom
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   [Event_G] ← Inner top
```
- **Ожидание**: 
  - `Event_V.expandLeft = 0`
  - `NeighborL.expandRight = 2` (base 1 + boost 1)
- **Правило**: RULE 2B (В over Г)

### Кейс 4: Biting
```
[OtherProj1] [Event] [OtherProj2]
```
- **Условие**: `OtherProj1.expandRight=1`, `OtherProj2.expandLeft=1`
- **Ожидание**: `Event.expandLeft = -1`, `Event.expandRight = -1`
- **Правило**: RULE 3 (Biting)

---

## 🛠️ Как расширять

### Добавление нового правила

1. **Определите условие** в терминах `EventGeometry` и `EventTopology`
2. **Добавьте правило в STAGE 3** после существующих правил
3. **Логируйте действие** для отладки
4. **Тестируйте изолированно**

Пример:
```typescript
// RULE 4: Custom rule for special case
for (const event of events) {
  const geometry = geometryMap.get(event.id);
  const topology = topologyMap.get(event.id);
  
  if (/* your condition */) {
    const decision = decisions.get(event.id)!;
    decision.expandLeft = /* your value */;
    decision.reason = "custom-rule-description";
    
    if (DEBUG) console.log(`🎯 CUSTOM RULE: ${event.id}`);
  }
}
```

---

## 📝 Выводы

**v8.0 - это полная переписка с чистой архитектурой.**

- ✅ Решены все проблемы v7.0 и ранее
- ✅ Кейсы А/Б/В/Г обрабатываются корректно
- ✅ Код читаемый, отлаживаемый, расширяемый
- ✅ Каждое правило изолировано и явное

**Больше никаких загадочных багов, где исправление одного ломает другое!**

---

**Версия**: 8.0  
**Дата**: 2025-11-29  
**Автор**: Clean Architecture Refactoring
