# Testing Checklist v2.6 - Tier 1 Optimizations

## ✅ Pre-Integration Checklist

Перед интеграцией убедитесь что:

- [ ] Сделан backup текущей версии (git commit)
- [ ] Прочитан `/QUICK_START_TIER_1_v2.6.md`
- [ ] Открыты DevTools (будем мониторить метрики)
- [ ] Есть тестовые данные (хотя бы 10 сотрудников, 20 событий)

---

## 🔍 Tier 1.1: Debounced Filters

### Интеграция (5-10 минут)

**FilterToolbar.tsx**:
- [ ] Добавлен import `useFilters`
- [ ] Добавлен `searchQuery, setSearchQuery`
- [ ] Добавлен input в JSX
- [ ] Input использует `searchQuery` (не debouncedSearchQuery)

**SchedulerMain.tsx**:
- [ ] Добавлен import `useFilters`
- [ ] Получен `debouncedSearchQuery`
- [ ] Добавлена фильтрация в `filteredResources`
- [ ] `debouncedSearchQuery` добавлен в dependencies useMemo

### Тестирование

**Базовый функционал**:
- [ ] Input появился в FilterToolbar
- [ ] При вводе текст появляется мгновенно
- [ ] При вводе "Иван" фильтруются сотрудники с этим именем
- [ ] При очистке поля все сотрудники возвращаются

**Performance**:
- [ ] Откройте DevTools → Performance
- [ ] Начните запись
- [ ] Введите "Иван Иванов" быстро (10 символов)
- [ ] Остановите запись
- [ ] **Проверьте**: Должен быть **1-2 ре-рендера** вместо 10
- [ ] **Проверьте**: Scripting time <50ms total

**Console**:
- [ ] Нет ошибок в консоли
- [ ] Нет warnings о missing dependencies

**Edge Cases**:
- [ ] Пустой поиск - показываются все
- [ ] Поиск "zzzzz" (не существует) - пустой список
- [ ] Поиск по позиции работает
- [ ] Поиск по email работает (если есть)
- [ ] Кириллица работает корректно
- [ ] Латиница работает корректно

---

## 💾 Tier 1.2: IndexedDB Cache

### Интеграция (15-20 минут)

**SchedulerContext.tsx**:
- [ ] Добавлены imports из `indexedDBCache.ts`
- [ ] `loadEvents` обновлен (кэш → API → обновление)
- [ ] `loadProjects` обновлен
- [ ] `loadResources` обновлен
- [ ] `loadDepartments` обновлен
- [ ] `loadGrades` обновлен
- [ ] `loadCompanies` обновлен
- [ ] `loadEventPatterns` обновлен
- [ ] `createEvent` обновляет кэш
- [ ] `updateEvent` обновляет кэш
- [ ] `deleteEvent` обновляет кэш

**AuthScreen.tsx**:
- [ ] Добавлен import `clearAllCache`
- [ ] `handleSignOut` вызывает `clearAllCache()`

### Тестирование

**Первая загрузка (без кэша)**:
- [ ] Очистите IndexedDB (DevTools → Application → IndexedDB → Delete)
- [ ] Откройте календарь
- [ ] Должна быть задержка ~800ms (первая загрузка с сервера)
- [ ] DevTools → Application → IndexedDB → scheduler-cache:
  - [ ] Есть store `events`
  - [ ] Есть store `projects`
  - [ ] Есть store `resources`
  - [ ] Есть store `departments`
  - [ ] Есть store `grades`
  - [ ] Есть store `companies`
  - [ ] Есть store `eventPatterns`

**Вторая загрузка (с кэшем)**:
- [ ] Обновите страницу (F5)
- [ ] **Проверьте**: Календарь появляется **мгновенно** (0-50ms)
- [ ] **Проверьте**: Console показывает `📦 Loaded N events from IndexedDB`
- [ ] **Проверьте**: Данные корректные (те же события, проекты, сотрудники)

**Background refresh**:
- [ ] Подождите 3 секунды после загрузки
- [ ] DevTools → Network: Должен быть запрос к API
- [ ] Console: `✅ Loaded N fresh events`
- [ ] Данные обновились (если были изменения на сервере)

**TTL (Time To Live)**:
- [ ] Создайте событие
- [ ] Подождите 6 минут
- [ ] Обновите страницу
- [ ] **Проверьте**: События загружаются с сервера (кэш истек)
- [ ] Console: `📦 Cached events expired`

**Offline mode**:
- [ ] Загрузите календарь (чтобы кэш заполнился)
- [ ] DevTools → Network → Offline
- [ ] Обновите страницу
- [ ] **Проверьте**: Календарь показывается (из кэша)
- [ ] **Проверьте**: Есть warning в console о network error
- [ ] DevTools → Network → Online
- [ ] Через 3 секунды данные обновятся

**Cache invalidation**:
- [ ] Создайте событие
- [ ] **Проверьте**: Кэш обновился (DevTools → IndexedDB)
- [ ] Удалите событие
- [ ] **Проверьте**: Кэш обновился
- [ ] Выйдите из системы
- [ ] **Проверьте**: IndexedDB очищен (все stores пустые)

**Multiple workspaces**:
- [ ] Откройте workspace A → подождите 3 сек
- [ ] Переключитесь на workspace B → подождите 3 сек
- [ ] Вернитесь на workspace A
- [ ] **Проверьте**: Instant loading (кэш)
- [ ] DevTools → IndexedDB: Оба workspace кэшированы

---

## 📦 Tier 1.3: Batched Updates

### Интеграция (10-15 минут)

**SchedulerMain.tsx** (или useEventInteractions.ts):
- [ ] Добавлен import `useBatchedUpdatesMap`
- [ ] Создан batch hook с правильным key extractor
- [ ] Drag handler использует `addEventUpdate`
- [ ] UI обновляется мгновенно (оптимистично)
- [ ] PointerUp вызывает `flush()`

### Тестирование

**Базовый drag**:
- [ ] Перетащите событие на 2 недели вправо
- [ ] **Проверьте**: Событие перемещается плавно (визуально)
- [ ] **Проверьте**: После отпускания мыши сохраняется на сервере

**Batching**:
- [ ] Откройте DevTools → Network → Clear
- [ ] Перетащите событие много раз (shake)
- [ ] Отпустите мышь
- [ ] **Проверьте**: Console показывает `📦 Batching N event updates`
- [ ] **Проверьте**: Network показывает **1 запрос** вместо множества
- [ ] **Проверьте**: Событие на правильной позиции

**Auto-flush (timeout)**:
- [ ] Перетащите событие
- [ ] Не отпускайте мышь
- [ ] Подождите 600ms
- [ ] **Проверьте**: Запрос ушел автоматически (timeout)

**Multiple events**:
- [ ] Перетащите событие A
- [ ] Быстро перетащите событие B
- [ ] Быстро перетащите событие C
- [ ] Отпустите мышь
- [ ] **Проверьте**: `📦 Batching 3 event updates`
- [ ] **Проверьте**: Все 3 события на правильных позициях

**Deduplication (Map version)**:
- [ ] Перетащите событие A на 1 неделю вправо
- [ ] Перетащите то же событие A еще на 1 неделю вправо
- [ ] Перетащите то же событие A еще на 1 неделю вправо
- [ ] Отпустите мышь
- [ ] **Проверьте**: `📦 Batching 1 event updates` (не 3!)
- [ ] **Проверьте**: Событие на финальной позиции (+3 недели)

**Error handling**:
- [ ] Отключите сервер (или сымитируйте 500 error)
- [ ] Перетащите событие
- [ ] Отпустите мышь
- [ ] **Проверьте**: Toast с ошибкой
- [ ] **Проверьте**: Console показывает error
- [ ] **Проверьте**: Событие осталось в UI (оптимистично)

---

## 📊 Performance Metrics

### Baseline (до оптимизаций)

**Запишите метрики**:
- [ ] First paint: ______ ms
- [ ] Search (10 chars) renders: ______ 
- [ ] Drag requests: ______
- [ ] Workspace switch time: ______ ms

### After Tier 1 (после оптимизаций)

**Проверьте улучшения**:
- [ ] First paint: **0-50ms** (с кэшем)
- [ ] Search (10 chars) renders: **1-2**
- [ ] Drag requests: **1**
- [ ] Workspace switch time: **0-100ms** (с кэшем)

### DevTools Performance

**Record performance при различных действиях**:

**Поиск**:
- [ ] Запишите поиск "Иван Иванов"
- [ ] **Проверьте**: FPS стабильно 60
- [ ] **Проверьте**: Scripting <50ms total
- [ ] **Проверьте**: 1-2 ре-рендера вместо 10

**Drag**:
- [ ] Запишите drag события
- [ ] **Проверьте**: FPS 55-60
- [ ] **Проверьте**: Плавная анимация
- [ ] **Проверьте**: Layout/Paint <16ms

**Scroll**:
- [ ] Запишите scroll календаря
- [ ] **Проверьте**: FPS 60
- [ ] **Проверьте**: Нет jank/stuttering

### DevTools Memory

**Heap snapshot**:
- [ ] Сделайте heap snapshot
- [ ] Откройте календарь
- [ ] Сделайте второй snapshot
- [ ] **Проверьте**: Нет утечек памяти
- [ ] **Проверьте**: DOM nodes <5000

### DevTools Network

**Запишите network activity**:
- [ ] Очистите network log
- [ ] Откройте календарь
- [ ] Подождите 30 секунд
- [ ] **Проверьте**: Меньше запросов чем раньше
- [ ] **Проверьте**: Instant loading (кэш)

---

## 🐛 Known Issues & Workarounds

### Issue: Search не фильтрует
**Причина**: `debouncedSearchQuery` не в dependencies  
**Fix**: Добавьте в dependencies массив useMemo

### Issue: Cache не работает
**Причина**: IndexedDB не поддерживается в приватном режиме  
**Fix**: Проверьте что не в incognito mode

### Issue: Batching не срабатывает
**Причина**: `flush()` не вызывается в pointerUp  
**Fix**: Добавьте вызов `flushEventUpdates()` в handler

### Issue: Кириллица в search
**Причина**: toLowerCase не работает для некоторых символов  
**Fix**: Используется `.toLowerCase()` - должно работать

---

## ✅ Final Checklist

После всех тестов:

- [ ] Все базовые функции работают
- [ ] Нет ошибок в console
- [ ] Нет warnings
- [ ] Performance улучшилась
- [ ] UX стал лучше
- [ ] Готово к production

**Если всё ✅ - можно деплоить!**

**Если есть проблемы** - см. Troubleshooting в `/QUICK_START_TIER_1_v2.6.md`

---

**Версия**: v2.6  
**Дата**: 2025-10-22  
**Время тестирования**: ~1 час  
**Критичность**: Высокая (нужно протестировать все)
