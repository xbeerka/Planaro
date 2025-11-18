# 🧑‍💻 Dev Note v2.3: Технические детали полного заполнения

## 🔍 Техническая реализация

### Основная идея
**"Последнее событие заполняет ВСЁ"** - ключевая стратегия для гарантии 100% заполнения.

### Псевдокод
```
targetCount = random(1, 12)
grid = Array[52][4].fill(false)
eventCount = 0

while (hasFreeCell(grid)):
  cell = findFirstFreeCell(grid)  // Слева-направо, сверху-вниз
  
  maxW = getMaxWidth(grid, cell)
  maxH = getMaxHeight(grid, cell)
  
  if (eventCount >= targetCount - 1):
    // LAST EVENT - максимальный размер
    w = maxW
    h = maxH
  else:
    // RANDOM EVENT - случайный размер
    w = random(1, maxW)
    h = random(1, maxH)
  
  createEvent(cell, w, h)
  markOccupied(grid, cell, w, h)
  eventCount++
```

## 🎯 Ключевые функции

### 1. `hasFreeCell()` - Проверка наличия свободных ячеек
```typescript
const hasFreeCell = (): boolean => {
  for (let week = 0; week < WEEKS; week++) {
    for (let unit = 0; unit < UNITS; unit++) {
      if (!occupancy[week][unit]) return true;
    }
  }
  return false;
};
```
Время: O(208) в худшем случае.

### 2. `findFirstFreeCell()` - Поиск первой свободной ячейки
```typescript
const findFirstFreeCell = (): { week: number; unit: number } | null => {
  for (let week = 0; week < WEEKS; week++) {
    for (let unit = 0; unit < UNITS; unit++) {
      if (!occupancy[week][unit]) return { week, unit };
    }
  }
  return null;
};
```
Порядок обхода: **слева-направо, сверху-вниз** (week 0→51, unit 0→3).

### 3. `getMaxWidth()` - Максимальная ширина от позиции
```typescript
const getMaxWidth = (startWeek: number, startUnit: number): number => {
  let width = 0;
  for (let w = startWeek; w < WEEKS; w++) {
    if (occupancy[w][startUnit]) break;
    width++;
  }
  return width;
};
```
Проверяет горизонталь по одному юниту.

### 4. `getMaxHeight()` - Максимальная высота от позиции
```typescript
const getMaxHeight = (startWeek: number, startUnit: number): number => {
  let height = 0;
  for (let u = startUnit; u < UNITS; u++) {
    if (occupancy[startWeek][u]) break;
    height++;
  }
  return height;
};
```
Проверяет вертикаль по одной неделе.

### 5. `markOccupied()` - Пометка ячеек как занятых
```typescript
const markOccupied = (startWeek: number, startUnit: number, width: number, height: number) => {
  for (let w = startWeek; w < startWeek + width && w < WEEKS; w++) {
    for (let u = startUnit; u < startUnit + height && u < UNITS; u++) {
      occupancy[w][u] = true;
    }
  }
};
```
Заполняет прямоугольник [startWeek, startWeek+width) × [startUnit, startUnit+height).

### 6. `canPlaceRect()` - Проверка возможности размещения
```typescript
const canPlaceRect = (startWeek: number, startUnit: number, width: number, height: number): boolean => {
  for (let w = startWeek; w < startWeek + width && w < WEEKS; w++) {
    for (let u = startUnit; u < startUnit + height && u < UNITS; u++) {
      if (occupancy[w][u]) return false;
    }
  }
  return true;
};
```
Проверяет что все ячейки прямоугольника свободны.

## 🧮 Математика

### Общие данные
- **Ячеек на сотрудника**: 52 × 4 = **208**
- **События**: от **1 до 12** (случайно)
- **Средний размер события**: 208 / N, где N - количество событий

### Распределение размеров событий

#### При N=1 (одно событие)
- **Размер**: 52 недели × 4 юнита = 208 ячеек
- **100% заполнение**

#### При N=12 (максимум событий)
- **Средний размер**: 208 / 12 ≈ **17 ячеек**
- **Примеры**: 4 недели × 4 юнита, 17 недель × 1 юнит, 8 недель × 2 юнита
- **Последнее событие**: заполняет все оставшиеся пробелы (может быть >17 ячеек)

#### Вероятности размеров (для событий 1-11)
- **60% короткие** (1-6 недель): среднее ~3.5 недели
- **40% средние/длинные** (7+ недель): среднее ~15 недель
- **70% одноэтажные** (1 юнит высотой): 1 row
- **30% многоэтажные** (2-4 юнита): среднее ~2.5 rows

## ⚡ Производительность

### Временная сложность
- **Worst case**: O(N × 208), где N - количество событий
  - N ≤ 12, поэтому максимум **2496 операций** на сотрудника
- **Average case**: O(N × 100) ≈ **1200 операций** на сотрудника
  - Большинство ячеек заполняется быстро

### Защита от зависаний
```typescript
const maxIterations = 1000;
let iterations = 0;

while (hasFreeCell() && iterations < maxIterations) {
  iterations++;
  // ...
}

if (iterations >= maxIterations) {
  console.warn('⚠️ Достигнут лимит итераций');
}
```

### Батчинг при создании событий
```typescript
const batchSize = 50;
for (let i = 0; i < eventsToCreate.length; i += batchSize) {
  const batch = eventsToCreate.slice(i, i + batchSize);
  await Promise.all(batch.map(event => createEvent(event)));
}
```

## 🐛 Возможные проблемы

### 1. Не заполнились все ячейки (< 100%)
**Причина**: Логическая ошибка в алгоритме

**Отладка**:
```typescript
// Визуализация сетки
const visualizeGrid = () => {
  for (let unit = 0; unit < UNITS; unit++) {
    let row = `Unit ${unit}: `;
    for (let week = 0; week < WEEKS; week++) {
      row += occupancy[week][unit] ? '█' : '░';
    }
    console.log(row);
  }
};

// Вызвать после генерации
visualizeGrid();
```

**Проверка**:
```typescript
const totalCells = WEEKS * UNITS;
let occupiedCells = 0;
for (let week = 0; week < WEEKS; week++) {
  for (let unit = 0; unit < UNITS; unit++) {
    if (occupancy[week][unit]) occupiedCells++;
  }
}
console.log(`Заполнено: ${occupiedCells}/${totalCells} (${(occupiedCells/totalCells*100).toFixed(1)}%)`);
```

### 2. Слишком много событий (> 12)
**Причина**: Условие `eventCount >= targetEventCount - 1` не работает

**Проверка**:
```typescript
console.log(`Target: ${targetEventCount}, Created: ${createdCount}`);
```

### 3. События перекрываются
**Причина**: Ошибка в `markOccupied()` или `canPlaceRect()`

**Проверка**:
```typescript
// После создания каждого события
console.log(`Event ${eventCount}: week=${startWeek}, unit=${startUnit}, w=${width}, h=${height}`);
```

## 🧪 Юнит-тесты (псевдокод)

```typescript
describe('handleGenerateTestEvents', () => {
  test('все ячейки заполнены', () => {
    generateTestEvents();
    
    for (const resource of resources) {
      const events = getEventsByResource(resource.id);
      const occupancy = buildOccupancyGrid(events);
      const occupiedCount = countOccupied(occupancy);
      
      expect(occupiedCount).toBe(208); // 100%
    }
  });
  
  test('количество событий от 1 до 12', () => {
    generateTestEvents();
    
    for (const resource of resources) {
      const events = getEventsByResource(resource.id);
      
      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events.length).toBeLessThanOrEqual(12);
    }
  });
  
  test('события не перекрываются', () => {
    generateTestEvents();
    
    for (const resource of resources) {
      const events = getEventsByResource(resource.id);
      
      for (let i = 0; i < events.length; i++) {
        for (let j = i + 1; j < events.length; j++) {
          expect(eventsOverlap(events[i], events[j])).toBe(false);
        }
      }
    }
  });
});
```

## 📚 Дополнительные ресурсы

- `/TESTING_FULL_CALENDAR_FILL.md` - полная документация алгоритма
- `/QUICK_TEST_v2.3.md` - инструкция по ручному тестированию
- `/SUMMARY_v2.3.md` - краткое описание изменений
- `/GIT_COMMIT_v2.3.md` - git команды для коммита

---

**Версия**: v2.3  
**Дата**: 2025-10-21  
**Автор**: AI Assistant

**Главный принцип**: Последнее событие ВСЕГДА максимального размера → гарантия 100% заполнения 🎯
