# Event Neighbors v8.0 - Cheatsheet

## 🚀 Quick Reference

### Включить DEBUG
```typescript
// /utils/eventNeighbors.ts:6
const DEBUG = true;
```

### Использование
```typescript
import { calculateEventNeighbors } from './utils/eventNeighbors';

const result = calculateEventNeighbors(events, projects);
const info = result.get(event.id);
```

---

## 🏗️ Архитектура (5 этапов)

| Этап | Что делает | Выход |
|------|-----------|-------|
| **STAGE 1** | Собирает факты | `EventGeometry` |
| **STAGE 2** | Классифицирует | `EventTopology` |
| **STAGE 3** | Применяет правила | `ExpansionDecision` |
| **STAGE 4** | Определяет углы | `flags` |
| **STAGE 5** | Скрывает названия | `MASK_HIDE_NAME` |

---

## 📐 Правила (STAGE 3)

### RULE 1: Base Glue
```
IF hasInnerConnection && !hasFull
THEN expandLeft/Right = 1
```

### RULE 2A: Б над А
```
IF topHasInnerBottom && bottomHasOuterTop
THEN top.expand = 1, neighbor.expand = 0
```

### RULE 2B: В над Г
```
IF topHasOuterBottom && bottomHasInnerTop
THEN top.expand = 0, neighbor.expand += 1
```

### RULE 3: Biting
```
IF no same-project neighbor && totalPressure >= 2
THEN expand -= 1
```

---

## 🎨 Формы событий

| Форма | Описание | Условие |
|-------|----------|---------|
| **А** | Outer Top | Внешние углы сверху |
| **Б** | Inner Bottom | Внутренние углы снизу |
| **В** | Outer Bottom | Внешние углы снизу |
| **Г** | Inner Top | Внутренние углы сверху |

---

## 🔍 Проверка результатов

### Флаги скругления
```typescript
const info = result.get(event.id);

const roundTL = !!(info.flags & MASK_ROUND_TL); // 1
const roundTR = !!(info.flags & MASK_ROUND_TR); // 2
const roundBL = !!(info.flags & MASK_ROUND_BL); // 4
const roundBR = !!(info.flags & MASK_ROUND_BR); // 8
```

### Флаги покрытия
```typescript
const fullLeft = !!(info.flags & MASK_FULL_LEFT);       // 16
const partialLeft = !!(info.flags & MASK_PARTIAL_LEFT); // 32
const bothLeft = !!(info.flags & MASK_BOTH_LEFT);       // 64

const fullRight = !!(info.flags & MASK_FULL_RIGHT);       // 128
const partialRight = !!(info.flags & MASK_PARTIAL_RIGHT); // 256
const bothRight = !!(info.flags & MASK_BOTH_RIGHT);       // 512
```

### Скрытие названия
```typescript
const hideName = !!(info.flags & MASK_HIDE_NAME); // 1024
```

### Расширения
```typescript
const expandLeft = info.expandLeftMultiplier;   // 0, 1, 2, -1, ...
const expandRight = info.expandRightMultiplier; // 0, 1, 2, -1, ...
```

---

## 🧪 Тестовые кейсы

### 1. Горизонтальная склейка
```
[E1]━[E2]━[E3]
```
**Ожидание:** E1.expandRight=1, E2.expandLeft=1, E2.expandRight=1, E3.expandLeft=1

### 2. Форма Б над А
```
[NeighborL]
━━━━━━━━
   [Б]
━━━━━━━━
   [А]
```
**Ожидание:** Б.expandLeft=1, NeighborL.expandRight=0

### 3. Форма В над Г
```
[NeighborL]
━━━━━━━━
   [В]
━━━━━━━━
   [Г]
```
**Ожидание:** В.expandLeft=0, NeighborL.expandRight=2

### 4. Откусывание
```
[Other1] [Middle] [Other2]
```
**Ожидание:** Middle.expandLeft=-1, Middle.expandRight=-1

### 5. Скрытие названий
```
[Long (5w)]━[Short (1w)]
```
**Ожидание:** Long видимый, Short скрытый

---

## 🐛 Отладка

### Проверка STAGE 1 (Geometry)
```typescript
const geometry = geometryMap.get(event.id);
console.log({
  leftNeighbors: geometry.left.neighbors.length,
  rightNeighbors: geometry.right.neighbors.length,
  hasFull: geometry.left.hasFull,
  hasInnerConnection: geometry.left.hasInnerConnection,
  innerTopProjectId: geometry.left.innerTopProjectId,
});
```

### Проверка STAGE 2 (Topology)
```typescript
const topology = topologyMap.get(event.id);
console.log({
  hasHorizontalGlue: topology.hasHorizontalGlue,
  stacksAbove: topology.stacksAbove.length,
  stacksBelow: topology.stacksBelow.length,
  hasInnerCorners: topology.hasInnerCorners,
});
```

### Проверка STAGE 3 (Rules)
```typescript
const decision = decisions.get(event.id);
console.log({
  expandLeft: decision.expandLeft,
  expandRight: decision.expandRight,
  reason: decision.reason,
});
```

---

## ⚠️ Частые ошибки

### ❌ Правило не срабатывает
**Причина:** Геометрия не соответствует условию  
**Решение:** Проверьте STAGE 1 → STAGE 2 → условие правила

### ❌ Углы не скругляются
**Причина:** innerProjectId или alignedTop/alignedBottom установлены  
**Решение:** Проверьте STAGE 1 geometry

### ❌ Неправильное расширение
**Причина:** Несколько правил применяются одновременно  
**Решение:** Проверьте reason в ExpansionDecision

---

## 🛠️ Добавление нового правила

### Шаг 1: Определите условие
```typescript
// В STAGE 3 - applyExpansionRules()

// RULE 4: Your new rule
for (const event of events) {
  const geometry = geometryMap.get(event.id);
  const topology = topologyMap.get(event.id);
  
  if (/* YOUR CONDITION */) {
    // ...
  }
}
```

### Шаг 2: Примените изменения
```typescript
const decision = decisions.get(event.id)!;
decision.expandLeft = /* YOUR VALUE */;
decision.reason = "your-rule-name";
```

### Шаг 3: Логируйте
```typescript
if (DEBUG) console.log(`🎯 YOUR RULE: ${event.id}`);
```

### Шаг 4: Тестируйте
- Создайте тестовый кейс
- Проверьте логи
- Проверьте визуальный результат

---

## 📊 Битовые маски (flags)

```typescript
// Скругления (4 бита)
MASK_ROUND_TL = 1 << 0;  // 1
MASK_ROUND_TR = 1 << 1;  // 2
MASK_ROUND_BL = 1 << 2;  // 4
MASK_ROUND_BR = 1 << 3;  // 8

// Покрытие слева (3 бита)
MASK_FULL_LEFT    = 1 << 4; // 16
MASK_PARTIAL_LEFT = 1 << 5; // 32
MASK_BOTH_LEFT    = 1 << 6; // 64

// Покрытие справа (3 бита)
MASK_FULL_RIGHT    = 1 << 7; // 128
MASK_PARTIAL_RIGHT = 1 << 8; // 256
MASK_BOTH_RIGHT    = 1 << 9; // 512

// Скрытие названия (1 бит)
MASK_HIDE_NAME = 1 << 10; // 1024
```

**Использование:**
```typescript
// Установить флаг
info.flags |= MASK_ROUND_TL;

// Снять флаг
info.flags &= ~MASK_ROUND_TL;

// Проверить флаг
const isSet = !!(info.flags & MASK_ROUND_TL);
```

---

## 📚 Документация

| Документ | Описание |
|----------|----------|
| [`README_v8.0.md`](README_v8.0.md) | Обзор (TL;DR) |
| [`EVENT_NEIGHBORS_v8.0_CLEAN_ARCHITECTURE.md`](EVENT_NEIGHBORS_v8.0_CLEAN_ARCHITECTURE.md) | Полное описание |
| [`QUICK_TEST_NEIGHBORS_v8.0.md`](QUICK_TEST_NEIGHBORS_v8.0.md) | Шпаргалка для тестирования |
| [`TEST_CASES_v8.0.md`](TEST_CASES_v8.0.md) | Тестовые кейсы |
| [`MIGRATION_GUIDE_v7_to_v8.md`](MIGRATION_GUIDE_v7_to_v8.md) | Гайд по миграции |

---

## ✅ Best Practices

### DO ✅
- ✅ Используйте DEBUG логи
- ✅ Проверяйте каждый этап отдельно
- ✅ Читайте документацию
- ✅ Добавляйте правила в STAGE 3
- ✅ Логируйте причины (reason)

### DON'T ❌
- ❌ Не смешивайте этапы
- ❌ Не изменяйте expandMultiplier в STAGE 1-2
- ❌ Не делайте решения в collectGeometry
- ❌ Не пропускайте логирование
- ❌ Не меняйте порядок правил

---

## 🎯 Контрольный чек-лист

### Перед тестированием
- [ ] `DEBUG = true` в eventNeighbors.ts
- [ ] Консоль браузера открыта
- [ ] Тестовые события созданы

### Базовые тесты
- [ ] Горизонтальная склейка работает
- [ ] Формы А/Б/В/Г определяются
- [ ] Откусывание срабатывает
- [ ] Названия скрываются корректно
- [ ] Углы скругляются правильно

### Перед commit
- [ ] Все тесты пройдены
- [ ] Логи проверены
- [ ] Нет ошибок в консоли
- [ ] Визуальная проверка выполнена
- [ ] Документация обновлена

---

## 💡 Подсказки

### Как понять почему правило НЕ сработало?
1. Проверьте STAGE 1: есть ли соседи?
2. Проверьте STAGE 2: правильная классификация?
3. Проверьте условие правила в коде

### Как понять почему углы НЕ скруглены?
1. Проверьте innerProjectId в STAGE 1
2. Проверьте alignedTop/alignedBottom
3. Проверьте hasFull

### Как добавить новое поведение?
1. Определите условие в терминах geometry/topology
2. Добавьте правило в STAGE 3 (после существующих)
3. Логируйте действие
4. Тестируйте изолированно

---

**Версия**: 8.0  
**Дата**: 2025-11-29  
**Тип**: Cheatsheet (Quick Reference)
