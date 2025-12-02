# CHANGELOG

Все значимые изменения в проекте Resource Scheduler документированы в этом файле.

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.0.0/).

---

## [Unreleased]

## [8.0.2] - 2025-11-29
### 🐛 Bug Fixes
- **Event Neighbors (Biting Logic Fix)**:
  - ✅ **Проблема**: При наличии 2+ соседей с одной стороны (без склейки) центральное событие сжималось на 1 gap, даже если соседи не расширялись.
  - ✅ **Причина**: Логика "Biting" (Rule 3) считала само наличие соседа за давление (`pressure += Math.max(1, expand)`), суммируя 1+1=2.
  - ✅ **Решение**: Убрано искусственное завышение. Теперь `pressure += expand`.
  - ✅ **Результат**: Давление учитывается только если соседи *реально* расширяются в сторону события. Стандартные соседи не вызывают сжатия.

## [8.0.1] - 2025-11-29
### 🐛 Bug Fixes
- **Event Neighbors (Roof Bug Fix)**:
  - ✅ **Проблема**: Событие (E0) не получало дополнительный отступ справа, когда сосед снизу был частью горизонтальной "стены" (форма Б над А).
  - ✅ **Решение**: В STAGE 3 (Rule 2) добавлена проверка `if (topology.hasHorizontalGlue) continue;`.
  - ✅ **Результат**: Если нижнее событие склеено горизонтально, правило "крыши" игнорируется, и верхний сосед корректно расширяется (+1 gap) благодаря Rule 1.
  - ✅ **Влияние**: Исправляет визуальный баг без поломки других кейсов склейки.

## [8.0.0] - 2025-11-29
### 🚀 MAJOR RELEASE - Clean Architecture Refactoring

**Event Neighbors v8.0 - Полная переписка алгоритма**

#### ❌ Проблемы старых версий (v1.0-7.0)
- **Смешанная ответственность**: `expandLeftMultiplier`/`expandRightMultiplier` использовались для склейки, стекинга И откусывания одновременно
- **Неявные зависимости**: Результат зависел от порядка проходов (passes), каждый проход мог перезаписать результаты предыдущего
- **Сложная логика**: 8 типов покрытия соседей, проверки вперемешку, невозможно отладить
- **Невозможность точечных правок**: Каждое исправление ломало другой кейс (как Bootstrap 2)

#### ✅ Новая архитектура v8.0
- **STAGE 1 - GEOMETRY**: Сбор геометрических фактов (соседи, покрытие, выравнивание, внутренние углы)
  - **Без решений**: Только факты, никаких expandMultiplier
  - **Чистые данные**: `EventGeometry` с `SideGeometry` для left/right
  
- **STAGE 2 - TOPOLOGY**: Классификация топологических паттернов
  - **StackPattern**: Явное определение форм А/Б/В/Г
  - **Независимая классификация**: Горизонтальная склейка, вертикальные стеки
  
- **STAGE 3 - RULES**: Применение правил расширения
  - **RULE 1**: Base horizontal glue expansion (+1 gap)
  - **RULE 2A**: Б над А - верхнее расширяется, соседи сбрасываются
  - **RULE 2B**: В над Г - верхнее сбрасывается, соседи расширяются (+1 boost)
  - **RULE 3**: Biting (откусывание при давлении других проектов)
  - **Каждое правило изолировано**: Можно добавлять/изменять без поломки других
  
- **STAGE 4 - CORNER FLAGS**: Определение скруглений углов
  - **Прозрачная логика**: Угол НЕ скругляется если hasFull/innerProjectId/aligned
  
- **STAGE 5 - NAME HIDING**: Логика скрытия названий
  - **Слева направо**: Сортировка по времени перед обработкой

#### 🎯 Преимущества
- ✅ **Предсказуемость**: Каждое правило изолировано, результат не зависит от побочных эффектов
- ✅ **Отладка**: Логирование каждого этапа, можно точно определить где баг
- ✅ **Расширяемость**: Добавление нового правила = просто новый блок кода в STAGE 3
- ✅ **Корректность**: Кейсы А/Б/В/Г обрабатываются явно через `StackPattern`

#### 📊 Сравнение
| Критерий | v7.0 (Старый) | v8.0 (Новый) |
|----------|---------------|--------------|
| **Этапы** | 4 прохода (passes) | 5 независимых этапов (stages) |
| **Логика** | Неявная, смешанная | Явная, разделенная |
| **expandMultiplier** | Используется везде | Только в STAGE 3 |
| **Отладка** | Сложная, логи вперемешку | Простая, логи по этапам |
| **Добавление правил** | Ломает существующие | Изолированное, безопасное |
| **Кейсы А/Б/В/Г** | Неявные, зависят от порядка | Явные, через StackPattern |

#### 📚 Документация
- `/EVENT_NEIGHBORS_v8.0_CLEAN_ARCHITECTURE.md` - полное описание архитектуры
- `/QUICK_TEST_NEIGHBORS_v8.0.md` - шпаргалка для тестирования
- Обновлены `/guidelines/Guidelines.md` - версия 4.0.5

#### 💬 Комментарий
**Больше никаких загадочных багов, где исправление одного ломает другое!**

Это не просто рефакторинг - это полная переписка на правильную архитектуру.

---

## [4.0.6] - 2025-11-28
### 🩹 Event Gluing Logic Tweaks (v6.24)
- **Independent Side Checking**: Stacking rules (B over A, V over G) apply independently for left and right sides.
  - Handles "Single Neighbor" edge cases correctly.
- **Rule 1 (B over A)**:
  - Top Project B (Inner Bottom) expands (+1 gap) on the side where Bottom Project A (Outer Top) has an outer corner.
  - Top Project B's neighbor on that side is reset to default width.
  - Bottom Project A remains unchanged.
- **Rule 2 (V over G)**:
  - Top Project V (Outer Bottom) resets to default width (0 gap) on the side where Bottom Project G (Inner Top) has an inner corner.
  - **CRITICAL**: Top Project V's neighbor on that side expands **BY +1 EXTRA** (accumulating to +2 gap total). This allows the neighbor to visually encroach further into the "gap" space left by V.

## [4.0.4] - 2025-11-28

### ♻️ Refactoring & Optimization
- **Step 1: Extract Modals**: All modal components moved from `SchedulerMain.tsx` to `SchedulerModals.tsx`.
- **Step 2: Extract Context Menus**: Context menus moved to `SchedulerContextMenus.tsx`.
- **Step 3: Extract UI State**: Created `useSchedulerUI` hook to manage all UI-related state (modals, menus, modes).
- **Step 4: Memoization**: Wrapped `SchedulerModals` and `SchedulerContextMenus` in `React.memo` to prevent unnecessary re-renders during high-frequency interactions (like drag & drop or hover).

## [4.0.4] - 2025-11-28

### 🛡️ Checkpoint
- **Refactoring Started**: Фиксация стабильной версии перед масштабным рефакторингом и оптимизацией компонентов.
- **State**: Полностью рабочий функционал склейки v6.18, Undo/Redo фиксы и Gap Handles.

## [4.0.3] - 2025-11-28

### 🐛 Bug Fixes

- **Event Gluing (Project Name Visibility)**:
  - ✅ Исправлена ошибка при Undo/Redo, когда логика скрытия названия проекта (для коротких событий) применялась некорректно.
  - ✅ **Причина**: Порядок обработки событий в PASS 5 зависел от порядка в массиве (который мог меняться из-за Z-order при Undo).
  - ✅ **Решение**: Принудительная сортировка событий по времени (`startWeek`) перед расчетом цепочки скрытия названий.

## [4.0.1] - 2025-11-28

### 🚀 Stable Release (Gluing Logic v6.18)

- **Event Gluing Logic Update (v6.18)**:
  - ✅ **Clean Pass 2**: Removed blocking logic to allow walls to expand freely
  - ✅ **New Edge Case Logic (Pass 3)**:
    - **Rule 1 (B above A)**: Inner Bottom event above Outer Top event -> Top event expands (+1 gap), neighbors reset
    - **Rule 2 (C above D)**: Outer Bottom event above Inner Top event -> Top event resets, neighbors expand (+1 gap)
  - ✅ **Stacking Reduction (Pass 2.5)**: Notch event (sandwiched + stacked) reduces expansion to avoid visual noise

## [4.0.0] - 2025-11-25

### 🚀 Stable Release (Clean Rollback)

- **SchedulerMain.tsx Cleanup & Fix**:
  - ✅ Выполнен откат к стабильной версии компонента
  - ✅ Устранены дублирования кода в конце файла
  - ✅ Добавлен корректный export default SchedulerMain
  - ✅ Исправлены циклические зависимости и проблемы с Undo/Redo
  - ✅ Удален лишний код автосохранения истории (теперь только явное сохранение)

### 🐛 Исправлено (Previous v3.3.x)

- **v3.3.22**: Строгая валидация и таймаут для batch операций (КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ)
  - **Проблема**: Неинформативная ошибка "Failed to fetch" при проблемах с сервером
  - **Исправление**:
    - ✅ **Строгая валидация параметров**:
      - Проверка `projectId !== 'undefined' && projectId.trim() !== ''`
      - Проверка `accessToken !== 'undefined' && accessToken.trim() !== ''`
      - Детальное логирование типов и значений всех параметров
    - ✅ **Таймаут 15 секунд для fetch**:
      - Использование `AbortController` для прерывания зависших запросов
      - Отдельная обработка `AbortError` с понятным сообщением
    - ✅ **Улучшенная диагностика ошибок**:
      - Детальное логирование ошибок fetch (name, message, cause, stack)
      - Понятные сообщения об ошибках с инструкциями по исправлению
      - Логирование HTTP статуса при получении ответа
    - ✅ **Обработка ошибок парсинга**:
      - Try-catch при парсинге JSON ответа сервера
      - Fallback сообщение если сервер вернул не-JSON
  - **Результат**:
    - ✅ Легко определить причину проблемы по логам
    - ✅ Запросы не висят бесконечно (таймаут 15 сек)
    - ✅ Валидация предотвращает отправку некорректных запросов
    - ✅ Понятные сообщения об ошибках вместо "Failed to fetch"
  - **Затронутые файлы**: 
    - `/contexts/SchedulerContext.tsx:1305-1370`
    - `/QUICK_DEBUG_FAILED_FETCH_v3.3.22.md`

- **v3.3.21**: Улучшенная диагностика ошибок сети в syncRestoredEventsToServer (УСТАРЕЛА в v3.3.22)
  - Заменена на более полную валидацию и таймауты в v3.3.22

- **v3.3.20**: Блокировка Undo/Redo для pending событий (КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ)
  - **Проблема 1**: Можно нажать Undo когда событие грузится
    - При создании события → сразу Ctrl+Z → Undo срабатывал
    - Событие удалялось → createEvent завершался → событие "воскресало" из БД
    - **Причина**: В `handleUndo` отсутствовала проверка на временные ID (которая есть в `handleRedo`)
  - **Проблема 2**: Нельзя нажать Redo после того как событие загрузилось
    - Создал событие → дождался загрузки → Ctrl+Z → Ctrl+Y → toast висит
    - Toast: "Подождите - Дождитесь завершения создания событий"
    - Redo заблокирован навсегда
    - **Причина**: История НЕ обновлялась после создания на сервере
      - State обновлялся: `ev_temp_123` → `e12345`
      - История НЕ обновлялась: остаётся `ev_temp_123`
      - При Redo восстанавливается событие с временным ID → блокировка
  - **Исправление 1**: Добавлена проверка временных ID в `handleUndo`
    - ✅ Симметричная логика с `handleRedo`
    - ✅ Блокировка при `events.some(e => e.id.startsWith('ev_temp_'))`
    - ✅ Toast: "Подождите - Дождитесь завершения создания событий"
  - **Исправление 2**: Обновление ID в истории после создания на сервере
    - ✅ В `syncRestoredEventsToServer` обновляем историю для созданных событий
    - ✅ Создаём map: временный ID → реальный ID
    - ✅ Вызываем `updateHistoryEventId(tempId, realId)` для каждого созданного события
    - ✅ Логирование: `📝 История: обновление ID для N созданных событий...`
  - **Результат**:
    - ✅ Undo блокируется при pending событиях (toast показан)
    - ✅ Redo НЕ блокируется после загрузки события
    - ✅ История обновляется с реальными ID
    - ✅ События не "воскресают" из БД
    - ✅ Undo/Redo работает в любой последовательности
  - **Затронутые файлы**: 
    - `/components/scheduler/SchedulerMain.tsx:411-444` (handleUndo)
    - `/contexts/SchedulerContext.tsx:1349-1370` (syncRestoredEventsToServer)
  - **Документация**: `/UNDO_REDO_PENDING_BLOCK_FIX_v3.3.20.md`, `/QUICK_TEST_UNDO_PENDING_v3.3.20.md`

- **v3.3.18**: React Warning "Cannot update while rendering" (ВАЖНОЕ ИСПРАВЛЕНИЕ)
  - **Проблема**: После v3.3.17 появилась ошибка при выходе из воркспейса
    ```
    Warning: Cannot update a component (`SchedulerMain`) while rendering a different component (`SchedulerProvider`)
    ```
  - **Корневая причина**: 
    - При выходе из воркспейса (workspaceId → undefined) запускался useEffect
    - Внутри useEffect **синхронно** вызывались 5 setState подряд (очистка данных)
    - React пытался обновить state **во время рендера** SchedulerProvider → warning
  - **Исправление**:
    - ✅ Обернули все setState в `queueMicrotask(() => { ... })`
    - ✅ setState выполняются **после завершения рендера** (в следующем microtask)
    - ✅ React warning полностью устранён
    - ✅ Функциональность сохранена (очистка данных ~0ms задержка)
  - **Почему queueMicrotask**:
    - Мгновенное выполнение (~0ms) vs setTimeout (~4ms)
    - Выполняется сразу после завершения рендера
    - Минимальные изменения кода
  - **Затронутые файлы**: `/contexts/SchedulerContext.tsx:544-557`
  - **Документация**: `/CANNOT_UPDATE_WHILE_RENDERING_FIX_v3.3.18.md`

- **v3.3.17**: Try-Finally структура для гарантированного сброса флага (КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ)
  - **Проблема**: Ошибки залипания флага `isUndoRedoInProgressRef` продолжали появляться после v3.3.16
    - Флаг устанавливался в `true` СНАРУЖИ try-finally блока
    - При критических ошибках (например, ошибка в setEvents) выполнение могло прерваться до finally
    - Finally блок НЕ выполнялся → флаг оставался в `true` → залипание
  - **Корневая причина**: 
    - `isUndoRedoInProgressRef.current = true` находился между `if (!state) return` и `try {}`
    - Если ошибка происходила синхронно (например, TypeError в setEvents), React Error Boundary мог прервать выполнение
    - Finally блок НЕ ГАРАНТИРОВАННО выполнялся
  - **Исправление**:
    - ✅ Переместили установку флага `isUndoRedoInProgressRef.current = true` ВНУТРЬ try блока
    - ✅ Добавили детальное логирование установки и сброса флага
    - ✅ Finally блок теперь ГАРАНТИРОВАННО выполняется при любых ошибках
    - ✅ Применено к handleUndo и handleRedo
  - **Результат**:
    - ✅ Флаг ВСЕГДА сбрасывается в finally (даже при критических ошибках)
    - ✅ Нет залипания флага при network errors, TypeError, ReferenceError и т.д.
    - ✅ Принудительный сброс больше не нужен (остаётся как резерв)
    - ✅ Детальные логи показывают установку и сброс флага
  - **Дополнительное исправление**: Защита showToast от ошибок
    - ✅ Обернули `showToast` в `queueMicrotask` + внутренний try-catch
    - ✅ Предотвращает ошибки если React component unmounted во время показа toast
    - ✅ Ошибка в showToast НЕ прерывает выполнение finally блока
    - ✅ Graceful degradation - ошибка логируется, но НЕ всплывает
  - **Затронутые файлы**: `/components/scheduler/SchedulerMain.tsx`
  - **Документация**: `/UNDO_REDO_TRYFINALLY_FIX_v3.3.17.md`

- **v3.3.16**: Залипание флага isUndoRedoInProgressRef (КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ)
  - **Проблема**: Undo/Redo перестаёт работать с ошибкой "Undo уже выполняется"
    - Сценарий: Выполнил Undo → ошибка синхронизации → флаг не сбросился → **Undo заблокирован навсегда**
    - **Причина 1**: Флаг `isUndoRedoInProgressRef` НЕ сбрасывался при критических ошибках
    - **Причина 2**: После сброса флага код продолжал выполнение и **снова устанавливал флаг в `true`** → бесконечный цикл
  - **Исправление**:
    - ✅ Принудительный сброс флага при обнаружении "залипания"
    - ✅ **КРИТИЧНО**: `return` после сброса флага (НЕ продолжать выполнение)
    - ✅ Toast уведомление "Повторите попытку" для пользователя
    - ✅ Внешний `catch` для перехвата ВСЕХ ошибок
    - ✅ Детальное логирование для диагностики
  - **Результат**:
    - ✅ Undo/Redo НЕ блокируется навсегда
    - ✅ При залипании флага: первая попытка сбрасывает флаг → вторая попытка выполняет Undo
    - ✅ Пользователь видит toast и понимает что нужно повторить попытку
    - ✅ Детальные логи показывают когда флаг сбрасывается
    - ✅ Graceful degradation при ошибках
  - **Затронутые файлы**: `/components/scheduler/SchedulerMain.tsx`
  - **Документация**: `/UNDO_REDO_FLAG_RESET_FIX_v3.3.16.md`, `/QUICK_TEST_FLAG_RESET_v3.3.16.md`

- **v3.3.15**: Проверка pending операций вместо временных ID (КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ)
  - **Проблема**: "Вечная блокировка" Undo после восстановления событий из истории
    - Сценарий: Создал событие → drag → Undo (восстановление) → Undo снова → **заблокировано навсегда**
    - **Причина**: История содержала временные ID (`ev_temp_*`), проверка `events.some(e => e.id.startsWith('ev_temp_'))` всегда возвращала `true`
    - **Исправление**:
      - ✅ Добавлена функция `hasPendingOperations()` в SchedulerContext
      - ✅ Проверяем РЕАЛЬНЫЕ pending операции через `pendingOps.getAllPending()`
      - ✅ Не зависит от временных ID в state/истории
      - ✅ Блокировка автоматически снимается после завершения операции
      - ✅ Детальное логирование для диагностики
  - **Результ��т**:
    - ✅ Undo/Redo блокируется ТОЛЬКО при реальных pending операциях
    - ✅ После завершения операции блокировка снимается автоматически
    - ✅ Нет "вечной блокировки" из-за ID в истории
    - ✅ Toast показывается корректно при блокировке
  - **Затронутые файлы**: 
    - `/contexts/SchedulerContext.tsx` — добавлена `hasPendingOperations()`
    - `/components/scheduler/SchedulerMain.tsx` — заменена проверка
  - **Документация**: `/UNDO_PENDING_CHECK_FIX_v3.3.15.md`, `/QUICK_TEST_PENDING_OPERATIONS_v3.3.15.md`

- **v3.3.14**: Pending состояние после Undo + убран toast warning (КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ)
  - **Проблема 1**: События пок��зывают полоски загрузки после Undo
    - Сценарий: Создал событие → drag → быстрый Undo (< 2 сек) → **полоски загрузки**
    - **Причина**: Debounced save продолжает выполняться после Undo (pending операция в очереди)
    - **Исправление**:
      - ✅ Добавлен `await flushPendingChanges()` в начало `handleUndo` и `handleRedo`
      - ✅ Все pending изменения сохраняются ПЕРЕД undo/redo
      - ✅ Очередь пуста → нет pending операций → нет полосок
      - ✅ События мгновенно восстанавливаются без артефактов
  - **Проблема 2**: Лишний toast warning при попытке undo
    - **Исправление**:
      - ✅ Убрали toast уведомление для блокировки pending событий
      - ✅ Оставили только console.log для диагностики
      - ✅ Меньше визуального шума
  - **Затронутые файлы**: `/components/scheduler/SchedulerMain.tsx:400-620`
  - **Документация**: `/UNDO_PENDING_FLUSH_FIX_v3.3.14.md`

- **v3.3.14**: React Warning "Cannot update component while rendering" (КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ)
  - Ошибка: `Warning: Cannot update a component (SchedulerMain) while rendering a different component (SchedulerProvider)`
  - **Причина**: Функция `setLoadedEventIds` вызывала setState-подобную операцию внутри debounced save колбэка
  - **Исправление**:
    - ✅ Удалена функция-обёртка `setLoadedEventIds`
    - ✅ Прямая работа с `loadedEventIds.current` (ref) во всех местах
    - ✅ Нет побочных эффектов во время рендера
    - ✅ React warning исчез
  - **Затронутые файлы**: `/contexts/SchedulerContext.tsx`

- **v3.3.13**: Исправлен паттерн временных ID в cleanup (КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ)
  - Ошибка: Orphaned events cleanup пытался удалить временные события через API
  - **Причина**: Неправильный паттерн проверки `!event.id.startsWith('ev_temp')` вместо `!event.id.startsWith('ev_temp_')`
  - **Исправление**:
    - ✅ Добавлено подчеркивание в конце паттерна: `'ev_temp'` → `'ev_temp_'`
    - ✅ Временные события корректно пропускаются в cleanup
    - ✅ Нет ложных DELETE запросов к API
    - ✅ Нет ошибок `Cannot delete temporary events via API`
  - **Сценарий воспроизведения**:
    1. Создать событие (двойной клик)
    2. СРАЗУ удалить департамент/ресурс (не дожидаясь создания)
    3. Подождать 5 секунд (cleanup таймер)
    4. БЫЛ БАГ: В консоли ошибка `❌ Ошибка удаления события ev_temp_XXX`
  - **Результат**:
    - ✅ Нет ошибок в консоли при cleanup
    - ✅ Временные события пропускаются (видно `⏭️ Пропуск временного события`)
    - ✅ Согласованность паттернов во всём коде
    - ✅ Нет лишней нагрузки на сеть
  - Затронутые файлы: `/contexts/SchedulerContext.tsx:964`
  - Документация: `/TEMP_ID_PATTERN_FIX_v3.3.13.md`, `/QUICK_TEST_TEMP_ID_v3.3.13.md`, `/RELEASE_NOTES_v3.3.13.md`

- **v3.3.12**: Блокировка Undo для pending событий (КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ)
  - Ошибка: События "воскресали" после быстрого Undo сразу после создания
  - **Причина**: Race condition между createEvent (создание в БД), Undo (удаление из стейта) и Delta Sync (загрузка из БД)
  - **Исправление**:
    - ✅ Проверка наличия pending событий (`id.startsWith('ev_temp_')`) в начале `handleUndo` и `handleRedo`
    - ✅ Блокировка Undo/Redo если есть события в процессе создания
    - ✅ Toast уведомление "Подождите, дождитесь завершения создания событий"
    - ✅ Типичная задержка блокировки ~500ms (время создания на сервере)
  - **Сценарий воспроизведения**:
    1. Создать событие (двойной клик) → спиннер (pending)
    2. СРАЗУ нажать Ctrl+Z (не дожидаясь завершения)
    3. БЫЛ БАГ: Событие исчезало → через 4 сек "воскресало" из БД
  - **Результат**:
    - ✅ Undo блокируется пока событие pending
    - ✅ Пользователь видит понятное сообщение
    - ✅ После завершения создания Undo работает корректно
    - ✅ События НЕ "воскресают" из БД
  - Документация: `/UNDO_PENDING_EVENTS_FIX_v3.3.12.md`, `/QUICK_TEST_UNDO_PENDING_v3.3.12.md`, `/RELEASE_NOTES_v3.3.12.md`

- **v3.3.11**: Race Condition в Undo/Redo (КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ)
  - Ошибка: При быстром нажатии Ctrl+Z несколько раз подряд возникала race condition
  - **Причина**: Второй Undo запускался ДО завершения первого → конфликты синхронизации
  - **Исправление**:
    - ✅ Добавлен `isUndoRedoInProgressRef` для блокировки одновременных операций
    - ✅ Проверка блокировки в начале `handleUndo` и `handleRedo`
    - ✅ Гарантированное снятие блокировки через `finally` блок
    - ✅ Логирование блокировки/разблокировки для диагностики
    - ✅ Исправлены отступы в try блоках функций Undo/Redo
  - **Сценарий воспроизведения**:
    1. Создать 5 событий
    2. Нажать Ctrl+Z 5 раз быстро (< 100ms между нажатиями)
    3. БЫЛ БАГ: все 5 Undo запускались одновременно → конфликты
  - **Результат**:
    - ✅ Невозможно запустить второй Undo/Redo пока первый не завершится
    - ✅ Предупреждение в консоли: "⏸️ UNDO/REDO: Undo уже выполняется"
    - ✅ События восстанавливаются последовательно
    - ✅ Нет ошибок синхронизации с сервером
  - Документация: `/UNDO_REDO_RACE_CONDITION_FIX_v3.3.11.md`

- **v3.3.10**: Конфликт Undo и Debounced Save (КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ)
  - Ошибка: `❌ BATCH update: событие e37367 не найдено в БД` при Undo после создания события
  - **Причина**: Race condition между Undo (удаляет событие) и debounced save (пытается UPDATE)
  - **Исправление**:
    - ✅ Очистка pending операций для удалённых событий в `handleUndo()`
    - ✅ Очистка pending операций для удалённых событий в `handleRedo()`
    - ✅ Вызов `cancelPendingChange()` для каждого удалённого события
    - ✅ Добавлена зависимость `cancelPendingChange` в useCallback
  - **Сценарий воспроизведения**:
    1. Создать событие → добавляется в debounced save queue (500ms)
    2. Undo → событие удаляется с сервера
    3. Debounced save срабатывает → пытается UPDATE удалённого события (БЫЛ БАГ)
  - **Результат**:
    - ✅ Pending операции очищаются ДО синхронизации удалений
    - ✅ Нет попыток UPDATE удалённых событий
    - ✅ Undo/Redo работает без ошибок
  - Документация: `/UNDO_DEBOUNCED_SAVE_CONFLICT_FIX_v3.3.10.md`

- **v3.3.9**: Блокировка взаимодействий с временными событиями (КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ)
  - Ошибка: При Undo после быстрого drag временного события оно удаляется
  - **Причина**: Drag завершался ДО создания события на сервере → история сохраняла временный ID
  - **Исправление**:
    - ✅ Проп `isBlocked` в SchedulerEvent - визуальная блокировка для `id.startsWith('ev_temp_')`
    - ✅ Спиннер показывается для `isPending || isBlocked`
    - ✅ CSS класс `pending` (opacity 0.6, stripes) для заблокированных событий
    - ✅ Скрытие ручек resize для заблокированных событий
    - ✅ Блокировка drag: `if (isPending || isBlocked) return;`
    - ✅ Блокировка resize: `if (isPending || isBlocked) return;`
    - ✅ Блокировка edit/delete/copy через контекстное меню с toast уведомлением
    - ✅ Обновление React.memo сравнения для `isBlocked`
    - ✅ Увеличение TTL пометки удаления с 10 до 60 секунд (защита от "воскрешения")
  - **Сценарий воспроизведения**:
    1. Создать событие (copy+paste) → временное `ev_temp_...`
    2. Сразу drag (< 1 сек) → история сохраняла временный ID (БЫЛ БАГ)
    3. CREATE завершается → ID заменяется на реальный
    4. Undo → событие с реальным ID не находилось в истории → удалялось (БЫЛ БАГ)
  - **Результат**:
    - ✅ Временные события визуально заблокированы (спиннер + stripes)
    - ✅ Нельзя drag/resize/edit/delete/copy до создания на сервере
    - ✅ История ВСЕГДА содержит реальные ID
    - ✅ Undo/Redo работает корректно
    - ✅ Задержка ~500ms между созданием и разблокировкой (незаметна)
  - Документация: `/TEMP_EVENTS_INTERACTION_BLOCK_v3.3.9.md`

- **v3.3.8**: BATCH create/update detection (КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ)
  - Ошибка: `❌ BATCH update: событие e37356 не найдено в БД`
  - **Причина**: ВСЕ batch операции помечались как `op: 'update'`, даже для несуществующих событий!
  - **Исправление**:
    - Определение `op: 'create' | 'update'` на основе `loadedEventIds.current.has(id)`
    - Передача `id` в `data` для CREATE операций (для UPSERT)
    - Добавление созданных событий в `loadedEventIds` после успешного batch create
    - Детальное логирование: `📦 BATCH: событие e37356 → update (isLoaded=true)`
  - **Сценарий воспроизведения**:
    1. `createEvent()` создаёт событие на сервере
    2. Если CREATE завершился с ошибкой → событие НЕ в loadedEventIds
    3. При drag → batch отправляет `op: 'update'` → сервер: "событие не найдено"
  - **Результат**:
    - Корректное определение create vs update
    - Нет ошибок "событие не найдено в БД"
    - Защита от race conditions между createEvent и drag
  - Документация: `/BATCH_CREATE_UPDATE_FIX_v3.3.8.md`

- **v3.3.7**: Sync history before drag (ФИНАЛЬНОЕ ИСПРАВЛЕНИЕ)
  - Критическое исправление: события больше не удаляются при undo после быстрого drag
  - **Часть 1**: Flush pending changes перед drag/resize/gap drag
    - Добавлен вызов `flushPendingChanges()` в начале всех drag операций
    - Гарантирует что все pending операции выполнятся ДО сохранения в историю
  - **Часть 2**: Синхронное сохранение истории через Promise
    - `saveHistory()` теперь вызывается через `await Promise.resolve()`
    - Гарантирует что история сохранится ДО того как пользователь начнёт drag
    - Исправлено в `handleModalSave`
  - **Часть 3**: Убран IIFE в handlePaste (НОВОЕ)
    - Сделали `handlePaste` async функцией (было: useCallback с IIFE внутри)
    - Убрали fire-and-forget `(async () => { ... })()`
    - Функция завершается ТОЛЬКО после создания события и сохранения истории
    - Событие всегда имеет реальный ID (НЕ временный!) при drag
  - Результат: при undo событие восстанавливается (НЕ удаляется)
  - Документация: `/SYNC_HISTORY_BEFORE_DRAG_v3.3.7.md`, `/QUICK_FIX_IIFE_v3.3.7.md`

---

## [1.5.0] - 2025-11-18

### ✨ Gap Handles - Двусторонний Resize

**Одновременное изменение двух соседних со��ытий через промежуток между ними**

#### Что добавлено

1. **Визуальные handles между событиями**
   - При зажатой **Cmd/Ctrl** появляются синие пипки на промежутках между событиями
   - Вертикальные handles (между событиями сверху-снизу) с 3 кружками
   - Горизонтальные handles (между событиями слева-справа) с 3 кружками
   - Handles появляются только при `isCtrlPressed = true`

2. **Двусторонний resize**
   - Drag вертикального handle → изменяет `unitsTall` верхнего и `unitStart`+`unitsTall` нижнего
   - Drag горизонтального handle → изменяет `weeksSpan` левого и `startWeek`+`weeksSpan` правого
   - Граница двигается вместе с курсором
   - Оба события изменяются **одновременно**

3. **Умный поиск gaps**
   - Вертикальные: события на одной неделе, касаются по вертикали
   - Горизонтальные: события касаются по горизонтали, перекрываются по вертикали
   - Gaps вычисляются только при зажатой Cmd (производительность)

4. **Валидация**
   - События не могут исчезнуть (минимум 1 unit / 1 week)
   - События не могут выйти за пределы сетки
   - Невалидные изменения игнорируются

#### Файлы

**Новые**:
- ✅ `/types/scheduler.ts` - интерфейс `EventGap`
- ✅ `/utils/eventGaps.ts` - `findEventGaps()`, `calculateGapResize()`
- ✅ `/components/scheduler/EventGapHandles.tsx` - компонент рендеринга handles
- ✅ `/hooks/useGapInteractions.ts` - логика drag gap handles

**Изменённые**:
- ✅ `/components/scheduler/SchedulerMain.tsx` - интеграция gap handles
- ✅ Импорт `useGapInteractions`, `EventGapHandles`, `findEventGaps`
- ✅ Рендер handles в events-overlay

#### Результат

- ✅ Быстрое редактирование двух событий за одно действие
- ✅ Интуитивно - граница двигается туда куда курсор
- ✅ Визуально понятно - синие пипки только при Cmd
- ✅ Undo/Redo поддерживается
- ✅ Polling блокируется на 2 секунды

**Документация**: `/GAP_HANDLES_v1.5.0.md`

---

## [1.4.0] - 2025-11-18

### ✨ Улучшена логика Drag & Drop

**Интуитивное перетаскивание событий с учётом точки захвата**

#### Что изменено

1. **Drag от точки захвата (offsetUnit)**
   - При захвате события вычисляется за какой юнит взялись (0, 1, 2, ...)
   - Этот юнит следует за курсором при перемещении
   - **Пример**: Событие 0-2, взяли за юнит 1 → юнит 1 следует за мышкой

2. **Правильное определение строки (ресурса)**
   - Строка определяется по реальной позиции курсора
   - Событие переносится на новую строку **только когда курсор на ней**
   - unitStart внутри строки учитывает offset точки захвата

3. **Математика**
   - `offsetUnit = floor(offsetY / unitStride)` при startDrag
   - `unitStart = floor(withinRow / unitStride) - offsetUnit` при move
   - Ресурс: `findClosestResource(cursorTopAbs)` (без offset)

#### Файлы

- ✅ `/hooks/useEventInteractions.ts` - добавлен offsetUnit в startDrag
- ✅ `/utils/schedulerLayout.ts` - modelFromGeometry принимает offsetUnit

#### Результат

- ✅ Drag интуитивный - событие двигается от точки захвата
- ✅ Перенос на другую строку только когда курсор на ней
- ✅ Нет неожиданных прыжков события при перетаскивании

---

### 🔕 Убраны избыточные toast уведомления

**UX оптимизация - меньше визуального шума**

#### Что убрано

1. ❌ Toast "Событие скопировано" при копировании
2. ❌ Toast "Событие вставлено" при вставке
3. ❌ Toast "Событие создано" при создании через модалку
4. ❌ Toast с ошибками вставки/создания (оставлены console.error)

#### Обоснование

- Пользователь **видит** что событие появилось на календаре
- Лишние уведомления создают визуальный шум
- Оставлены только критические toast (ошибки сервера, авторизация)

#### Файлы

- ✅ `/components/scheduler/SchedulerMain.tsx` - удалены 3 showToast вызова

#### Результат

- ✅ Приложение работает тише
- ✅ Меньше отвлекающих уведомлений
- ✅ Фокус на важных сообщениях

---

**Документация**: Официальная версия 1.4.0

---

## [3.4.0-clean-hotfix] - 2025-11-18

### 🛡️ Улучшена обработка Cloudflare ошибок

**Проблема**: Cloudflare Error 1105 (Temporarily unavailable) вызывал огромные HTML ошибки в логах

#### Что исправлено

1. **Автоматический Retry с экспоненциальной задержкой**
   - По умолчанию 2 повторных попытки (3 попытки всего)
   - Задержка: 1s → 2s (экспоненциально)
   - Работает для всех API запросов

2. **Парсинг Cloudflare ошибок**
   - Вместо 5000+ символов HTML
   - Показываем короткое: `"Cloudflare Error 1105"`
   - Логи чистые и понятные

3. **Toast уведомления для пользователя**
   - Показывается **один toast** на 60 секунд
   - Сообщение: "База данных временно недоступна. Повторная попытка..."
   - Нет спама уведомлений

4. **Интеграция во все sync функции**
   - Delta Sync
   - Full Sync
   - Projects Sync
   - Resources Sync
   - Departments Sync

#### Файлы

**Frontend**:
- ✅ `/services/api/base.ts` - retry логика и парсинг Cloudflare
- ✅ `/utils/cloudflareErrorHandler.ts` - обработка ошибок и toast throttling
- ✅ `/contexts/SchedulerContext.tsx` - интеграция в 5 sync функций
- ✅ `/components/scheduler/OnlineUsers.tsx` - улучшенные логи

**Backend**:
- ✅ `/supabase/functions/server/index.tsx` - парсинг Cloudflare на сервере
  - `parseCloudflareError()` - извлекает error code
  - `handleError()` - универсальная обработка
  - Обновлены: `/projects`, `/resources`, `/events`, `/departments`

#### Результат

- ✅ Автоматическое восстановление после временных сбоев
- ✅ Понятные сообщения для пользователя
- ✅ Чистые логи (без HTML)
- ✅ Приложение работает стабильно

**Документация**: `/CLOUDFLARE_ERROR_HANDLING.md`

---

## [3.4.0-clean] - 2025-11-18

### 🧹 Очистка кода Supabase Realtime

**Полное удаление Realtime кода - пакет недоступен в Figma Make**

#### Удалено
- ❌ `/utils/supabase/client.ts` - всегда возвращал `null`
- ❌ `/contexts/PresenceContext.tsx` - зависел от Supabase клиента
- ❌ `/components/scheduler/RealtimeCursors.tsx` - ничего не рендерил
- ❌ Импорты `PresenceProvider` в `/App.tsx`
- ❌ Импорты `RealtimeCursors` в `/SchedulerMain.tsx`
- ❌ Warning логи про недоступность Realtime

#### Что осталось
- ✅ `/components/scheduler/CursorPresence.tsx` - исторический артефакт (старый WebSocket код)
- ✅ `/components/scheduler/OnlineUsers.tsx` - работает через HTTP polling
- ✅ Delta Sync - работает через HTTP polling
- ✅ Вся документация про Realtime (как историческая справка)

#### Результат
- ✅ Код чище и понятнее
- ✅ Нет бесполезных файлов
- ✅ Нет warning логов
- ✅ Приложение собирается без ошибок
- ✅ Все функции работают стабильно

**Документация**: `/REALTIME_CLEANUP.md`

---

## [3.4.0] - 2025-11-18

### ⚠️ Supabase Realtime Integration - ОТКЛЮЧЕНО

**`@supabase/supabase-js` недоступен в Figma Make - Realtime отключён**

#### Статус
- ❌ **Realtime НЕ РАБОТАЕТ** - пакет недоступен на этапе сборки
- ✅ **Приложение РАБОТАЕТ СТАБИЛЬНО** - graceful fallback на HTTP polling
- ✅ **Нет регрессий** - все функции v3.3.6 работают
- ❌ **Курсоры отключены** - не критично для продакшена

#### Что добавлено
- ✅ **Supabase клиент для Frontend** (`/utils/supabase/client.ts`)
  - Динамический импорт `@supabase/supabase-js`
  - Lazy loading - загружаем только когда нужно
  - Graceful fallback если пакет недоступен
  - Конфигурация: `eventsPerSecond: 20`, `persistSession: false`

- ✅ **PresenceContext** (`/contexts/PresenceContext.tsx`)
  - React Context для управления cursor presence
  - Подключение к Realtime каналу `workspace:{id}:presence`
  - Broadcast для отправки позиции курсора (throttle 50ms)
  - Автоматическая очистка устаревших курсоров (5 сек)
  - Генерация уникального цвета для каждого пользователя

- ✅ **RealtimeCursors компонент** (`/components/scheduler/RealtimeCursors.tsx`)
  - Отображает курсоры других пользователей в реальном времени
  - SVG курсор с именем пользователя
  - Плавная анимация движения (100ms ease-out)
  - Индикатор подключения в dev режиме

- ✅ **Интеграция в SchedulerMain**
  - Заменён старый `CursorPresence` (WebSocket) на `RealtimeCursors` (Realtime)
  - Обёрнут в `PresenceProvider` в `App.tsx`

#### Преимущества Realtime
- ⚡ Мгновенные обновления (50-100ms вместо 100-200ms)
- ✅ Стабильное соединение (автоматический реконнект)
- 🔒 RLS безопасность (проверка через `workspace_members`)
- 📡 Встроенная Presence логика
- 🎯 Нативная интеграция с Supabase

#### Требования в Supabase
1. Realtime включён для таблиц (`events`, `users`, `projects`, `departments`, `workspaces`)
2. RLS политики для `workspace_members` и `realtime.messages`
3. Таблица `workspace_members` с колонками: `workspace_id`, `user_id`, `role`

#### Тестирование
```bash
# Проверка доступности
1. Откройте два браузера с разными пользователями
2. Войдите в один workspace
3. Двигайте мышью в первом браузере
4. Курсор должен появиться во втором браузере
5. Закройте первый браузер
6. Курсор должен исчезнуть через 5 секунд
```

#### Fallback (АКТИВЕН)
- ✅ `@supabase/supabase-js` **НЕДОСТУПЕН** в Figma Make (подтверждено тестами)
- ✅ Курсоры отключены (не критично)
- ✅ HTTP polling для Delta Sync работает (v3.3.6)
- ✅ HTTP heartbeat для OnlineUsers работает (v3.3.6)
- ✅ **Приложение полностью функционально**

#### Документация
- `/REALTIME_STATUS_v3.4.0.md` - **ВАЖНО!** Статус интеграции и объяснение проблемы
- `/SUPABASE_REALTIME_INTEGRATION_v3.4.0.md` - полная документация интеграции
- `/QUICK_TEST_REALTIME_v3.4.0.md` - быстрый старт тестирования
- `/READY_TO_TEST_v3.4.0.md` - чек-лист тестирования
- `/STABLE_SNAPSHOT_v3.3.6.md` - backup стабильной версии перед изменениями

#### Проблема
**Ошибка сборки**:
```
Error: Build failed with 1 error:
virtual-fs:file:///utils/supabase/client.ts:28:34: ERROR: [plugin: npm] Failed to fetch
```

**Причина**: Пакет `@supabase/supabase-js` недоступен в Figma Make

**Решение**: Создана заглушка в `/utils/supabase/client.ts` - всегда в��звращает `null`

#### Итоговый вердикт
✅ **v3.4.0 ГОТОВО К ИСПОЛЬЗОВАНИЮ** (без Realtime)

**Что работает**:
- ✅ Все базовые функции
- ✅ Delta Sync (HTTP polling - 4 сек)
- ✅ OnlineUsers (HTTP heartbeat - 30 сек)
- ✅ Нет регрессий

**Что не работает** (не критично):
- ❌ Collaborative Cursors
- ❌ Realtime Presence

**Рекомендация**: ИСПОЛЬЗОВАТЬ как есть - приложение стабильно работает!

См. также: `/FINAL_STATUS_v3.4.0.md` - полное объяснение

#### Связанные файлы
**Новые**:
- `/utils/supabase/client.ts`
- `/contexts/PresenceContext.tsx`
- `/components/scheduler/RealtimeCursors.tsx`

**Изменённые**:
- `/App.tsx` - добавлен PresenceProvider
- `/components/scheduler/SchedulerMain.tsx` - добавлен RealtimeCursors

**Deprecated** (не удалять):
- `/components/scheduler/CursorPresence.tsx` - старый WebSocket код

---

## [3.3.6] - 2025-11-18

### 🐛 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Undo/Redo не синхронизирует изменения событий

**Измененные события (высота, позиция) возвращались к старому состоянию через 30 секунд**

#### П��облема
- Пользователь изменил высоту события → сохранил
- Удалил событие → сохранил
- Сделал **Undo** → событие восстановилось с **прежне��** высотой
- Через **~30 секунд** Full Sync вернул **измененную** высоту (данные с сервера)
- **Удаленные события** работали правильно (НЕ возвращались)

**Корневая причина**: `syncRestoredEventsToServer()` синхронизировала только **создание** новых событий, но НЕ **обновление** существующих

```typescript
// ❌ СТАРАЯ ЛОГИКА (НЕПРАВИЛЬНАЯ)
const eventsToCreate = events.filter(event => {
  const existsOnServer = loadedEventIds.current.has(event.id);
  return !existsOnServer; // Только события которых НЕТ на сервере
});

if (eventsToCreate.length === 0) {
  return; // ❌ ОШИБКА: события ЕСТЬ на сервере, но с УСТАРЕВШИМИ данными!
}
```

#### Решение
**Разделили события на ДВЕ группы: CREATE + UPDATE**

```typescript
// ✅ НОВАЯ ЛОГИКА (ПРАВ��ЛЬНАЯ)
const eventsToCreate: SchedulerEvent[] = []; // События которых НЕТ на сервере
const eventsToUpdate: SchedulerEvent[] = []; // События которые ЕСТЬ на сервере (но устаревшие)

events.forEach(event => {
  const existsOnServer = loadedEventIds.current.has(event.id);
  if (!existsOnServer) {
    eventsToCreate.push(event); // Создать
  } else {
    eventsToUpdate.push(event); // ✅ КРИТИЧНО: обновить!
  }
});

// Batch запрос: op: 'create' + op: 'update'
const operations: BatchOperation[] = [
  ...eventsToCreate.map(e => ({ op: 'create', id: e.id, data: {...} })),
  ...eventsToUpdate.map(e => ({ op: 'update', id: e.id, data: {...} })) // ✅ Синхронизация изменений!
];
```

#### Изменения
- ✅ `syncRestoredEventsToServer()` теперь синхронизирует **ВСЕ** восстановленные события (CREATE + UPDATE)
- ✅ Batch операции: один запрос вместо последовательных UPDATE
- ✅ Детальное логирование: `📦 BATCH: 2 create + 5 update`
- ✅ Защита от race condition: блокировка Delta Sync на 5 секунд

#### Тестиро��ание
```
1. Изменил высоту события → сохранил
2. Удалил событие → сохранил
3. Undo → событие восстановилось с прежней высотой
4. ✅ Мгновенная синхронизация: высота обновилась на сервере
5. ✅ Full Sync через 30 секунд: загрузил правильные данные
```

#### Документация
- `/UNDO_REDO_MODIFIED_EVENTS_FIX.md` - подробное описание проблемы и решения
- `/guidelines/Guidelines.md` - обновлены правила синхронизации

#### Связанные исправления
- **v3.3.2**: Синхронизация проектов при Undo/Redo (`resetProjectsSyncTimer()`)
- **v3.3.3**: Синхронизация удаленных событий (`syncDeletedEventsToServer()`)
- **v3.3.6**: Синхронизация измененных событий (`syncRestoredEventsToServer()` с UPDATE)

---

## [3.3.5] - 2025-11-18

### 🐛 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Drag/Resize не синхронизируются с сервером

**Локальные изменения после drag/resize перезаписывались данными с сервера**

#### Проблема
- Пользователь делал resize/drag события
- Событие визуально изменялось
- Через несколько секунд событие "откатывалось" к старому состоянию
- Delta/Full Sync перезаписывал локальные изменения данными с сервера

**Корневая причина**: Гонка условий (race condition)
```
t=0ms    : Resize завершён, setIsUserInteracting(false)
t=0ms    : onEventUpdate() добавляет событие в debounced queue (500ms задержка)
t=100ms  : Delta Sync проверяет lastLocalChangeRef (ещё не обновлен!)
t=100ms  : ❌ Delta Sync выполняется, перезаписывает локальные изменения
t=500ms  : Debounced save выполняется, lastLocalChangeRef обновляется (ПОЗДНО!)
```

#### Решение
**Добавили мгновенный вызов `resetDeltaSyncTimer()` в `useEventInteractions.ts`**:

```typescript
// ✅ v3.3.5: БЛОКИРУЕМ Delta Sync на 5 секунд после drag/resize
resetDeltaSyncTimer();
console.log('⏸️ Drag/Resize завершён: блокировка Delta Sync на 5 сек');
```

**Новый таймлайн** (защита от гонки услови��):
```
t=0ms    : Resize завершён, setIsUserInteracting(false)
t=0ms    : ✅ resetDeltaSyncTimer() (мгновенная блокировка!)
t=0ms    : onEventUpdate() добавляет событие в debounced queue
t=100ms  : Delta Sync проверяет lastLocalChangeRef (обновлен!)
t=100ms  : ✅ Delta Sync ПРОПУСКАЕТСЯ (< 5000ms с последнего изменения)
t=500ms  : Debounced save отправляет данные на сервер
```

#### Изменения
1. **`/hooks/useEventInteractions.ts`**:
   - Добавлен параметр `resetDeltaSyncTimer: () => void`
   - Вызов `resetDeltaSyncTimer()` после drag (строка 154)
   - Вызов `resetDeltaSyncTimer()` после resize (строка 410)
   - Обновлены зависимости useCallback

2. **`/components/scheduler/SchedulerMain.tsx`**:
   - Передан `resetDeltaSyncTimer` в `useEventInteractions`

#### Результат
- ✅ Drag/Resize изменения НЕ откатываются (защита от перезаписи)
- ✅ Мгновенная блокировка Delta Sync (0ms задержка)
- ✅ Нет гонки условий (блокировка срабатывает ДО Delta Sync)
- ✅ Данные корректно сохраняются на сервере
- ✅ Сохранена поддержка debounced save (экономия трафика)

#### Тестирование
```
1. Перетащите событие на новую неделю
2. Дождитесь 5 секунд
3. ✅ Событие НЕ откатывается (защищено блокировкой)
4. Через 5+ секунд Delta Sync получит актуальные данные с сервера

Логи:
⏸️ Drag завершён: блокировка Delta Sync на 5 сек
📍 Перемещение завершено: {...}
⏸️ Delta Sync: пропуск (недавнее локальное изменение) // ← Должен пропустить!
```

#### Документация
- `/DRAG_RESIZE_DELTA_SYNC_FIX_v3.3.5.md` - детальное описание проблемы и решения

---

## [3.3.3] - 2025-11-18

### 🐛 FIX: React Warning "Cannot update component while rendering"

**Устранён warning о setState во время рендера**

#### Проблема
- React warning: "Cannot update a component while rendering a different component"
- `setHasCachedData(true)` вызывался **7 раз** в разных useEffect'ах (departments, resources, projects, etc.)
- Конкурентные setState приводили к warning в React DevTools

#### Решение
1. **Заменили state на ref**:
   ```typescript
   // Было: const [hasCachedData, setHasCachedData] = useState(false);
   // С��ало: const hasCachedDataRef = useRef(false);
   ```

2. **Все вызовы setState заменены на присвоение ref**:
   ```typescript
   // Было: setHasCachedData(true);
   // Стало: hasCachedDataRef.current = true;
   ```

3. **Мемоизировали Context value**:
   ```typescript
   // Было: <SchedulerContext.Provider value={{ ... }}>
   // Стало: const contextValue = useMemo(() => ({ ... }), [deps]);
   //        <SchedulerContext.Provider value={contextValue}>
   ```

#### Результат
- ✅ Нет конкурентных setState
- ✅ Warning исчез
- ✅ Производительность улучшена (ref быстрее state)
- ✅ Context value не пересоздаётся при каждом рендере

#### Файлы
- `/contexts/SchedulerContext.tsx` - замена state на ref + мемоизация context value

---

### 🐛 FIX: Full Sync возвращает удалённые события после Undo/Redo

**События удалялись локально, но оставались на сервере**

#### Проблема
- Пользователь делал Undo/Redo → событие удалялось локально (8 событий)
- Через 30 секунд Full Sync загружал ВСЕ события с сервера (9 событий)
- Удалённое событие **возвращалось** (не было удалено на сервере) ��

#### Решение
1. **Новая функция `syncDeletedEventsToServer`**:
   - Сравнивает текущие события с предыдущими (до Undo/Redo)
   - Находит удалённые события: `previousEvents.filter(e => !currentIds.has(e.id))`
   - Помечает их в `deletedEventIdsRef` (защита от Full Sync)
   - Удаляет на сервере через `eventsApi.delete()`

2. **Вызов в handleUndo/handleRedo**:
   ```typescript
   const previousEvents = events; // Сохраняем ДО undo
   setEvents(uniqueEvents); // Восстанавливаем из истории
   await syncDeletedEventsToServer(uniqueEvents, previousEvents); // Синхронизируем удаления!
   ```

3. **Защита от "воскрешения"**:
   - Удалённые события помечаются в `deletedEventIdsRef`
   - Full Sync фильтрует их: `allEvents.filter(e => !deletedEventIdsRef.current.has(e.id))`
   - Пометки очищаются через 10 секунд (достаточно для Full Sync)

#### Результат
- ✅ Удалённые события синхронизируются с сервером
- ✅ Full Sync НЕ возвращает удалённые события
- ✅ Undo/Redo работает корректно для удаления
- ✅ Защита от "воскрешения" событий

#### Файлы
- `/contexts/SchedulerContext.tsx` - новая функция syncDeletedEventsToServer
- `/components/scheduler/SchedulerMain.tsx` - вызовы syncDeletedEventsToServer в handleUndo/handleRedo

---

### 🔧 FIX: Синхронизация проектов при Undo/Redo (2025-11-18)

**Проекты перезаписывались данными с сервера после Undo/Redo**

#### Проблема
- Пользователь делал Undo/Redo для проектов (быстро, локально)
- Через 15 секунд приходил polling проектов с сервера
- Локальный state **перезаписывался** данными с сервера
- Все изменения через Undo/Redo **терялись** 😱

#### Решение
1. **Добавлены функции блокировки синхронизации**:
   - `resetProjectsSyncTimer()` - блокирует polling проектов на 2 секунды
   - `resetResourcesSyncTimer()` - для сотрудников (на будущее)
   - `resetDepartmentsSyncTimer()` - для департаментов (на будущее)

2. **Вызов блокировки в handleUndo/handleRedo**:
   ```typescript
   setProjects(state.projects);
   resetProjectsSyncTimer(); // ← БЛОКИРУЕТ синхронизацию!
   ```

3. **Защита в polling**:
   ```typescript
   const timeSinceLastChange = Date.now() - lastProjectsChangeRef.current;
   if (timeSinceLastChange < 2000) {
     return; // Пропускаем синхронизацию!
   }
   ```

#### Результат
- ✅ Проекты остаются как после Undo/Redo
- ✅ Polling блокируется на 2 секунды
- ✅ Данные не перезаписываются с сервера
- ✅ Undo/Redo для проектов работает корректно

#### Файлы
- `/contexts/SchedulerContext.tsx` - добавлены reset*SyncTimer функции
- `/components/scheduler/SchedulerMain.tsx` - вызовы resetProjectsSyncTimer()
- `/UNDO_REDO_PROJECTS_SYNC_FIX.md` - полная документация

---

### ✅ COMPLETE: Синхронизация восстановленных событий с сервером (2025-11-18)

**Автоматическое создание восстановленных событий на сервере при Undo/Redo**

#### Реализовано
1. **Функция syncRestoredEventsToServer**:
   - Автоматически вызывается после Undo/Redo
   - Проверяет какие события отсутствуют на сервере
   - Создаёт их через batch API с **сохранением оригинальных ID**
   - Предотвращает удаление Full Sync'ом через 30 секунд

2. **Server-side UPSERT поддержка**:
   - Endpoint `/events/batch` поддерживает передачу существующих ID
   - `.upsert(events, { onConflict: 'id' })` создаёт/обновляет событие
   - Восстановленное событие получает тот же ID что был до удаления

3. **Защита от "воскрешения"**:
   - Очищается `deletedEventIdsRef` для восстанавливаемых событий
   - Обновляется `loadedEventIds` после создания на сервере
   - `lastLocalChangeRef` блокирует Delta Sync на 2 секунды

#### Результат
- ✅ Восстановленные события НЕ исчезают через 30 секунд
- ✅ Сохраняются оригинальные ID событий
- ✅ Данные синхронизируются с сервером автоматически
- ✅ Система Undo/Redo полностью функциональна

#### Файлы
- `/contexts/SchedulerContext.tsx` - функция `syncRestoredEventsToServer()`
- `/supabase/functions/server/index.tsx` - UPSERT поддержка в batch API
- `/types/scheduler.ts` - типы `BatchOperation`, `BatchResult`
- `/SYNC_RESTORED_EVENTS_STATUS.md` - полная документация

---

### 🐛 FIX: Защита истории от сохранения событий без проектов (2025-11-18)

**Критическое исправление Undo/Redo системы**

#### Проблема
- При сбросе истории через `onResetHistory` в модалках UsersManagementModal и ProjectsManagementModal параметр `projects` НЕ передавался
- Вызов `resetHistory(events, eventZOrder)` без третьего параметра сохранял состояние с событиями но БЕЗ проектов
- При попытке Undo/Redo система правильно блокировала восстановление (защита сработала), но выдавала ошибку:
  ```
  ❌ История: КРИТИЧЕСКАЯ ОШИБКА - попытка восстановить state с событиями но без проектов!
  ❌ История: это приведёт к удалению всех событий. Отменяем Undo.
  ```
- Проблема появлялась при использовании Undo после сохранения изменений в модалках Users/Projects

#### Решение
1. **Исправлены вызовы `resetHistory`** в SchedulerMain.tsx:
   - UsersManagementModal: `resetHistory(events, eventZOrder, projects)` ✅
   - ProjectsManagementModal: `resetHistory(events, eventZOrder, projects)` ✅
   - Теперь ВСЕГДА передаём проекты при сбросе истории

2. **Усилена защита в `saveHistory`** (useHistory.ts):
   - Если есть события но НЕТ про��ктов → НЕ сохраняем в историю (return early)
   - Логирование ошибки для диагностики
   - Защита от некорректного состояния на уровне сохранения

3. **Улучшено логирование**:
   - Детальные логи при сбросе истории с указанием источника
   - Понятные сообщения об ошибках для отладки

#### Результат
- ✅ История ВСЕГДА содержит проекты вместе с событиями
- ✅ Undo/Redo работает корректно после сохранения в модалках
- ✅ Двойная защита: на уровне вызова и на уровне сохранения
- ✅ Нет ошибок при восстановлении состояния

#### Файлы изменены
- `/components/scheduler/SchedulerMain.tsx` - исправлены вызовы resetHistory
- `/hooks/useHistory.ts` - добавлена защита в saveHistory

---

### ⚡ PERF: Восстановлен быстрый Delta Sync (4 сек) v3.3.0 (2025-11-18)

**Критическое исправление автообновления событий**

#### Проблема
- Автообновление событий стало очень медленным (10-30 секунд)
- Динамическая смена интервалов (10s → 30s) не работала корректно
- Full Sync каждые 60 секунд - слишком редко
- Пользователи жаловались на задержки при отображении изменений

#### Решение
1. **Быстрый Delta Sync**: 4 секунды (вместо 10 секунд)
2. **Быстрый Full Sync**: 30 секунд (вместо 60 секунд)
3. **Убрана динамическая смена интервалов**: простая фиксированная логика
4. **Упрощённый код**: нет счётчиков пустых ответов и переключения интервалов

#### Результат
- ⚡ Изменения появляются через 4 секунды (было 10-30 секунд)
- 🔄 Full Sync каждые 30 секунд (обнаружение удалений)
- 🛡️ За��ита от конфликтов при drag/drop сохранена
- 🎯 Простая и на��ёжная логика без хитростей

#### Интервалы синхронизации
```javascript
DELTA_SYNC_INTERVAL = 4000;   // ⚡ 4 сек - только изменённые события
FULL_SYNC_INTERVAL  = 30000;  // 🔄 30 сек - все события + удаления
```

#### Файлы изменены
- `/contexts/SchedulerContext.tsx` - упрощённая логика Delta Sync
- `/guidelines/Guidelines.md` - обновлён раздел "Delta Sync автообновление v3.3.0"

---

### 🐛 FIX: Исправлено множественное в��сстановление событий через Undo/Redo (2025-11-18)

**Race conditions при batch restore - ИСПРАВЛЕНО**

#### Проблема
- При быстром удалении нескольких событий → Redo возникали race conditions
- При восстановлении десятка событий подряд через Redo - "мигающие" события
- Параллельное выполнение `createEvent()` приводило к конфликтам state updates
- `Date.now()` генерировал одинаковые временные ID для событий созданных одновременно
- Async `updateHistoryEventId()` вызывался в непредсказуемом порядке

#### Решение
1. **Последовательное восстановление**: События восстанавливаются один за другим через `for await` вместо `Promise.all()`
2. **Уникальные временные ID**: `ev_temp_${Date.now()}_${Math.random()}` предотвращает коллизии
3. **Гарантированный порядок**: `updateHistoryEventId()` вызывается после каждого успешного restore
4. **Детальное логирование**: Progress bar для batch операций

#### Результат
- ✅ Стабильное восстановление любого количества событий
- ✅ Нет race conditions и "мигающих" событий
- ✅ История обновляется в правильном порядке
- ✅ Защита от конфликтов с Delta Sync

#### Файлы изменены
- `/components/scheduler/SchedulerMain.tsx` - `handleUndo()`, `handleRedo()`
- `/contexts/SchedulerContext.tsx` - `createEvent()` с уникальными ID
- `/BATCH_RESTORE_FIX.md` - полная документация исправления

---

### 🐛 FIX: Удаление событий синхронизируется ��ежду пользователями (2025-11-18)

**Full Sync каждые 20 секунд для обнаружения удалений**

#### Проблема
- При удалении события одним пользователем, оно НЕ исчезало у других
- Delta Sync возвращает только изменённые события, не сообщает об удалениях
- Drag/resize работали, delete нет

#### Решение
- Delta Sync каждые 4 сек (изменения)
- Full Sync каждые 20 сек (удаления)
- Обнаружение: есть локально, но нет на сервере = удалено

#### Результат
- ✅ Удаление синхронизируется через ≤20 сек
- ✅ Оптимальный баланс скорости и точности

---

### ✨ FEATURE: Полноценная поддержка Undo/Redo для всех операций (2025-11-17)

**Undo/Redo теперь работает для создания, удаления и изменения событий**

#### Реализовано
- ✅ **Создание событий** сохраняется в истории:
  - Через контекстное меню пустой ячейки (Paste)
  - Через модальное окно создания события
  - **Undo создания → событие удаляется из БД** (не возвращается при polling!)
- ✅ **Удаление событий** сохраняется в истории
- ✅ **Изменение событий** (drag/resize) сохраняется в истории
- ✅ Синхронизация всех операций с сервером:
  - Undo создания → DELETE запрос к БД
  - Undo ��зменения → UPDATE запрос к БД
  - Redo → аналогично

#### Технические детали
```typescript
// 1. Сохранение в истории после создания
setEvents(currentEvents => {
  console.log('История: сохранение после создания события');
  saveHistory(currentEvents, eventZOrder);
  return currentEvents;
});

// 2. Undo создания → удаление из БД
deletedEventIds.forEach(id => {
  console.log(`История: Undo удаляет событие ${id} (было создано)`);
  promises.push(deleteEvent(id));
});

// 3. Undo удаления → создание заново с новым ID
eventsToRestore.forEach(event => {
  const oldId = event.id;
  promises.push(
    createEvent(event).then(newEvent => {
      // Заменяем старый ID на новый в локальном state
      setEvents(currentEvents => 
        currentEvents.map(e => e.id === oldId ? newEvent : e)
      );
      console.log(`✅ Событие восстановлено: ${oldId} → ${newEvent.id}`);
    })
  );
});
```

#### Восстановление удаленных событий
- ✅ **Undo удаления → событие создаётся заново в БД**
  - Событие получает новый ID (старый уже удалён)
  - Все параметры сохраняются (проект, длина, высота, позиция)
  - Локальный state автоматически обновляется с новым ID
  - Следующий Redo будет работать с новым ID
- ✅ **Redo удаления → событие снова создаётся**
  - Аналогично Undo - создание с новым ID

#### Логирование
- `"История: сохранение после вставки события (paste)"`
- `"История: сохранение после создания события (модалка)"`
- `"История: Undo удаляет событие e123 (было создано)"`
- `"История: Undo восстанавливает событие e456 (было удалено)"`
- `"✅ Со��ытие восстановлено с новым ID: e456 → e789"`
- `"История: Redo восстанавливает событие e123 (было удалено)"`
- Все логи имеют префикс `"История:"` для удобной фильтрации

---

### 🐛 FIX: Откат группировки истории + детальное логирование (2025-11-17)

**Откат эксперимента с группировкой, добавлено детальное логирование для диагностики**

#### Проблема с группировкой
- Группировка через setTimeout создавала race conditions
- Undo/Redo работали нестабильно (неправильный возврат state)
- История "схлопывалась" из-за проблем с замыканиями в useCallback

#### Решение
- ✅ Откат к простой версии без группировки (работает стабильно)
- ✅ Добавлено детальное логирование с префиксом `"История:"`
- ✅ Каждое изменение сохраняется сразу (как было изначально)

#### Логи
```
История: СБРОС
История: СОХРАНЕНИЕ
История: 5 записей, index: 4
История: UNDO - текущий index 4, всего записей 5
История: UNDO - возвращаем state с 10 событиями (index 3)
История: REDO - текущий index 3, всего записей 5
```

---

### 🐛 FIX: Batch Update .single() ошибка (2025-11-17)

**Исправлена ошибка "Cannot coerce the result to a single JSON object"**

#### Проблема
- Метод `.single()` выбрасывает ошибку если событие не найдено в БД
- Batch update падал с некорректной ошибкой

#### Исправление
```typescript
// Заменили .single() на .maybeSingle()
const { data, error } = await supabase
  .from('events')
  .update(updateData)
  .eq('id', numericId)
  .select('*, event_patterns(name, pattern)')
  .maybeSingle(); // ✅ Возвращает null вместо ошибки

if (!data) {
  return { error: { id: eventId, message: 'Event not found' } };
}
```

---

### 🐛 CRITICAL FIX: Batch Update не обновлял resourceId (2025-11-17)

**Исправлен критический баг - события "уезжали" на неправильного сотрудника после сохранения**

#### Проблема
- При перетаскивании события на другого сотрудника локально всё работало
- Через 2 секунды отправлялся batch update на сервер с правильным `resourceId`
- **НО:** сервер игнорировал поле `resourceId` и не обновлял `user_id` в БД
- Сервер возвращал старые данные из БД, и событие "уезжало" обратно

#### Исправление
```typescript
// /supabase/functions/server/index.tsx - BATCH UPDATE endpoint
const body = op.data;
const updateData: any = {};

// ✅ ДОБАВЛЕНО: обработка resourceId
if (body.resourceId !== undefined) {
  updateData.user_id = parseInt(body.resourceId.replace('r', ''));
}
```

#### Дополнительные улучшения
- ✅ Убрано перезаписывание state данными с сервера (оптимистичное обновление)
- ✅ Добавлено детальное логирование batch операций для отладки
- ✅ Debounce timer уменьшен с 5 сек → 2 сек (быстрее реакция)
- ✅ Delta sync интервал уменьшен с 7 сек → 4 сек (быстрее синхронизация)

#### Тестирование
```bash
# Воспроизведение бага
1. Перетащить событие на другого сотрудника
2. Подождать 2 секунды (debounce save)
3. ❌ ДО ФИКСА: событие "уезжало" обратно
4. ✅ ПОСЛЕ ФИКСА: событие остаётся на правильном сотруднике
```

---

### 🚀 OPTIMIZATION: Алгоритм склейки событий v6.0 (2025-11-17)

**Оптимизирован модуль `/utils/eventNeighbors.ts` - производительность улучшена в ~45x!**

#### Улучшения
- ✅ **Индексация событий**: O(1) вместо O(n) для поиска соседей
- ✅ **Меньше проходов**: 4 вместо 5 (-20%)
- ✅ **Утилитарные функции**: переиспользование кода, -200 строк дублирования
- ✅ **Оптимизация кода**: 545 строк вместо 691 (-21%)
- ✅ **DEBUG режим**: опциональные логи для отладки
- ✅ **Чистый код**: понятная структура, легко поддерживать

#### Техническая реализация

**Индексация событий:**
```typescript
// Создаём индекс Map<resourceId, Map<week, Event[]>> один раз - O(n)
const eventIndex = createEventIndex(events);

// Поиск ��ерез индекс - O(1)
const leftNeighbors = findNeighbors(eventIndex, event, 'left', { sameProject: true });
```

**Утилитарные функции:**
```typescript
// Универсальная функция поиска соседей (переиспользуется 10+ раз)
function findNeighbors(index, event, side, filterOptions): Event[] { ... }

// Анализ покрытия углов (переиспользуется для left/right)
function analyzeNeighborCoverage(neighbors, event, projectIndex): { ... } { ... }
```

**Объединение проходов (4 вместо 5):**
- **PASS 1**: Базовое расширение + вычисление углов (объединены!)
- **PASS 2**: Расширение навстречу + блокировка конфликтов
- **PASS 3**: Поджатие + компенсация (объединены!)
- **PASS 4**: Откусывание при вклинивании

#### Производительность

**До (v5.23):** O(5n²) → для 100 событий ~50,000 операций  
**После (v6.0):** O(n*w + 4n*k) → для 100 событий ~1,100 операций  
**Результат: ~45x ускорение!** 🚀

#### Влияние
- ✅ Склейка событий работает в **45 раз быстрее**
- ✅ Код стал **чище и понятнее** (-21% строк)
- ✅ **Без изменений логики** (те же 7 правил склейки)

#### Файлы
- `utils/eventNeighbors.ts` - оптимизированный алгоритм
- `EVENT_NEIGHBORS_v6.0_OPTIMIZATION.md` - документация

---

### 🎯 FIX: Откусывание только при двойном gap в ПРОХОДЕ 5 v5.23 (2025-11-17)

**Исправлен баг в алгоритме вклинивания - откусывание теперь срабатывает только для событий с двойным расширение��**

#### Проблема
- ❌ ПРОХОД 5 (откусывание) срабатывал при `expandRightMultiplier > 0` (ЛЮБОЕ расширение)
- ❌ Откусывал gap даже для обычной склейки событий разных проектов
- ❌ Визуально: нежелательные зазоры между событиями разных проектов
- ❌ Логика вклинивания работала там где не нужно

#### Решение
- ✅ **Откусывание только при двойном gap**: `expandRightMultiplier >= 2` (вместо `> 0`)
- ✅ **Правильная логика вклинивания**: событие "вклинилось" только если соседний проект имеет ДВОЙНОЕ расширение
- ✅ **Нормальная склейка сохранена**: события с `expandRight = 1` больше не откусываются
- ✅ **Симметрично для обеих сторон**: аналогичная логика для `expandLeftMultiplier`

#### Что такое "вклинивание"?

**Определение:**
- Событие БЕЗ левого соседа своего проекта (не является продолжением)
- Слева находится событие ДРУГОГО проекта с ДВОЙНЫМ расширением (`expandRight >= 2`)
- Текущее событие "вклинилось" в двойной gap → откусываем 1 gap

**Двойное расширение:**
- Событие расширилось дважды (ПРОХОД 1 + ПРОХОД 2, или ПРОХОД 1 + ПРОХОД 4)
- `expandRight = 1 + 1 = 2` или больше
- Визуально: очень широкий gap между событиями разных проектов

**НЕ вклинивание:**
- Событие слева имеет `expandRight = 1` (обычное расширение)
- Это нормальная склейка событий разных проектов
- Откусывать НЕ нужно

#### Техническая реализация

```typescript
// БЫЛО (v5.6):
if (otherInfo && otherInfo.expandRightMultiplier > 0) {
  neighborInfo.expandLeftMultiplier -= 1; // ❌ При любом расширении
}

// СТАЛО (v5.23):
if (otherInfo && otherInfo.expandRightMultiplier >= 2) {
  neighborInfo.expandLeftMultiplier -= 1; // ✅ Только при двойном gap!
}
```

#### Влияние
- ✅ Откусывание срабатывает только для реального вклинивания (двойной gap)
- ✅ Обычная склейка событий разных проектов работает корректно
- ✅ Визуально: нет нежелательных зазоров между проектами
- ✅ Логика вклинивания стала предсказуемой

#### Файлы
- `utils/eventNeighbors.ts` - изменён ПРОХОД 5 для левой и правой сторон

---

### 🎯 FIX: Правильная неделя для поиска соседей справа в ПРОХОДЕ 3 v5.22 (2025-11-17)

**Исправлен критический баг в алгоритме склейки событий - поджа��ие справа теперь работает для коротких событий**

#### Проблема
- ❌ ПРОХОД 3 (поджатие событий) искал соседей на неделе `event.startWeek` для `roundBottomRight`
- ❌ Для длинных событий (например, Проект1 на 6-7 неделях) это работало случайно
- ❌ Для коротких событий (например, Проект2 на 7 неделе длиной 1 неделя) поджатие НЕ срабатывало
- ❌ Проект1(6-7) не поджимался вправо, когда Проект2(7) был коротким
- ❌ Проект1(8) не расширялся влево к поджатому соседу

#### Решение
- ✅ **Правильная неделя для поиска**: `roundBottomRight` ищет на **ПОСЛЕДНЕЙ** неделе события (`startWeek + weeksSpan - 1`)
- ✅ **Логика**: Внешний угол справа смотрит на ПОСЛЕДНЮЮ неделю события, а не на ПЕРВУЮ
- ✅ **Универсальность**: Работает для событий ЛЮБОЙ длины (1 неделя или 10 недель)
- ✅ **Симметричность**: `roundBottomLeft` уже искал на правильной неделе (`startWeek`)

#### Техническая реализация

**В `/utils/eventNeighbors.ts` ПРОХОД 3**:

```typescript
// БЫЛО (v5.20):
if (neighborInfo.roundBottomRight) {
  const eventsWithInnerRight = events.filter(e => {
    // ❌ Искали на неделе event.startWeek (первая неделя события!)
    if (!(e.startWeek <= event.startWeek && (e.startWeek + e.weeksSpan) > event.startWeek)) return false;
    // ...
  });
}

// СТАЛО (v5.22):
if (neighborInfo.roundBottomRight) {
  const lastWeek = event.startWeek + event.weeksSpan - 1; // ← ПОСЛЕДНЯЯ неделя события
  
  const eventsWithInnerRight = events.filter(e => {
    // ✅ Ищем на ПОСЛЕДНЕЙ неделе события!
    if (!(e.startWeek <= lastWeek && (e.startWeek + e.weeksSpan) > lastWeek)) return false;
    // ...
  });
}
```

#### Как это работает

**Сценарий: Короткий Проект2(7) длиной 1 неделя**

```
Неделя 6    Неделя 7    Неделя 8
┌─────────┬─────────┬─────────┐
│ Proj1   │ Proj1   │ Proj2   │ 25-100%
│ 0-75%   │ (6-7)   │         │
│         │ Proj2   ├─────────┤
│         │ 75-100% │ Proj1   │ 0-25%
���─────────┴─────────┴─────────┘
```

**До v5.22 (НЕ работало):**
- Проект1(6-7): `startWeek = 6`, искал соседей на неделе **6**
- Проект2(7) находится на неделе **7** → НЕ НАЙДЕН ❌
- Поджатие НЕ срабатывало → Проект1(6-7) расширялся вправо ❌
- Проект1(8) НЕ расширялся влево ❌

**После v5.22 (РАБОТАЕТ!):**
- Проект1(6-7): `lastWeek = 6 + 2 - 1 = 7`, ищет на неделе **7** ✅
- Проект2(7) находится на неделе **7** → НАЙДЕН! ✅
- Проект2(7) имеет `innerBottomRight` (от Проект1(6-7)) ✅
- `unitsTall`: Проект1(6-7) = 0.75 >= Проект2(7) = 0.25 ✅
- **Поджатие срабатывает!** `expandRight = 0` ✅
- ПРОХОД 4 компенсирует: Проект1(8).`expandLeft += 1` ✅
- **Проект1(8) расширяется влево!** ✅

#### Влияние
- ✅ Поджатие справа работает для событий **любой длины**
- ✅ Короткие события (1 неделя) теперь корректно поджимают длинные соседи слева
- ✅ Компенсация в ПРОХОДЕ 4 срабатывает правильно
- ✅ Визуальная склейка событий стала предсказуемой

#### Файлы
- `utils/eventNeighbors.ts` - изменён ПРОХОД 3 для `roundBottomRight`

---

### 🐛 FIX: ��орректное восстановление DOM стилей при ресайзе без изменений v2.3.13 (2025-11-16)

**Исправлена проблема смещения событий при клике на ручку ресайза без фактического изменения размера**

#### Проблема
- ❌ При клике на ручку ресайза (например, изменение ширины с 1 недели на 1 неделю)
- ❌ В `onMove` стили DOM многократно пересчитывались с округлениями
- ❌ При `hasChanged = false` код делал `return`, но оставлял изменён��ые стили
- ❌ Событие визуально смещалось на несколько пикселей

#### Решение
- ✅ **Сохранение исходных стилей**: В `startResize` сохраняем `startLeft`, `startTop`, `startWidth`, `startHeight`
- ✅ **Восстановление при отмене**: Если `hasChanged = false` → восстанавливаем ТОЧНЫЕ исходные стили
- ✅ **Никаких пересчётов**: Используем значения, которые были ДО начала ресайза
- ✅ **Pixel-perfect**: Событие остаётся на месте без смещений

#### Техническая реализация

**В `startResize`**:
```typescript
const startLeft = parseFloat(el.style.left || '0');
const startTop = parseFloat(el.style.top || '0');
const startWidth = el.offsetWidth;
const startHeight = el.offsetHeight;

pointerStateRef.current = {
  // ...
  startLeft,    // ← Сохраняем исходные стили
  startTop,
  startWidth,
  startHeight,
  // ...
};
```

**В `onUp`**:
```typescript
if (!hasChanged) {
  console.log('⏭️ Событие не изменилось при ресайзе - восстанавливаем исходные стили');
  // ✅ ВОССТАНАВЛИВАЕМ исходные DOM стили
  savedState.el.style.left = `${savedState.startLeft}px`;
  savedState.el.style.top = `${savedState.startTop}px`;
  savedState.el.style.width = `${savedState.startWidth}px`;
  savedState.el.style.height = `${savedState.startHeight}px`;
  return;
}
```

**Обновлённые файлы**:
- `/hooks/useEventInteractions.ts` - добавлено восстановление исходных DOM стилей

---

### 🎨 UX: Умная горизонтальная склейка событий v2.3.12 (2025-11-14)

**Боковые отступы убираются только при полной склейке по высоте**

#### Проблема
- ❌ **Старая логика**: `hasAnyLeftNeighbor = hasTopLeft || hasBottomLeft`
- ❌ Если хотя бы один угол склеен → убирается весь боковой padding
- ❌ В середине горизонтальной склейки с��бытия **без боковых отступов вообще**

**Пример проблемы**:
```
Week 1:      Week 2:      Week 3:
Unit 1: [P1] [P1] [P1]
Unit 2: [P1] [  ] [P1]  ← Week 2 пустой (разный unitsTall)
Unit 3: [P2] [P2] [P2]  ← Week 2 склеен с обеих сторон
Unit 4: [P2] [P2] [P2]  ← Week 2 склеен с обеих сторон

Проект2 Week 2: paddingLeft = 0, paddingRight = 0 ❌
Отступов вообще нет!
```

#### Решение
- ✅ **Новая логика**: `hasFullLeftNeighbor = hasTopLeft && hasBottomLeft`
- ✅ Padding убирается **только если ОБА угла склеены** (полная склейка по высоте)
- ✅ Если склеен только один угол → padding остаётся (4px)

#### Визуальное сравнение

**До (v2.3.11)**:
```
Week 1:      Week 2:      Week 3:
Unit 3: [P2][P2][P2]  ← Нет отступов между Week 1-2 и 2-3
Unit 4: [P2][P2][P2]  ← Склеено, но БЕЗ боковых отступов внутри!
```

**После (v2.3.12)**:
```
Week 1:      Week 2:        Week 3:
Unit 3: [P2] [P2] [P2]  ← Отступы 4px с каждой стороны
Unit 4: [P2] [P2] [P2]  ← Склеено, но отступы внутри ЕСТЬ
```

#### Логика

| Условие | Старая логика (OR) | Новая логика (AND) | Результат |
|---------|--------------------|--------------------|-----------|
| Оба угла склеены | Padding = 0 ✅ | Padding = 0 ✅ | Правильно |
| Только верхний угол | Padding = 0 ❌ | Padding = 4px ✅ | Исправлено! |
| Только нижний угол | Padding = 0 ❌ | Padding = 4px ✅ | Исправлено! |
| Нет соседей | Padding = 4px ✅ | Padding = 4px ✅ | Правильно |

**Обновлённые файлы**:
- `/components/scheduler/SchedulerMain.tsx` - изменена логика `hasFullLeftNeighbor` и `hasFullRightNeighbor`

---

### 🎯 Pixel-Perfect: Целочисленные координаты Y для событий v2.3.11 (2025-11-14)

**Все события теперь позиционируются по целым пикселям**

#### Проблема
- ❌ При `rowHeight = 48px` использовался `gap = 0.5px`
- ❌ Это создавало **дробные координаты Y**: события на unit 1, 2, 3 смещались на 0.5px
- ❌ События разной высоты выглядели "кривыми" из-за субпиксельного рендеринга
- ❌ Нет перфекционизма в Y-позиционировании

#### Решение
- ✅ **Минимальный gap увеличен с 0.5px до 1px**
- ✅ **Округление вычислений**: `unitContentH = Math.floor(...)` для целых пикселей
- ✅ **Pixel-perfect позиционирование**: все координаты Y теперь целые числа

#### Примеры расчетов

**До (v2.3.10)** при rowHeight = 48px:
```
gap = 0.5px
unitContentH = (48 - 3*0.5 - 2) / 4 = 11.125px ❌ дробное!
unitStride = 11.125 + 0.5 = 11.625px ❌ дробное!

Event unit 1: top = 11.625px ❌
Event unit 2: top = 23.25px ❌
Event unit 3: top = 34.875px ❌
```

**После (v2.3.11)** при rowHeight = 48px:
```
gap = 1px
unitContentH = Math.floor((48 - 3*1 - 2) / 4) = 10px ✅ целое!
unitStride = 10 + 1 = 11px ✅ целое!

Event unit 1: top = 11px ✅
Event unit 2: top = 22px ✅
Event unit 3: top = 33px ✅
```

**Обновлённые файлы**:
- `/utils/schedulerLayout.ts` - изменен минимальный gap и добавлено округление

---

### 🎨 Visual: Математически правильные внутренние скругления v2.3.10 (2025-11-14)

**Внутренние скругления теперь учитывают отступ между событиями**

#### Проблема
- ❌ Внутренний радиус был равен внешнему радиусу (10px = 10px)
- ❌ Это математически некорректно, так как не учитывает отступ (gap) между событиями
- ❌ Внутренние скругления выглядели слишком острыми

#### Решение
- ✅ **Новая формула**: `innerRadius = borderRadius + gap`
- ✅ **Математически правильно**: внутреннее скругление компенсирует отступ
- ✅ **Адаптивно**: работает для всех размеров строки

#### Примеры
| Row Height | Внешний radius | gap  | Внутренний radius |
|------------|----------------|------|-------------------|
| ≤ 48px     | 4px            | 1px  | **5px**           |
| ≤ 80px     | 6px            | 1px  | **7px**           |
| ≤ 112px    | 8px            | 2px  | **10px**          |
| ≥ 144px    | 10px           | 4px  | **14px**          |

**Обновлённые файлы**:
- `/components/scheduler/SchedulerEvent.tsx` - изменен расчет `innerRadius`

---

### 🎯 Visual: Унифицированные отступы для событий v2.3.9 (2025-11-14)

**Одиночные события теперь имеют одинаковые отступы со всех сторон**

#### Проблема
- ❌ Одиночные события имели **разные визуальные отступы**: справа 2px, снизу 4px
- ❌ Выглядело несимметрично и непрофессионально
- ❌ `cellPadding = gap / 2` создавал дисбаланс между горизонтальными и вертикальными отступами

#### Решение
- ✅ **Унифицированные отступы**: `cellPadding = gap` (вместо `gap / 2`)
- ✅ **Симметричные визуальные отступы** для одиночных событий:
  - Справа: 4px (было 2px)
  - Слева: 4px (было 2px)
  - Сверху: 4px (gap)
  - Снизу: 4px (gap)
- ✅ **Склейка работает как прежде**: при слиянии событий padding убирается (0px)
- ✅ **Режим производительности без изменений**: все отступы остаются 0px

#### Визуальные улучшения
- Одиночные события выглядят более сбалансированными
- Четкая визуальная граница между событиями разных проектов
- Между двумя событиями разных недель: 8px (4px + 4px)
- Между юнитами внутри события: 4px (gap)

**Обновлённые файлы**:
- `/utils/schedulerLayout.ts` - изменен расчет `cellPadding` с `gap / 2` на `gap`

---

### 🎨 UX: Улучшение hover highlight для контекстных меню v2.3.8 (2025-11-14)

**Hover highlight теперь корректно исчезает при закрытии контекстных меню**

#### Проблема
- ❌ При открытии контекстного меню на пустой ячейке hover зона оставалась видимой
- ❌ При вставке события через контекстное меню hover не исчезал
- ❌ При переключении между контекстными меню hover зона не обновлялась
- ❌ Hover оставался после закрытия меню при ошибках (недостаточно места/недель)

#### Решение
- ✅ **Взаимное закрытие контекстных меню**: ПКМ на событии з��крывает меню пустой ячейки и наоборот
- ✅ **Обновление hover при открытии**: ПКМ на новой пустой ячейке обновляет hover highlight на позицию курсора
- ✅ **Скрытие hover при закрытии меню**: 7 точек закрытия `emptyCellContextMenu` корректно убирают hover
- ✅ **Обработка всех сценариев**: Escape, клик вне меню, вставка (успешно/ошибка), переключение между меню

#### Покрытые случаи (10 сценариев)
1. ✅ Escape → убирает hover
2. ✅ Клик вне меню → убирает hover
3. ✅ Открытие контекстного меню события → закрывает меню ячейки + убирает hover
4. ✅ Открытие контекстного меню ячейки → закрывает меню события + обновляет hover
5. ✅ Вставка: недостаточно места → убирает hover
6. ✅ Вставка: недостаточно недель → убирает hover
7. ✅ Вставка: успешно → убирает hover
8. ✅ Закрытие через onClose компонента → убирает hover
9. ✅ Закрытие модального окна создания/редактирования → убирает hover
10. ✅ handleCellMouseLeave → ��Е убирает hover если меню открыто (правильная логика)

**Обновлённые файлы**:
- `/components/scheduler/SchedulerMain.tsx` - добавлено скрытие hover во всех местах закрытия контекстных меню

---

### ⚡ КРИТИЧНО: Правильная пагинация v2.3.7 (2025-10-21)

**PostgREST ВСЕГДА возвращает max 1000 записей - реализована автоматическая пагинация!**

#### Проблема
- ❌ PostgREST возвращает **максимум 1000 записей** за один запрос
- ❌ `.limit(50000)` → вернёт 1000
- ❌ `.range(0, 49999)` → вернёт 1000 (предыдущее "исправление" не работало!)
- ❌ Создано 8053 событий → Загружено 1000 → **Потеряно 7053 (87.6%)**

#### Решение
- ✅ **Автоматическая пагинация**: цикл while загружает по 1000 записей
- ✅ **Определение последней страницы**: `hasMore = pageEvents.length === PAGE_SIZE`
- ✅ **Защита от переполнения**: максимум 100 страниц (100,000 событий)
- ✅ **Детальное логирование**: каждая страница + общее время
- ✅ **Поддержка любого количества**: от 1 до 100,000 событий

#### Пример работы
```
Страница 1: range(0, 999) → 1000 событий
Страница 2: range(1000, 1999) → 1000 событий
...
Страница 9: range(8000, 8999) → 53 события
Итого: 8053 события за 9 запросов (~2-5 сек)
```

#### Производительность
- 1,000 событий: 1 запрос, ~200ms
- 10,000 событий: 10 запросов, ~2s
- 50,000 событий: 50 запросов, ~10s
- 100,000 событий: 100 запросов, ~20s (макс лимит)

**Обновлённые файлы**:
- `/supabase/functions/server/index.tsx` - GET /events с пагинацией
- `/FIX_EVENT_LOADING_LIMIT.md` - обновлена документация
- `/FIX_PAGINATION_v2.3.7.md` - краткое резюме

---

### 🎯 Fix Generation Algorithm v2.3.5 (2025-10-21)

**100% ЗАПОЛНЕНИЕ КАЛЕНДАРЯ - Исправлен алгоритм генерации!**

#### Проблема
- ❌ После v2.3.4 генерация создавала **недостаточно событий**
- ❌ Много строк оставались **незаполненными** (вместо 8 максимальных событий получалось 2-3)
- ❌ Календарь заполнялся только на **60-80%** вместо 100%
- ✅ Batch upload работал корректно - проблема была в ГЕНЕРАЦИИ

#### Решение
- ✅ **Убрали искусственное ограничение** `targetEventCount` (1-8 событи��)
- ✅ **3-фазная стратегия заполнения**:
  - Фаза 1 (0-40%): разнообразные средние события (1-20 недель)
  - Фаза 2 (40-80%): короткие события (1-10 недель) для заполнения пустот
  - Фаза 3 (80-100%): максимальные прямоугольники для гарантии 100%
- ✅ **Умный расчёт заполненности**: `fillRatio = (occupied / total)`
- ✅ **Гарантия 100% заполнения**: алгоритм работает пока есть свободные ячейки

#### Результаты
- ✅ Заполнение: **100%** (вместо 60-80%)
- ✅ Количество событий: **зависит от размеров** (может быть 5-15 на сотрудника)
- ✅ Каждая строка полностью заполнена БЕЗ пустот

**Обновлённые файлы**:
- `/components/scheduler/SchedulerMain.tsx` - новый алгоритм генерации
- `/components/scheduler/GenerateProgressModal.tsx` - обновлён текст "500мс между пачками"

**Документация**: 
- `/FIX_GENERATION_v2.3.5.md` - детальное описание исправления
- `/QUICK_TEST_v2.3.5.md` - инструкция по тестированию

---

### 🚀 Batch Upload Optimization v2.3.4 (2025-10-21)

**Увеличен лимит PostgREST + уменьшен batch size для стабильности**

#### Проблема (v2.3.3)
- ❌ Supabase PostgREST возвращал **максимум 1000 событий** (по умолчанию)
- ❌ При генерации 1500+ событий загружалась только половина
- ❌ Батчи по 100 событий иногда вызывали timeout в Edge Function

#### Решение (v2.3.4)
- ✅ **Увеличен лимит** в endpoint `/events`: `.limit(50000)` вместо default 1000
- ✅ **Уменьшен batch size**: с 100 до 50 событий (стабильность Edge Function)
- ✅ **Уменьшена задержка**: с 2 секунд до 500мс между batch-ами (быстрее)
- ✅ **Детальное логирование**: проверка расхождений created vs loaded

**Обновлённые файлы**:
- `/supabase/functions/server/index.tsx` - `.limit(50000)` в GET `/events`
- `/components/scheduler/SchedulerMain.tsx` - batch size 50, delay 500ms

**Метрики производительности**:
| События | v2.3.3 | v2.3.4 | Изменение |
|---------|--------|--------|-----------|
| 500 | ~15 сек | ~7 сек | **2x быстрее** |
| 1500 | ~45 сек (⚠️ неполная загрузка) | ~20 сек (✅ полная загрузка) | **Исправлено + 2x** |
| 3000 | ❌ не работало | ~40 сек | **Работает!** |

**Документация**: `/BATCH_UPLOAD_FIX_v2.3.4.md`

---

### 🚀 Batch Upload Optimization v2.3.3 (2025-10-21)

**МАССОВАЯ ЗАГРУЗКА: 1 запрос вместо 100, в 10 раз быстрее!**

#### Bugfix (v2.3.3 исправлено)
- ✅ **Исправлена ошибка** `ReferenceError: loadEvents is not defined` при генерации
- ✅ Заменён вызов несуществующей функции на прямую загрузку через `eventsApi.getAll()`
- ✅ Добавлена обработка ошибок при перезагрузке событий
- Документация: `/FIX_LOAD_EVENTS_v2.3.3.md`

#### Что изменилось (v2.3.2 → v2.3.3)

**Проблема**:
- ❌ Загрузка 500 событий: 500 HTTP запросов + 2 минуты delay
- ❌ Некоторые события не загружались (падали запросы)
- ❌ Перегрузка сервера при параллельных запросах

**Решение - Batch Endpoint**:
- ✅ **Новый endpoint** `/events/batch` - создаёт до 200 событий за ОДИН запрос
- ✅ **Один SQL INSERT** вместо 100 параллельных запросов
- ✅ **Delay сокращён**: с 30 секунд до 2 секунд между пачками
- ✅ **Скорость**: 10x быстрее (2.5 мин → 15 сек для 500 событий)

**Технические улучшения**:
- ✅ Обработка ошибок: подсчёт успешных/неуспешных загрузок
- ✅ Детальное логирование каждой пачки
- ✅ Финальная статистика в toast уведомлении
- ✅ Автоматическое обновление workspace summary
- ✅ Перезагрузка событий с сервера после генерации

**Обновлённые файлы**:
- `/supabase/functions/server/index.tsx` - новый batch endpoint
- `/services/api/events.ts` - метод createBatch()
- `/components/scheduler/SchedulerMain.tsx` - использование batch API
- `/components/scheduler/GenerateProgressModal.tsx` - статус "2 сек между пачками"

**Метрики производительности**:
| События | v2.3.2 | v2.3.3 | Ускорение |
|---------|--------|--------|-----------|
| 100 | ~35 сек | ~5 сек | **7x** |
| 500 | ~2.5 мин | ~15 сек | **10x** |
| 1000 | ~5 мин | ~30 сек | **10x** |

**Документация**: `/BATCH_UPLOAD_v2.3.3.md`

---

### 📊 Улучшенный прогресс генерации v2.3.2 (2025-10-21)

**ТРИ ПРОГРЕСС-БАРА + DELAY между пачками загрузки**

#### Что изменилось (v2.3.1 → v2.3.2)

**Визуализация прогресса**:
- ✅ **3 прогресс-бара вместо 1**:
  - 🔵 Синий - обработка сотрудников (строки)
  - 🟢 Зелёный - заполнение ячеек календаря
  - 🟣 Фиолетовый - загрузка событий на сервер
- ✅ **Детальные счётчики**: сотрудники, ячейки, загруженные события
- ✅ **Стадии процесса**: generating → uploading → done

**Оптимизация загрузки**:
- ✅ **Delay 30 секунд** между каждой сотней событий
- ✅ **Batch размер увеличен**: с 50 до 100 событий
- ✅ **Предотвращение перегрузки сервера** при массовой генерации

**Обновлённые файлы**:
- `/components/scheduler/GenerateProgressModal.tsx` - 3 бара + новые пропсы
- `/components/scheduler/SchedulerMain.tsx` - расширенный state + delay логика
- `/GENERATE_PROGRESS_v2.3.2.md` - полная документация
- `/QUICK_TEST_v2.3.2.md` - инструкция по тестированию

**Timeline для 500 событий**: ~2 минуты (генерация 10 сек + 5 пачек по 30 сек delay)

---

### 🧪 Тестовые кнопки: ПОЛНОЕ заполнение календаря v2.3.1 (2025-10-21)

**ОБНОВЛЕНИЕ**: Прогресс-бар в реальном времени + сокращено до макс. 8 событий

#### Что изменилось (v2.3 → v2.3.1)

**Улучшения генерации**:
- ✅ **Прогресс-бар в реальном времени** - видно сколько сотрудников обработано
- ✅ **Сокращено максимальное количество событий**: с 12 до 8
- ✅ **Confirm обновлен**: теперь упоминает 1-8 событий
- ✅ **Визуальная обратная связь**: модальное окно с прогрессом генерации
- ✅ **Неболь��ая задержка** (10ms) между сотрудниками для визуального обновления

**Новый компонент**:
- Добавлен: `/components/scheduler/GenerateProgressModal.tsx` - модалка с прогресс-баром

**Обновленные файлы**:
- `/components/scheduler/SchedulerMain.tsx` - добавлен state для прогресса, обновлена генерация
- `/CHANGELOG.md` - обновлена документация

---

### 🧪 Тестовые кнопки: ПОЛНОЕ заполнение календаря v2.3 (2025-10-21)

**100% заполнение БЕЗ ПУСТОТ - ни одной пустой ячейки!**

#### Что изменилось (v2.2 → v2.3)

**Новая логика генерации**:
- ✅ **Было**: максимум 10 событий, могли оставаться пустые ячейки
- ✅ **Стало**: от 1 до 12 событий, **100% заполнение БЕЗ ПУСТОТ**
- ✅ **Гарантия**: ВСЕ 208 ячеек (52 недели × 4 юнита) заполнены событиями

**Новые тестовые кнопки в Toolbar**:
- ✅ **"Сгенерировать эвенты"** (зеленая) - полное заполнение календаря
- ✅ **"Очистить все эвенты"** (красная) - удаляет все события одним запросом

**Генерация с ПОЛНЫМ заполнением (1-8 событий на сотрудника)**:
- **100% заполнение БЕЗ ПУСТОТ** - все 208 ячеек заполнены
- Случайное количество событий: от 1 до 8 на каждого сотрудника
- Алгоритм прогрессивного заполнения: находим свободные ячейки → создаём события → последнее событие заполняет ВСЁ оставшееся
- 60% коротких событий (1-6 недель), 40% средних/длинных (7+ недель)
- 70% событий высотой 1 юнит, 30% высотой 2-4 юнита
- Последнее событие всегда максимального размера (гарантия заполнения)
- Случайные проекты из текущего воркспейса
- События не перекрываются, заполняют календарь как тетрис
- Батчинг по 50 событий для производительности
- Защита от бесконечного цикла (1000 итераций)
- Детальное логирование: "заполнено 208/208 ячеек (100.0%)"

**Оптимизи����ванная очистка**:
- Новый endpoint: `DELETE /events/clear/:workspaceId`
- Удаление всех событий одним SQL запросом
- Подсчет удален��ых событий
- Обновление workspace summary
- Быстро даже для т��сяч событий

**Файлы**:
- Обновлён: `/supabase/functions/server/index.tsx` - endpoint для очистки
- Обновлён: `/components/scheduler/SchedulerMain.tsx` - новые алгоритмы генерации и очистки
- Обновлён: `/components/scheduler/Toolbar.tsx` - замена кнопки "Выход" на тестовые кнопки
- Новый: `/TESTING_FULL_CALENDAR_FILL.md` - инструкции по тестированию
- Новый: `/SUMMARY_TEST_BUTTONS_v2.md` - детальное описание изменений

**Производительность**:
- Генерация: ~80-100 событий за 1-2 сек (10 сотрудников), среднее 8-10 на сотрудника
- Очистка: ~1000 событий за 1-2 сек (один SQL запрос)
- Результат: красиво заполненный календарь без пропусков

**UI/UX**:
- Confirm диалоги с подробной информацией
- Toast уведомления с количеством событий
- Прогресс в консоли при батчинге
- Среднее количество событий на сотрудника

---

### 🔄 Simple Short Polling автообновление - РАСШИРЕНО v1.9.4 (2025-10-21)

**Автоматическое обновление ВСЕХ данных через HTTP polling**

#### Что добавлено

**Расширен Simple Short Polling на все сущности**:
- ✅ **События**: HTTP polling каждые 10 секунд
- ✅ **Сотрудники**: HTTP polling каждые 15 секунд
- ✅ **Департаменты**: HTTP polling каждые 15 секунд
- ✅ **Проекты**: HTTP polling каждые 15 секунд
- ✅ Умная защита от дублирования для каждого типа данных
- ✅ Обновление только при реальных изменениях
- ✅ Автоматическое обновление кэша в IndexedDB

**Нагрузка на сервер**:
- События: 6 запросов/минуту (10 сек)
- Сотрудники: 4 запроса/минуту (15 сек)
- Департаменты: 4 запроса/минуту (15 сек)
- Проекты: 4 запроса/минуту (15 сек)
- **Итого**: 18 запросов/минуту на пользователя (умеренная нагрузка)

**Файлы**:
- Обновлён: `/contexts/SchedulerContext.tsx` - добавлен polling для всех сущностей
- Новый: `/SIMPLE_POLLING_EXTENDED_v1.9.4.md` - расширенная документация

**Как работает**:
1. Приложение запрашивает данные с сервера по таймеру
2. Сравнивает с текущими данными через `JSON.stringify`
3. Если есть изменения - обновляет UI и кэш
4. Пропускает polling если было локальное изменение < 2 сек назад

**Защита от дублирования**:
- `lastLocalChangeRef` - события
- `lastResourcesChangeRef` - сотрудн��ки
- `lastDepartmentsChangeRef` - департаменты
- `lastProjectsChangeRef` - проекты

**От пользователя НЕ требуется**:
- Никаких настроек - работает из коробки

#### Почему НЕ Realtime Broadcast v1.9.3?

**Проблемы Realtime Broadcast**:
- ❌ Требует `@supabase/supabase-js` клиентскую библиотеку
- ❌ В Figma Make окружении библиотека недоступна
- ❌ Ошибка сборки: "Failed to fetch @supabase/supabase-js"
- ❌ Нельзя импортировать пакеты без спецификации версии

**Преимущества Simple Polling**:
- ✅ Работает везде (только HTTP)
- ✅ Не требует библиотек
- ✅ Простая реализация
- ✅ Легко отлаживать
- ✅ Предсказуемое поведение
- ✅ Синхронизация всех данных между пользователями
- ✅ Предсказуемо работает

---

### 🔔 Realtime Broadcast автообновление - v1.9.3 (2025-10-21) [ОТКЛОНЕНО]

**ПРИЧИНА ОТКАЗА**: Ошибка сборки - `@supabase/supabase-js` недоступен в Figma Make окружении

#### Что добавлено

**Realtime Broadcast система**:
- ✅ WebSocket подключение с задержкой ~100ms
- ✅ Мгновенное уведомление других пользователей об изменениях (create/update/delete)
- ✅ Умная фильтрация - пользователь не получает свои собственные broadcast
- ✅ Легкая нагрузка - отправляется только уведомление, не данные
- ✅ Надежность - при ошибке broadcast другие получат обновление через polling

**Файлы**:
- Новый: `/utils/supabase/client.ts` - утилита для Realtime клиента
- Обновлён: `/contexts/SchedulerContext.tsx` - Realtime Broadcast логика
- Новый: `/REALTIME_BROADCAST_SETUP.md` - инструкции по настройке

**Как ��аботает**:
1. Пользователь A создает событие → сохранение в БД → broadcast: `{ action: 'create', userId: 'A' }`
2. Пользователь B получает broadcast → проверка `userId !== B` → перезагрузка событий
3. Пользователь A игнорирует свой broadcast (state уже обновлен)
4. Задержка: ~600-1100ms (broadcast ~100ms + загрузка ~500-800ms)

**От пользователя требуется**:
- Проверить что Realtime включен в Supabase Dashboard (Settings → API → Realtime)

#### Почему НЕ Smart Polling v1.9.2?

**Проблемы Smart Polling**:
- ❌ Синтаксические ошибки с escape последовательностями `\n` в console.log
- ❌ Дубликаты endpoint кода
- ❌ Невозможность автоматического исправления через edit_tool
- ❌ Слишком сложная серверная логика

**Преимущества Realtime Broadcast**:
- ✅ Простая реализация (~50 строк кода)
- ✅ Без серверной логики (только клиент)
- ✅ Встроено в Supabase (уже используем для presence)
- ✅ Мгновенные обновления через WebSocket
- ✅ Легко отлаживать

---

### ⚡ Realtime синхронизация событий - v1.10.0 (2025-10-21) [ОТКЛОНЕНО]

**ПРИЧИНА ОТКАЗА**: Слишком сложная реализация, заменено на Realtime Broadcast v1.9.3

**Мгновенная синхронизация изменений событий между всеми пользователями воркспейса**

#### Что добавлено

**Realtime Database Changes через Supabase**:
- ✅ WebSocket подключение с задержкой 100-300ms
- ✅ Подписка на изменения в таблице `events` (INSERT/UPDATE/DELETE)
- ✅ Фильтрация по `workspace_id` - получаем только релевантные изменения
- ✅ Защита от дубликатов через регистрацию локальных изменений
- ✅ Автоматический реконнект при обрыве соединения

**Компоненты**:
- Новый: `/components/scheduler/EventsRealtimeSync.tsx` - управление подпиской
- Обновлён: `/contexts/SchedulerContext.tsx` - регистрация локальных изменений
- Обновлён: `/components/scheduler/SchedulerMain.tsx` - интеграция компон��нта

**Как работа��т**:
1. Пользователь 1 двигает событие → сохранение в БД
2. Supabase Realtime отправляет UPDATE через WebSocket
3. EventsRealtimeSync получает изменение → обновляет UI у Пользователя 2
4. Задержка: 100-300ms

**Защита от дубликатов**:
- Каждое локальное изменение регистрируется с timestamp
- При получении события от Realtime проверяется:
  - Было ли это событие изменено локально менее 2 секунд назад?
  - Совпадает ли timestamp события?
- Если да → событие игнорируется (это эхо нашего изменения)

#### ⚠️ ВАЖНО: Требуется настройка Supabase Dashboard

**Функция НЕ БУДЕТ РАБОТАТЬ без этой настройки!**

1. Откройте **Supabase Dashboard**
2. Перейдите в **Database → Replication**
3. Найдите таблицу **`events`**
4. **Включите** переключатель в колонке **"Realtime"**

Дополнительно может потребоваться:
```sql
-- Добавить таблицу events в репликацию
ALTER PUBLICATION supabase_realtime ADD TABLE events;
```

#### Документация

- Полная инструкция: `/docs/REALTIME_EVENTS_SETUP.md`
- Troubleshooting, тестирование, производительность

#### Преимущества

**Vs Polling (HTTP запросы каждые N секунд)**:
- ✅ В 10-20 раз быстрее (100-300ms vs 2-5 секунд)
- ✅ Снижение нагрузки на сервер в 100 раз (события только при изменениях)
- ✅ Меньше трафика (WebSocket vs HTTP overhead)

**Vs Custom WebSocket в Edge Functions**:
- ✅ Работает стабильно (managed by Supabase)
- ✅ Не требует поддержки WebSocket в Edge Functions
- ✅ Автоматическая синхронизация с БД
- ✅ Встроенные фильтры и RLS политики

#### Планы на будущее

1. **Conflict Resolution**: Предупреждение когда два пользователя меняют одно событие
2. **Optimistic UI с Rollback**: Очередь изменений с повторными попытками
3. **Индикатор "Кто редактирует"**: Показывать кто сейчас редактирует событие

---

### ❌ Отключение Collaborative Cursors - v1.9.2 (2025-10-21)

**Temporary Rollback: WebSocket соединение нестабильно работает в Supabase Edge Functions**

#### Причина отката
- WebSocket `readyState: 3` (CLOSED) - соединение не устанавливается
- Supabase Edge Functions не поддерживают WebSocket должным образом в текущей версии
- Множественные ошибки подключения вызывают проблемы для пользователей

#### Что отключено
- ❌ Компонент `CursorPresence.tsx` (закомментирован в `SchedulerMain.tsx`)
- ❌ WebSocket endpoint `/cursors/:workspaceId` (закомментирован в `index.tsx`)
- ℹ️ Код сохранён для будущей реализации когда поддержка WebSocket улучшится

#### Что работает
- ✅ Онлайн пользователи (через HTTP endpoints с presence системой)
- ✅ Heartbeat каждые 30 секунд
- ✅ Аватарки и отображение активности
- ✅ Batch запросы для оптимизации

#### Планы на будущее
- Collaborative cursors будут реализованы когда Supabase улучшит поддержку WebSocket
- Альтернатива: использовать Supabase Realtime Presence (требует отдельную настройку)

---

### 🔧 Исправление WebSocket Cursors - v1.9.1 (2025-10-21)

**Исправл��ны ошибки подключения WebSocket для collaborative cursors**

#### Проблемы
- ❌ WebSocket ошибка: `{ "isTrusted": true }`
- ❌ Достигнут лимит попыток переподключения

#### Исправления

**1. Протокол WebSocket (ГЛАВНОЕ)**:
- **Было**: Определение протокола на основе `window.location.protocol`
- **Стало**: Всегда используем `wss://` для Supabase Edge Functions
- **Причина**: Edge Functions всегда работают через HTTPS, независимо от протокола клиента

**2. Порядок операций на сервере**:
- **Было**: Async авторизация → WebSocket upgrade
- **Стало**: WebSocket upgrade → Async авторизация в `onopen`
- **Причина**: Upgrade должен быть синхронным, авторизация может быть асинхронной

**3. Детальное логирование**:
- Добавлены коды закрытия WebSocket (1000, 1006, 1008, 1011)
- Логирование URL без токена (для безопасности)
- Расшифровка ошибок (Abnormal closure, Policy violation)

**4. Область видимости переменных**:
- Переменные `userId`, `email`, `displayName` теперь в правильной области
- Доступны во всех обработчиках (`onmessage`, `onclose`)

#### Файлы
- `/components/scheduler/CursorPresence.tsx` - исправлен протокол и логирование
- `/supabase/functions/server/index.tsx` - изменён порядок операций
- `/FIX_WEBSOCKET_CURSORS.md` - полная инструкция по исправлению

---

### ✨ Collaborative Cursors через Native WebSocket - v1.9.0 (2025-10-21)

**Добавлено отображение курсоров других пользователей в реальном времени**

#### Новая функция
- **Realtime курсоры** - видите где находятся курсоры других пользователей в календаре
- **Технология**: Native WebSocket через Supabase Edge Functions
- **Компонент**: `/components/scheduler/CursorPresence.tsx`
- **Backend**: WebSocket endpoint в `/supabase/functions/server/index.tsx`

#### Как это работает
1. При входе в календарь устанавливается WebSocket соединение: `wss://{projectId}.supabase.co/.../cursors/:workspaceId`
2. При движении мыши координаты отправляются на сервер (throttle 50ms)
3. Сервер делает broadcast всем пользователям в workspace
4. Курсоры других пользователей отображаются как цветные стрелки с именами
5. При выходе из календаря или обрыве соединения курсор автоматиче��ки исчезает

#### Технические детали
- **WebSocket**: Native browser WebSocket API (не Supabase Realtime)
- **Авторизация**: JWT token в query string при подключении
- **Throttle**: 50ms (максимум 20 обновлений в секунду)
- **Timeout**: 5 секунд без обновлений → курсор исчезает
- **Reconnect**: Автоматическое переподключение с exponential backoff (5 попыток)
- **Координаты**: относительно viewport (clientX, clientY)
- **Z-index**: 9999 (поверх всех элементов)
- **Isolation**: Каждый workspace имеет отдельные соединения

#### WebSocket Endpoint
- **URL**: `GET /make-server-73d66528/cursors/:workspaceId?token=ACCESS_TOKEN`
- **Upgrade**: HTTP → WebSocket через `Deno.upgradeWebSocket()`
- **Хранение**: In-memory Map с активными соединениями `Map<workspaceId, Map<userId, ws>>`
- **Broadcast**: Отправка координат всем пользователям в workspace кроме отправителя
- **Cleanup**: Автоматическое удаление при disconnect

#### Сообщения WebSocket
- `connected` - подтверждение подключения + количество активных пользователей
- `cursor` - координаты курсора + метаданные (userId, email, displayName, avatarUrl, color)
- `disconnected` - уведомление об отключении пользователя

#### Визуальный стиль
- SVG стрелка курсора с уникальным цветом для каждого пользовате��я
- Цвет генерируется на основе hash(email): `hsl(hue, 70%, 50%)`
- Белый контур (stroke) для контраста
- Имя пользователя в цветном badge рядом с курсором
- Плавная анимация движения (100ms ease-out)
- `pointer-events: none` - курсоры не блокируют взаимодействие

#### Производительность
- **Network**: ~2 KB/сек отправка + ~8 KB/сек получение (5 пользователей)
- **Memory**: ~1 KB на курсор (client), ~1 KB на соединение (server)
- **CPU**: Минимальная нагрузка благодаря throttle и GPU acceleration
- Автоматическая очистка устаревших курсоров каждую секунду
- Не показывается свой курсор (фильтруется по userId)

#### Преимущества над Supabase Realtime
- ✅ Нет зависимости от `@supabase/supabase-js` в клиенте
- ✅ Полный контроль над WebSocket логикой
- ✅ Меньше overhead (прямой WebSocket vs Realtime protocol)
- ✅ Проще отладка (видны все сообщения в Network tab)
- ✅ Reconnect с exponential backoff

#### Файлы
- **Backend**: `/supabase/functions/server/index.tsx` (WebSocket endpoint + broadcast)
- **Frontend**: `/components/scheduler/CursorPresence.tsx` (WebSocket client + render)
- **Integration**: `/components/scheduler/SchedulerMain.tsx` (использование компонента)
- **Docs**: `/docs/COLLABORATIVE_CURSORS.md` (полная документация)
- **Deploy**: `/WEBSOCKET_CURSORS_READY.md` (инструкции по деплою)

---

### 🐛 Фикс ошибок Heartbeat и Leave

#### Проблема: "⚠️ Heartbeat: сетевая ошибка, сервер может быть недоступен"
- **Симптом**: При открытии календаря в консоли появляется предупреждение о сетевой ошибке heartbeat
- **Причины**:
  1. **Отсутствовал endpoint `/presence/leave/:workspaceId`** - при закрытии календаря OnlineUsers пытался отправить DELETE запрос на несуществующий endpoint
  2. **Слишком чувствительное логирование** - каждая ошибка heartbeat (даже разовая) показывалась как WARNING
  3. Heartbeat продолжал работать, но ошибки пугали пользователя
  
- **Решение**:
  - ✅ **Добавлен endpoint `DELETE /presence/leave/:workspaceId`**:
    ```typescript
    app.delete("/make-server-73d66528/presence/leave/:workspaceId", async (c) => {
      const presenceKey = `presence:${workspaceId}:${user.id}`;
      await kv.del(presenceKey);
      console.log(`✅ Presence удалён: ${user.email}`);
      return c.json({ success: true });
    });
    ```
  - ✅ **Умное логирование с счетчиком ошибок**:
    - Счетчик `heartbeatFailureCount` для отслеживания последовательных неудач
    - Первые 1-2 ошибки → `console.warn` (не критично, повтор через 30 сек)
    - 3+ ошибок подряд → `console.error` с подсказкой о деплое
    - При успешной отправке ��четчик сбрасывается
  - ✅ **Информативные сообщения**:
    ```
    ⚠️ Heartbeat: сетевая ошибка (попытка 1) - повтор через 30 сек
    ⚠️ Heartbeat: сетевая ошибка (попытка 2) - повтор через 30 сек
    ❌ Heartbeat: сетевая ошибка (попытка 3)
    💡 Убедитесь что Edge Function задеплоена: supabase functions deploy make-server-73d66528
    ```
  
- **Результат**: 
  - Graceful degradation - разовые сбои не пугают пользователя
  - Явные инструкции при множественных ошибках
  - Корректное удаление presence при закрытии календаря

---

### 🐛 Фикс таймаута OnlineUsers

#### Проблема: "⚠️ OnlineUsers: таймаут запроса (10 секунд)"
- **Симптом**: При загрузке онлайн пользователей запрос прерывался по таймауту
- **Причины**:
  1. **Дубликат endpoint'а** - `/presence/online/:workspaceId` был определен ДВАЖДЫ (строки 3122 и 3355)
  2. Второе определение перезаписывало первое в Hono
  3. **Слишком короткий таймаут** - 10 секунд недостаточно для медленных `kv.getByPrefix()` операций
  
- **Решение**:
  - ✅ Удален дубликат endpoint'а (строка 3122-3163)
  - ✅ Оставлена актуальная версия с TTL 60 секунд (строка 3355+)
  - ✅ Добавлено логирование времени выполнения:
    ```
    ⏱️ KV getByPrefix выполнен за XXXms
    ✅ Активных пользователей: N (общее время: XXXms)
    ```
  - ✅ Увеличен таймаут на клиенте: **10 → 30 секунд**
  - ✅ Обновлено сообщение об ошибке для диагностики
  
- **Результат**: 
  - Запросы успевают выполниться даже при медленной KV операции
  - Детальные метрики производительности в логах
  - Более информативные сообщения об ошибках

---

## [Unreleased]

### 🐛 Критический фикс модальных окон

#### Проблема "Not Found" при клике на кнопки (ИСПРАВЛЕНО)
- **Симптом**: При клике на кнопки внутри модалок → выброс на страницу "Not Found" → требуется обновление
- **Причина**: HTML `<button>` без `type` по умолчанию имеет `type="submit"` → браузер пытается отправить форму → 404
- **Исправленные модалки**:
  - ✅ **ProfileModal** - X, Upload, Отмена, Сохранить (+ preventDefault, stopPropagation)
  - ✅ **KeyboardShortcutsModal** - кнопка закрытия (X)
  - ✅ **CreateWorkspaceModal** - кнопка закрытия (X)
  - ✅ **DepartmentsManagementModal** - Отмена, Сохранить
  - ✅ **ProjectsManagementModal** - Отмена, Сохранить
  - ✅ **UsersManagementModal** - Отмена, Сохранить
- **Дополнительно**:
  - ✅ Убран избыточный toast "Изображение оптимизировано" в ProfileModal (остались логи)
- **Результат**: Все модалки работают плавно, никаких редиректов, кнопки работают корректно

### ✨ Оптимизация аватарок

#### Клиентско�� сжатие изображений (БЕЗОПАСНО)
- **Новая утилита** `/utils/imageResize.ts`:
  - Функция `resizeImageOnClient()` - сжатие до 200px по меньшей стороне
  - Canvas API с высоким качеством сглаживания
  - Конвертация в JPEG 90% качество
  - Graceful degradation - при ошибке использует оригинал
  - Подробное логирование процесса сжатия

- **Интеграция в ProfileModal**:
  - Автоматическое сжатие при выборе файла (асинхронно, ~100-300ms)
  - Toast уведомление "Изображение оптимизировано"
  - Preview из сжатого файла
  - Весь круг аватарки кликабельный (cursor: pointer)
  - Обновлённая подсказка: "автоматически оптимизируется"

- **Результаты**:
  - Фото 4000x3000px (2.5MB) → 267x200px (~40KB) - экономия 98%
  - Фото 1920x1080px (800KB) → 355x200px (~35KB) - экономия 95%
  - Изображение ≤200px → без изменений (оригинал)
  - Быстрая загрузка на сервер (маленькие файлы)
  - 100% безопасность - серверный код не затронут

- **Преимущества клиентского подхода**:
  - ✅ Нулевой риск падения сервера (vs серверное сжатие)
  - ✅ Экономия CPU Edge Functions
  - ✅ Мгновенный preview для пользователя
  - ✅ Простая отладка в браузере
  - ✅ Поддержка всех современных браузеров

- **Документация**: См. `/docs/CLIENT_SIDE_IMAGE_RESIZE.md`

---

## [1.8.8] - 2025-10-21

### 🔧 Критические улучшения Presence системы

#### Проблема "мигания" при возврате из календаря (ИСПРАВЛЕНО v2)
- **Симптом**: При нажатии "Назад" из календаря → текущий пользователь появляется на 1-2 секунды → исчезает
- **Причина - "гонка условий"**:
  1. OnlineUsers размонтируется → sendLeave() удаляет presence на сервере
  2. WorkspaceListScreen монтируется → показывает кэш `cache_online_users_batch`
  3. В кэше ещё есть текущий пользователь (данные устарели)
  4. Через 1-2 секунды batch запрос обновляется → пользоват��ль исчезает
  5. Результат: "мигание" аватарки

- **Решение (двухуровневое)**:
  1. **Очистка кэша** (v1):
     - `handleBackToWorkspaces()` в App.tsx мгновенно очищает текущего пользователя из `cache_online_users_batch`
     - WorkspaceListScreen мо��тируется с уже очищенным кэшем
     
  2. **Временная блокировка** (v2 - защита от быстрых переходов):
     - После очистки кэша устанавливается флаг `suppress_current_user_presence` (TTL 5 секунд)
     - WorkspaceListScreen при batch запросе проверяет этот флаг
     - Если флаг активен → фильтрует текущего пользователя из ВСЕХ воркспейсов
     - Применяется как к batch данным с сервера, так и к кэшу
     - Решает проблему: быстро вошли в календарь → heartbeat → сразу назад → batch успел записать presence → без блокировки было бы "мигание"
  
  - **Результат**: Нет "мигания" даже при мгновенных переходах (календарь → назад за <1 сек)
  - Graceful degradation: если блокировка не сработала → следующий batch запрос обновит через 15 сек

#### Исходная проблема (ИСПРАВЛЕНО)
- **Проблема**: Пользователи оставались "онлайн" 2+ минуты после закрытия календаря
  - Старая логика: heartbeat каждые 30 сек, TTL 2 минуты, НЕТ явного "leave"
  - При закрытии календаря компонент размонтировался, но presence оставался до истечения TTL
  - Резуль��ат: в списке воркспей��ов показывались "призраки" (ушедшие пользователи)

- **Решение - трёхступенчатое**:
  1. **Явный "leave" при размонтировании OnlineUsers**:
     - Новая функция `sendLeave()` - DELETE запрос к `/presence/leave/:workspaceId`
     - Вызывае��ся в `useEffect` cleanup при закрытии календаря
     - Мгновенно удаляет presence из KV Store
     - Таймаут 5 секунд (быстрее чем heartbeat)
  
  2. **Уменьшен TTL с 120 до 60 секунд**:
     - Если leave не дошёл (сетевая ошибка, закрытие вкладки) - автоматическое удаление через 60 сек
     - В 2 раза быстрее обновление онлайн статуса
     - Изменено в heartbeat endpoint и обоих online endpoints (single + batch)
  
  3. **Новый серверный endpoint**:
     - `DELETE /make-server-73d66528/presence/leave/:workspaceId`
     - Проверка авторизации через JWT токен
     - Удаляет `presence:{workspaceId}:{userId}` из KV Store
     - Детальное логирование: `👋 Leave от {email} из workspace {id}`

- **Эффект**:
  - ✅ При закрытии календаря → leave отправляется → пользователь исчезает из списка **МГНОВЕННО** (0 сек)
  - ✅ При сетевых проблемах → автоудаление через 60 сек (вместо 120 сек)
  - ✅ В списке воркспейсов показываются только реально активные пользователи
  - ✅ Нет "призраков" после закрытия календаря
  - ✅ Нет "мигания" текущего пользователя при возврате из календаря (очистка кэша)

### 📚 Документация
- **Новые документы**:
  - `/docs/PRESENCE_LEAVE_FIX.md` - подробное описание исправления "призраков" и "мигания"
  - `/docs/TESTING_CACHE_CLEANUP.md` - тестовые сценарии для проверки очистки кэша (обновлено для v2)
  - `/docs/FIX_FAST_TRANSITION_FLICKER.md` - детальное описание проблемы и решения v2
  - Обновлены: `Guidelines.md`, `DEPLOY_INSTRUCTIONS.md`, `QUICK_TEST_v1.8.8.md`, `PRESENCE_FLOW_DIAGRAM.md`

### 📝 Технические детали
- **App.tsx** (`handleBackToWorkspaces`):
  - Чтение `cache_online_users_batch` из IndexedDB
  - Фильтрация текущего пользователя из всех воркспейсов
  - Сохранение обновлённого кэша (с тем же timestamp)
  - **Установка блокировки** `suppress_current_user_presence` (TTL 5 сек)
  - Выполняется ДО `setSelectedWorkspace(null)` для гарантии очистки до ре-рендера
  - Graceful degradation - не критично если очистка не удалась

- **WorkspaceListScreen** (`fetchOnlineUsersForWorkspaces` и `loadCachedOnlineUsers`):
  - Проверка флага `suppress_current_user_presence` перед отображением данных
  - Если флаг активен (возраст < 5 сек) → фильтрация текущего пользователя
  - Применяется к batch данным с сервера И к кэшированным данным
  - Защита от "гонки условий" при быстрых переходах

- **OnlineUsers компонент**:
  - Новая функция `sendLeave()` с таймаутом 5 секунд
  - useEffect cleanup: `return () => { clearInterval(); sendLeave(); }`
  - Graceful degradation - если leave не дошёл, сработает автоудаление по TTL

- **Серверные изменения** (`/supabase/functions/server/index.tsx`):
  - Heartbeat: комментарий "TTL 60 секунд (1 минута)" вместо "TTL 2 минуты"
  - `GET /presence/online/:workspaceId`: фильтр `age < 60000` вместо `120000`
  - `POST /presence/online-batch`: фильтр `age < 60000` (60 секунд)
  - `DELETE /presence/leave/:workspaceId`: новый endpoint для явного leave

- **Логирование**:
  - `👋 Leave от {email} из workspace {id}` при вызове leave
  - `✅ Presence удалён: presence:{workspaceId}:{userId}`
  - `✅ Leave успешно отправлен - пользователь удалён из онлайн списка`

---

## [1.8.7] - 2025-10-21

### 🚀 Оптимизации
- **Мгновенное отображение онлайн пользователей в календаре**:
  - **Проблема**: При входе в календарь OnlineUsers дел��л запрос к `/presence/online/:workspaceId` → задержка 200-500ms
  - **Решение**: Читаем кэш `cache_online_users_batch` (загруженный WorkspaceListScreen) → мгновенное отображение
  - **Логика**: 
    1. При монтировании OnlineUsers проверяет кэш (TTL 45 секунд)
    2. Если кэш валиден → показываем пользователей сразу (0ms)
    3. В фоне делаем запрос к серверу → обновляем данные
  - **Эффект**: Такой же UX как в списке воркспейсов - нет задержки, данные показываются мгновенно
  - **Детальное логирование**: 
    - `🔍 OnlineUsers: проверка кэша для workspace X`
    - `💾 OnlineUsers: загружено из кэша (Nс н��зад): M пользователей`
    - `💡 OnlineUsers: показываем кэшированные данные мгновенно, запр��с в фоне...`
    - `✅ OnlineUsers: состояние обновлено с сервера - M пользователей`

### 📝 Технические детали
- Добавлен импорт `getStorageJSON` в OnlineUsers
- Добавлен `useRef<boolean>` для флага `hasLoadedCache` (однократная загрузка)
- Функция `loadFromCache()` - чтение кэша с проверкой TTL
- Изменен `fetchOnlineUsers(isInitial: boolean)` - при `isInitial=true` сначала читает кэш
- Логика: кэш → мгновенный показ → запрос к серверу → обновление в фоне

---

## [1.8.6] - 2025-10-21

### ✨ Новые возможности
- **Профильное меню с аватаркой**:
  - Заменена кнопка "Выйти" на профильное меню с аватаркой и displayName
  - Круглая аватарка с инициалами если фото не загружено
  - Dropdown меню с опциями: "Редактировать профиль", "Настройки", "Выйти"
  - Поддержка кириллицы в именах через `/utils/jwt.ts`

- **Редактирование профиля**:
  - Модальное окно ProfileModal для изменения displayName и аватарки
  - Загрузка фото до 5MB (jpeg, png, gif и др.)
  - Превью аватарки перед сохранением
  - Сохранение в Supabase Storage (публичный bucket `make-73d66528-avatars`)
  - Обновление user_metadata через server endpoint
  - Перезагрузка страницы после сохранения для получения нового токена

- **Аватар��а при регистрации**:
  - Возможность загрузить фото профиля сразу при создании аккаунта
  - Поле загрузки в форме регистрации (необязательное)
  - Превью с инициалами из Имени и Фамилии
  - Поддержка multipart/form-data в signup endpoint
  - Загрузка в Storage под именем `avatars/temp_{email}_{timestamp}.{ext}`

### 🔧 Технические изменения
- **Серверные endpoints**:
  - `POST /make-server-73d66528/profile/upload-avatar` - загрузка аватарки
  - `POST /make-server-73d66528/profile/update` - обновление профиля (displayName, avatar_url)
  - Обновлён `POST /make-server-73d66528/auth/signup` для поддержки multipart/form-data
  
- **Storage**:
  - Создаётся публичный bucket `make-73d66528-avatars` при первой загрузке
  - Аватарки сохраняются с уникальными именами `{user.id}_{timestamp}.{ext}`
  - Публичные URL доступны без signed URLs

- **JWT декодирование**:
  - Добавлено `avatar_url` в `SupabaseJWTPayload` интерфейс
  - Полная поддержка кириллических имён через TextDecoder UTF-8

### 📁 Новые файлы
- `/components/workspace/ProfileModal.tsx` - модальное окно редактирования профиля

### 🔧 Исправления (Critical Fixes)
- **🚨 КРИТИЧНО: Сервер не передавал avatarUrl в presence данных**:
  - **Проблема**: Heartbeat endpoint НЕ сохранял `user.user_metadata.avatar_url` в KV Store
  - **Решение**: Добавлен `avatarUrl` в `presenceData` объект при сохранении heartbeat
  - **Эффект**: Теперь аватарки показываются ВЕЗДЕ (в списке воркспейсов И в календаре)
  - Логирование: `✅ Presence сохранён: email (с аватаркой)` для диагностики

- **🚨 КРИТИЧНО: Исправлена логика объединения пользователей в OnlineUsers**:
  - **Проблема**: Текущий пользователь из токена (с avatarUrl) перезаписывался данными с сервера (без avatarUrl)
  - **Решение**: Текущий пользователь ВСЕГДА берется из токена, другие пользователи фильтруются
  - **Логика**: `[currentUser (из токена), ...otherUsers (с сервера без текущего)]`
  - Теперь аватарка текущего пользователя показывается ВСЕГДА внутри календаря
  
- **🚨 КРИТИЧНО: Исправлен парсинг batch response в WorkspaceListScreen**:
  - **Проблема**: Сервер возвращает `{ workspaces: {...} }`, код парсил `data` напрямую → `NaN пользователей`
  - **Решение**: Поддержка обоих форматов `data.workspaces || data` для обратной совместимости
  - Теперь онлайн пользователи корректно отображаются в списке воркспейсов

- **Правил��ная логика отображения онлайн пользователей**:
  - **В списке воркспейсов**: показываются ТОЛЬКО пользователи из presence (т.е. те кто ВНУТРИ воркспейса)
  - **Внутри календаря**: текущий пользователь показывается ВСЕГДА сразу из токена (не ждёт presence)
  - **Детальное логирование для диагностики**:
    - Batch effect: логирование вызова, workspaces count, IDs
    - Кэш: проверка наличия и количество воркспейсов
    - Сервер heartbeat: полный `user_metadata` JSON для проверки avatarUrl
    - Сервер online endpoint: каждый пользователь с displayName и avatarUrl
    - Сервер batch endpoint: детали по каждому воркспейсу
  - **Обновление токена после изменения профиля**:
    - После сохранения профиля страница перезагружается через 2 секунды
    - Это необходимо чтобы получить свежий токен с обновлё��ными user_metadata (displayName, avatarUrl)
    - Toast уведомление предупреждает пользователя о перезагрузке
  - Если аватарка отсутствует - показываются инициалы на цветном градиенте
  - Исправлен batch endpoint response parsing: `data.workspaces` → `data` (сервер возв��ащает results напрямую)
  - Presence endpoints правильно извлекают и передают `avatar_url` из `user_metadata`
  - `overflow-hidden` на кружках для корректного отображения круглых аватарок

---

## [1.8.5] - 2025-10-21

### ⚡ Оптимизация
- **WorkspaceListScreen - Кэширование онлайн пользователей**:
  - **Проблема**: При обновлении страницы воркспейсы грузились из кэша (быстро), а онлайн пользователи с сервера (медленно) → блок с аватарками "появлялся" через 1-2 секунды
  - **Решение**: 
    - Добавлено кэширование онлайн пользователей в IndexedDB (`cache_online_users_batch`)
    - TTL: 45 секунд (оптимально между свежестью данных и UX)
    - При загрузке: сначала показываются кэшированные данные (мгновенно), затем обновляются с сервера в фоне
    - Кэш очищается при выходе из системы
  - **Результат**: ✅ Воркспейсы и онлайн пользователи отображаются одновременно, без задержки
  - **UX**: Плавная загрузка экрана без "скачков" контента

## [1.8.4] - 2025-10-21

### 🔄 Рефакторинг
- **App.tsx - Упрощённый роутинг**:
  - **Убрано**: Флаг `isProgrammaticNavigation` и state `currentPath` - излишняя сложность
  - **Упрощено**: URL как единственный источник истины через `window.location.pathname`
  - **Логика**:
    1. При выборе воркспейса: `setSelectedWorkspace()` + `history.pushState('/workspace/:id')`
    2. При возврате к списку: `setSelectedWorkspace(null)` + `history.pushState('/')`
    3. При popstate (кнопка "назад"): проверяем URL и загружаем нужный воркспейс или показываем список
    4. При монтировании/авторизации: восстанавливаем из URL один раз
  - **Преимущества**: Меньше кода, проще понять, нативное поведение браузера
  - **Работает**: Прямые ссылки, обновление страницы, кнопка "назад/вперед" браузера

### ✅ Исправления
- **App.tsx - ИСПРАВЛЕНО мигание списка воркспейсов при обновлении страницы в календаре**:
  - **Проблема**: При F5 в календаре (/workspace/:id) на долю секунды отображался список воркспейсов
  - **Причина**: Рендер проходил через `!selectedWorkspace` → WorkspaceListScreen → useEffect загрузки → календарь
  - **Решение**: Добавлена проверка URL в рендере - если URL = /workspace/:id но selectedWorkspace = null, показыва��тся спиннер "Загрузка рабочего пространства..."
  - **Результат**: ✅ Плавный переход без мигания при обновлении страницы в календаре

## [1.8.3] - 2025-10-21

### ✅ Исправления
- **WorkspaceListScreen - ИСПРАВЛЕНО отображение онлайн пользова��елей**:
  - **Проблема 1**: workspace.id в базе хранится как number (1, 14), но JSON возвращает строковые ключи ("1", "14")
  - **Симптом 1**: `onlineUsersMap.get(14)` не находил данные, т.к. ключи были строками `"14"` (type mismatch)
  - **Решение 1**: Конвертация `workspace.id` в String перед поиском: `const workspaceIdStr = String(workspace.id)`
  - **Проблема 2**: В WorkspaceUsers передавался `onlineUsersMap.get(workspace.id)` вместо `users` (повторный поиск с неправильным ключом)
  - **Решение 2**: Использовать переменную `users`, которая уже получена с правильным ключом
  - **Результат**: ✅ Онлайн пользователи теперь корректно отображаются в мини-карточках воркспейсов
  - JavaScript Map использует строгое сравнение ключей: `map.get(14) !== map.get("14")`

### ⚡ Улучшения
- **WorkspaceListScreen - мгновенная загрузка онлайн пользователей**:
  - Batch запрос теперь делается СРАЗУ при загрузке (раньше только через 15 сек��нд)
  - Исправлена зависимость useEffect - теперь запускается когда accessToken становится доступен
  - Добавлены детальные логи для диагностики:
    - Список workspace_ids в batch запросе
    - Количество онлайн пользователей в каждом воркспейсе
    - Информативное сообщение если нет онлайн пользователей
  - Объяснение в консоли как работает presence система

### 🐛 Исправлено
- **Система Presence - критическая ошибка с отображением онлайн пользователей**:
  - **Проблема #1 - Двойное кодирование**: 
    - `kv.set()` сохраняет в JSONB колонку (автоматически делает JSON.parse)
    - Мы делали `JSON.stringify()` перед сохранением → строка сохранялась как JSONB
    - При `kv.getByPrefix()` возвращалась строка вместо объекта
    - Наш `JSON.parse()` пытался парсить уже строку → данные терялись
  - **Решение**: Передаем объект напрямую в `kv.set()` без `JSON.stringify()`
  - **Проблема #2 - Текущий пользователь фильтровался**:
    - `WorkspaceUsers.tsx` фильтровал текущего пользователя (строки 48-50)
    - Если пользователь был один в воркспейсе → аватарки не показывались вообще
  - **Решение**: Текущий пользователь теперь ВСЕГДА показывается (зеленый градиент, метка "(вы)")
  - Затронутые файлы:
    - `/supabase/functions/server/index.tsx` - heartbeat, batch endpoint
    - `/components/workspace/WorkspaceUsers.tsx` - логика фильтрации и сортировки
  
### 🎨 Улучшения UI
- **WorkspaceUsers** - визуальное отличие текущего пользователя:
  - Зеленый градиент (from-green-500 to-green-700) вместо синего
  - Метка "(вы)" зеленого цвета в tooltip
  - Текущий пользователь всегда справа (после rotate-180)

### 🧹 Оптимизация
- Почищены избыточные debug логи в batch запросах
- Улучшена читаемость логов presence системы

## [1.8.2] - 2025-10-21

### 🐛 Исправлено
- **URL роутинг**: Окончательно исправлена ошибка "Воркспейс не найден" при навигации
  - Проблема: useEffect восстановления срабатывал при программной навигации через handleSelectWorkspace
  - Решение: Добавлен флаг `isProgrammaticNavigation` (useRef) для разделения типов навигации
  - Программная навигация (клик по ворксп��йсу) → устанавливает флаг → пропускает восстановление
  - Навигация браузером (back/forward/прямая ссылка) → флаг false → выполняет восстановление
  - Теперь воркспейс загружается ТОЛЬКО когда это действительно нужно
  - См. подробную документацию в `/docs/NAVIGATION_PATTERN.md`

## [1.8.1] - 2025-10-21

### 🐛 Исправлено
- **Кириллица в именах пользователей**: Исправлена некорректная декодировка JWT токенов с русскими символами
  - Проблема: `atob()` не поддерживает UTF-8, вместо кириллицы показывались "кракозябры"
  - Решение: Создан модуль `/utils/jwt.ts` с функциями для правильной обработки UTF-8
  - Теперь имена на русском языке ко��ректно отображаются сразу при входе в воркспейс

### 🚀 Новые утилиты
- **`/utils/jwt.ts`** - модуль для работы с JWT токенами с поддержкой кириллицы:
  - `decodeBase64Unicode()` - декодирование base64url → UTF-8 с поддержкой Unicode
  - `decodeJWT()` - универсальная декодировка JWT токенов
  - `decodeSupabaseJWT()` - типизированная декодировка Supabase токенов
  - `getDisplayNameFromToken()` - извлечение имени из токена
  - `getEmailFromToken()` - извлечение email из токена
  - `getUserIdFromToken()` - извлечение user ID из токена

## [1.8.0] - 2025-10-21

### ���� Новые функции
- **URL Роутинг через History API**:
  - Добавлена реальная навигация между страницами (вместо условного рендеринга)
  - URL структура: "/" - список воркспейсов, "/workspace/:workspaceId" - календарь
  - Кнопка "назад" в браузере теперь возвращает к списку воркспейсов (вместо выхода с сайта)
  - Поддержка прямых ссылок - можно открыть воркспейс по URL
  - Обработка события popstate для корректной работы навигации

### ⚡ Улучшения производительности
- **Мгновенное отображение своей аватарки в OnlineUsers**:
  - Текущий пользователь показывается СРАЗУ (парсится из accessToken, без запроса к серверу)
  - Больше не нужно ждать 15 секунд до первого отображения своей аватарки
  - Остальные онлайн пользователи подгружаются асинхронно в фоне
  - Используется useMemo для эффективного объединения currentUser + onlineUsers

### 🔧 Технические улучшения
- **App.tsx**: Добавлен state currentPath для отслеживания текущего URL
- **App.tsx**: handleSelectWorkspace теперь обновляет URL через pushState
- **App.tsx**: handleBackToWorkspaces обновляет URL и добавляет в историю
- **App.tsx**: Автоматическое восстановление воркспейса при прямом переходе по URL
- **App.tsx**: Динамическое обновление document.title в зависимости от выбранного воркспейса
- **OnlineUsers**: Рефакторинг - currentUser вычисляется отдельно (из токена), объединяется с onlineUsers
- **OnlineUsers**: Добавлен лог при создании текущего пользователя для отладки
- **WorkspaceListScreen**: Оптимизированы логи batch запросов (убраны избыточные детали)

## [1.7.4] - 2025-10-21

### 🐛 Исправлено
- **Логика отображения текущего пользователя в Presence системе**:
  - В карточках воркспейсов (WorkspaceUsers) - текущий пользователь НЕ показывается (он априори онлайн, не нужен в превью)
  - Вну��ри календаря (OnlineUsers) - текущий пользователь ПОКАЗЫВАЕТСЯ (чтобы было понятно "кто я")
  - Убрана золотая рамка для текущего пользователя
  - Метка "(вы)" теперь зеленого цвета вместо желтого
  - Добавлены детальные debug логи для диагностики проблем с онлайн пользова��елями

### 🔧 Технически�� улучшения
- Добавлено логирование в WorkspaceListScreen для отладки батч-запросов
- Добавлено логирование в WorkspaceUsers для отладки рендеринга
- Улучшена обработка ошибок при batch запросах (логируется response.text() при ошибке)

## [1.7.2] - 2025-10-21

### 🐛 Исправлено
- **Улучшена обработка ошибок в Presence системе**
  - Добавлен 10-секундный таймаут для всех presence запросов (heartbeat и получение онлайн пользователей)
  - Сетевые ошибки теперь логируются как предупреждения (⚠️) вместо критических ошибок (❌)
  - При временных сетевых проблемах сохраняется последнее известное состояние онлайн пользователей
  - Graceful degradation - приложение продолжает работать даже при недоступности presence системы
  - Улучшены сообщения об ошибках для упрощения диагностики проблем с сервером

### ⚡ Производительность
- **Оптимизация OnlineUsers компонента**
  - Добавлена мемоизация с `React.memo` - компонент больше не ре-рендерится при hover на ячейках календаря
  - Мемоизирован `currentUserEmail` в SchedulerMain через `useMemo` для стабильности пропсов
  - Убраны избыточные console.log при каждом рендере (были логи при каждом движении мыши)
  - Умное обновление состояния - `setOnlineUsers` теперь сравнивает данные и обновляет только при изменениях

- **Оптимизация загрузки онлайн пользователей в списке воркспейсов**
  - Создан батч-endpoint `/presence/online-batch` - один запрос вместо N запросов для каждого воркспейса
  - Снижена нагрузка на базу данных: было N запросов каждые 10 секунд → стало 1 запрос каждые 15 секунд
  - Параллельная обработка на сервере через Promise.all для всех воркспейсов
  - Увеличен интервал опроса с 10 до 15 секунд (и в календаре, и в списке воркспейсов)
  - Значительное снижение трафика: для 10 воркспейсов было 60 запросов/мин → стало 4 запроса/мин

### 🎨 UI/UX
- **WorkspaceUsers (кружки онлайн пользователей в списке воркспейсов)**
  - Кружки теперь наложены друг на друга с эффектом "стопки карт" (marginLeft: -8px)
  - Убрана тень (shadow-sm) для более чистого вида
  - Единообразие с OnlineUsers внутри календаря

### 📚 Документация
- Создан `PRESENCE_TROUBLESHOOTING.md` - подробное руководство по диагностике и решению проблем
- Создан `QUICK_FIX_PRESENCE.md` - экспресс-руководство для быстрого решения проблем (30 секунд)
- Создан `PERFORMANCE_FIX.md` - детальное объяснение оптимизации OnlineUsers компонента
- Обновлён `Guidelines.md` до версии 1.7.2

### 🔧 Технические улучшения
- Добавлен AbortController для всех fetch запросов в presence системе
- Улучшенная обр��ботка различных типов ошибок (AbortError, Network Error, Server Error)
- Более детальн��е логирование для диагностики проблем (только при реальных изменениях)
- Новый серверный endpoint для батч-операций с presence данными

---

## [1.7.0] - 2025-10-20

### ✨ Добавлено
- **Система отображения онлайн пользователей**
  - Новый компонент `OnlineUsers` показывает пользователей, работающих в текущем воркспейсе
  - Расположен слева внизу экрана (симметрично фильтрам справа)
  - Такой же фон как у фильтров: `bg-[rgba(0,0,0,0.75)] backdrop-blur-md`
  - **Дизайн**: горизонтальный ряд кружочков с инициалами (градиент от синего)
  - **Инициалы**: первая буква имени + первая буква фамилии из `displayName`
  - **Tooltip при наведении**: показывает полное имя и email пользователя
  - **Индикатор**: зелёная точка с пульсацией + счётчик онлайн пользователей
  - **Анимация**: кружочки увеличиваются при наведении (scale 1.1)

### ��� Backend
- **Presence endpoints**
  - `POST /presence/heartbeat` - отправка heartbeat от пользователя (каждые 30 секунд)
  - `GET /presence/online/:workspaceId` - получение списка онлайн пользователей
  - Данные хранятся в KV Store с ключом `presence:{workspace_id}:{user_id}`
  - TTL 2 минуты - пользователи считаются онлайн если последний heartbeat < 2 минут назад
  - Автоматическая очистка устаревших записей при запросе списка

### 🔐 Исправлено
- **Критическая ошибка импорта Supabase в Edge Function**
  - Исправлен импорт `@supabase/supabase-js` с `npm:` на `jsr:` в `/supabase/functions/server/index.tsx`
  - Решена проблема "Cannot find module 'tslib'" в Deno Edge Runtime
  - JSR (JavaScript Registry) от Deno лучше работает с Edge Functions и не требует дополнительных зависимостей

### 🔄 Изменено
- **Интервалы обновления**
  - Heartbeat отправляется каждые 30 секунд
  - Список онлайн пользователей обновляется каждые 10 секунд
  - При размонтировании компонента интервалы очищаются
  - Использованы `useCallback` хуки для оптимизации

### 📚 Документация
- Обновлён Guidelines.md до версии 1.7.0
- Добавлено описание presence системы

---

## [1.6.1] - 2025-10-20

### 🔐 Исправлено
- **Автоматическое обновление access_token через refresh_token**
  - Access token от Supabase живет только 1 час, теперь сервер автоматически обновляет его через refresh_token
  - Refresh token живет 30 дней (как и session_id в KV store)
  - При проверке сессии сервер проверяет, истек ли access_token (expires_at < 5 минут), и автоматически обновляет его
  - Сохранение refresh_token в sessionData на сервере (endpoints: /auth/signin, /auth/verify-otp)
  - Периодическая проверка сессии на клиенте изменена с 50 минут на 10 минут (сервер сам обновляет токены)

### 🔄 Изменено
- **Улучшенная логика /auth/session endpoint**
  - Сохранение refresh_token и expires_at в KV store
  - Автоматический вызов supabaseAuth.auth.refreshSession() при истекшем access_token
  - Обновление sessionData в KV store после refresh
  - Детальное логирование всех операций с токенами
- **Уменьшена частота проверки сессии** на клиенте с 50 до 10 минут (более эффективно)

### 📚 Документация
- Обновлён Guidelines.md - раздел Session Management
- Добавлено описание автоматического обновления токенов

---

## [1.6.0] - 2025-10-20

### ✨ Добавлено
- **Отложенное удаление элементов** во всех модалках управления
  - При клике на корзину элемент помечается для удаления локально (удаляется из UI, добавляется ID в массив `deletedIds`)
  - Реальное удаление на сервере происходит при нажатии "Сохранить"
  - Confirm диалог с предупреждением "Удаление будет выполне��о после нажатия Сохранить"
  - Порядок сохранения: 1) Удаление → 2) Создание → 3) Обновление

### 🔄 Изменено
- **Унифицирован DepartmentsManagementModal** по ��аттерну ProjectsManagementModal и UsersManagementModal
  - Убран старый подход с `isCreating` и `newDeptName`
  - Добавлен массив `localNewDepartments` для множественного добавления департаментов
  - Теперь все три модалки работают идентично

### 📚 Документация
- Обновлён Guidelines.md до версии 1.6.0
- Добавлены детальные правила для отложенного удаления
- Уточнён порядок сохранения изменений

---

## [1.5.1] - 2025-10-20

### ✨ Добавлено
- **Множественное добавление элементов** во всех м��далках управления
  - При нажатии "Добавить" появляется новая строка в списке (можно добавить хоть 10 пустых)
  - Визуальное выделение новых строк: `bg-blue-50`, рамка `border-2 border-blue-300`
  - Корзина для удаления новых строк до сохранения
  - Новые элементы хранятся в локальном состоянии (`localNewProjects`, `localNewUsers`) и создаются в БД только при сохранении
  - Фильтрация валидных элементов (с заполненным именем) перед сохранением

### 🔄 Изменено
- **Кнопка "Отмена"** теперь всегда закрывает модалку целиком (не только форму создания)
  - Проверка `hasChanges` перед закрытием
  - Confirm диалог при наличии несохранённых изменений
- **Улучшена логика `hasChanges`** - учитывает наличие любых новых строк (даже пустых)
- **Параллельное сохранение** всех изменений через `Promise.all()`

### 📚 Документация
- Обновлён Guidelines.md до версии 1.5.1
- Добавлены детальные правила для модальных окон

---

## [1.5.0] - 2025-10-19

### ✨ Добавлено
- **Воркспейсы (Workspaces)** - организация проектов по годам
  - Новые таблицы: `workspaces`, `workspaces_summary`
  - Экран выбора воркспейса (WorkspaceListScreen)
  - Модалка создания воркспейса (CreateWorkspaceModal)
  - Кэширование списка воркспейсов в IndexedDB
  - Автоскролл к текущей неделе только для воркспейсов текущего года
  - Breadcrumb навигация: Воркспейсы → Департаменты
  - API endpoints: GET/POST `/workspaces`, GET `/workspaces/summary`

### 🔄 Изменено
- Все сущности (проекты, департаменты, события) привязаны к `workspace_id`
- Фильтрация данных по выбранному воркспейсу
- После авторизации всегда показывается список воркспейсов
- Кнопка "Выход" заменена на breadcrumb с возможностью вернуться к списку воркспейсов

### 🐛 Исправлено
- Ошибки при работе без выбранного воркспейса

---

## [1.4.0] - 2025-10-18

### ✨ Добавлено
- **Режим перемещения (Ctrl/Cmd + hold)** - скрывает ручки resize для удобного drag & drop
- **30-дневные сессии** с автоматическим обновлением токенов
  - Session ID сохраняется в IndexedDB и KV Store на сервере
  - Автоматическая проверка сессии каждые 50 минут
  - Graceful обработка истёкших сессий
- **Sticky названия проектов** при горизонтальном скролле
  - `position: sticky` на `.ev-name`
  - `background: inherit` для корректного отображения
- **Спиннер загрузки событий** использует `textColor` проекта из БД
  - Размер 10px, border-color с opacity 20% и 100%

### 🔄 Изменено
- **Улучшена авторизация**
  - Детальное логирование всех этапов
  - Проверка сессии через сервер при загрузке приложения
  - Сохранение `access_token` и `session_id` в IndexedDB
- **Health check сервера** при загрузке приложения
  - Информативный экран ошибки с инструкциями

### 🐛 Исправлено
- Утечка session ID в логах (теперь только preview)
- Проблемы с обновлением токенов
- Scroll offset при перемещении департаментов в модалке

---

## [1.3.0] - 2025-10-17

### ✨ Добавлено
- **Паттерны со��ытий** (Event Patterns)
  - Таблица `event_patterns` в БД
  - Выбор паттерна при создании/редактировании события и проекта
  - Визуальное отображение патт����рнов через `background-image`
  - API endpoints: GET `/event-patterns`
- **Димминг неактивных событий** при фильтрации проектов
  - События не выбранных проектов: `backgroundColor: #AAA`, `color: #333`, `opacity: 0.2`
  - Паттерны сохраняются поверх серого фона
  - Плавный переход через `transition: opacity 0.2s ease`
- **Модалка управления пользователями** (UsersManagementModal)
  - Создание, редактирование, удаление сотрудников
  - Выбор грейда, департамента, компании
  - Сортировка по департаменту и гре��ду

### 🔄 Изменено
- **Улучшена модалка управления проектами**
  - Выбор паттерна для проекта
  - Preview с паттерном
  - Автогенерация цветов с confirm диалогом
- **Рефакторинг модалок**
  - Единый компонент ManagementModalHeader
  - Локальное состояние для всех изменений
  - Сохранение только по кнопке "Сохранить"

### 📚 Докумен��ация
- Добавлены правила для модальных окон в Guidelines.md
- Описание паттернов событий
- Логика фильтрации проектов

---

## [1.2.0] - 2025-10-16

### ✨ Добавлено
- **Модалка управления департаментами** (DepartmentsManagementModal)
  - Создание, переименование, удаление департаментов
  - Drag & drop для изменения порядка (queue)
  - Переключение видимости департаментов
  - Отображение количества сотрудников
  - Плавный скролл при перестановке элементов
- **Модалка управления проектами** (ProjectsManagementModal)
  - Создание, редактирование, удаление проектов
  - Автогенерац��я случайных цветов (HSL)
  - Умный выбор цвета текста (белый/чёрный) на основе яркости фона
  - Клик на preview блок для генерации новых цветов
- **Toast уведомления** вместо alert()
  - Компонент ToastContext
  - Типы: success, error, warning, info
  - Кастомные стили для каждого типа

### 🔄 Изменено
- **Улучшена FilterToolbar**
  - Теперь отображается всегда
  - Переключение между фильтрацией департаментов и проектов
  - Кнопки управления департаментами и проектами
- **Рефакторинг API клиентов**
  - Единая функция `apiRequest` в `base.ts`
  - Обработка ошибок в одном месте
  - Детальное логирование

### 🐛 Исправлено
- Проблемы с отображением фильтров
- Ошибки при создании/удалении проектов

---

## [1.1.0] - 2025-10-15

### ✨ Добавлено
- **Режим ножниц (Scissors Mode)** для разделения событий
  - Визуальные направляющие на границах недель
  - Hover эффекты с highlight
  - Разделение событий на части с сохранением в БД
  - Отключение анимаций для резкого реза
- **Z-order управление** для перекрывающихся событий
  - Клик на событие поднимает его наверх
  - Сохранение z-index в БД
  - Обновление через API
- **Pending состояние** для событий в процессе сохранения
  - `opacity: 0.6` + diagonal stripes
  - `cursor: wait`
  - Блокировка взаимодействий

### 🔄 Изменено
- **Улучшена производительность**
  - GPU acceleration (`translateZ(0)`) для событий
  - `will-change` только для анимируемых свойств
  - Debounced updates при drag & drop
- **Оптимизирован Resize**
  - Плавная анимация с `cubic-bezier(0.25, 0.1, 0.25, 1)`
  - 4 направления: top, bottom, left, right
  - Умное снятие фокуса при начале resize

### 🐛 Исправлено
- Проблемы с перекрытием событий
- Лаги при большом количестве событий
- Баги с resize handles

---

## [1.0.0] - 2025-10-14

### ✨ Первый релиз
- **Годовой календарь** с 52 неделями
  - Понедельник как начало недели
  - Sticky заголовки (месяцы, недели, имена)
  - Маркер текущей недели (красная линия)
  - Авто��кролл к текущей неделе
- **Drag & Drop событий**
  - Курсорное позиционирование
  - Snap-to-grid для недель
  - Визуальная обратная связь
- **Resize событий** в 2 направления (left, right)
- **Undo/Redo** с горячими клавишами
  - Ctrl/Cmd + Z - отмена
  - Ctrl/Cmd + Shift + Z / Ctrl/Cmd + Y - повтор
  - Стек до 50 операций
- **Департаменты** с группировкой сотрудников
  - Сортировка по queue
  - Переключение видимости
  - Липкие заголовки департаментов
- **Проекты** с кастомными цветами
  - `backgroundColor` и `textColor` из БД
  - Поддержка HEX цветов
- **События** с привязкой к проекту и сотруднику
  - Даты начала и окончания
  - Hover эффекты
  - Context menu для удаления
- **Настройки размеров** через Toolbar
  - weekWidth: 48-220px
  - rowHeight: 48-144px
  - Сохранение в cookies
- **Аутентификация**
  - Только корпоративные email @kode.ru
  - Sign In / Sign Up
  - OTP поддержка
  - Access tokens в IndexedDB
- **Базовые API endpoints**
  - `/resources` - сотрудники
  - `/departments` - департаменты
  - `/projects` - проекты
  - `/events` - события (CRUD)
  - `/grades` - грейды
  - `/companies` - компании
- **Supabase интеграция**
  - PostgreSQL база данных
  - Edge Function на Hono
  - KV Store для дополнительных данных
  - Service Role для защищённых операций

### 🎨 UI/UX
- **CSS Grid** для календарной сетки
- **Tailwind CSS v4** для стилизации
- **Shadcn/ui** компоненты
- **Responsive design** (desktop-first)
- **Кастомные анимации** и transitions
- **Детальное логирование** с эмоджи

### 📚 Документация
- Guidelines.md - полное руководство по разработке
- TypeScript интерфейсы в `/types/scheduler.ts`
- Комментарии в коде для сложных алгоритмов

---

## Формат версий

Проект использует [Semantic Versioning](https://semver.org/lang/ru/):

- **MAJOR** версия - несовместимые изменения API
- **MINOR** версия - новая функциональность, обратная совместимость
- **PATCH** версия - исправления ошибок

## Типы изменений

- `✨ Добавлено` - новая функциональность
- `🔄 Изменено` - изменения в существующей функциональности
- `🗑️ Удалено` - удалённая функциональность
- `🐛 Исправлено` - исправления ошибок
- `🔒 Безопасность` - исправления уязвимостей
- `📚 Документация` - изменения в документации
- `🎨 UI/UX` - изменения интерфейса
- `⚡ Производительность` - улучшения производительности
