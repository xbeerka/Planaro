# Оптимизация алгоритма склейки событий v6.0

## 🎯 Цель оптимизации

Улучшить производительность и читаемость алгоритма склейки событий (`/utils/eventNeighbors.ts`) путём:
- Уменьшения количества проходов (с 5 до 4)
- Использования индексов для быстрого поиска (O(1) вместо O(n))
- Переиспользования кода через утилитарные функции
- Опциональных логов (DEBUG mode)

---

## 📊 Сравнение версий

### До (v5.23):
- **Строк кода**: ~691
- **Проходов**: 5
- **Поиск соседей**: `events.filter()` каждый раз → O(n²)
- **Повторяющийся код**: ~200 строк дублирования
- **Логи**: Всегда включены

### После (v6.0):
- **Строк кода**: ~545 (-21%)
- **Проходов**: 4 (-20%)
- **Поиск соседей**: Индексы `Map<resourceId, Map<week, Event[]>>` → O(1)
- **Повторяющийся код**: 0 (утилитарные функции)
- **Логи**: Опциональные (const DEBUG)

---

## 🚀 Основные улучшения

### 1. Индексация событий

**Было (v5.23):**
```typescript
// Каждый раз filter по всем событиям - O(n)
const leftNeighbors = events.filter(e => 
  e.id !== event.id &&
  e.resourceId === event.resourceId &&
  e.projectId === event.projectId &&
  e.startWeek + e.weeksSpan === event.startWeek
).filter(e => {
  // ... пересечение по высоте
});
```

**Стало (v6.0):**
```typescript
// Создаём индекс один раз - O(n)
const eventIndex = createEventIndex(events);

// Поиск через индекс - O(1)
const leftNeighbors = findNeighbors(eventIndex, event, 'left', { sameProject: true });
```

**Выигрыш:**
- Индекс создаётся **один раз** за O(n)
- Каждый поиск соседей — **O(1)** вместо O(n)
- Для 100 событий: **~10,000 операций → ~100 операций** (100x быстрее!)

---

### 2. Утилитарные функции

**Было (v5.23):**
```typescript
// ПРОХОД 1: Поиск левых соседей
const leftNeighbors = events.filter(e => 
  e.id !== event.id &&
  e.resourceId === event.resourceId &&
  e.projectId === event.projectId &&
  e.startWeek + e.weeksSpan === event.startWeek
).filter(e => {
  const eTop = e.unitStart;
  const eBottom = e.unitStart + e.unitsTall - 1;
  return eventTop <= eBottom && eTop <= eventBottom;
});

// ПРОХОД 2: Поиск правых соседей (ТОТ ЖЕ КОД!)
const rightNeighbors = events.filter(e => 
  e.id !== event.id &&
  e.resourceId === event.resourceId &&
  e.projectId === event.projectId &&
  e.startWeek === eventEndWeek
).filter(e => {
  const eTop = e.unitStart;
  const eBottom = e.unitStart + e.unitsTall - 1;
  return eventTop <= eBottom && eTop <= eventBottom;
});

// ПРОХОД 3, 4, 5: Тот же код повторяется...
```

**Стало (v6.0):**
```typescript
// Одна утилитарная функция для ВСЕХ случаев
function findNeighbors(
  index: EventIndex,
  event: SchedulerEvent,
  side: 'left' | 'right',
  filterOptions?: {
    sameProject?: boolean;
    differentProject?: boolean;
  }
): SchedulerEvent[] {
  // ... универсальная логика поиска
}

// Использование
const leftNeighbors = findNeighbors(eventIndex, event, 'left', { sameProject: true });
const rightNeighbors = findNeighbors(eventIndex, event, 'right', { sameProject: true });
const otherProjectsLeft = findNeighbors(eventIndex, event, 'left', { differentProject: true });
```

**Выигрыш:**
- **-200 строк** повторяющегося кода
- Легче поддерживать (изменения в одном месте)
- Меньше багов (один источник истины)

---

### 3. Объединение проходов

**Было (v5.23):**
```
ПРОХОД 1: Базовое расширение
ПРОХОД 2: Расширение навстречу + блокировка
ПРОХОД 3: Поджатие
ПРОХОД 4: Компенсация
ПРОХОД 5: Откусывание
```

**Стало (v6.0):**
```
ПРОХОД 1: Базовое расширение + вычисление углов (объединены!)
ПРОХОД 2: Расширение навстречу + блокировка
ПРОХОД 3: Поджатие + компенсация (объединены!)
ПРОХОД 4: Откусывание
```

**Выигрыш:**
- **-1 проход** (20% меньше итераций)
- Меньше вызовов `neighbors.get()` и `neighbors.set()`

---

### 4. Опциональные логи

**Было (v5.23):**
```typescript
console.log('🔄 calculateEventNeighbors v3.6...');
console.log(`✅ Event ${event.id}:`, { ... });
console.log(`🔄 НАВСТРЕЧУ RIGHT...`);
console.log(`✂️ ПОДЖАТИЕ RIGHT...`);
// ... 50+ console.log в продакшене!
```

**Стало (v6.0):**
```typescript
const DEBUG = false; // ← Одна константа

if (DEBUG) {
  console.log('🔄 calculateEventNeighbors v6.0 OPTIMIZED!');
}

if (DEBUG) {
  console.log(`🚫 БЛОКИРОВКА RIGHT...`);
}
```

**Выигрыш:**
- В продакшене: **0 логов** (быстрее!)
- При отладке: `DEBUG = true` → все логи включены

---

## 📝 Детали реализации

### Индекс событий

```typescript
type EventIndex = Map<string, Map<number, SchedulerEvent[]>>;
//                     ↑           ↑          ↑
//                  resourceId    week    события на этой неделе

function createEventIndex(events: SchedulerEvent[]): EventIndex {
  const index: EventIndex = new Map();
  
  for (const event of events) {
    let resourceMap = index.get(event.resourceId);
    if (!resourceMap) {
      resourceMap = new Map();
      index.set(event.resourceId, resourceMap);
    }
    
    // Добавляем событие на ВСЕ недели которые оно покрывает
    for (let w = event.startWeek; w < event.startWeek + event.weeksSpan; w++) {
      let weekEvents = resourceMap.get(w);
      if (!weekEvents) {
        weekEvents = [];
        resourceMap.set(w, weekEvents);
      }
      weekEvents.push(event);
    }
  }
  
  return index;
}
```

**Пример:**
```typescript
// Событие: { resourceId: 'user1', startWeek: 5, weeksSpan: 3 }
// Добавляется в индекс:
index.get('user1').get(5) // → [event]
index.get('user1').get(6) // → [event]
index.get('user1').get(7) // → [event]
```

---

### Утилита findNeighbors()

```typescript
function findNeighbors(
  index: EventIndex,
  event: SchedulerEvent,
  side: 'left' | 'right',
  filterOptions?: {
    sameProject?: boolean;        // Только тот же проект
    differentProject?: boolean;   // Только другие проекты
    excludeEventId?: string;      // Исключить конкретное событие
  }
): SchedulerEvent[] {
  // Определяем неделю для поиска
  const targetWeek = side === 'left' 
    ? event.startWeek - 1 
    : event.startWeek + event.weeksSpan;
  
  // Получаем все события на этой неделе O(1)
  const candidates = getEventsAt(index, event.resourceId, targetWeek);
  
  // Фильтруем по условиям
  return candidates.filter(neighbor => {
    // ... проверки проекта, направления, пересечения
  });
}
```

**Использование:**
```typescript
// Все левые соседи своего проекта
const leftSame = findNeighbors(index, event, 'left', { sameProject: true });

// Все правые соседи других проектов
const rightOther = findNeighbors(index, event, 'right', { differentProject: true });
```

---

### Утилита analyzeNeighborCoverage()

```typescript
function analyzeNeighborCoverage(
  neighbors: SchedulerEvent[],
  event: SchedulerEvent,
  projectIndex: ProjectIndex
): {
  hasFull: boolean;              // Полная склейка
  hasTopCovered: boolean;        // Верх покрыт
  hasBottomCovered: boolean;     // Низ покрыт
  innerTopColor?: string;        // Цвет для внутреннего угла сверху
  innerBottomColor?: string;     // Цвет для внутреннего угла снизу
  alignedTop: boolean;           // Границы выровнены сверху
  alignedBottom: boolean;        // Границы выровнены снизу
  // ...
} {
  // ... анализирует всех соседей и возвращает агрегированную информацию
}
```

**Выигрыш:**
- Вся логика анализа соседей в одном месте
- Переиспользуется для левой И правой стороны
- Легко тестировать

---

## 🎯 Алгоритм v6.0 (4 прохода)

### STEP 0: Создание индексов
```typescript
const eventIndex = createEventIndex(events);      // O(n * avgWeeksSpan)
const projectIndex = createProjectIndex(projects); // O(p)
```

---

### PASS 1: Базовое расширение + углы
```typescript
for (const event of events) {
  const leftNeighbors = findNeighbors(...);     // O(1) вместо O(n)
  const rightNeighbors = findNeighbors(...);    // O(1) вместо O(n)
  
  const leftCoverage = analyzeNeighborCoverage(...);
  const rightCoverage = analyzeNeighborCoverage(...);
  
  // Вычисляем расширение
  const expandLeft = (hasInnerLeft && !leftCoverage.hasFull) ? 1 : 0;
  const expandRight = (hasInnerRight && !rightCoverage.hasFull) ? 1 : 0;
  
  // Вычисляем round* флаги
  const roundTopLeft = !(...);
  const roundBottomLeft = !(...);
  const roundTopRight = !(...);
  const roundBottomRight = !(...);
  
  neighbors.set(event.id, { ... });
}
```

**Что делает:**
- Находит всех соседей (O(1) через индекс)
- Анализирует покрытие углов
- Вычисляет базовое расширение
- Вычисляет какие углы скруглены
- **Объединили два прохода в один!**

---

### PASS 2: Расширение навстречу + блокировка
```typescript
for (const event of events) {
  const rightNeighbors = findNeighbors(...);
  const shouldExpandRight = rightNeighbors.some(n => n.hasInnerLeft);
  
  // Блокировка: проверяем конфликты с другими проектами
  let blockExpandRight = false;
  const otherProjects = getEventsAt(...).filter(...);
  for (const other of otherProjects) {
    if (other.hasRightNeighbor) {
      blockExpandRight = true;
      break;
    }
  }
  
  if (shouldExpandRight && !blockExpandRight) {
    expandRight += 1;
  }
  
  // Аналогично для левой стороны
}
```

**Что делает:**
- Проверяет нужно ли расширяться навстречу соседу
- Блокирует расширение если есть конфликт с другим проектом
- **Без изменений логики** (только оптимизация поиска)

---

### PASS 3: Поджатие + компенсация
```typescript
for (const event of events) {
  // Поджатие LEFT
  if (roundBottomLeft) {
    const eventsWithInnerLeft = getEventsAt(...).filter(...);
    const shouldShrink = eventsWithInnerLeft.some(...);
    
    if (shouldShrink) {
      expandLeft = 0;
      
      // КОМПЕНСАЦИЯ: левые соседи получают +1 gap
      const leftNeighbors = findNeighbors(...);
      for (const neighbor of leftNeighbors) {
        neighbor.expandRight += 1;
      }
    }
  }
  
  // Аналогично для правой стороны (lastWeek!)
}
```

**Что делает:**
- Поджимает события с внешними углами
- **Сразу** компенсирует соседей (+1 gap)
- **Объединили два прохода в один!**

---

### PASS 4: Откусывание (ДВОЙНОЙ gap!)
```typescript
for (const event of events) {
  // LEFT: если нет левого соседа своего проекта
  const hasLeftNeighbor = findNeighbors(...).length > 0;
  
  if (!hasLeftNeighbor) {
    const otherProjectsLeft = findNeighbors(..., { differentProject: true });
    
    for (const other of otherProjectsLeft) {
      if (other.expandRight >= 2) {  // ← ДВОЙНОЙ gap!
        expandLeft -= 1;
        break;
      }
    }
  }
  
  // Аналогично для правой стороны
}
```

**Что делает:**
- Откусывает gap если событие вклинилось между ДВОЙНЫМИ расширениями
- **Без изменений логики** (только оптимизация поиска)

---

## 📈 Производительность

### Сложность алгоритма

**Было (v5.23):**
```
Создание: O(1)
ПРОХОД 1: O(n²)  ← events.filter() для каждого события
ПРОХОД 2: O(n²)
ПРОХОД 3: O(n²)
ПРОХОД 4: O(n²)
ПРОХОД 5: O(n²)

ИТОГО: O(5n²) ≈ O(n²)
```

**Стало (v6.0):**
```
Создание индексов: O(n * avgWeeksSpan + p)
ПРОХОД 1: O(n * avgNeighbors)
ПРОХОД 2: O(n * avgNeighbors)
ПРОХОД 3: O(n * avgNeighbors)
ПРОХОД 4: O(n * avgNeighbors)

ИТОГО: O(n * avgWeeksSpan + 4n * avgNeighbors)
```

**Для типичного случая:**
- n = 100 событий
- avgWeeksSpan = 3 недели
- avgNeighbors = 2 соседа на сторону
- p = 20 проектов

```
v5.23: 5 * 100 * 100 = 50,000 операций
v6.0:  100 * 3 + 4 * 100 * 2 = 300 + 800 = 1,100 операций

Ускорение: ~45x! 🚀
```

---

## ✅ Преимущества v6.0

### Производительность
- ✅ **~45x быстрее** для 100 событий
- ✅ **~450x быстрее** для 1000 событий (квадратичная сложность v5.23!)
- ✅ Меньше проходов (4 вместо 5)

### Читаемость
- ✅ **-21% строк кода** (545 vs 691)
- ✅ **Нет дублирования** (утилитарные функции)
- ✅ **Понятная структура** (4 чёткие секции)

### Поддержка
- ✅ **Легче отлаживать** (DEBUG mode)
- ✅ **Легче расширять** (утилиты переиспользуются)
- ✅ **Меньше багов** (один источник истины)

### Логика
- ✅ **Без изменений** (те же 7 правил склейки)
- ✅ **Обратная совместимость** (тот же интерфейс)
- ✅ **Те же результаты** (прошла все тесты)

---

## 🔧 Включение DEBUG режима

```typescript
// В /utils/eventNeighbors.ts
const DEBUG = true; // ← Включить детальные логи

// Перезагрузить приложение
// В консоли появятся:
// 🔄 calculateEventNeighbors v6.0 OPTIMIZED! События: 100 Проекты: 20
// 📇 Индексы созданы: { resources: 10, projects: 20 }
// 🚫 БЛОКИРОВКА RIGHT для события 42: конфликт с проектом 5
// 💰 КОМПЕНСАЦИЯ: Левый сосед 13 получает expandRight += 1
// 🪓 ОТКУСЫВАНИЕ LEFT: Событие 27 вклинилось в ДВОЙНОЙ gap (expandRight=2)
// ✅ calculateEventNeighbors v6.0 завершён! Результатов: 100
```

---

## 📦 Файлы

- `/utils/eventNeighbors.ts` - оптимизированный алгоритм v6.0
- `/EVENT_NEIGHBORS_v6.0_OPTIMIZATION.md` - эта документация

---

**Версия:** 6.0  
**Дата:** 2025-11-17  
**Авторы:** Оптимизация и рефакторинг  
**Совместимость:** Полная обратная совместимость с v5.23
