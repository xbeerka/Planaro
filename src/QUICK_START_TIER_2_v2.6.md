# Quick Start - Tier 2 Optimizations v2.6

## ⚡ 1-часовая интеграция Optimistic UI + Batch Polling

### ✅ Что уже готово:
- `/hooks/useOptimisticUpdate.ts` ✅
- `/hooks/usePollingBatch.ts` ✅
- `/supabase/functions/server/index.tsx` ✅ (batch endpoint добавлен)

---

## 1️⃣ Optimistic UI (30 минут)

### SchedulerContext.tsx - замените CRUD операции

```typescript
// 1. ИМПОРТ в начале файла
import { useOptimisticUpdate } from '../hooks/useOptimisticUpdate';

// 2. СОЗДАЙТЕ HOOK после useState (внутри SchedulerProvider)
const {
  addOptimistic: addOptimisticEvent,
  updateOptimistic: updateOptimisticEvent,
  removeOptimistic: removeOptimisticEvent,
  batchUpdateOptimistic: batchUpdateOptimisticEvents,
  optimisticIds: optimisticEventIds,
  isOptimistic: isEventOptimistic
} = useOptimisticUpdate(events, setEvents, (e) => e.id);

// 3. ЗАМЕНИТЕ createEvent на optimistic версию
const createEvent = useCallback(async (eventData: Partial<SchedulerEvent>) => {
  if (!currentWorkspace) return;
  
  // Создаём временное событие
  const tempEvent: SchedulerEvent = {
    ...eventData,
    id: `temp_${Date.now()}`,
  } as SchedulerEvent;
  
  // Мгновенно добавляем + сохранение в фоне
  const created = await addOptimisticEvent(
    tempEvent,
    async (temp) => {
      // API запрос
      const response = await eventsApi.create(accessToken, currentWorkspace.id, {
        user_id: parseInt(temp.resourceId.replace('r', '')),
        project_id: parseInt(temp.projectId.replace('p', '')),
        start_week: temp.startWeek + 1,
        weeks_span: temp.weeksSpan,
        unit_start: temp.unitStart,
        units_tall: temp.unitsTall,
        pattern_id: temp.patternId ? parseInt(temp.patternId.replace('ep', '')) : undefined
      });
      
      // Обновляем кэш
      const updatedEvents = [...events.filter(e => e.id !== temp.id), response];
      await setCachedEvents(String(currentWorkspace.id), updatedEvents);
      
      return response;
    }
  );
  
  return created;
}, [addOptimisticEvent, accessToken, currentWorkspace, events]);

// 4. ЗАМЕНИТЕ updateEvent на optimistic версию
const updateEvent = useCallback(async (eventId: string, updates: Partial<SchedulerEvent>) => {
  if (!currentWorkspace) return false;
  
  const success = await updateOptimisticEvent(
    eventId,
    updates,
    async (id, data) => {
      // Конвертируем данные для API
      const apiData: any = {};
      if (data.startWeek !== undefined) apiData.start_week = data.startWeek + 1;
      if (data.weeksSpan !== undefined) apiData.weeks_span = data.weeksSpan;
      if (data.unitStart !== undefined) apiData.unit_start = data.unitStart;
      if (data.unitsTall !== undefined) apiData.units_tall = data.unitsTall;
      
      // API запрос
      await eventsApi.update(accessToken, id.replace('e', ''), apiData);
      
      // Обновляем кэш
      const updatedEvents = events.map(e => e.id === id ? { ...e, ...data } : e);
      await setCachedEvents(String(currentWorkspace.id), updatedEvents);
    }
  );
  
  return success;
}, [updateOptimisticEvent, accessToken, currentWorkspace, events]);

// 5. ЗАМЕНИТЕ deleteEvent на optimistic версию
const deleteEvent = useCallback(async (eventId: string) => {
  if (!currentWorkspace) return false;
  
  const success = await removeOptimisticEvent(
    eventId,
    async (id) => {
      // API запрос
      await eventsApi.delete(accessToken, id.replace('e', ''));
      
      // Обновляем кэш
      const updatedEvents = events.filter(e => e.id !== id);
      await setCachedEvents(String(currentWorkspace.id), updatedEvents);
    }
  );
  
  return success;
}, [removeOptimisticEvent, accessToken, currentWorkspace, events]);

// 6. ДОБАВЬТЕ в return context
return (
  <SchedulerContext.Provider
    value={{
      // ... existing values
      createEvent,
      updateEvent,
      deleteEvent,
      optimisticEventIds, // ← ДОБАВЬТЕ
      isEventOptimistic   // ← ДОБАВЬТЕ
    }}
  >
    {children}
  </SchedulerContext.Provider>
);
```

### SchedulerEvent.tsx - визуальный индикатор

```typescript
// 1. ИМПОРТ в начале файла
import { useScheduler } from '../../contexts/SchedulerContext';

// 2. ПОЛУЧИТЕ optimisticEventIds в компоненте
const { optimisticEventIds } = useScheduler();
const isPending = optimisticEventIds?.has(event.id) || false;

// 3. ОБНОВИТЕ style события (найдите существующий style объект)
const style = {
  // ... existing styles
  
  // + ДОБАВЬТЕ diagonal stripes для pending
  backgroundImage: isPending
    ? 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.1) 10px, rgba(255,255,255,0.1) 20px)'
    : undefined,
};

// 4. ДОБАВЬТЕ opacity для pending (в className или style)
<div
  className={`scheduler-event ${isPending ? 'opacity-60' : ''}`}
  style={style}
>
  {/* ... rest */}
</div>
```

### types/scheduler.ts - обновите интерфейс

```typescript
// Найдите interface SchedulerContextType и добавьте:
export interface SchedulerContextType {
  // ... existing fields
  
  // + НОВЫЕ ПОЛЯ
  optimisticEventIds?: Set<string>;
  isEventOptimistic?: (id: string) => boolean;
}
```

---

## 2️⃣ Batch Polling (20 минут)

### SchedulerContext.tsx - замените раздельный polling

```typescript
// 1. ИМПОРТ в начале файла
import { usePollingBatch } from '../hooks/usePollingBatch';
import { projectId, publicAnonKey } from '../utils/supabase/info';

// 2. УДАЛИТЕ старые polling useEffect (найдите и закомментируйте):
// useEffect(() => {
//   // Events polling каждые 10 секунд
//   const interval = setInterval(() => loadEvents(workspaceId), 10000);
//   return () => clearInterval(interval);
// }, [workspaceId]);
//
// useEffect(() => {
//   // Resources polling каждые 15 секунд
//   const interval = setInterval(() => loadResources(workspaceId), 15000);
//   return () => clearInterval(interval);
// }, [workspaceId]);
// ... и т.д.

// 3. ДОБАВЬТЕ batch polling (после создания optimistic hooks)
const { markLocalChange } = usePollingBatch({
  workspaceId: currentWorkspace ? String(currentWorkspace.id) : '',
  accessToken,
  
  onEventsUpdate: (freshEvents) => {
    const currentJson = JSON.stringify(events);
    const freshJson = JSON.stringify(freshEvents);
    
    if (currentJson !== freshJson) {
      console.log(`🔄 Events обновлены: ${freshEvents.length} событий`);
      setEvents(freshEvents);
      
      if (currentWorkspace) {
        setCachedEvents(String(currentWorkspace.id), freshEvents);
      }
    }
  },
  
  onResourcesUpdate: (freshResources) => {
    const currentJson = JSON.stringify(resources);
    const freshJson = JSON.stringify(freshResources);
    
    if (currentJson !== freshJson) {
      console.log(`🔄 Resources обновлены: ${freshResources.length} сотрудников`);
      setResources(freshResources);
      
      if (currentWorkspace) {
        setCachedResources(String(currentWorkspace.id), freshResources);
      }
    }
  },
  
  onDepartmentsUpdate: (freshDepartments) => {
    const currentJson = JSON.stringify(departments);
    const freshJson = JSON.stringify(freshDepartments);
    
    if (currentJson !== freshJson) {
      console.log(`🔄 Departments обновлены: ${freshDepartments.length} департаментов`);
      setDepartments(freshDepartments);
      
      if (currentWorkspace) {
        setCachedDepartments(String(currentWorkspace.id), freshDepartments);
      }
    }
  },
  
  onProjectsUpdate: (freshProjects) => {
    const currentJson = JSON.stringify(projects);
    const freshJson = JSON.stringify(freshProjects);
    
    if (currentJson !== freshJson) {
      console.log(`🔄 Projects обновлены: ${freshProjects.length} проектов`);
      setProjects(freshProjects);
      
      if (currentWorkspace) {
        setCachedProjects(String(currentWorkspace.id), freshProjects);
      }
    }
  },
  
  fetchBatch: async (workspaceId, token) => {
    const response = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-73d66528/batch?workspace_id=${workspaceId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Batch polling failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  },
  
  interval: 10000, // 10 секунд
  enabled: !!currentWorkspace
});

// 4. ОТМЕЧАЙТЕ локальные изменения (в create/update/delete)
// Уже сделано выше в optimistic hooks, но можно добавить:
const createEvent = useCallback(async (eventData) => {
  // ... optimistic create
  
  markLocalChange(); // ← ДОБАВЬТЕ для пропуска следующего polling
  
  return created;
}, [addOptimisticEvent, markLocalChange, /* ... */]);
```

---

## ✅ Готово!

### Проверьте работу:

**Optimistic UI**:
1. Создайте событие → должно появиться мгновенно с diagonal stripes
2. Через 1-2 сек stripes исчезают (сохранено)
3. Drag событие → мгновенно перемещается
4. Удалите событие → мгновенно исчезает

**Batch Polling**:
1. Откройте DevTools → Network
2. Каждые 10 секунд должен быть ОДИН запрос `/batch`
3. Раньше было: 4 запроса (/events, /resources, /departments, /projects)

**Error Recovery**:
1. Отключите сервер (или поменяйте URL на неверный)
2. Создайте событие → появится → откатится → toast "Ошибка создания"
3. Включите сервер → всё работает снова

---

## 🐛 Troubleshooting

### "optimisticEventIds is undefined"
- Проверьте что optimisticEventIds в return context
- Проверьте что SchedulerEvent импортирует useScheduler()

### Batch endpoint 404
- Проверьте что сервер задеплоен: `supabase functions deploy make-server-73d66528`
- Проверьте URL: должен быть `https://{projectId}.supabase.co/functions/v1/make-server-73d66528/batch`

### Optimistic откат не работает
- Откройте console → должно быть "❌ Optimistic ... failed"
- Проверьте что toast импортирован из 'sonner@2.0.3'

### Batch polling вызывает старые endpoints
- Проверьте что старые useEffect с polling закомментированы/удалены
- Перезагрузите страницу

---

**Время интеграции**: ~1 час  
**Сложность**: ⭐⭐⭐☆☆ (средняя)  
**Эффект**: ⭐⭐⭐⭐⭐ (максимальный UX)
