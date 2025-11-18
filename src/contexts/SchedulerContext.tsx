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
import { getStorageJSON, setStorageJSON } from '../utils/storage';
import { usePendingOperations } from '../hooks/usePendingOperations';
import { useDebouncedSave } from '../hooks/useDebouncedSave';
import { projectId } from '../utils/supabase/info';
import { handleCloudflareError } from '../utils/cloudflareErrorHandler';
import { toast } from 'sonner@2.0.3';

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
  
  // Computed data
  visibleDepartments: Department[];
  visibleEvents: SchedulerEvent[];
  
  // Event operations
  createEvent: (event: Partial<SchedulerEvent>) => Promise<SchedulerEvent>;
  updateEvent: (id: string, event: Partial<SchedulerEvent>) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  setEvents: (events: SchedulerEvent[] | ((prev: SchedulerEvent[]) => SchedulerEvent[])) => void;
  
  // ✨ Sync operations (для Undo/Redo)
  cancelPendingChange: (id: string) => void;
  flushPendingChanges: () => Promise<void>;
  syncRestoredEventsToServer: (events: SchedulerEvent[], updateHistoryEventId?: (oldId: string, newId: string) => void) => Promise<void>;
  syncDeletedEventsToServer: (currentEvents: SchedulerEvent[], previousEvents: SchedulerEvent[]) => Promise<void>; // ✅ Синхронизация удалений
  
  // 🚫 User interaction state (для отключения polling во время drag/resize)
  isUserInteracting: boolean;
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
  const setLoadedEventIds = useCallback((updater: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    loadedEventIds.current = typeof updater === 'function' ? updater(loadedEventIds.current) : updater;
  }, []);

  // 🗑️ Отслеживание удаленных событий (для защиты от "воскрешения")
  const deletedEventIdsRef = useRef<Set<string>>(new Set());
  const lastLocalChangeRef = useRef<number>(0);
  
  // ⏱️ Timestamp последней синхронизации (для delta sync)
  const lastSyncTimestampRef = useRef<string | null>(null);
  
  const pendingOps = usePendingOperations();
  
  // ✨ Debounced Save - накопление изменений для пакетного сохранения
  const { queueChange: queueEventUpdate, flush: flushPendingUpdates } = useDebouncedSave(
    async (changes: Map<string, Partial<SchedulerEvent>>) => {
      // 🚀 BATCH API - отправляем ВСЕ изменения ОДНИМ запросом!
      console.log(`📦 BATCH: отправка ${changes.size} изменений на сервер...`);
      
      // 🔍 Фильтруем временные ID (события которые еще не созданы в БД)
      const validChanges = Array.from(changes.entries()).filter(([id]) => {
        const numericPart = id.replace('e', '');
        const isTemporaryId = numericPart.length > 10; // Временные ID: e1732005123456789 (timestamp)
        
        if (isTemporaryId) {
          console.log(`⏭️ BATCH: пропуск временного ID ${id} (событие еще не создано в БД)`);
          return false;
        }
        return true;
      });
      
      if (validChanges.length === 0) {
        console.log('⏭️ BATCH: нет валидных изменений для отправки (все временные ID)');
        return;
      }
      
      console.log(`📦 BATCH: ${validChanges.length} валидных изменений из ${changes.size} (отфильтровано ${changes.size - validChanges.length} временных ID)`);
      
      const operations: BatchOperation[] = validChanges.map(([id, eventData]) => ({
        op: 'update',
        id,
        data: eventData,
        workspace_id: workspaceId
      }));
      
      console.log('📦 BATCH: операции:', operations.map(op => `${op.op}:${op.id}`).join(', '));
      console.log('📦 BATCH: отправляемые данные:', validChanges.map(([id, data]) => ({
        id,
        resourceId: data.resourceId,
        startWeek: data.startWeek,
        unitStart: data.unitStart
      })));
      
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
      
      console.log('📦 BATCH: response status:', response.status);
      
      if (!response.ok) {
        const error = await response.json();
        console.error('❌ BATCH: ответ сервера:', error);
        throw new Error(error.error || 'Batch update failed');
      }
      
      const results: BatchResult = await response.json();
      console.log(`✅ BATCH: успешно сохранено ${results.updated.length} событий`);
      console.log('📦 BATCH: возвращённые данные с сервера:', results.updated.map((e: SchedulerEvent) => ({
        id: e.id,
        resourceId: e.resourceId,
        startWeek: e.startWeek,
        unitStart: e.unitStart
      })));
      
      // 🔍 ВАЖНО: НЕ ПЕРЕЗАПИСЫВАЕМ локальное состояние данными с сервера!
      // Локальное состояние уже правильное (оптимистичное обновление)
      // Сервер может вернуть устаревшие данные из-за race condition
      console.log('⏭️ BATCH: пропускаем обновление state (локальное состояние актуальнее)');
      
      // Удаляем из pending операций после успешного сохранения
      changes.forEach((_, id) => {
        pendingOps.removePending(id);
      });
      
      // Отмечаем что было локальное изменение
      lastLocalChangeRef.current = Date.now();
    },
    2000 // ⏱️ Debounce delay 2 секунды (быстрее!)
  );
  
  const [isLoadingDepartments, setIsLoadingDepartments] = useState(true);
  const [isLoadingResources, setIsLoadingResources] = useState(true);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [isLoadingGrades, setIsLoadingGrades] = useState(true);
  const [isLoadingEventPatterns, setIsLoadingEventPatterns] = useState(true);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(true);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const hasCachedDataRef = useRef(false); // ✅ Используем ref вместо state для избежания setState во время рендера
  
  // 🚫 User interaction state (для отключения polling во время drag/resize)
  const [isUserInteracting, setIsUserInteracting] = useState(false);
  
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

  // Вычисленное состояние загрузки (без useMemo для избежания setState во время рендера)
  const isLoading = !hasCachedDataRef.current && (isLoadingDepartments || isLoadingResources || isLoadingProjects || 
                    isLoadingGrades || isLoadingEventPatterns || isLoadingCompanies || isLoadingEvents);

  // Load departments
  useEffect(() => {
    if (!accessToken) {
      setIsLoadingDepartments(false);
      return;
    }
    
    // Если workspaceId нет - ничего не загружаем
    if (!workspaceId) {
      setIsLoadingDepartments(false);
      return;
    }

    const load = async () => {
      try {
        // Load from cache first
        const cacheKey = `cache_departments_${workspaceId}`;
        const cachedData = await getStorageJSON<Department[]>(cacheKey);
        
        if (cachedData) {
          setDepartments(cachedData);
          hasCachedDataRef.current = true;
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
      setIsLoadingResources(false);
      return;
    }
    
    // Если workspaceId нет - ничего не загружаем
    if (!workspaceId) {
      setIsLoadingResources(false);
      return;
    }
    
    const load = async () => {
      try {
        // Load from cache first
        const cacheKey = `cache_resources_${workspaceId}`;
        const cachedData = await getStorageJSON<Resource[]>(cacheKey);
        
        if (cachedData) {
          setResources(cachedData);
          hasCachedDataRef.current = true;
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
      setIsLoadingProjects(false);
      return;
    }
    
    // Если workspaceId нет - ничего не загружаем
    if (!workspaceId) {
      setIsLoadingProjects(false);
      return;
    }

    const load = async () => {
      try {
        // Load from cache first
        const cacheKey = `cache_projects_${workspaceId}`;
        const cachedData = await getStorageJSON<Project[]>(cacheKey);
        
        if (cachedData) {
          setProjects(cachedData);
          hasCachedDataRef.current = true;
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
      setIsLoadingGrades(false);
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
          hasCachedDataRef.current = true;
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
      setIsLoadingEventPatterns(false);
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
          hasCachedDataRef.current = true;
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
      setIsLoadingCompanies(false);
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
          hasCachedDataRef.current = true;
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
      setIsLoadingEvents(false);
      return;
    }
    
    // Если workspaceId нет - очищаем все данные (пользователь вышел из воркспейса)
    if (!workspaceId) {
      console.log('🧹 чистка данных при выходе из воркспейса');
      setEventsState([]);
      setDepartments([]);
      setResources([]);
      setProjects([]);
      setLoadedEventIds(new Set());
      setIsLoadingEvents(false);
      return;
    }

    const load = async () => {
      try {
        // Load from cache first
        const cacheKey = `cache_events_${workspaceId}`;
        const cachedData = await getStorageJSON<SchedulerEvent[]>(cacheKey);
        
        if (cachedData) {
          setEventsState(cachedData);
          setLoadedEventIds(new Set(cachedData.map(e => e.id)));
          hasCachedDataRef.current = true;
        }
        
        // Load fresh data in background
        const data = await eventsApi.getAll(accessToken, workspaceId);
        setEventsState(data);
        setLoadedEventIds(new Set(data.map(e => e.id)));
        
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
    
    const DELTA_SYNC_INTERVAL = 4000; // ⚡ 4 секунды (быстрый delta sync!)
    const FULL_SYNC_INTERVAL = 30000; // 🔄 30 секунд (полная синхронизация)
    
    let fullSyncCounter = 0;
    
    const syncChanges = async () => {
      // Пропускаем если пользователь взаимодействует с событиями
      if (isUserInteracting) {
        console.log('⏸️ Delta Sync: пропуск (пользователь взаимодействует)');
        return;
      }
      
      // Пропускаем если было локальное изменение < 5 секунд назад
      // (увеличено с 2 до 5 сек для защиты от быстрых последовательных Undo/Redo)
      const timeSinceLastChange = Date.now() - lastLocalChangeRef.current;
      if (timeSinceLastChange < 5000) {
        console.log('⏸️ Delta Sync: пропуск (недавнее локальное изменение)');
        return;
      }
      
      fullSyncCounter++;
      const isFullSync = fullSyncCounter * DELTA_SYNC_INTERVAL >= FULL_SYNC_INTERVAL;
      
      if (isFullSync) {
        fullSyncCounter = 0;
        console.log('🔄 Full Sync: загрузка ВСЕХ событий (для обнаружения удалений)');
        
        try {
          // Загружаем ВСЕ события
          const allEvents = await eventsApi.getAll(accessToken, workspaceId);
          
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
            
            console.log(`✅ Full Sync: загружено ${filtered.length} событий (было ${prev.length})`);
            setLoadedEventIds(new Set(filtered.map(e => e.id)));
            
            // Обновляем кэш
            setStorageJSON(`cache_events_${workspaceId}`, filtered).catch(err =>
              console.error('❌ Ошибка обновления кэша:', err)
            );
            
            return filtered;
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
          // Загружаем ТОЛЬКО изменённые события
          const { events: changedEvents, timestamp } = await eventsApi.getChanges(
            accessToken,
            workspaceId,
            lastSyncTimestampRef.current || undefined
          );
          
          if (changedEvents.length > 0) {
            console.log(`📥 Delta Sync: получено ${changedEvents.length} изменений`);
            
            setEventsState(prev => {
              // Создаём Map для быстрого поиска
              const changedMap = new Map(changedEvents.map(e => [e.id, e]));
              
              // Обновляем изменённые события + добавляем новые
              const updated = prev.map(e => changedMap.get(e.id) || e);
              const newEventIds = new Set(prev.map(e => e.id));
              const newEvents = changedEvents.filter(e => !newEventIds.has(e.id));
              
              const merged = [...updated, ...newEvents];
              
              // Фильтруем удалённые события
              const filtered = merged.filter(event => !deletedEventIdsRef.current.has(event.id));
              
              console.log(`✅ Delta Sync: применено ${changedEvents.length} изменений`);
              setLoadedEventIds(new Set(filtered.map(e => e.id)));
              
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
    
    // Запускаем первый sync через 4 секунды после загрузки
    const initialTimeout = setTimeout(syncChanges, DELTA_SYNC_INTERVAL);
    
    // Периодический sync каждые 4 секунды
    const interval = setInterval(syncChanges, DELTA_SYNC_INTERVAL);
    
    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [accessToken, workspaceId, isLoadingEvents, isUserInteracting]);

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
        const serverProjects = await projectsApi.getAll(accessToken, workspaceId);

        setProjects(prev => {
          // Сравниваем с текущими проектами через JSON
          const hasChanges = JSON.stringify(prev) !== JSON.stringify(serverProjects);

          if (hasChanges) {
            console.log(`📥 Projects Sync: обнаружены изменения (сервер: ${serverProjects.length}, локально: ${prev.length})`);

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

  // ✨ Polling для СОТРУДНИКОВ каждые 15 секунд (согласно Guidelines v1.9.4)
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
        const serverResources = await resourcesApi.getAll(accessToken, workspaceId);

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

    // Запускаем первый sync через 15 секунд после загрузки
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
        const serverDepartments = await departmentsApi.getAll(accessToken, workspaceId);

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
      setLoadedEventIds(prev => {
        const newSet = new Set(prev);
        orphanedIds.forEach(id => newSet.delete(id));
        return newSet;
      });

      // Delete from database in background
      if (accessToken) {
        orphanedEvents.forEach(event => {
          if (event.id.startsWith('e') && !event.id.startsWith('ev_temp')) {
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
    console.log(`🔍 Пересчёт visibleEvents: всего событий ${events.length}, ресурсов ${resources.length}, департаментов ${departments.length}`);
    
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
    
    // ✅ ИСПРАВЛЕНИЕ: Генерируем УНИКАЛЬНЫЙ временный ID с рандомизацией
    // Date.now() + Math.random() предотвращает коллизии при параллельном создании событий
    const tempEvent: SchedulerEvent = {
      id: event.id || `ev_temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      resourceId: event.resourceId!,
      startWeek: startWeek,
      weeksSpan: validWeeksSpan,
      unitStart: event.unitStart || 0,
      unitsTall: event.unitsTall || 1,
      projectId: event.projectId || projects[0].id
    };
    
    // Добавляем в state только если события с таким ID еще нет (избегаем дубликатов)
    setEventsState(prev => {
      const exists = prev.some(e => e.id === tempEvent.id);
      const newState = exists ? prev : [...prev, tempEvent];
      
      console.log(`📝 setEventsState (добавление временного): ${prev.length} → ${newState.length}`, {
        tempId: tempEvent.id,
        exists,
        added: !exists
      });
      
      return newState;
    });

    try {
      const createdEvent = await eventsApi.create(tempEvent, accessToken);
      
      // ВАЖНО: Используем функциональный setState для избежания stale closure
      setEventsState(prev => {
        const newEvents = prev.map(e => e.id === tempEvent.id ? createdEvent : e);
        
        console.log(`📝 setEventsState (замена временного на реальное): ${tempEvent.id} → ${createdEvent.id}`, {
          prevLength: prev.length,
          newLength: newEvents.length,
          replaced: prev.some(e => e.id === tempEvent.id)
        });
        
        // Сохраняем в кэш асинхронно
        setStorageJSON(`cache_events_${workspaceId}`, newEvents).catch(err => 
          console.error('❌ Ошибка сохранения в кэш:', err)
        );
        
        return newEvents;
      });
      
      setLoadedEventIds(prev => new Set(prev).add(createdEvent.id));
      console.log('✅ Событие создано:', createdEvent.id);
      
      // ✅ Отмечаем что было локальное изменение
      // Используем более позднюю метку чтобы защититься от polling во время batch операций
      lastLocalChangeRef.current = Date.now();
      
      return createdEvent;
    } catch (error) {
      console.error('❌ Ошибка создания события:', error);
      setEventsState(prev => prev.filter(e => e.id !== tempEvent.id));
      throw error;
    }
  }, [projects, accessToken, workspaceId]);

  const updateEvent = useCallback(async (id: string, event: Partial<SchedulerEvent>) => {
    // Пропускаем обновление на сервере только для временных ID
    if (id.startsWith('ev_temp_')) {
      console.log('⏭️ Пропуск обновления временного события:', id);
      return;
    }

    // 🎯 НОВАЯ ЛОГИКА: Добавляем в pending операции и debounced save
    // Оптимистичное обновление уже сделано в вызывающем коде
    
    // Находим оригинальное событие для rollback
    const originalEvent = events.find(e => e.id === id);
    
    if (originalEvent) {
      // Создаём обновлённое событие
      const updatedEvent = { ...originalEvent, ...event };
      
      // Добавляем в pending операции
      pendingOps.addPending(id, 'update', originalEvent, updatedEvent);
      
      console.log('⏳ Добавление обновления в debounced queue:', id);
    }
    
    // Добавляем в очередь debounced save (автоматически сохранится через 500ms)
    queueEventUpdate(id, event);
    
    // Отмечаем что было локальное изменение (для защиты от polling)
    lastLocalChangeRef.current = Date.now();
  }, [events, pendingOps, queueEventUpdate]);

  const deleteEvent = useCallback(async (id: string) => {
    // ✅ КРИТИЧНО: Очищаем pending операции для этого события (если есть)
    pendingOps.removePending(id);
    console.log('🧹 Очистка pending операций для события:', id);
    
    // Используем функциональный setState для избежания stale closure
    let originalEvent: SchedulerEvent | undefined;
    
    setEventsState(prev => {
      originalEvent = prev.find(e => e.id === id);
      if (!originalEvent) {
        // Событие не найдено в state - это нормально для Undo/Redo
        console.log('ℹ️ Событие не найдено в state при удалении (уже удалено локально):', id);
        return prev;
      }
      
      const newEvents = prev.filter(e => e.id !== id);
      
      // Сохраняем в кэш асинхронно
      setStorageJSON(`cache_events_${workspaceId}`, newEvents).catch(err =>
        console.error('❌ Ошибка сохранения в кэш:', err)
      );
      
      return newEvents;
    });
    
    // Удаляем из loadedEventIds даже если события нет в state
    setLoadedEventIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });

    // 🗑️ КРИТИЧНО: Помечаем событие как удаленное СРАЗУ (даже если не было в state)
    deletedEventIdsRef.current.add(id);
    console.log(`🗑️ Событие помечено как удаленное: ${id} (всего удалено: ${deletedEventIdsRef.current.size})`);

    // Пропускаем удаление на сервере только для временных ID
    if (id.startsWith('ev_temp_')) {
      console.log('⏭️ Пропуск удаления временного события:', id);
      return;
    }

    try {
      console.log('🗑️ Удаление события на сервере:', id);
      await eventsApi.delete(id, accessToken);
      console.log('✅ Событие удлено на сервере:', id);
      
      // Отмечаем что было локальное изменение
      lastLocalChangeRef.current = Date.now();
      
      // Очищаем пометку удаления через 10 секунд (достаточно для всех sync'ов)
      setTimeout(() => {
        deletedEventIdsRef.current.delete(id);
        console.log(`🧹 Очистка пометки удаления: ${id}`);
      }, 10000);
    } catch (error) {
      console.error('❌ Ошибка удаления события на сервере:', error);
      // При ошибке снимаем пометку удаления и восстанавливаем событие
      deletedEventIdsRef.current.delete(id);
      setEventsState(prev => [...prev, originalEvent!]);
      setLoadedEventIds(prev => new Set(prev).add(id));
      throw error;
    }
  }, [accessToken, workspaceId, pendingOps]);

  const setEvents = useCallback((eventsOrUpdater: SchedulerEvent[] | ((prev: SchedulerEvent[]) => SchedulerEvent[])) => {
    setEventsState(eventsOrUpdater);
  }, []);

  // ✨ Sync operations (для Undo/Redo)
  const cancelPendingChange = useCallback((id: string) => {
    pendingOps.removePending(id);
  }, [pendingOps]);

  const flushPendingChanges = useCallback(async () => {
    await flushPendingUpdates();
  }, [flushPendingUpdates]);

  const syncRestoredEventsToServer = useCallback(async (events: SchedulerEvent[], updateHistoryEventId?: (oldId: string, newId: string) => void) => {
    console.log(`🔄 Undo/Redo: синхронизация восстановленных событий с сервером...`);
    console.log(`🔄 Всего событий для проверки: ${events.length}`);
    console.log(`🔄 loadedEventIds содержит: ${loadedEventIds.current.size} событий`);
    
    // ✅ КРИТИЧНО: Разделяем события на ДВЕ группы:
    // 1. eventsToCreate - событий НЕТ на сервере (удалены другим пользователем)
    // 2. eventsToUpdate - события ЕСТЬ на сервере (но могут быть с устаревшими данными)
    const eventsToCreate: SchedulerEvent[] = [];
    const eventsToUpdate: SchedulerEvent[] = [];
    
    events.forEach(event => {
      const existsOnServer = loadedEventIds.current.has(event.id);
      if (!existsOnServer) {
        console.log(`🔄 Событие ${event.id} не найдено на сервере, нужно создать`);
        eventsToCreate.push(event);
      } else {
        console.log(`🔄 Событие ${event.id} найдено на сервере, нужно обновить`);
        eventsToUpdate.push(event);
      }
    });
    
    console.log(`🔄 Событий для создания на сервере: ${eventsToCreate.length}`);
    console.log(`🔄 Событий для обновления на сервере: ${eventsToUpdate.length}`);
    
    if (eventsToCreate.length === 0 && eventsToUpdate.length === 0) {
      console.log('✅ Нет событий для синхронизации');
      return;
    }
    
    // Очищаем пометки удаления для всех восстанавливаемых событий
    [...eventsToCreate, ...eventsToUpdate].forEach(event => {
      if (deletedEventIdsRef.current.has(event.id)) {
        deletedEventIdsRef.current.delete(event.id);
        console.log(`🧹 Очистка пометки удаления для восстановленного: ${event.id}`);
      }
    });
    
    try {
      const operations: BatchOperation[] = [];
      
      // ✅ ЧАСТЬ 1: Операции создания (для событий которых нет на сервере)
      if (eventsToCreate.length > 0) {
        console.log(`📦 BATCH CREATE: подготовка ${eventsToCreate.length} событий для создания...`);
        eventsToCreate.forEach(e => {
          operations.push({
            op: 'create',
            id: e.id, // ✅ КРИТИЧНО: передаем ID для upsert!
            data: {
              id: e.id, // ✅ Также в data для уверенности
              resourceId: e.resourceId,
              startWeek: e.startWeek,
              weeksSpan: e.weeksSpan,
              unitStart: e.unitStart,
              unitsTall: e.unitsTall,
              projectId: e.projectId
            },
            workspace_id: workspaceId
          });
        });
      }
      
      // ✅ ЧАСТЬ 2: Операции обновления (для событий которые есть на сервере)
      // КРИТИЧНО: Это исправляет проблему когда Full Sync возвращает старые данные!
      if (eventsToUpdate.length > 0) {
        console.log(`📦 BATCH UPDATE: подготовка ${eventsToUpdate.length} событий для обновления...`);
        eventsToUpdate.forEach(e => {
          operations.push({
            op: 'update',
            id: e.id,
            data: {
              resourceId: e.resourceId,
              startWeek: e.startWeek,
              weeksSpan: e.weeksSpan,
              unitStart: e.unitStart,
              unitsTall: e.unitsTall,
              projectId: e.projectId
            },
            workspace_id: workspaceId
          });
        });
      }
      
      console.log(`📦 BATCH: всего операций для отправки: ${operations.length}`);
      console.log(`📦 BATCH: ${eventsToCreate.length} create + ${eventsToUpdate.length} update`);
      
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
        console.error('❌ BATCH: ответ сервера:', error);
        throw new Error(error.error || 'Batch operation failed');
      }
      
      const results: BatchResult = await response.json();
      
      console.log(`✅ BATCH CREATE: создано ${results.created.length} событий на сервере`);
      console.log(`✅ BATCH UPDATE: обновлено ${results.updated.length} событий на сервере`);
      console.log(`📦 Восстановленные события:`, [...results.created, ...results.updated].map((e: SchedulerEvent) => ({ id: e.id, resourceId: e.resourceId })));
      
      // Обновляем loadedEventIds для созданных событий
      results.created.forEach((event: SchedulerEvent) => {
        loadedEventIds.current.add(event.id);
      });
      
      // ✅ ВАЖНО: Обновляем state событий с данными с сервера (на случай если что-то изменилось)
      setEventsState(prev => {
        const syncedIds = new Set([...results.created, ...results.updated].map((e: SchedulerEvent) => e.id));
        return prev.map(e => {
          if (syncedIds.has(e.id)) {
            const serverEvent = [...results.created, ...results.updated].find((se: SchedulerEvent) => se.id === e.id);
            return serverEvent || e;
          }
          return e;
        });
      });
      
      // Отмечаем что было локальное изменение
      lastLocalChangeRef.current = Date.now();
      
      console.log('✅ Восстановленные события успешно синхронизированы с сервером');
      
    } catch (error) {
      console.error('❌ Ошибка синхронизации восстановленных событий:', error);
      throw error;
    }
    
    // Обновляем ID в истории если нужно
    if (updateHistoryEventId) {
      events.forEach(event => {
        updateHistoryEventId(event.id, event.id);
      });
    }
  }, [accessToken, workspaceId, pendingOps]);

  const syncDeletedEventsToServer = useCallback(async (currentEvents: SchedulerEvent[], previousEvents: SchedulerEvent[]) => {
    console.log(`🗑️ Undo/Redo: проверка удалённых событий...`);
    console.log(`🗑️ Текущих событий: ${currentEvents.length}, было: ${previousEvents.length}`);
    
    // Находим события которые были удалены (есть в previous, нет в current)
    const currentIds = new Set(currentEvents.map(e => e.id));
    const deletedEvents = previousEvents.filter(e => !currentIds.has(e.id));
    
    if (deletedEvents.length === 0) {
      console.log('✅ Нет удалённых событий для синхронизации');
      return;
    }
    
    console.log(`🗑️ Найдено ${deletedEvents.length} удалённых событий:`, deletedEvents.map(e => e.id));
    
    // Помечаем события как удалённые (чтобы Full Sync их не вернул)
    deletedEvents.forEach(event => {
      deletedEventIdsRef.current.add(event.id);
      console.log(`🗑️ Пометка удалённого: ${event.id}`);
    });
    
    // Удаляем события на сервере
    try {
      await Promise.all(deletedEvents.map(async (event) => {
        // Пропускаем временные ID
        if (event.id.startsWith('ev_temp_')) {
          console.log(`⏭️ Пропуск временного ID: ${event.id}`);
          return;
        }
        
        try {
          await eventsApi.delete(event.id, accessToken);
          console.log(`✅ Событие удалено на сервере: ${event.id}`);
        } catch (error) {
          console.error(`❌ Ошибка удаления события ${event.id}:`, error);
        }
      }));
      
      console.log('✅ Удалённые события синхронизированы с сервером');
      
      // Очищаем пометки удаления через 10 секунд
      setTimeout(() => {
        deletedEvents.forEach(event => {
          deletedEventIdsRef.current.delete(event.id);
          console.log(`🧹 Очистка пометки удаления: ${event.id}`);
        });
      }, 10000);
      
    } catch (error) {
      console.error('❌ Ошибка синхронизации удалённых событий:', error);
      throw error;
    }
  }, [accessToken]);

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
    
    // Отмечаем что было локальное изменение
    lastResourcesChangeRef.current = Date.now();
    
    console.log('✅ Сотрудник удален:', id);
  }, [accessToken, workspaceId]);

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
    isUserInteracting,
    setIsUserInteracting,
    resetDeltaSyncTimer: () => lastLocalChangeRef.current = Date.now(),
    resetProjectsSyncTimer: () => lastProjectsChangeRef.current = Date.now(),
    resetResourcesSyncTimer: () => lastResourcesChangeRef.current = Date.now(),
    resetDepartmentsSyncTimer: () => lastDepartmentsChangeRef.current = Date.now(),
    createResource,
    updateResource,
    deleteResource,
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
    isUserInteracting,
    setIsUserInteracting,
    createResource,
    updateResource,
    deleteResource,
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