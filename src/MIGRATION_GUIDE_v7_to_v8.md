# Migration Guide: v7.0 → v8.0

## 🎯 Обзор изменений

**Event Neighbors v8.0** - это полная переписка алгоритма с новой архитектурой.

### Что изменилось

#### ❌ Удалено (v7.0)
- Проходы (Passes): `applyBaseExpansion`, `applyStackingRules`, `applyBitingClipping`, `applyVisualRules`
- Смешанная логика expandMultiplier
- Неявные зависимости между проходами
- Сложная система анализа соседей с 8 типами покрытия

#### ✅ Добавлено (v8.0)
- Этапы (Stages): `STAGE 1-5` с четким разделением ответственности
- Новые типы: `EventGeometry`, `EventTopology`, `StackPattern`, `ExpansionDecision`
- Явные правила: `RULE 1`, `RULE 2A`, `RULE 2B`, `RULE 3`
- Изолированная логика каждого этапа

---

## 🏗️ Архитектура

### v7.0 (Старая)
```
calculateEventNeighbors()
  ├─ Pass 1: applyBaseExpansion()
  │   └─ Устанавливает expandMultiplier для склейки
  ├─ Pass 2: applyStackingRules()
  │   └─ Изменяет expandMultiplier для стекинга
  ├─ Pass 3: applyBitingClipping()
  │   └─ Уменьшает expandMultiplier для откусывания
  └─ Pass 4: applyVisualRules()
      └─ Устанавливает MASK_HIDE_NAME

ПРОБЛЕМА: expandMultiplier используется ВЕЗДЕ!
```

### v8.0 (Новая)
```
calculateEventNeighbors()
  ├─ STAGE 1: collectGeometry()
  │   └─ Собирает факты (соседи, покрытие, углы)
  │       → EventGeometry
  ├─ STAGE 2: classifyTopology()
  │   └─ Классифицирует паттерны (А/Б/В/Г)
  │       → EventTopology
  ├─ STAGE 3: applyExpansionRules()
  │   ├─ RULE 1: Base horizontal glue
  │   ├─ RULE 2A: Б over А
  │   ├─ RULE 2B: В over Г
  │   └─ RULE 3: Biting
  │       → ExpansionDecision
  ├─ STAGE 4: determineCornerRounding()
  │   └─ Определяет флаги скругления
  └─ STAGE 5: determineNameHiding()
      └─ Определяет MASK_HIDE_NAME

РЕШЕНИЕ: Каждый этап изолирован!
```

---

## 📦 API Совместимость

### Сигнатура функции
**НЕ ИЗМЕНИЛАСЬ!** Можно заменить v7 на v8 без изменения вызовов.

```typescript
// v7.0 и v8.0
export function calculateEventNeighbors(
  inputEvents: SchedulerEvent[],
  projects: Project[],
  precomputedIndex?: EventIndex
): Map<string, EventNeighborsInfo>;
```

### Возвращаемый тип
**НЕ ИЗМЕНИЛСЯ!** Структура `EventNeighborsInfo` та же.

```typescript
// v7.0 и v8.0
export interface EventNeighborsInfo {
  flags: number;
  expandLeftMultiplier: number;
  expandRightMultiplier: number;
  innerTopLeftProjectId?: string;
  innerBottomLeftProjectId?: string;
  innerTopRightProjectId?: string;
  innerBottomRightProjectId?: string;
}
```

---

## 🔄 Миграция кода

### Шаг 1: Заменить файл
```bash
# Скопировать новый eventNeighbors.ts
cp /utils/eventNeighbors.ts.v8 /utils/eventNeighbors.ts
```

### Шаг 2: Проверить импорты
**Без изменений!** Все экспорты остались те же:
```typescript
import {
  calculateEventNeighbors,
  createEventIndex,
  MASK_ROUND_TL,
  MASK_ROUND_TR,
  // ... и т.д.
} from './utils/eventNeighbors';
```

### Шаг 3: Проверить вызовы
**Без изменений!** Вызовы остались те же:
```typescript
// v7.0 и v8.0 - одинаково
const result = calculateEventNeighbors(events, projects);
```

### Шаг 4: Проверить флаги
**Без изменений!** Битовые маски остались те же:
```typescript
const info = result.get(event.id);

// v7.0 и v8.0 - одинаково
const roundTL = !!(info.flags & MASK_ROUND_TL);
const expandLeft = info.expandLeftMultiplier;
```

---

## ⚠️ Важные изменения поведения

### 1. Порядок применения правил

**v7.0:** Неявный порядок, проходы могут перезаписать друг друга

**v8.0:** Явный порядок в STAGE 3:
1. RULE 1: Base horizontal glue
2. RULE 2A/2B: Vertical stacking
3. RULE 3: Biting

**Последствия:** Результаты могут незначительно отличаться в крайних случаях.

### 2. Определение форм А/Б/В/Г

**v7.0:** Неявное определение через условия в `applyStackingRules`

**v8.0:** Явное определение через `StackPattern` в STAGE 2:
```typescript
interface StackPattern {
  topEvent: SchedulerEvent;
  bottomEvent: SchedulerEvent;
  side: "left" | "right";
  
  topHasInnerBottom: boolean;  // форма Б
  topHasOuterBottom: boolean;  // форма В
  bottomHasInnerTop: boolean;  // форма Г
  bottomHasOuterTop: boolean;  // форма А
}
```

**Последствия:** Более корректное определение форм в сложных случаях.

### 3. Логирование

**v7.0:** Логи смешаны, сложно понять что происходит

**v8.0:** Логи по этапам:
```
📐 STAGE 1: Collecting Geometry...
✅ STAGE 1 Complete: 50 events analyzed

🔍 STAGE 2: Classifying Topology...
✅ STAGE 2 Complete: 50 events classified

⚙️ STAGE 3: Applying Expansion Rules...
📐 RULE: Б e123 over А e456 (left)
✅ STAGE 3 Complete: 50 expansion decisions made
```

**Последствия:** Проще отлаживать проблемы.

---

## 🧪 Тестирование после миграции

### Обязательные тесты

1. **Горизонтальная склейка** (базовый кейс)
   - Создать 3 события одного проекта подряд
   - Проверить что все имеют `expandLeft=1` или `expandRight=1`
   - Проверить что углы скруглены корректно

2. **Формы А/Б/В/Г** (сложный кейс)
   - Создать вертикальный стек разных проектов
   - Проверить что правила 2A/2B срабатывают
   - Проверить логи: `📐 RULE: Б ... over А ...`

3. **Откусывание** (крайний кейс)
   - Создать событие между двумя проектами
   - Проверить что `expandLeft=-1` и `expandRight=-1`
   - Проверить логи: `🔪 BITING: ...`

4. **Скрытие названий** (визуальный кейс)
   - Создать длинное событие + короткое событие
   - Проверить что короткое имеет `MASK_HIDE_NAME`

### Контрольный чек-лист

- [ ] Все события отображаются корректно
- [ ] Расширения (gaps) применяются правильно
- [ ] Углы скругляются корректно
- [ ] Названия скрываются для коротких событий
- [ ] Логи в консоли читаемые и понятные
- [ ] Нет ошибок в консоли

---

## 🐛 Возможные проблемы

### Проблема 1: Результаты отличаются от v7.0

**Причина:** Новая архитектура более корректна в крайних случаях

**Решение:**
1. Проверьте логи STAGE 1-3
2. Убедитесь что геометрия определена правильно
3. Проверьте какое правило должно сработать

**Большинство отличий - это ИСПРАВЛЕНИЯ багов v7.0!**

### Проблема 2: Правило не срабатывает

**Причина:** Условия не соблюдены (геометрия не соответствует)

**Решение:**
1. Проверьте STAGE 1: есть ли соседи?
2. Проверьте STAGE 2: правильно ли классифицирован стек?
3. Проверьте условие правила в `/EVENT_NEIGHBORS_v8.0_CLEAN_ARCHITECTURE.md`

### Проблема 3: Углы не скругляются

**Причина:** Флаги установлены в STAGE 4 на основе геометрии

**Решение:**
1. Проверьте innerProjectId в STAGE 1
2. Проверьте alignedTop/alignedBottom
3. Проверьте hasFull

---

## 📚 Дополнительная документация

### Обязательно прочитайте
- `/EVENT_NEIGHBORS_v8.0_CLEAN_ARCHITECTURE.md` - полное описание архитектуры
- `/QUICK_TEST_NEIGHBORS_v8.0.md` - шпаргалка для тестирования
- `/TEST_CASES_v8.0.md` - набор тестовых кейсов

### Для разработчиков
- `/CHANGELOG.md` - список изменений (версия 8.0.0)
- `/guidelines/Guidelines.md` - обновленные guidelines (версия 4.0.5)

---

## ✅ Рекомендации

### DO ✅
- **Используйте DEBUG логи** для отладки (`const DEBUG = true`)
- **Проверяйте каждый этап** отдельно (STAGE 1-5)
- **Читайте документацию** перед изменениями
- **Добавляйте новые правила в STAGE 3** (изолированно)
- **Логируйте причины** в ExpansionDecision.reason

### DON'T ❌
- **Не смешивайте этапы** - каждый этап должен быть изолирован
- **Не изменяйте expandMultiplier в STAGE 1-2** - только в STAGE 3
- **Не делайте решения в collectGeometry** - только факты
- **Не пропускайте логирование** - это ключ к отладке
- **Не меняйте порядок правил** без понимания последствий

---

## 🚀 Запуск в production

### Перед деплоем
1. [ ] Все тесты пройдены
2. [ ] Визуальная проверка выполнена
3. [ ] Логи проверены (DEBUG = true)
4. [ ] Нет ошибок в консоли
5. [ ] Документация обновлена

### После деплоя
1. [ ] Мониторинг ошибок в production
2. [ ] Проверка feedback от пользователей
3. [ ] Готовность к hotfix если нужно

### Rollback план
Если что-то пошло не так:
```bash
# Откатить к v7.0
git checkout HEAD~1 -- /utils/eventNeighbors.ts
```

---

## 💬 Поддержка

### Если возникли проблемы
1. Проверьте `/QUICK_TEST_NEIGHBORS_v8.0.md`
2. Запустите тесты из `/TEST_CASES_v8.0.md`
3. Проверьте логи в консоли (DEBUG = true)
4. Прочитайте `/EVENT_NEIGHBORS_v8.0_CLEAN_ARCHITECTURE.md`

### Если баг
1. Запишите сценарий воспроизведения
2. Скопируйте логи из консоли
3. Определите на каком этапе (STAGE 1-5) проблема
4. Создайте issue с подробным описанием

---

## 🎯 Выводы

### Преимущества v8.0
- ✅ **Предсказуемость** - каждое правило изолировано
- ✅ **Отладка** - логирование по этапам
- ✅ **Расширяемость** - добавление правил безопасно
- ✅ **Корректность** - кейсы А/Б/В/Г обрабатываются явно

### Миграция
- ✅ **API совместимость** - 100%
- ✅ **Простая замена** - без изменения кода вызовов
- ✅ **Улучшенное поведение** - большинство отличий = исправления багов

**Миграция с v7 на v8 - это БЕЗОПАСНОЕ УЛУЧШЕНИЕ!**

---

**Версия**: 8.0  
**Дата**: 2025-11-29  
**Автор**: Migration Guide for Clean Architecture
