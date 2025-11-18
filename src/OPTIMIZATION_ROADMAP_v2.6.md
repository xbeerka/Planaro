# Optimization Roadmap v2.6

## 🎯 Общий план оптимизаций

### ✅ Tier 1: Quick Wins (ГОТОВО - 3-4 часа)
1. **Debounced Filters** ✅
2. **IndexedDB Cache** ✅
3. **Batched Updates** ✅

### ✅ Tier 2: UX & Server Load (ГОТОВО - 1-2 часа)
4. **Optimistic UI** ✅ - мгновенный feedback с откатом
5. **Batch Polling Endpoint** ✅ - объединение polling запросов (4→1)
6. **Smart Polling Hooks** ✅ - usePollingBatch + умная защита

### 🚀 Tier 3: Advanced (3-5 дней)
7. **Web Workers** - генерация событий в фоне
8. **Canvas Rendering** (опционально) - для >500 событий
9. **Intersection Observer** (опционально) - уже есть виртуализация

---

## 📋 Детальный план Tier 2

### 4. Optimistic UI (Приоритет: 🔴 High)

**Время**: 6-8 часов  
**Сложность**: ⭐⭐⭐☆☆  
**Эффект**: ⭐⭐⭐⭐☆

**Что делает**:
- UI обновляется мгновенно при действиях пользователя
- Запрос на сервер идет в фоне
- Если ошибка - откатываем изменения и показываем toast

**Где применить**:
1. Создание события → мгновенно появляется на календаре
2. Drag & Drop → мгновенно перемещается
3. Resize → мгновенно изменяет размер
4. Удаление → мгновенно исчезает
5. Редактирование → мгновенно обновляется

**Реализация**:

```typescript
// /hooks/useOptimisticUpdate.ts
export function useOptimisticUpdate<T>(
  data: T[],
  setData: (data: T[]) => void,
  onServerUpdate: (optimisticData: T[]) => Promise<void>,
  getId: (item: T) => string
) {
  const [optimisticUpdates, setOptimisticUpdates] = useState<Map<string, T>>(new Map());
  
  const addOptimistic = useCallback((item: T) => {
    const id = getId(item);
    
    // Мгновенно обновляем UI
    setOptimisticUpdates(prev => new Map(prev).set(id, item));
    setData([...data, item]);
    
    // В фоне сохраняем
    onServerUpdate([...data, item])
      .then(() => {
        // Успех - убираем из optimistic
        setOptimisticUpdates(prev => {
          const next = new Map(prev);
          next.delete(id);
          return next;
        });
      })
      .catch((error) => {
        // Ошибка - откатываем
        console.error('❌ Optimistic update failed:', error);
        setData(data); // Откат к предыдущим данным
        setOptimisticUpdates(prev => {
          const next = new Map(prev);
          next.delete(id);
          return next;
        });
        // Показываем toast
        showToast({ type: 'error', message: 'Ошибка сохранения' });
      });
  }, [data, setData, onServerUpdate, getId]);
  
  return { addOptimistic, optimisticUpdates };
}
```

**Интеграция**:
```typescript
// В SchedulerContext.tsx
const { addOptimistic: addOptimisticEvent } = useOptimisticUpdate(
  events,
  setEvents,
  async (optimisticEvents) => {
    // Сохраняем на сервер
    await eventsApi.create(optimisticEvents[optimisticEvents.length - 1]);
  },
  (event) => event.id
);

// При создании события
const createEvent = useCallback((event: Partial<SchedulerEvent>) => {
  const tempEvent = { ...event, id: `temp_${Date.now()}` };
  addOptimisticEvent(tempEvent); // Мгновенно в UI + фоновое сохранение
}, [addOptimisticEvent]);
```

**Эффект**:
- ⚡ Perceived performance +200%
- 🎯 Мгновенный feedback
- 🛡️ Защита от ошибок через откат

---

### 5. Request Coalescing (Приоритет: 🟠 Medium)

**Время**: 4-5 часов  
**Сложность**: ⭐⭐☆☆☆  
**Эффект**: ⭐⭐⭐⭐☆

**Проблема**:
- Presence heartbeat каждые 30 секунд для каждого пользователя
- Polling events каждые 10 секунд
- Polling resources/departments каждые 15 секунд
- **Итого**: 3+ запроса каждые 10 секунд (18 req/min)

**Решение**:
Объединить множественные запросы в один batch endpoint

**Реализация**:

```typescript
// /hooks/useRequestCoalescing.ts
export function useRequestCoalescing<T>(
  fetchFn: () => Promise<T>,
  interval: number,
  coalescingWindow: number = 100
) {
  const pendingRequestsRef = useRef<Array<(value: T) => void>>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  const request = useCallback((): Promise<T> => {
    return new Promise((resolve) => {
      // Добавляем в очередь
      pendingRequestsRef.current.push(resolve);
      
      // Если таймер еще не установлен
      if (!timerRef.current) {
        timerRef.current = setTimeout(async () => {
          const callbacks = [...pendingRequestsRef.current];
          pendingRequestsRef.current = [];
          timerRef.current = null;
          
          // Выполняем ОДИН запрос
          const result = await fetchFn();
          
          // Резолвим ВСЕ промисы
          callbacks.forEach(cb => cb(result));
        }, coalescingWindow);
      }
    });
  }, [fetchFn, coalescingWindow]);
  
  return request;
}
```

**Интеграция**:
```typescript
// В SchedulerContext.tsx
const coalescedLoadEvents = useRequestCoalescing(
  () => eventsApi.getAll(accessToken, workspaceId),
  10000, // Интервал polling
  100    // Coalescing window
);

// Теперь если 5 компонентов запросят events одновременно
// → будет только 1 HTTP запрос вместо 5
```

**Новый server endpoint** (batch):
```typescript
// /supabase/functions/server/index.tsx

app.post("/make-server-73d66528/batch", async (c) => {
  const { requests } = await c.req.json();
  
  // requests = [
  //   { type: 'events', workspaceId: '1' },
  //   { type: 'presence', workspaceId: '1' },
  //   { type: 'resources', workspaceId: '1' }
  // ]
  
  const results = await Promise.all(
    requests.map(async (req) => {
      switch (req.type) {
        case 'events':
          return { type: 'events', data: await getEvents(req.workspaceId) };
        case 'presence':
          return { type: 'presence', data: await getPresence(req.workspaceId) };
        case 'resources':
          return { type: 'resources', data: await getResources(req.workspaceId) };
      }
    })
  );
  
  return c.json({ results });
});
```

**Эффект**:
- 📉 **80% снижение** количества HTTP запросов
- ⚡ **Быстрее** - один batch запрос вместо множества
- 🌐 **Меньше нагрузка** на сервер

---

### 6. Smart Batching для Polling (Приоритет: 🟠 Medium)

**Время**: 3-4 часа  
**Сложность**: ⭐⭐☆☆☆  
**Эффект**: ⭐⭐⭐☆☆

**Идея**:
Объединить все polling запросы в один batch

**Текущее состояние**:
```typescript
// Events polling: каждые 10 сек
setInterval(() => loadEvents(), 10000);

// Resources polling: каждые 15 сек
setInterval(() => loadResources(), 15000);

// Departments polling: каждые 15 сек
setInterval(() => loadDepartments(), 15000);

// Projects polling: каждые 15 сек
setInterval(() => loadProjects(), 15000);

// Presence heartbeat: каждые 30 сек
setInterval(() => sendHeartbeat(), 30000);
```

**После оптимизации**:
```typescript
// /hooks/usePollingBatch.ts
export function usePollingBatch(workspaceId: string, accessToken: string) {
  useEffect(() => {
    const interval = setInterval(async () => {
      // ОДИН batch запрос вместо 5
      const { events, resources, departments, projects, presence } = 
        await api.batch.getAll(workspaceId);
      
      // Обновляем все разом
      setEvents(events);
      setResources(resources);
      setDepartments(departments);
      setProjects(projects);
      setOnlineUsers(presence);
      
    }, 10000); // Один интервал для всего
    
    return () => clearInterval(interval);
  }, [workspaceId, accessToken]);
}
```

**Эффект**:
- 📉 **5 запросов → 1 запрос** каждые 10 секунд
- ⚡ **Синхронизированное** обновление всех данных
- 🎯 **Проще дебажить**

---

## 📋 Детальный план Tier 3

### 7. Web Workers (Приоритет: 🟡 Low)

**Когда нужен**: Только если генерация >1000 событий блокирует UI

**Время**: 8-10 часов  
**Сложность**: ⭐⭐⭐☆☆  
**Эффект**: ⭐⭐⭐☆☆

См. `/PERFORMANCE_OPTIMIZATION_v2.5.md` для детальной реализации

---

### 8. Canvas Rendering (Приоритет: 🟢 Optional)

**Когда нужен**: Только если >500 событий одновременно на экране

**Время**: 1-2 недели  
**Сложность**: ⭐⭐⭐⭐☆  
**Эффект**: ⭐⭐⭐⭐⭐ (при большом количестве событий)

См. детальную реализацию в начале документа

**Решение**: Пока что НЕ нужен, т.к. виртуализация v2.5 уже решает проблему

---

### 9. Intersection Observer (Приоритет: ⚪ Skip)

**Статус**: Не нужен, т.к. виртуализация v2.5 уже рендерит только видимые строки

---

## 🎯 Рекомендуемый порядок внедрения

### ✅ Этап 1: Tier 1 (ГОТОВО)
- ✅ Debounced Filters
- ✅ IndexedDB Cache
- ✅ Batched Updates

**Время**: 3-4 часа  
**Эффект**: ⭐⭐⭐⭐⭐

### ✅ Этап 2: Tier 2 (ГОТОВО)
1. ✅ **Optimistic UI** (30 минут)
2. ✅ **Batch Polling Endpoint** (20 минут)
3. ✅ **Smart Polling Hooks** (10 минут)

**Общее время**: 1 час  
**Эффект**: ⭐⭐⭐⭐⭐

### 🚀 Этап 3: Tier 3 (ОПЦИОНАЛЬНО)
- **Web Workers** - только если генерация нужна
- **Canvas Rendering** - только если >500 событий
- **Intersection Observer** - пропускаем (есть виртуализация)

### Этап 3: Tier 3 (ОПЦИОНАЛЬНО)
- **Web Workers** - если генерация лагает
- **Canvas Rendering** - если >500 событий
- **Intersection Observer** - пропускаем (есть виртуализация)

**Время**: По необходимости  
**Эффект**: Зависит от сценария использования

---

## 📊 Ожидаемые результаты после ВСЕХ оптимизаций

| Метрика | До | После | Улучшение |
|---------|-----|-------|-----------|
| **First paint** | 800ms | 0ms | ⚡ Instant |
| **Perceived performance** | Медленно | Мгновенно | ⚡ 10x |
| **Search (10 symbols)** | 10 renders | 1 render | 📉 90% ↓ |
| **Drag updates** | 100 req | 1 req | 📉 99% ↓ |
| **Polling load** | 18 req/min | 6 req/min | 📉 66% ↓ |
| **Network total** | Высокая | Низкая | 📉 70-80% ↓ |
| **Memory** | ~150 MB | ~80 MB | 📉 47% ↓ |
| **CPU при поиске** | 80% | 10% | 📉 87% ↓ |

---

## 🔄 Rollback план

Если что-то пошло не так:

### Tier 1:
- Debounced Filters: Удалить использование `debouncedSearchQuery`, использовать `searchQuery`
- IndexedDB: Удалить вызовы `getCached*`, оставить только API запросы
- Batched Updates: Заменить `addEventUpdate` на прямой `updateEvent`

### Tier 2:
- Optimistic UI: Убрать `useOptimisticUpdate`, вернуть `await` в create/update
- Request Coalescing: Убрать batch endpoint, вернуть раздельные запросы
- Smart Batching: Вернуть раздельные intervals

---

## 💡 Мониторинг эффективности

После каждого этапа проверяйте:

1. **Chrome DevTools → Performance**:
   - FPS при скролле (должен быть 55-60)
   - Scripting time (<10ms на frame)
   - Rendering/Painting (<5ms на frame)

2. **Chrome DevTools → Network**:
   - Количество запросов (должно снижаться)
   - Общий размер (должен снижаться)
   - Время загрузки (должно снижаться)

3. **Chrome DevTools → Memory**:
   - Heap size (не должен расти бесконечно)
   - DOM nodes (<5000 для календаря с 50 сотрудниками)

4. **User Experience**:
   - Instant feedback при действиях
   - Нет визуальных лагов
   - Плавный скролл
   - Быстрая загрузка

---

**Версия**: v2.6  
**Дата**: 2025-10-22  
**Автор**: AI Assistant  
**Статус**: 📋 Planning document
