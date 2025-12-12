import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo, useRef } from 'react';
import { SchedulerEvent, Department, Resource, Project, Grade, EventPattern, Company, BatchOperation, BatchResult } from '../types/scheduler';
import { 
  eventsApi, 
  resourcesApi, 
  projectsApi, 
  departmentsApi, 
  gradesApi, 
  eventPatternsApi,
  fetchCompanies,
  CreateResourceData,
  UpdateResourceData,
  CreateProjectData,
  UpdateProjectData
} from '../services/api';
import { usersApi } from '../services/api/users';
import { getStorageJSON, setStorageJSON } from '../utils/storage';
import { usePendingOperations } from '../hooks/usePendingOperations';
import { useSyncManager } from '../hooks/useSyncManager';
import { projectId } from '../utils/supabase/info';
import { handleCloudflareError } from '../utils/cloudflareErrorHandler';
import { toast } from 'sonner@2.0.3';
import { throttledRequest } from '../utils/requestThrottle';

interface SchedulerContextType {
  // Data
  events: SchedulerEvent[];
  departments: Department[];
  resources: Resource[];
  projects: Project[];
  grades: Grade[];
  eventPatterns: EventPattern[];
  companies: Company[];
  
  // Loading states
  isLoading: boolean;
  isLoadingResources: boolean; // ✅ Для блокировки рендера событий
  
  // Computed data
  visibleDepartments: Department[];
  visibleEvents: SchedulerEvent[];
  
  // Event operations
  createEvent: (event: Partial<SchedulerEvent>) => Promise<SchedulerEvent>;
  updateEvent: (id: string, event: Partial<SchedulerEvent>) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  setEvents: (events: SchedulerEvent[] | ((prev: SchedulerEvent[]) => SchedulerEvent[])) => void;
  
  // ✨ Sync operations (для Undo/Redo)
  queueChange: (id: string, op: 'create' | 'update' | 'delete', data?: any) => void; // ✅ Exposed for optimistic updates
  cancelPendingChange: (id: string) => void;
  flushPendingChanges: (updateHistoryEventId?: (oldId: string, newId: string) => void) => Promise<void>;
  syncRestoredEventsToServer: (events: SchedulerEvent[], updateHistoryEventId?: (oldId: string, newId: string) => void) => Promise<void>;
  syncDeletedEventsToServer: (currentEvents: SchedulerEvent[], previousEvents: SchedulerEvent[]) => Promise<void>; // ✅ Синхронизация удалений
  hasPendingOperations: () => boolean; // ✅ Проверка наличия активных pending операций
  
  // 🔄 History ID Updater Registration
  setHistoryIdUpdater: (updater: (oldId: string, newId: string) => void) => void;

  // 🚫 User interaction state (для отключения polling во время drag/resize)
  isUserInteractingRef: React.MutableRefObject<boolean>;
  setIsUserInteracting: (value: boolean) => void;
  
  // ⏱️ Delta Sync control (для блокировки синхронизации после локальных изменений)
  resetDeltaSyncTimer: () => void;
  resetProjectsSyncTimer: () => void; // ✅ Для проектов
  resetResourcesSyncTimer: () => void; // ✅ Для сотрудников
  resetDepartmentsSyncTimer: () => void; // ✅ Для департаментов
  
  // Resource operations
  createResource: (data: CreateResourceData) => Promise<void>;
  updateResource: (id: string, data: UpdateResourceData) => Promise<void>;
  deleteResource: (id: string) => Promise<void>;
  uploadUserAvatar: (userId: string, file: File) => Promise<string>;
  
  // Project operations
  createProject: (data: CreateProjectData) => Promise<void>;
  updateProject: (id: string, data: UpdateProjectData) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  setProjects: (projects: Project[] | ((prev: Project[]) => Project[])) => void;
  
  // Department operations
  createDepartment: (name: string) => Promise<void>;
  deleteDepartment: (id: string) => Promise<void>;
  getDepartmentUsersCount: (id: string) => Promise<number>;
  renameDepartment: (id: string, name: string) => Promise<void>;
  reorderDepartments: (departments: Department[]) => Promise<void>;
  toggleDepartmentVisibility: (id: string) => Promise<void>;
  
  // Utility
  getGradeName: (gradeId: string | undefined) => string | undefined;
  loadedEventIds: Set<string>;
  getEvents: () => { events: SchedulerEvent[], projects: Project[], eventZOrder: Map<string, number> }; // ✅ Функция для получения свежего снапшота
}

const SchedulerContext = createContext<SchedulerContextType | undefined>(undefined);

interface SchedulerProviderProps {
  children: ReactNode;
  accessToken?: string;
  workspaceId?: string;
}

export function SchedulerProvider({ children, accessToken, workspaceId }: SchedulerProviderProps) {
  const [eventsState, setEventsState] = useState<SchedulerEvent[]>([]);
  const loadedEventIds = useRef<Set<string>>(new Set());

  // 🔄 Reference to history updater (for background syncs)
  const historyIdUpdaterRef = useRef<((oldId: string, newId: string) => void) | null>(null);
  const setHistoryIdUpdater = useCallback((updater: (oldId: string, newId: string) => void) => {
    historyIdUpdaterRef.current = updater;
  }, []);

  // 🗑️ Отслеживание удаленных событий (для защиты от "воскрешения")
  const deletedEventIdsRef = useRef<Set<string>>(new Set());
  const lastLocalChangeRef = useRef<number>(0);
  
  // ⏱️ Timestamp последней синхронизации (для delta sync)
  const lastSyncTimestampRef = useRef<string | null>(null);
  
  const pendingOps = usePendingOperations();
  
  // ✨ SyncManager - новый движок синхронизации (v4.0.0)
  const { queueChange, flush: flushSync, remapKey, isSyncing, queueSize, hasPendingChanges } = useSyncManager({
    delay: 2000, // 2 секунды задержки (Local-First)
    onSync: async (items, context: any) => {
      if (items.size === 0) return;
      
      const operations: BatchOperation[] = [];
      
      items.forEach((item, id) => {
        // Фильтр старых временных ID
        const numericPart = id.replace('e', '');
        const isOldTemporaryId = id.startsWith('e') && !id.startsWith('ev_temp_') && numericPart.length > 10;
        
        if (isOldTemporaryId) {
          console.log(`⏭️ SyncManager: Skipping old temporary ID ${id}`);
          return;
        }

        // ✅ КРИТИЧНО: Передаем workspace_id для обхода ошибки P0001
        const op: BatchOperation = {
          op: item.op,
          id: item.id,
          data: item.data,
          workspace_id: workspaceId
        };
        
        // Для CREATE не передаем ID в data (сервер создаст новый)
        if (item.op === 'create' && item.data && item.id.startsWith('ev_temp_')) {
           const { id, ...rest } = item.data;
           op.data = rest;
        } else if (item.op === 'update' && item.data) {
           // Для UPDATE передаем ID
           op.data.id = item.id;
        }

        operations.push(op);
      });

      if (operations.length === 0) return;

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-73d66528/events/batch`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({ operations })
        }
      );

      if (!response.ok) {
        const error = await response.json();
        console.error('❌ SyncManager: Server error:', error);
        throw new Error(error.error || 'Batch update failed');
      }

      const results: BatchResult = await response.json();

      // ⚠️ Log errors if any
      if (results.errors && results.errors.length > 0) {
        console.error('❌ SyncManager: Server reported errors in batch:', results.errors);
        results.errors.forEach(err => {
           toast.error(`Ошибка сохранения: ${err.error || 'Unknown error'} (ID: ${err.id})`);
        });
      }

      // Обработка созданных событий (замена ID)
      if (results.created && results.created.length > 0) {
        const createOps = operations.filter(op => op.op === 'create');
        
        results.created.forEach(createdEvent => {
           const realId = createdEvent.id;
           
           // Находим соответствующую операцию создания
           const matchingOp = createOps.find(op => 
              op.data?.resourceId === createdEvent.resourceId &&
              op.data?.startWeek === createdEvent.startWeek &&
              op.data?.unitStart === createdEvent.unitStart &&
              op.data?.projectId === createdEvent.projectId
           );

           if (matchingOp) {
             const tempId = matchingOp.id;
             if (tempId !== realId) {
               console.log(`🔄 SyncManager: Swapping ${tempId} -> ${realId}`);
               
               // 1. Обновляем локальный стейт
               setEventsState(prev => prev.map(e => e.id === tempId ? { ...e, ...createdEvent } : e));
               
               // 2. Обновляем loadedEventIds
               loadedEventIds.current.delete(tempId);
               loadedEventIds.current.add(realId);
               
               // 3. Обновляем очередь (если были изменения пока летело)
               remapKey(tempId, realId);
               
               // 4. Убираем из UI pending
               pendingOps.removePending(tempId);
               
               // 5. ✅ КРИТИЧНО: Обновляем историю (если передана функция updateHistoryEventId)
               // Это исправляет баг, когда Undo возвращает событие с временным ID (спиннером)
               const updater = (context && context.updateHistoryEventId) || historyIdUpdaterRef.current;
               if (updater) {
                 console.log(`📝 SyncManager: Updating history ID ${tempId} -> ${realId}`);
                 updater(tempId, realId);
               } else {
                 // Если функция не передана, попробуем найти ее в глобальной области или контексте (fallback?)
                 // В данный момент мы полагаемся на явную передачу через flushPendingChanges
                 console.log('ℹ️ SyncManager: updateHistoryEventId not provided in context or via registration');
               }
             }
           }
        });
      }
      
      // Удаляем из UI pending успешно обновленные/удаленные
      operations.forEach(op => {
        if (op.op !== 'create') {
           pendingOps.removePending(op.id);
        }
      });
      
      lastLocalChangeRef.current = Date.now();
    }
  });
  
  const [isLoadingDepartments, setIsLoadingDepartments] = useState(true);
  const [isLoadingResources, setIsLoadingResources] = useState(true);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [isLoadingGrades, setIsLoadingGrades] = useState(true);
  const [isLoadingEventPatterns, setIsLoadingEventPatterns] = useState(true);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(true);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  
  // 🚫 User interaction state (для отклю��ения polling во время drag/resize)
  const isUserInteractingRef = useRef(false);
  const setIsUserInteracting = useCallback((value: boolean) => {
    isUserInteractingRef.current = value;
  }, []);
  
  // Data state
  const [departments, setDepartments] = useState<Department[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [eventPatterns, setEventPatterns] = useState<EventPattern[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  
  // Refs для tracking локальных изменений (защита от синхронизации)
  const lastResourcesChangeRef = useRef<number>(0);
  const lastDepartmentsChangeRef = useRef<number>(0);
  const lastProjectsChangeRef = useRef<number>(0);
  
  // Alias для удобства
  const events = eventsState;

  // Вычисленное состояние загрузки
  // ✅ НЕ используем hasCachedDataRef в useMemo - это вызывает "Cannot update component while rendering"
  // Просто проверяем все флаги загрузки
  const isLoading = useMemo(() => {
    return isLoadingDepartments || isLoadingResources || isLoadingProjects || 
           isLoadingGrades || isLoadingEventPatterns || isLoadingCompanies || isLoadingEvents;
  }, [isLoadingDepartments, isLoadingResources, isLoadingProjects, isLoadingGrades, isLoadingEventPatterns, isLoadingCompanies, isLoadingEvents]);

  // Load departments
  useEffect(() => {
    if (!accessToken) {
      queueMicrotask(() => setIsLoadingDepartments(false));
      return;
    }
    
    // Если workspaceId нет - ничего не загружаем
    if (!workspaceId) {
      queueMicrotask(() => setIsLoadingDepartments(false));
      return;
    }

    const load = async () => {
      try {
        // Load from cache first
        const cacheKey = `cache_departments_${workspaceId}`;
        const cachedData = await getStorageJSON<Department[]>(cacheKey);
        
        if (cachedData) {
          setDepartments(cachedData);
        }
        
        // Load fresh data in background
        const data = await departmentsApi.getAll(accessToken, workspaceId);
        setDepartments(data);
        
        // Update cache
        await setStorageJSON(cacheKey, data);
      } catch (error) {
        console.error('❌ Ошибка загрузки департаментов:', error);
      } finally {
        setIsLoadingDepartments(false);
      }
    };
    load();
  }, [accessToken, workspaceId]);

  // Load resources
  useEffect(() => {
    if (!accessToken) {
      queueMicrotask(() => setIsLoadingResources(false));
      return;
    }
    
    // Если workspaceId нет - ничего не загружаем
    if (!workspaceId) {
      queueMicrotask(() => setIsLoadingResources(false));
      return;
    }
    
    const load = async () => {
      try {
        // Load from cache first
        const cacheKey = `cache_resources_${workspaceId}`;
        const cachedData = await getStorageJSON<Resource[]>(cacheKey);
        
        if (cachedData) {
          setResources(cachedData);
        }
        
        // Load fresh data in background
        const data = await resourcesApi.getAll(accessToken, workspaceId);
        setResources(data);
        
        // Update cache
        await setStorageJSON(cacheKey, data);
      } catch (error) {
        console.error('❌ Ошибка загрузки сотрудников:', error);
      } finally {
        setIsLoadingResources(false);
      }
    };
    load();
  }, [accessToken, workspaceId]);

  // Load projects
  useEffect(() => {
    if (!accessToken) {
      queueMicrotask(() => setIsLoadingProjects(false));
      return;
    }
    
    // Если workspaceId нет - ничего не загружаем
    if (!workspaceId) {
      queueMicrotask(() => setIsLoadingProjects(false));
      return;
    }

    const load = async () => {
      try {
        // Load from cache first
        const cacheKey = `cache_projects_${workspaceId}`;
        const cachedData = await getStorageJSON<Project[]>(cacheKey);
        
        if (cachedData) {
          setProjects(cachedData);
        }
        
        // Load fresh data in background
        const data = await projectsApi.getAll(accessToken, workspaceId);
        setProjects(data);
        
        // Update cache
        await setStorageJSON(cacheKey, data);
      } catch (error) {
        console.error('❌ Ошибка загрузки проектов:', error);
      } finally {
        setIsLoadingProjects(false);
      }
    };
    load();
  }, [accessToken, workspaceId]);

  // Load grades
  useEffect(() => {
    if (!accessToken) {
      queueMicrotask(() => setIsLoadingGrades(false));
      return;
    }

    const load = async () => {
      try {
        // Load from cache first
        const cacheKey = `cache_grades_${workspaceId}`;
        const cachedData = await getStorageJSON<Grade[]>(cacheKey);
        
        if (cachedData) {
          // console.log('📦 Загружены грейды из кэша:', cachedData.length);
          setGrades(cachedData);
        }
        
        // Load fresh data in background
        const data = await gradesApi.getAll(accessToken);
        setGrades(data);
        
        // Update cache
        await setStorageJSON(cacheKey, data);
        // console.log('✅ Грейды обновлены из API');
      } catch (error) {
        console.error('❌ Ошибка загрузки грейдов:', error);
      } finally {
        setIsLoadingGrades(false);
      }
    };
    load();
  }, [accessToken, workspaceId]);

  // Load event patterns
  useEffect(() => {
    if (!accessToken) {
      queueMicrotask(() => setIsLoadingEventPatterns(false));
      return;
    }

    const load = async () => {
      try {
        // Load from cache first
        const cacheKey = `cache_patterns_${workspaceId}`;
        const cachedData = await getStorageJSON<EventPattern[]>(cacheKey);
        
        if (cachedData) {
          // console.log('📦 Загружены паттерны из кэша:', cachedData.length);
          setEventPatterns(cachedData);
        }
        
        // Load fresh data in background
        const data = await eventPatternsApi.getAll(accessToken);
        setEventPatterns(data);
        
        // Update cache
        await setStorageJSON(cacheKey, data);
        // console.log('✅ Паттерны обновлены из API');
      } catch (error) {
        console.error('❌ Ошибка загрузки паттерн��в:', error);
      } finally {
        setIsLoadingEventPatterns(false);
      }
    };
    load();
  }, [accessToken, workspaceId]);

  // Load companies
  useEffect(() => {
    if (!accessToken) {
      queueMicrotask(() => setIsLoadingCompanies(false));
      return;
    }

    const load = async () => {
      try {
        // Load from cache first
        const cacheKey = `cache_companies_${workspaceId}`;
        const cachedData = await getStorageJSON<Company[]>(cacheKey);
        
        if (cachedData) {
          // console.log('📦 Загружены компании из кэша:', cachedData.length);
          setCompanies(cachedData);
        }
        
        // Load fresh data in background
        const data = await fetchCompanies(accessToken);
        setCompanies(data);
        
        // Update cache
        await setStorageJSON(cacheKey, data);
        // console.log('✅ Компании обнолены из API');
      } catch (error) {
        console.error('❌ Ошибка загрузки компаний:', error);
      } finally {
        setIsLoadingCompanies(false);
      }
    };
    load();
  }, [accessToken, workspaceId]);

  // Load events
  useEffect(() => {
    if (!accessToken) {
      queueMicrotask(() => setIsLoadingEvents(false));
      return;
    }
    
    // Если workspaceId нет - очищаем все данные (пользователь вышел из воркспейса)
    if (!workspaceId) {
      console.log('🧹 чистка данных при выходе из воркспейса');
      
      // ✅ Откладываем setState на следующий tick чтобы избежать "Cannot update while rendering"
      queueMicrotask(() => {
        setEventsState([]);
        setDepartments([]);
        setResources([]);
        setProjects([]);
        loadedEventIds.current = new Set();
        setIsLoadingEvents(false);
      });
      
      return;
    }

    const load = async () => {
      try {
        // Load from cache first
        const cacheKey = `cache_events_${workspaceId}`;
        const cachedData = await getStorageJSON<SchedulerEvent[]>(cacheKey);
        
        if (cachedData) {
          setEventsState(cachedData);
          loadedEventIds.current = new Set(cachedData.map(e => e.id));
        }
        
        // Load fresh data in background
        const data = await eventsApi.getAll(accessToken, workspaceId);
        setEventsState(data);
        loadedEventIds.current = new Set(data.map(e => e.id));
        
        // Update cache
        await setStorageJSON(cacheKey, data);
      } catch (error) {
        console.error('❌ Ошибка загрузки событий:', error);
      } finally {
        setIsLoadingEvents(false);
      }
    };
    load();
  }, [accessToken, workspaceId]);

  // ✨ Delta Sync - синхронизация ТОЛЬКО изменённых событий
  // ⚡ БЫСТРАЯ стратегия: 4 секунды для delta, 30 секунд для full
  useEffect(() => {
    if (!accessToken || !workspaceId || isLoadingEvents) return;
    
    const DELTA_SYNC_INTERVAL = 5000; // ⚡ 5 секунд (быстрый delta sync!)
    const FULL_SYNC_INTERVAL = 30000; // 🔄 30 секунд (полная синхронизация)
    
    let fullSyncCounter = 0;
    
    const syncChanges = async () => {
      // Пропускаем если пользователь взаимодействует с событиями
      if (isUserInteractingRef.current) {
        return;
      }
      
      // Пропускаем если было локальное изменение < 5 секунд назад
      // (увеличено с 2 до 5 сек для защиты от быстрых последовательных Undo/Redo)
      const timeSinceLastChange = Date.now() - lastLocalChangeRef.current;
      if (timeSinceLastChange < 5000) {
        return;
      }
      
      fullSyncCounter++;
      const isFullSync = fullSyncCounter * DELTA_SYNC_INTERVAL >= FULL_SYNC_INTERVAL;
      
      if (isFullSync) {
        fullSyncCounter = 0;
        
        try {
          // 🛡️ Throttled request - защита от перегрузки
          const allEvents = await throttledRequest(
            `events-full-sync-${workspaceId}`,
            () => eventsApi.getAll(accessToken, workspaceId)
          );
          
          if (!allEvents) {
            // console.log('ℹ️ Full Sync: пропущен (throttle)');
            return;
          }
          
          setEventsState(prev => {
            // Сравниваем с текущими событиями
            const currentIds = new Set(prev.map(e => e.id));
            const serverIds = new Set(allEvents.map(e => e.id));
            
            // Находим удалённые события (есть локально, но нет на сервере)
            const deletedIds = Array.from(currentIds).filter(id => 
              !serverIds.has(id) && !deletedEventIdsRef.current.has(id)
            );
            
            if (deletedIds.length > 0) {
              console.log(`🗑️ Full Sync: обнаружено ${deletedIds.length} удалённых событий другими пользователями:`, deletedIds);
            }
            
            // Фильтруем события которые были удалены текущим пользователем
            const filtered = allEvents.filter(event => !deletedEventIdsRef.current.has(event.id));
            
            // ✅ КРИТИЧНО: МЕРЖИМ с локальными событиями вместо полной замены!
            // Это защищает восстановленные Undo/Redo события от перезаписи
            const mergedEvents = prev.map(localEvent => {
              // 🛡️ PROTECTION: If event is pending sync, keep local version
              if (hasPendingChanges(localEvent.id)) {
                 return localEvent;
              }

              // Если событие с таким ID есть на сервере - используем данные с сервера
              const serverEvent = filtered.find(e => e.id === localEvent.id);
              if (serverEvent) {
                // ✅ Проверяем - если событие было изменено локально < 10 сек назад,
                // используем локальную версию (защита от перезаписи после Undo/Redo)
                const timeSinceLastChange = Date.now() - lastLocalChangeRef.current;
                if (timeSinceLastChange < 10000) {
                  console.log(`🛡️ Full Sync: защита локального события ${localEvent.id} (изменено ${Math.round(timeSinceLastChange/1000)}с назад)`);
                  return localEvent; // Используем локальную версию
                }
                return serverEvent; // Используем серверную версию
              }
              // Если события нет на сервере - проверяем не удалено ли оно
              if (deletedEventIdsRef.current.has(localEvent.id)) {
                return null; // Удаляем
              }
              // Иначе - это новое локальное событие или удаленное на сервере
              // 1. Если это временный ID - оставляем (возможно еще летит на сервер)
              if (localEvent.id.startsWith('ev_temp_')) {
                 return localEvent;
              }
              
              // 2. Если это реальный ID и его нет на сервере:
              // Проверяем на недавнее локальное изменение (защита от race condition)
              const timeSinceLastChange = Date.now() - lastLocalChangeRef.current;
              if (timeSinceLastChange < 10000) {
                 console.log(`🛡️ Full Sync: сохранение "фантома" ${localEvent.id} (недавнее изменение)`);
                 return localEvent;
              }
              
              // Иначе считаем его удалённым на сервере
              console.log(`🗑️ Full Sync: удаление фантома ${localEvent.id} (нет на сервере)`);
              return null;
            }).filter(Boolean) as SchedulerEvent[];
            
            // Добавляем новые события с сервера (которых нет локально)
            const newServerEvents = filtered.filter(serverEvent => 
              !currentIds.has(serverEvent.id)
            );
            
            const result = [...mergedEvents, ...newServerEvents];
            
            loadedEventIds.current = new Set(result.map(e => e.id));
            
            // Обновляем кэш
            setStorageJSON(`cache_events_${workspaceId}`, result).catch(err =>
              console.error('❌ Ошибка обновления кэша:', err)
            );
            
            return result;
          });
        } catch (error) {
          // Обработка Cloudflare ошибки
          if (error instanceof Error) {
            handleCloudflareError(error, (message, type) => {
              toast.error(message);
            });
          } else {
            console.error('❌ Full Sync ошибка:', error);
          }
        }
      } else {
        // Delta Sync - только изменения
        try {
          // 🛡️ Throttled request - защита от перегрузки
          const result = await throttledRequest(
            `events-delta-sync-${workspaceId}`,
            () => eventsApi.getChanges(
              accessToken,
              workspaceId,
              lastSyncTimestampRef.current || undefined
            )
          );
          
          if (!result) {
            // console.log('ℹ️ Delta Sync: пропущен (throttle)');
            return;
          }
          
          const { events: changedEvents, timestamp } = result;
          
          if (changedEvents.length > 0) {
            setEventsState(prev => {
              // Создаём Map для быстрого поиска
              const changedMap = new Map(changedEvents.map(e => [e.id, e]));
              
              // Обновляем изменённые события + добавляем новые
              const updated = prev.map(e => {
                 // 🛡️ PROTECTION
                 if (hasPendingChanges(e.id)) return e;
                 return changedMap.get(e.id) || e;
              });
              const newEventIds = new Set(prev.map(e => e.id));
              const newEvents = changedEvents.filter(e => !newEventIds.has(e.id));
              
              const merged = [...updated, ...newEvents];
              
              // Фильтруем удалённые события
              const filtered = merged.filter(event => !deletedEventIdsRef.current.has(event.id));
              
              loadedEventIds.current = new Set(filtered.map(e => e.id));
              
              // Обновляем кэш
              setStorageJSON(`cache_events_${workspaceId}`, filtered).catch(err =>
                console.error('❌ Ошибка обновления кэша:', err)
              );
              
              return filtered;
            });
          }
          
          // Обновляем timestamp для следующего запроса
          lastSyncTimestampRef.current = timestamp;
          
        } catch (error) {
          // Обработка Cloudflare ошибки
          if (error instanceof Error) {
            handleCloudflareError(error, (message, type) => {
              toast.error(message);
            });
          } else {
            console.error('❌ Delta Sync ошибка:', error);
          }
        }
      }
    };
    
    // Периодический sync каждые 5 секунд
    const interval = setInterval(syncChanges, DELTA_SYNC_INTERVAL);
    
    return () => {
      clearInterval(interval);
    };
  }, [accessToken, workspaceId, isLoadingEvents]);

  // ✨ Polling для ПРОЕКТОВ каждые 15 секунд (согласно Guidelines v1.9.4)
  useEffect(() => {
    if (!accessToken || !workspaceId || isLoadingProjects) return;

    const PROJECTS_SYNC_INTERVAL = 15000; // 15 секунд

    const syncProjects = async () => {
      // Пропускаем если было локальное изменение < 5 секунд назад
      // (увеличено с 2 до 5 сек для защиты от быстрых последовательных Undo/Redo)
      const timeSinceLastChange = Date.now() - lastProjectsChangeRef.current;
      if (timeSinceLastChange < 5000) {
        return;
      }

      try {
        // 🛡️ Throttled request - защита от перегрузки
        const serverProjects = await throttledRequest(
          `projects-sync-${workspaceId}`,
          () => projectsApi.getAll(accessToken, workspaceId)
        );
        
        if (!serverProjects) {
          // console.log('ℹ️ Projects Sync: пропущен (throttle)');
          return;
        }

        setProjects(prev => {
          // Сравниваем с текущими проектами через JSON
          const hasChanges = JSON.stringify(prev) !== JSON.stringify(serverProjects);

          if (hasChanges) {
            console.log(`📥 Projects Sync: обнаружены изменени�� (сервер: ${serverProjects.length}, локально: ${prev.length})`);

            // Обновляем кэш
            setStorageJSON(`cache_projects_${workspaceId}`, serverProjects).catch(err =>
              console.error('❌ Ошибка обновления кэша проектов:', err)
            );

            return serverProjects;
          }

          return prev;
        });
      } catch (error) {
        // Обработка Cloudflare ошибки
        if (error instanceof Error) {
          handleCloudflareError(error, (message, type) => {
            toast.error(message);
          });
        } else {
          console.error('❌ Projects Sync ошибка:', error);
        }
      }
    };

    // Запускаем первый sync через 15 секунд после загрузки
    const initialTimeout = setTimeout(syncProjects, PROJECTS_SYNC_INTERVAL);

    // Периодический sync каждые 15 секунд
    const interval = setInterval(syncProjects, PROJECTS_SYNC_INTERVAL);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [accessToken, workspaceId, isLoadingProjects]);

  // ✨ Polling для СОТ��УДНИКОВ каждые 15 секунд (согласно Guidelines v1.9.4)
  useEffect(() => {
    if (!accessToken || !workspaceId || isLoadingResources) return;

    const RESOURCES_SYNC_INTERVAL = 15000; // 15 секунд

    const syncResources = async () => {
      // Пропускаем если было локальное изменение < 5 секунд назад
      // (увеличено с 2 до 5 сек для защиты от быстрых последовательных Undo/Redo)
      const timeSinceLastChange = Date.now() - lastResourcesChangeRef.current;
      if (timeSinceLastChange < 5000) {
        return;
      }

      try {
        // 🛡️ Throttled request - защита от перегрузки
        const serverResources = await throttledRequest(
          `resources-sync-${workspaceId}`,
          () => resourcesApi.getAll(accessToken, workspaceId)
        );
        
        if (!serverResources) {
          // console.log('ℹ️ Resources Sync: пропущен (throttle)');
          return;
        }

        setResources(prev => {
          // Сравниваем с текущими ресурсами через JSON
          const hasChanges = JSON.stringify(prev) !== JSON.stringify(serverResources);

          if (hasChanges) {
            console.log(`📥 Resources Sync: обнаружены изменения (сервер: ${serverResources.length}, локально: ${prev.length})`);

            // Обновляем кэш
            setStorageJSON(`cache_resources_${workspaceId}`, serverResources).catch(err =>
              console.error('❌ Ошибка обновления кэша сотрудников:', err)
            );

            return serverResources;
          }

          return prev;
        });
      } catch (error) {
        // Обработка Cloudflare ошибки
        if (error instanceof Error) {
          handleCloudflareError(error, (message, type) => {
            toast.error(message);
          });
        } else {
          console.error('❌ Resources Sync ошибка:', error);
        }
      }
    };

    // Запускаем первый sync через 15 секун�� после загрузки
    const initialTimeout = setTimeout(syncResources, RESOURCES_SYNC_INTERVAL);

    // Периодический sync каждые 15 секунд
    const interval = setInterval(syncResources, RESOURCES_SYNC_INTERVAL);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [accessToken, workspaceId, isLoadingResources]);

  // ✨ Polling для ДЕПАРТАМЕНТОВ каждые 15 секунд (согласно Guidelines v1.9.4)
  useEffect(() => {
    if (!accessToken || !workspaceId || isLoadingDepartments) return;

    const DEPARTMENTS_SYNC_INTERVAL = 15000; // 15 секунд

    const syncDepartments = async () => {
      // Пропускаем если было локальное изменение < 5 секунд назад
      // (увеличено с 2 до 5 сек для защиты от быстрых последовательных Undo/Redo)
      const timeSinceLastChange = Date.now() - lastDepartmentsChangeRef.current;
      if (timeSinceLastChange < 5000) {
        return;
      }

      try {
        // 🛡️ Throttled request - защита от перегрузки
        const serverDepartments = await throttledRequest(
          `departments-sync-${workspaceId}`,
          () => departmentsApi.getAll(accessToken, workspaceId)
        );
        
        if (!serverDepartments) {
          // console.log('ℹ️ Departments Sync: пропущен (throttle)');
          return;
        }

        setDepartments(prev => {
          // Сравниваем с текущими департаментами через JSON
          const hasChanges = JSON.stringify(prev) !== JSON.stringify(serverDepartments);

          if (hasChanges) {
            console.log(`📥 Departments Sync: обнаружены изменения (сервер: ${serverDepartments.length}, локально: ${prev.length})`);

            // Обновляем кэш
            setStorageJSON(`cache_departments_${workspaceId}`, serverDepartments).catch(err =>
              console.error('❌ Ошибка обновления кэша департаментов:', err)
            );

            return serverDepartments;
          }

          return prev;
        });
      } catch (error) {
        // Обработка Cloudflare ошибки
        if (error instanceof Error) {
          handleCloudflareError(error, (message, type) => {
            toast.error(message);
          });
        } else {
          console.error('❌ Departments Sync ошибка:', error);
        }
      }
    };

    // Запускаем первый sync через 15 секунд после загрузки
    const initialTimeout = setTimeout(syncDepartments, DEPARTMENTS_SYNC_INTERVAL);

    // Периодический sync каж��ые 15 секунд
    const interval = setInterval(syncDepartments, DEPARTMENTS_SYNC_INTERVAL);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [accessToken, workspaceId, isLoadingDepartments]);

  // Clean up orphaned events
  useEffect(() => {
    if (isLoadingProjects || isLoadingEvents) return;
    
    // ✅ КРИТИЧНО: Задержка 5 секунд перед cleanup
    // Защита от удаления событий которые были восстановлены через Undo/Redo
    const cleanupTimeout = setTimeout(() => {
      const orphanedEvents = events.filter(event => {
        const projectExists = projects.some(p => p.id === event.projectId);
        return !projectExists;
      });

      if (orphanedEvents.length === 0) return;

      console.log('🧹 Найдено событий с несуществующими проектами:', orphanedEvents.length);
      
      const orphanedIds = new Set(orphanedEvents.map(e => e.id));
      setEventsState(prev => prev.filter(e => !orphanedIds.has(e.id)));
      orphanedIds.forEach(id => loadedEventIds.current.delete(id));

      // Delete from database in background
      if (accessToken) {
        orphanedEvents.forEach(event => {
          // ✅ v3.3.13: КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ - правильный паттерн временных ID
          if (event.id.startsWith('e') && !event.id.startsWith('ev_temp_')) {
            eventsApi.delete(event.id, accessToken).catch(err => 
              console.error(`❌ Ошибка удаления события ${event.id}:`, err)
            );
          }
        });
      }
    }, 5000); // ⏱️ 5 секунд задержки для защиты от Undo/Redo

    return () => clearTimeout(cleanupTimeout);
  }, [isLoadingProjects, isLoadingEvents, projects, events]);

  // Clean up invalid patterns in projects
  useEffect(() => {
    if (isLoadingProjects || isLoadingEventPatterns || !accessToken) return;
    
    const projectsWithInvalidPatterns = projects.filter(project => {
      if (!project.patternId) return false;
      const patternExists = eventPatterns.some(p => p.id === project.patternId);
      return !patternExists;
    });

    if (projectsWithInvalidPatterns.length === 0) return;

    console.log('🧹 Найдено проектов с несуществующими паттернами:', projectsWithInvalidPatterns.length);
    
    // Reset invalid patterns to empty string in local state
    const updatedProjects = projects.map(project => {
      const hasInvalidPattern = projectsWithInvalidPatterns.some(p => p.id === project.id);
      if (hasInvalidPattern) {
        console.log(`🔧 Сброс паттерна проекта "${project.name}" (${project.patternId} не найден)`);
        return { ...project, patternId: '' };
      }
      return project;
    });
    
    setProjects(updatedProjects);
    setStorageJSON(`cache_projects_${workspaceId}`, updatedProjects);

    // Update in database in background
    projectsWithInvalidPatterns.forEach(project => {
      projectsApi.update(project.id, { patternId: '' }, accessToken).catch(err => 
        console.error(`❌ Ошибка сброса паттерна проекта ${project.id}:`, err)
      );
    });
  }, [isLoadingProjects, isLoadingEventPatterns, projects, eventPatterns, accessToken, workspaceId]);

  // Computed data
  const sortedDepartments = useMemo(() => {
    return [...departments].sort((a, b) => {
      const queueA = a.queue || 999;
      const queueB = b.queue || 999;
      return queueA - queueB;
    });
  }, [departments]);

  const visibleDepartments = useMemo(() => {
    return sortedDepartments.filter(dept => dept.visible);
  }, [sortedDepartments]);

  const visibleEvents = useMemo(() => {
    const filtered = events.filter(event => {
      const resource = resources.find(r => r.id === event.resourceId);
      if (!resource) {
        // console.log(`⚠️ Событие ${event.id} не отображается: сотрудник ${event.resourceId} не найден`);
        return false;
      }
      const department = departments.find(d => d.id === resource.departmentId);
      if (department?.visible === false) {
        // console.log(`⚠️ Событие ${event.id} не отображается: департамент ${department.id} скрыт`);
        return false;
      }
      return true;
    });
    
    // console.log(`✅ Фильтрация событий завершена: всего ${events.length}, видимых ${filtered.length}`);
    // console.log(`🔍 Сотрудников: ${resources.length}, департаментов: ${departments.length} (видимых: ${departments.filter(d => d.visible !== false).length})`);
    
    return filtered;
  }, [events, resources, departments]);

  // Event operations
  const createEvent = useCallback(async (event: Partial<SchedulerEvent>): Promise<SchedulerEvent> => {
    // Валидация weeksSpan перед созданием
    const startWeek = event.startWeek || 0;
    const maxWeeks = 52 - startWeek;
    const validWeeksSpan = Math.max(1, Math.min(event.weeksSpan || 1, maxWeeks));
    
    // ✅ ШАГ 1 v4.0.0: Генерируем УНИКАЛЬНЫЙ временный ID с рандомизацией
    const tempEvent: SchedulerEvent = {
      id: event.id || `ev_temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      resourceId: event.resourceId!,
      startWeek: startWeek,
      weeksSpan: validWeeksSpan,
      unitStart: event.unitStart || 0,
      unitsTall: event.unitsTall || 1,
      projectId: event.projectId || projects[0].id
    };
    
    // ✅ ШАГ 1 v4.0.0: Добавляем в state с временным ID
    setEventsState(prev => {
      const exists = prev.some(e => e.id === tempEvent.id);
      const newState = exists ? prev : [...prev, tempEvent];
      
      // Сохраняем в кэш асинхронно
      if (!exists) {
        setStorageJSON(`cache_events_${workspaceId}`, newState).catch(err => 
          console.error('❌ Ошибка сохранения в кэш:', err)
        );
      }
      
      return newState;
    });

    // ✅ ШАГ 1 v4.0.0: Добавляем в pending queue (UI feedback)
    pendingOps.addPending(tempEvent.id, 'create', tempEvent, tempEvent);
    
    // ✅ ШАГ 1 v4.0.0: Добавляем в SyncManager (Local-First saving)
    queueChange(tempEvent.id, 'create', tempEvent);
    
    lastLocalChangeRef.current = Date.now();
    
    return tempEvent;
  }, [projects, workspaceId, pendingOps, queueChange]);

  const updateEvent = useCallback(async (id: string, event: Partial<SchedulerEvent>) => {
    // Пропускаем обновление на сервере только для временных ID
    // (если событие еще летит, SyncManager смаржит create+update)
    // Но если create уже улетел, а ответ еще не пришел, id все еще temp.
    // SyncManager корректно обработает это (create in-flight, update in queue).
    
    const originalEvent = events.find(e => e.id === id);
    if (originalEvent) {
      const updatedEvent = { ...originalEvent, ...event };
      
      // UI Feedback
      pendingOps.addPending(id, 'update', originalEvent, updatedEvent);
      
      // ✅ FIX: Если обновляем weeksSpan, нужно также передать startWeek
      // Сервер использует startWeek для валидации maxWeeksSpan
      // Если startWeek не передан, сервер считает его 0, что может привести к ошибкам валидации в БД
      const dataToQueue = { ...event };
      if (event.weeksSpan !== undefined && event.startWeek === undefined) {
          dataToQueue.startWeek = originalEvent.startWeek;
      }

      // SyncManager Saving
      queueChange(id, 'update', dataToQueue);
    }
    
    lastLocalChangeRef.current = Date.now();
  }, [events, pendingOps, queueChange]);

  const deleteEvent = useCallback(async (id: string) => {
    // 1. Update Local State (Optimistic)
    let originalEvent: SchedulerEvent | undefined;
    
    setEventsState(prev => {
      originalEvent = prev.find(e => e.id === id);
      if (!originalEvent) return prev;
      
      const newEvents = prev.filter(e => e.id !== id);
      
      setStorageJSON(`cache_events_${workspaceId}`, newEvents).catch(err =>
        console.error('❌ Ошибка сохранения в кэш:', err)
      );
      
      return newEvents;
    });
    
    loadedEventIds.current.delete(id);
    deletedEventIdsRef.current.add(id);

    // 2. Queue Delete in SyncManager
    queueChange(id, 'delete');
    
    // 3. Remove UI pending
    pendingOps.removePending(id);
    
    lastLocalChangeRef.current = Date.now();
    
    // Очищаем пометку удаления через 10 секунд
    setTimeout(() => {
      deletedEventIdsRef.current.delete(id);
    }, 10000);
  }, [workspaceId, pendingOps, queueChange]);

  const setEvents = useCallback((eventsOrUpdater: SchedulerEvent[] | ((prev: SchedulerEvent[]) => SchedulerEvent[])) => {
    setEventsState(eventsOrUpdater);
  }, []);

  // ✨ Sync operations (для Undo/Redo)
  const cancelPendingChange = useCallback((id: string) => {
    pendingOps.removePending(id);
  }, [pendingOps]);

  const flushPendingChanges = useCallback(async (updateHistoryEventId?: (oldId: string, newId: string) => void) => {
    await flushSync({ updateHistoryEventId });
  }, [flushSync]);

  const hasPendingOperations = useCallback(() => {
    const pending = pendingOps.getAllPending();
    // Проверяем и UI pending, и реальную очередь SyncManager
    const hasPending = pending.length > 0 || isSyncing || queueSize > 0;
    
    if (hasPending) {
      console.log(`⏳ hasPendingOperations: pending=${pending.length}, queue=${queueSize}, syncing=${isSyncing}`);
    }
    
    return hasPending;
  }, [pendingOps, isSyncing, queueSize]);

  const syncRestoredEventsToServer = useCallback(async (events: SchedulerEvent[], updateHistoryEventId?: (oldId: string, newId: string) => void) => {
    console.log(`🔄 UNDO/REDO (SyncManager): Restoring ${events.length} events...`);
    
    // Используем SyncManager для восстановления событий
    events.forEach(event => {
       const isTemporaryId = event.id.startsWith('ev_temp_');
       const isLoaded = loadedEventIds.current.has(event.id);
       
       if (isTemporaryId || !isLoaded) {
          // Create (восстановление удаленного или временного)
          console.log(`🔄 UNDO/REDO: Queue CREATE for ${event.id}`);
          queueChange(event.id, 'create', event);
       } else {
          // Update (восстановление измененного)
          console.log(`🔄 UNDO/REDO: Queue UPDATE for ${event.id}`);
          queueChange(event.id, 'update', event);
       }
       
       // Очищаем пометку удаления
       if (deletedEventIdsRef.current.has(event.id)) {
         deletedEventIdsRef.current.delete(event.id);
       }
    });
    
    lastLocalChangeRef.current = Date.now();
  }, [queueChange]);

  const syncDeletedEventsToServer = useCallback(async (currentEvents: SchedulerEvent[], previousEvents: SchedulerEvent[]) => {
    const currentIds = new Set(currentEvents.map(e => e.id));
    const deletedEvents = previousEvents.filter(e => !currentIds.has(e.id));
    
    if (deletedEvents.length === 0) return;
    
    console.log(`🔄 UNDO/REDO (SyncManager): Deleting ${deletedEvents.length} events...`);
    
    deletedEvents.forEach(event => {
       console.log(`🔄 UNDO/REDO: Queue DELETE for ${event.id}`);
       
       // Queue Delete
       queueChange(event.id, 'delete');
       
       // Оптимистичная очистка
       loadedEventIds.current.delete(event.id);
       deletedEventIdsRef.current.add(event.id);
       pendingOps.removePending(event.id);
    });
    
    lastLocalChangeRef.current = Date.now();
    
    // Очищаем пометку удаления через 60 секунд
    setTimeout(() => {
      deletedEvents.forEach(event => deletedEventIdsRef.current.delete(event.id));
    }, 60000);
  }, [queueChange, pendingOps]);

  // Resource operations
  const createResource = useCallback(async (data: CreateResourceData) => {
    const dataWithWorkspace = { ...data, workspace_id: workspaceId };
    const createdResource = await resourcesApi.create(dataWithWorkspace, accessToken);
    
    // ВАЖНО: Используем функциональный setState для избежания stale closure
    setResources(prev => {
      const newResources = [...prev, createdResource];
      
      // Сохраняем в кэш асинхронно
      setStorageJSON(`cache_resources_${workspaceId}`, newResources).catch(err => 
        console.error('❌ Ошибка сохранения сотрудников в кэш:', err)
      );
      
      return newResources;
    });
    
    // Отмечаем что было локальное изменение
    lastResourcesChangeRef.current = Date.now();
    
    console.log('✅ Сотрудник создан:', createdResource.id);
  }, [accessToken, workspaceId]);

  const updateResource = useCallback(async (id: string, data: UpdateResourceData) => {
    const updatedResource = await resourcesApi.update(id, data, accessToken);
    
    // ВАЖНО: Используем функциональный setState для избежания stale closure
    setResources(prev => {
      const newResources = prev.map(r => r.id === id ? updatedResource : r);
      
      // Сохраняем в кэш асинхронно
      setStorageJSON(`cache_resources_${workspaceId}`, newResources).catch(err => 
        console.error('❌ Ошибка сохранения сотрудников в кэш:', err)
      );
      
      return newResources;
    });
    
    // Отмечаем что было локальное изменение
    lastResourcesChangeRef.current = Date.now();
    
    console.log('✅ Сотрудник обновлен:', id);
  }, [accessToken, workspaceId]);

  const deleteResource = useCallback(async (id: string) => {
    await resourcesApi.delete(id, accessToken);
    
    // ВАЖНО: Используем функциональный setState для избежания stale closure
    setResources(prev => {
      const newResources = prev.filter(r => r.id !== id);
      
      // Сохраняем в кэш асинхронно
      setStorageJSON(`cache_resources_${workspaceId}`, newResources).catch(err => 
        console.error('❌ Ошибка сохранения сотрудников в кэш:', err)
      );
      
      return newResources;
    });
    
    setEventsState(prev => {
      const newEvents = prev.filter(e => e.resourceId !== id);
      
      // Сохраняем в кэш асинхронно
      setStorageJSON(`cache_events_${workspaceId}`, newEvents).catch(err => 
        console.error('❌ Ошибка сохранения событий в кэш:', err)
      );
      
      return newEvents;
    });
    
    // Отмеча��м что было локальное изменение
    lastResourcesChangeRef.current = Date.now();
    
    console.log('✅ Сотрудник удален:', id);
  }, [accessToken, workspaceId]);

  const uploadUserAvatar = useCallback(async (userId: string, file: File): Promise<string> => {
    const avatarUrl = await usersApi.uploadAvatar(userId, file);
    console.log('✅ Аватар загружен для пользователя:', userId, '→', avatarUrl);
    return avatarUrl;
  }, []);

  // Project operations
  const createProject = useCallback(async (data: CreateProjectData) => {
    const dataWithWorkspace = { ...data, workspace_id: workspaceId };
    const createdProject = await projectsApi.create(dataWithWorkspace, accessToken);
    
    // ВАЖНО: Используем функциональный setState для избежания stale closure
    setProjects(prev => {
      const newProjects = [...prev, createdProject];
      
      // Сохраняем в кэш асинхронно
      setStorageJSON(`cache_projects_${workspaceId}`, newProjects).catch(err => 
        console.error('❌ Ошибка сохранения проектов в кэш:', err)
      );
      
      return newProjects;
    });
    
    // Отмечаем что было локальное изменение
    lastProjectsChangeRef.current = Date.now();
  }, [accessToken, workspaceId]);

  const updateProject = useCallback(async (id: string, data: UpdateProjectData) => {
    const updatedProject = await projectsApi.update(id, data, accessToken);
    
    // ВАЖНО: Используем функциональный setState для избежания stale closure
    setProjects(prev => {
      const newProjects = prev.map(p => p.id === id ? updatedProject : p);
      
      // Сохраняем в кэш асинхронно
      setStorageJSON(`cache_projects_${workspaceId}`, newProjects).catch(err => 
        console.error('❌ Ошибка сохранения проектов в кэш:', err)
      );
      
      return newProjects;
    });
    
    // Отмечаем что было локальное изменение
    lastProjectsChangeRef.current = Date.now();
    
    console.log('✅ Проект обновлен:', id);
  }, [accessToken, workspaceId]);

  const deleteProject = useCallback(async (id: string) => {
    // 🚀 ОПТИМИСТИЧНОЕ удаление - сначала обновляем UI, потом отправляем на сервер
    console.log('🗑️ Оптимистичное удаление проекта:', id);
    
    // ВАЖНО: Используем функциональный setState для избежания stale closure
    setProjects(prev => {
      const newProjects = prev.filter(p => p.id !== id);
      
      // Сохраняем в кэш асинхронно
      setStorageJSON(`cache_projects_${workspaceId}`, newProjects).catch(err => 
        console.error('❌ Ошибка сохранения проектов в кэш:', err)
      );
      
      return newProjects;
    });
    
    setEventsState(prev => {
      const newEvents = prev.filter(e => e.projectId !== id);
      
      // Сохраняем в кэш асинхронно
      setStorageJSON(`cache_events_${workspaceId}`, newEvents).catch(err => 
        console.error('❌ Ошибка сохранения событий в кэш:', err)
      );
      
      return newEvents;
    });
    
    // Отмечаем что было локальное изменение
    lastProjectsChangeRef.current = Date.now();
    
    // Теперь отправляем на сервер в фоне
    try {
      await projectsApi.delete(id, accessToken);
      console.log('✅ Проект удален на сервере:', id);
    } catch (error) {
      console.error('❌ Ошибка удаления проекта на сервере:', error);
      // При ошибке можно восстановить проект, но для простоты пропускаем
      throw error;
    }
  }, [accessToken, workspaceId]);

  const setProjectsExported = useCallback((projectsOrUpdater: Project[] | ((prev: Project[]) => Project[])) => {
    setProjects(projectsOrUpdater);
  }, []);

  // Department operations
  const createDepartment = useCallback(async (name: string) => {
    if (!workspaceId) {
      console.error('❌ Workspace ID не указан');
      throw new Error('Workspace ID не указан');
    }
    
    const newDept = await departmentsApi.create({ name, workspace_id: workspaceId }, accessToken);
    
    // ВАЖНО: Используем функциональный setState для избежания stale closure
    setDepartments(prev => {
      const newDepartments = [...prev, newDept];
      
      // Сохраняем в кэш асинхронно
      setStorageJSON(`cache_departments_${workspaceId}`, newDepartments).catch(err => 
        console.error('❌ Ошибка сохранения департаментов в кэш:', err)
      );
      
      return newDepartments;
    });
    
    // Отмечаем что было локальное изменение
    lastDepartmentsChangeRef.current = Date.now();
    
    console.log('✅ Департамент создан:', newDept.id);
  }, [accessToken, workspaceId]);

  const deleteDepartment = useCallback(async (deptId: string) => {
    const numericId = parseInt(deptId.replace('d', ''));
    await departmentsApi.delete(numericId.toString(), accessToken);
    
    // ВАЖНО: Используем функциональный setState для избежания stale closure
    setDepartments(prev => {
      const newDepartments = prev.filter(d => d.id !== deptId);
      
      // Сохраняем в кэш аснхронно
      setStorageJSON(`cache_departments_${workspaceId}`, newDepartments).catch(err => 
        console.error('❌ Ошибка сохранения департаментов в кэш:', err)
      );
      
      return newDepartments;
    });
    
    // Отмечаем что было локальное изменение
    lastDepartmentsChangeRef.current = Date.now();
    
    console.log('✅ Де��артамент удален:', deptId);
  }, [accessToken, workspaceId]);

  const getDepartmentUsersCount = useCallback(async (deptId: string): Promise<number> => {
    const numericId = parseInt(deptId.replace('d', ''));
    const result = await departmentsApi.getUsersCount(numericId.toString(), accessToken);
    return result.count;
  }, [accessToken]);

  const renameDepartment = useCallback(async (deptId: string, newName: string) => {
    const numericId = parseInt(deptId.replace('d', ''));
    
    try {
      await departmentsApi.update(numericId.toString(), { name: newName }, accessToken);
      
      // ВАЖНО: Используем функциональный setState для избежания stale closure
      setDepartments(prev => {
        const newDepartments = prev.map(d => d.id === deptId ? { ...d, name: newName } : d);
        
        // Сохраняем в кэш асинхронно
        setStorageJSON(`cache_departments_${workspaceId}`, newDepartments).catch(err => 
          console.error('❌ Ошибка сохранения департаментов в кэш:', err)
        );
        
        return newDepartments;
      });
      
      // Отмечаем что было локальное изменение
      lastDepartmentsChangeRef.current = Date.now();
      
      console.log('✅ Департамент переименован:', deptId);
    } catch (error) {
      console.error('❌ Ошибка переименования департамента:', error);
      throw error;
    }
  }, [accessToken, workspaceId]);

  const reorderDepartments = useCallback(async (newOrder: Department[]) => {
    const departmentsWithQueue = newOrder.map((dept, index) => ({
      id: dept.id,
      queue: index + 1
    }));

    try {
      await departmentsApi.updateQueue({ departments: departmentsWithQueue }, accessToken);
      
      // ВАЖНО: Используем функциональный setState для избежания stale closure
      setDepartments(prev => {
        const newDepartments = prev.map(dept => {
          const newDept = newOrder.find(d => d.id === dept.id);
          if (newDept) {
            const index = newOrder.indexOf(newDept);
            return { ...dept, queue: index + 1 };
          }
          return dept;
        });
        
        // Сохраняем в кэш асинхронно
        setStorageJSON(`cache_departments_${workspaceId}`, newDepartments).catch(err => 
          console.error('❌ Ошибка сохранения департаментов в кэш:', err)
        );
        
        return newDepartments;
      });
      
      // Отмечаем что было локальное изменение
      lastDepartmentsChangeRef.current = Date.now();
      
      console.log('✅ Очередность департаментов обновлена');
    } catch (error) {
      console.error('❌ Ошибка обновления очередности:', error);
      throw error;
    }
  }, [accessToken, workspaceId]);

  const toggleDepartmentVisibility = useCallback(async (deptId: string) => {
    // Находим департамент для получения текущего состояния
    let newVisible: boolean = true;
    setDepartments(prev => {
      const department = prev.find(d => d.id === deptId);
      if (!department) return prev;
      
      newVisible = !department.visible;
      return prev; // Возвращаем без изменений, обновим после успешного API запроса
    });

    const numericId = parseInt(deptId.replace('d', ''));
    try {
      await departmentsApi.update(numericId.toString(), { visible: newVisible }, accessToken);
      
      // ВАЖНО: Используем функциональный setState для избежания stale closure
      setDepartments(prev => {
        const newDepartments = prev.map(d => 
          d.id === deptId ? { ...d, visible: newVisible } : d
        );
        
        // Сохраняем в кэш асинхронно
        setStorageJSON(`cache_departments_${workspaceId}`, newDepartments).catch(err => 
          console.error('❌ Ошибка сохранения департаментов в кэш:', err)
        );
        
        return newDepartments;
      });
      
      // Отмечаем что было локальное изменение
      lastDepartmentsChangeRef.current = Date.now();
      
      console.log('✅ Видимость департамента обновлена:', deptId);
    } catch (error) {
      console.error('❌ Ошибка обновления видимости:', error);
      throw error;
    }
  }, [accessToken, workspaceId]);

  // Utility
  const getGradeName = useCallback((gradeId: string | undefined): string | undefined => {
    if (!gradeId) return undefined;
    const grade = grades.find(g => g.id === gradeId);
    return grade?.name;
  }, [grades]);

  // ✅ Мемоизируем value объект чтобы избежать пересоздания при каждом рендере
  // Это предотвращает warning "Cannot update component while rendering"
  const contextValue = useMemo(() => ({
    events: eventsState,
    departments,
    resources,
    projects,
    grades,
    eventPatterns,
    companies,
    isLoading,
    isLoadingResources, // ✅ Экспорт для блокировки рендера событий
    visibleDepartments,
    visibleEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    setEvents,
    cancelPendingChange,
    flushPendingChanges,
    syncRestoredEventsToServer,
    syncDeletedEventsToServer,
    hasPendingOperations,
    setHistoryIdUpdater, // ✅ Export setHistoryIdUpdater
    isUserInteractingRef,
    setIsUserInteracting,
    queueChange, // ✅ Export queueChange
    resetDeltaSyncTimer: () => lastLocalChangeRef.current = Date.now(),
    resetProjectsSyncTimer: () => lastProjectsChangeRef.current = Date.now(),
    resetResourcesSyncTimer: () => lastResourcesChangeRef.current = Date.now(),
    resetDepartmentsSyncTimer: () => lastDepartmentsChangeRef.current = Date.now(),
    createResource,
    updateResource,
    deleteResource,
    uploadUserAvatar,
    createProject,
    updateProject,
    deleteProject,
    setProjects: setProjectsExported,
    createDepartment,
    deleteDepartment,
    getDepartmentUsersCount,
    renameDepartment,
    reorderDepartments,
    toggleDepartmentVisibility,
    getGradeName,
    setHistoryIdUpdater, // ✅ Export setHistoryIdUpdater
    loadedEventIds: loadedEventIds.current
  }), [
    eventsState,
    departments,
    resources,
    projects,
    grades,
    eventPatterns,
    companies,
    isLoading,
    isLoadingResources,
    visibleDepartments,
    visibleEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    setEvents,
    cancelPendingChange,
    flushPendingChanges,
    syncRestoredEventsToServer,
    syncDeletedEventsToServer,
    hasPendingOperations,
    setHistoryIdUpdater, // ✅ Export
    // isUserInteracting // Removed to prevent re-renders
    setIsUserInteracting,
    createResource,
    updateResource,
    deleteResource,
    uploadUserAvatar,
    createProject,
    updateProject,
    deleteProject,
    setProjectsExported,
    createDepartment,
    deleteDepartment,
    getDepartmentUsersCount,
    renameDepartment,
    reorderDepartments,
    toggleDepartmentVisibility,
    getGradeName
  ]);

  return (
    <SchedulerContext.Provider value={contextValue}>
      {children}
    </SchedulerContext.Provider>
  );
}

export function useScheduler() {
  const context = useContext(SchedulerContext);
  if (context === undefined) {
    throw new Error('useScheduler must be used within a SchedulerProvider');
  }
  return context;
}