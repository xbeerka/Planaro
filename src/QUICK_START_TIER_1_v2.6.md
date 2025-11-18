# Quick Start - Tier 1 Optimizations v2.6

## ⚡ 30-минутная интеграция

### ✅ Что уже готово (созданные файлы):
- `/hooks/useDebounce.ts` ✅
- `/hooks/useBatchedUpdates.ts` ✅
- `/utils/indexedDBCache.ts` ✅
- `/contexts/FilterContext.tsx` ✅ (обновлен)

### 📝 Что нужно сделать:

---

## 1️⃣ Debounced Search (5 минут)

### FilterToolbar.tsx - добавьте search input

```typescript
// components/scheduler/FilterToolbar.tsx
import { useFilters } from '../../contexts/FilterContext';

// Добавьте в компонент:
const { searchQuery, setSearchQuery, resetFilters } = useFilters();

// В JSX перед фильтрами:
<div className="flex items-center gap-2 mb-4">
  <input
    type="text"
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
    placeholder="🔍 Поиск сотрудников..."
    className="px-3 py-2 border rounded-lg flex-1"
  />
  {searchQuery && (
    <button
      onClick={() => setSearchQuery('')}
      className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900"
    >
      ✕ Очистить
    </button>
  )}
</div>
```

### SchedulerMain.tsx - используйте debouncedSearchQuery

```typescript
// Импорт в начале файла
const { debouncedSearchQuery, enabledCompanies, ... } = useFilters();

// В filteredResources (найдите этот useMemo):
const filteredResources = useMemo(() => {
  let filtered = resources;

  // + НОВЫЙ КОД: Search filter
  if (debouncedSearchQuery) {
    const query = debouncedSearchQuery.toLowerCase();
    filtered = filtered.filter(r =>
      r.fullName?.toLowerCase().includes(query) ||
      r.position?.toLowerCase().includes(query) ||
      r.email?.toLowerCase().includes(query)
    );
  }

  // Filter by companies (существующий код)
  if (enabledCompanies.size > 0) {
    // ... остальное без изменений
  }
  
  return filtered;
}, [resources, debouncedSearchQuery, enabledCompanies, enabledDepartments, enabledProjects, events]);
// ⚠️ Добавьте debouncedSearchQuery в зависимости!
```

---

## 2️⃣ IndexedDB Cache (15 минут)

### SchedulerContext.tsx - кэшируйте все данные

```typescript
// Импорты в начале файла
import {
  getCachedEvents, setCachedEvents,
  getCachedProjects, setCachedProjects,
  getCachedResources, setCachedResources,
  getCachedDepartments, setCachedDepartments,
  getCachedGrades, setCachedGrades,
  getCachedCompanies, setCachedCompanies,
  getCachedEventPatterns, setCachedEventPatterns,
  clearWorkspaceCache
} from '../utils/indexedDBCache';

// ЗАМЕНИТЕ loadEvents на это:
const loadEvents = useCallback(async (workspaceId: string) => {
  setIsLoading(true);
  
  // 1. Показываем кэш мгновенно
  const cachedEvents = await getCachedEvents(workspaceId);
  if (cachedEvents) {
    setEvents(cachedEvents);
    setIsLoading(false);
  }
  
  try {
    // 2. Загружаем свежие данные в фоне
    const freshEvents = await eventsApi.getAll(accessToken, workspaceId);
    setEvents(freshEvents);
    await setCachedEvents(workspaceId, freshEvents);
  } catch (error) {
    console.error('Failed to load fresh events:', error);
    if (!cachedEvents) {
      setIsLoading(false);
      throw error;
    }
  }
}, [accessToken]);

// АНАЛОГИЧНО для loadProjects, loadResources, loadDepartments:
const loadProjects = useCallback(async (workspaceId: string) => {
  const cached = await getCachedProjects(workspaceId);
  if (cached) setProjects(cached);
  
  try {
    const fresh = await projectsApi.getAll(accessToken, workspaceId);
    setProjects(fresh);
    await setCachedProjects(workspaceId, fresh);
  } catch (error) {
    console.error('Failed to load projects:', error);
  }
}, [accessToken]);

// ... loadResources, loadDepartments аналогично

// Для глобальных данных (Grades, Companies, EventPatterns):
const loadGrades = useCallback(async () => {
  const cached = await getCachedGrades();
  if (cached) setGrades(cached);
  
  try {
    const fresh = await gradesApi.getAll(accessToken);
    setGrades(fresh);
    await setCachedGrades(fresh);
  } catch (error) {
    console.error('Failed to load grades:', error);
  }
}, [accessToken]);

// При создании/обновлении - обновляйте кэш:
const createEvent = useCallback(async (event: Partial<SchedulerEvent>) => {
  // ... существующий код создания ...
  
  // + НОВЫЙ КОД: Обновляем кэш
  if (currentWorkspace) {
    const updatedEvents = [...events, createdEvent];
    await setCachedEvents(String(currentWorkspace.id), updatedEvents);
  }
}, [events, currentWorkspace]);

// updateEvent, deleteEvent - аналогично обновляйте кэш
```

### AuthScreen.tsx - очищайте кэш при выходе

```typescript
// Импорт
import { clearAllCache } from '../utils/indexedDBCache';

// В handleSignOut:
const handleSignOut = async () => {
  await clearAllCache(); // + НОВЫЙ КОД
  // ... остальная логика выхода
};
```

---

## 3️⃣ Batched Updates (10 минут)

### SchedulerMain.tsx - батчинг для drag & drop

```typescript
// Импорт в начале файла
import { useBatchedUpdatesMap } from '../../hooks/useBatchedUpdates';

// Добавьте в компонент SchedulerMain (после useState):
const { add: addEventUpdate, flush: flushEventUpdates } = useBatchedUpdatesMap(
  async (updates: Array<{ id: string; data: Partial<SchedulerEvent> }>) => {
    console.log(`📦 Batching ${updates.length} event updates`);
    await Promise.all(updates.map(u => updateEvent(u.id, u.data)));
  },
  (update) => update.id, // Key extractor
  500 // 500ms delay
);

// В useEventInteractions.ts (или где обрабатывается окончание drag):
// ЗАМЕНИТЕ прямой вызов updateEvent на:
const handleDragEnd = useCallback((eventId: string, newData: Partial<SchedulerEvent>) => {
  // Мгновенно обновляем UI
  setEvents(prev => prev.map(e => 
    e.id === eventId ? { ...e, ...newData } : e
  ));
  
  // Добавляем в batch (сохранится через 500ms)
  addEventUpdate({ id: eventId, data: newData });
}, [addEventUpdate]);

// При отпускании мыши (pointerUp):
const handlePointerUp = useCallback(() => {
  flushEventUpdates(); // Flush все накопленные изменения
  // ... остальная логика
}, [flushEventUpdates]);
```

---

## ✅ Готово!

### Проверьте работу:

1. **Search**: Введите текст → UI обновляется мгновенно, фильтрация через 300ms
2. **Cache**: Обновите страницу → календарь появляется мгновенно
3. **Batching**: Перетащите событие → 1 запрос вместо множества

### Откройте DevTools:

- **Performance**: Меньше ре-рендеров при поиске
- **Network**: Меньше запросов при drag
- **Application** → **IndexedDB**: Видны сохраненные данные

---

## 🐛 Troubleshooting

### Search не работает
- Проверьте что `debouncedSearchQuery` добавлен в dependencies useMemo
- Проверьте что FilterToolbar использует `searchQuery` (не debouncedSearchQuery)

### Cache не работает
- Откройте DevTools → Application → IndexedDB → scheduler-cache
- Проверьте что данные сохраняются (должны быть stores: events, projects, etc.)
- Проверьте консоль на ошибки IndexedDB

### Batching не работает
- Проверьте что `flushEventUpdates()` вызывается при pointerUp
- Проверьте консоль - должно быть `📦 Batching N event updates`

---

**Время интеграции**: 30 минут  
**Сложность**: ⭐⭐☆☆☆ (средняя)  
**Эффект**: ⭐⭐⭐⭐⭐ (максимальный)
