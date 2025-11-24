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
  flushPendingChanges: (updateHistoryEventId?: (oldId: string, newId: string) => void) => Promise<void>;
  syncRestoredEventsToServer: (events: SchedulerEvent[], updateHistoryEventId?: (oldId: string, newId: string) => void) => Promise<void>;
  syncDeletedEventsToServer: (currentEvents: SchedulerEvent[], previousEvents: SchedulerEvent[]) => Promise<void>; // ✅ Синхронизация удалений
  hasPendingOperations: () => boolean; // ✅ Проверка наличия активных pending операций
  
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

  // 🗑️ Отслеживание удаленных событий (для защиты от "воскрешения")
  const deletedEventIdsRef = useRef<Set<string>>(new Set());
  const lastLocalChangeRef = useRef<number>(0);
  
  // ⏱️ Timestamp последней синхронизации (для delta sync)
  const lastSyncTimestampRef = useRef<string | null>(null);
  
  const pendingOps = usePendingOperations();
  
  // ✨ Debounced Save - накопление изменений для пакетного сохранения
  const { queueChange: queueEventUpdate, flush: flushPendingUpdates } = useDebouncedSave(
    async (changes: Map<string, Partial<SchedulerEvent>>, updateHistoryEventId?: (oldId: string, newId: string) => void) => {
      // 🚀 BATCH API - отправляем ВСЕ изменения ОДНИМ запросом!
      console.log(`📦 BATCH v4.0.0: отправка ${changes.size} изменений на сервер...`);
      
      // ✅ ШАГ 2 v4.0.0: Фильтруем только СТАРЫЕ временные ID (e1732005123456789)
      // НОВЫЕ временные ID (ev_temp_XXX) РАЗРЕШЕНЫ - они будут созданы на сервере!
      const validChanges = Array.from(changes.entries()).filter(([id]) => {
        // ✅ Новые временные ID ev_temp_* РАЗРЕШЕНЫ
        if (id.startsWith('ev_temp_')) {
          console.log(`✅ BATCH: временное событие ${id} будет создано на сервере`);
          return true;
        }
        
        // ❌ Старые временные ID e1732005123456789 НЕ разрешены
        const numericPart = id.replace('e', '');
        const isOldTemporaryId = numericPart.length > 10;
        
        if (isOldTemporaryId) {
          console.log(`⏭️ BATCH: пропуск старого временного ID ${id} (устаревший формат)`);
          return false;
        }
        
        return true;
      });
      
      if (validChanges.length === 0) {
        console.log('⏭️ BATCH: нет валидных изменений для отправки');
        return;
      }
      
      console.log(`📦 BATCH: ${validChanges.length} валидных изменений из ${changes.size} (отфильтровано ${changes.size - validChanges.length} устаревших ID)`);
      
      // ✅ ШАГ 2 v4.0.0: Определяем create vs update на основе формата ID и loadedEventIds
      const operations: BatchOperation[] = validChanges.map(([id, eventData]) => {
        const isTemporary = id.startsWith('ev_temp_');
        const isLoaded = loadedEventIds.current.has(id);
        
        // Временные ID → всегда create
        // Реальные ID → create если не загружен, update если загружен
        const op = isTemporary ? 'create' : (isLoaded ? 'update' : 'create');
        
        console.log(`📦 BATCH: событие ${id} → ${op} (isTemporary=${isTemporary}, isLoaded=${isLoaded})`);
        
        const data: any = { ...eventData };
        
        // ✅ ШАГ 2 v4.0.0: НЕ передаём временный ID в data для CREATE
        // Для временных ID сервер создаст новый ID через PostgreSQL sequence
        if (!isTemporary) {
          data.id = id;
        }
        
        return {
          op,
          id, // Для отслеживания в результатах (сопоставление temp → real)
          data,
          workspace_id: workspaceId
        };
      });
      
      console.log('📦 BATCH: операции:', operations.map(op => `${op.op}:${op.id}`).join(', '));
      
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
      console.log(`✅ BATCH: успешно - created: ${results.created?.length || 0}, updated: ${results.updated.length}`);
      
      // ✅ ШАГ 2 v4.0.0: Заменяем временные ID на реальные после CREATE
      if (results.created && results.created.length > 0) {
        console.log(`🔄 BATCH: начало замены временных ID на реальные для ${results.created.length} событий...`);
        
        // Получаем CREATE операции для сопоставления temp → real
        const createOps = operations.filter(op => op.op === 'create');
        
        results.created.forEach((createdEvent: SchedulerEvent) => {
          const realId = createdEvent.id;
          
          // ✅ ИСПРАВЛЕНИЕ v4.0.1: Сопоставляем по данным события, а не по индексу!
          // Если некоторые CREATE failed, индексы не совпадут
          const matchingOp = createOps.find(op => {
            const opData = op.data;
            return opData?.resourceId === createdEvent.resourceId &&
                   opData?.startWeek === createdEvent.startWeek &&
                   opData?.unitStart === createdEvent.unitStart &&
                   opData?.projectId === createdEvent.projectId;
          });
          
          if (!matchingOp) {
            console.warn(`⚠️ BATCH: не найдена CREATE операция для события ${realId}`);
            return;
          }
          
          const tempId = matchingOp.id;
          console.log(`🔄 BATCH: замена ${tempId} → ${realId}`);

          // ✅ Обновляем историю (если передана функция)
          if (updateHistoryEventId) {
            updateHistoryEventId(tempId, realId);
            console.log(`   📜 History: ID обновлён ${tempId} → ${realId}`);
          }
          
          // 1️⃣ Заменить в eventsState
          setEventsState(prev => {
            const replaced = prev.map(e => e.id === tempId ? { ...e, ...createdEvent } : e);
            console.log(`   ✅ eventsState: заменён ${tempId} → ${realId}`);
            
            // Сохраняем в кэш
            setStorageJSON(`cache_events_${workspaceId}`, replaced).catch(err =>
              console.error('❌ Ошибка сохранения в кэш:', err)
            );
            
            return replaced;
          });
          
          // 2️⃣ Добавить в loadedEventIds
          loadedEventIds.current.delete(tempId); // Удаляем временный
          loadedEventIds.current.add(realId); // Добавляем реальный
          console.log(`   ✅ loadedEventIds: ${tempId} → ${realId}`);
          
          // 3️⃣ Удалить из pending операций
          pendingOps.removePending(tempId);
        });
        
        console.log(`✅ BATCH: замена временных ID завершена`);
      }
      
      // ✅ ШАГ 2 v4.0.0: Обработка ошибок UPDATE
      if (results.errors && results.errors.length > 0) {
        console.warn(`⚠️ BATCH: обнаружено ${results.errors.length} ошибок`);
        
        results.errors.forEach(err => {
          console.error(`❌ BATCH ${err.op} error:`, err);
          
          // Если событие не найдено при UPDATE - удаляем из loadedEventIds
          if (err.op === 'update' && err.id && err.message === 'Event not found') {
            console.log(`🧹 BATCH: удаление ${err.id} из loadedEventIds (не найдено на сервере)`);
            
            loadedEventIds.current.delete(err.id);
            
            // Также удаляем из pending
            pendingOps.removePending(err.id);
            
            // Пометим как удалённое чтобы не синхронизировать снова
            deletedEventIdsRef.current.add(err.id);
          }
        });
      }
      
      // 🔍 ВАЖНО: НЕ ПЕРЕЗАПИСЫВАЕМ локальное состояние данными с сервера!
      // Локальное состояние уже правильное (оптимистичное обновление)
      console.log('⏭️ BATCH: пропускаем обновление state для UPDATE операций (локальное состояние актуальнее)');
      
      // Удаляем из pending операций после успешного сохранения (для UPDATE)
      changes.forEach((_, id) => {
        if (!id.startsWith('ev_temp_')) { // Временные ID уже удалены выше
          pendingOps.removePending(id);
        }
      });
      
      // Отмечаем что было локальное изменение
      lastLocalChangeRef.current = Date.now();
    },
    500 // ⏱️ Debounce delay 500ms (компромисс между производительностью и сохранением истории)
  );
  
  const [isLoadingDepartments, setIsLoadingDepartments] = useState(true);
  const [isLoadingResources, setIsLoadingResources] = useState(true);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [isLoadingGrades, setIsLoadingGrades] = useState(true);
  const [isLoadingEventPatterns, setIsLoadingEventPatterns] = useState(true);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(true);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  
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
            
            // ✅ КРИТИЧНО: МЕРЖИМ с локальными событиями вместо полной замены!
            // Это защищает восстановленные Undo/Redo события от перезаписи
            const mergedEvents = prev.map(localEvent => {
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
            
            console.log(`✅ Full Sync: загружено ${result.length} событий (было ${prev.length}, с сервера ${filtered.length}, новых ${newServerEvents.length})`);
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
    
    // ✅ ШАГ 1 v4.0.0: Генерируем УНИКАЛЬНЫЙ временный ID с рандомизацией
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
    
    // ✅ ШАГ 1 v4.0.0: Добавляем в state с временным ID
    setEventsState(prev => {
      const exists = prev.some(e => e.id === tempEvent.id);
      const newState = exists ? prev : [...prev, tempEvent];
      
      console.log(`📝 createEvent: добавление временного события ${tempEvent.id}`, {
        exists,
        added: !exists,
        prevLength: prev.length,
        newLength: newState.length
      });
      
      // Сохраняем в кэш асинхронно
      if (!exists) {
        setStorageJSON(`cache_events_${workspaceId}`, newState).catch(err => 
          console.error('❌ Ошибка сохранения в кэш:', err)
        );
      }
      
      return newState;
    });

    // ✅ ШАГ 1 v4.0.0: Добавляем в pending queue для batch сохранения
    pendingOps.addPending(tempEvent.id, 'create', tempEvent, tempEvent);
    console.log(`⏳ createEvent: событие ${tempEvent.id} добавлено в pending queue (op: create)`);
    
    // ✅ ШАГ 1 v4.0.0: Добавляем в debounced save queue (автоматически сохранится через 500ms)
    queueEventUpdate(tempEvent.id, tempEvent);
    
    // ✅ ШАГ 1 v4.0.0: Отмечаем что было локальное изменение
    lastLocalChangeRef.current = Date.now();
    
    console.log('✅ createEvent завершён: событие создано локально (сохранится через flushPendingChanges):', tempEvent.id);
    
    // ✅ ШАГ 1 v4.0.0: Возвращаем временное событие (БЕЗ API запроса!)
    return tempEvent;
  }, [projects, workspaceId, pendingOps, queueEventUpdate]);

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
    loadedEventIds.current.delete(id);

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
      loadedEventIds.current.add(id);
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

  const flushPendingChanges = useCallback(async (updateHistoryEventId?: (oldId: string, newId: string) => void) => {
    await flushPendingUpdates(updateHistoryEventId);
  }, [flushPendingUpdates]);

  const hasPendingOperations = useCallback(() => {
    const pending = pendingOps.getAllPending();
    const hasPending = pending.length > 0;
    
    if (hasPending) {
      console.log(`⏳ hasPendingOperations: ${pending.length} операций в очереди:`, 
        pending.map(op => `${op.type}:${op.id}`).join(', ')
      );
    }
    
    return hasPending;
  }, [pendingOps]);

  const syncRestoredEventsToServer = useCallback(async (events: SchedulerEvent[], updateHistoryEventId?: (oldId: string, newId: string) => void) => {
    console.log(`🔄 UNDO/REDO: Синхронизация восстановленных событий с сервером...`);
    console.log(`🔄 UNDO/REDO: Всего событий для проверки: ${events.length}`);
    console.log(`🔄 UNDO/REDO: loadedEventIds содержит: ${loadedEventIds.current.size} событий`);
    
    // ✅ КРИТИЧНО: Разделяем события на ДВЕ группы:
    // 1. eventsToCreate - событий НЕТ на сервере
    //    (временные ID "ev_temp_..." ИЛИ реальные ID которых нет в loadedEventIds)
    // 2. eventsToUpdate - события ЕСТЬ на сервере (реальные ID в loadedEventIds)
    const eventsToCreate: SchedulerEvent[] = [];
    const eventsToUpdate: SchedulerEvent[] = [];
    
    events.forEach(event => {
      const isTemporaryId = event.id.startsWith('ev_temp_');
      const isLoaded = loadedEventIds.current.has(event.id);
      
      if (isTemporaryId) {
        console.log(`🔄 UNDO/REDO: Событие ${event.id} имеет временный ID -> CREATE`);
        eventsToCreate.push(event);
      } else if (!isLoaded) {
        console.log(`🔄 UNDO/REDO: Событие ${event.id} имеет реальный ID но не загружено (восстановление удалённого) -> CREATE`);
        eventsToCreate.push(event);
      } else {
        console.log(`🔄 UNDO/REDO: Событие ${event.id} имеет реальный ID и загружено -> UPDATE`);
        eventsToUpdate.push(event);
      }
    });
    
    console.log(`🔄 UNDO/REDO: Событий для создания: ${eventsToCreate.length}`);
    console.log(`🔄 UNDO/REDO: Событий для обновления: ${eventsToUpdate.length}`);
    
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
          const isTemporary = e.id.startsWith('ev_temp_');
          const data: any = {
            resourceId: e.resourceId,
            startWeek: e.startWeek,
            weeksSpan: e.weeksSpan,
            unitStart: e.unitStart,
            unitsTall: e.unitsTall,
            projectId: e.projectId
          };
          
          // ✅ КРИТИЧНО: Если это реальный ID (восстановление удалённого), передаём его серверу!
          if (!isTemporary) {
            data.id = e.id;
          }

          operations.push({
            op: 'create',
            id: e.id, // Для отслеживания в результатах (сопоставление temp → real)
            data: data,
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
      
      // ✅ v3.3.22: КРИТИЧНО - строгая валидация ПЕРЕД использованием
      console.log('🔍 BATCH: Валидация параметров...');
      console.log(`   projectId: "${projectId}" (тип: ${typeof projectId})`);
      console.log(`   accessToken: ${accessToken ? `"${accessToken.substring(0, 20)}..." (длина: ${accessToken.length})` : 'ОТСУТСТВУЕТ'}`);
      console.log(`   workspaceId: ${workspaceId} (тип: ${typeof workspaceId})`);
      
      if (!projectId || projectId === 'undefined' || projectId === 'null' || projectId.trim() === '') {
        console.error('❌ BATCH: projectId невалиден!', { projectId, type: typeof projectId });
        throw new Error(`Invalid project ID: "${projectId}". Check /utils/supabase/info.tsx`);
      }
      if (!accessToken || accessToken === 'undefined' || accessToken === 'null' || accessToken.trim() === '') {
        console.error('❌ BATCH: accessToken невалиден!', { hasToken: !!accessToken, type: typeof accessToken });
        throw new Error('Invalid access token. Please re-login.');
      }
      if (!workspaceId) {
        console.error('❌ BATCH: workspaceId не определён!', { workspaceId, type: typeof workspaceId });
        throw new Error('Workspace ID is required for batch operations');
      }
      
      console.log('✅ BATCH: Валидация пройдена');
      
      const batchUrl = `https://${projectId}.supabase.co/functions/v1/make-server-73d66528/events/batch`;
      console.log(`📦 BATCH: Отправка запроса к: ${batchUrl}`);
      console.log(`📦 BATCH: Workspace ID: ${workspaceId}`);
      
      // ✅ v3.3.22: Таймаут 15 секунд для запроса
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.error('❌ BATCH: Таймаут 15 секунд истёк');
        controller.abort();
      }, 15000);
      
      let response: Response;
      try {
        response = await fetch(batchUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({ operations }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        console.log(`✅ BATCH: Получен ответ от сервера (status: ${response.status})`);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        
        // Детальная диагностика ошибки fetch
        if (fetchError.name === 'AbortError') {
          console.error('❌ BATCH: Запрос прерван по таймауту (15 сек)');
          throw new Error('Request timeout after 15 seconds. Server may be overloaded or Edge Function not responding.');
        }
        
        console.error('❌ BATCH: Ошибка fetch:', {
          name: fetchError.name,
          message: fetchError.message,
          cause: fetchError.cause,
          stack: fetchError.stack
        });
        
        throw new Error(`Network error: ${fetchError.message}. Check server availability and CORS settings.`);
      }
      
      if (!response.ok) {
        let errorData: any;
        try {
          errorData = await response.json();
        } catch (parseError) {
          console.error('❌ BATCH: Не удалось распарсить ответ сервера');
          throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }
        console.error('❌ BATCH: ответ сервера:', errorData);
        throw new Error(errorData.error || `Batch operation failed with status ${response.status}`);
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
        // 1. Создаем карту Temp -> Real (CREATE) для замены ID
        const tempToRealMap = new Map<string, SchedulerEvent>();
        if (results.created.length > 0) {
           eventsToCreate.forEach((tempEvent, index) => {
              const createdEvent = results.created[index];
              if (createdEvent) {
                  tempToRealMap.set(tempEvent.id, createdEvent);
              }
           });
        }

        // 2. Множество обновлённых реальных ID (UPDATE)
        const updatedIds = new Set(results.updated.map((e: SchedulerEvent) => e.id));

        return prev.map(e => {
          // Если это временное событие которое мы только что создали -> заменяем на реальное
          if (tempToRealMap.has(e.id)) {
             console.log(`🔄 Sync: замена временного ID в стейте ${e.id} → ${tempToRealMap.get(e.id)!.id}`);
             return tempToRealMap.get(e.id)!;
          }
          
          // Если это реальное событие которое мы обновили -> берем свежие данные с сервера
          if (updatedIds.has(e.id)) {
            const serverEvent = results.updated.find((se: SchedulerEvent) => se.id === e.id);
            return serverEvent || e;
          }
          
          return e;
        });
      });
      
      // Отмечаем что было локальное изменение
      lastLocalChangeRef.current = Date.now();
      
      // ✅ v3.3.20: КРИТИЧНО - обновляем ID в истории для созданных событий!
      // Это исправляет баг когда Redo блокируется из-за временных ID в истории
      if (updateHistoryEventId && results.created.length > 0) {
        console.log(`📝 История: обновление ID для ${results.created.length} созданных событий...`);
        
        // Создаём map: временный ID → реальный ID
        const tempToRealIdMap = new Map<string, string>();
        eventsToCreate.forEach((tempEvent, index) => {
          const createdEvent = results.created[index];
          if (createdEvent) {
            tempToRealIdMap.set(tempEvent.id, createdEvent.id);
            console.log(`   ${tempEvent.id} → ${createdEvent.id}`);
          }
        });
        
        // Обновляем ID в истории
        tempToRealIdMap.forEach((realId, tempId) => {
          updateHistoryEventId(tempId, realId);
        });
        
        console.log(`📝 История: обновлено ${tempToRealIdMap.size} ID`);
      }
      
      console.log('✅ Восстановленные события успешно синхронизированы с сервером');
      
    } catch (error: any) {
      console.error('❌ Ошибка синхронизации восстановленных событий:', error);
      console.error('❌ Тип ошибки:', error?.constructor?.name);
      console.error('❌ Сообщение:', error?.message);
      console.error('❌ Stack:', error?.stack);
      
      // ✅ Детальная информация для диагностики
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        console.error('❌ СЕТЕВАЯ ОШИБКА: Не удалось подключиться к серверу');
        console.error('❌ Проверьте:');
        console.error('   1. Edge Function деплоен: supabase functions list');
        console.error(`   2. URL корректен: https://${projectId}.supabase.co`);
        console.error('   3. Токен валиден:', accessToken ? '✅ есть' : '❌ нет');
      }
      
      throw error;
    }
  }, [accessToken, workspaceId, pendingOps]);

  const syncDeletedEventsToServer = useCallback(async (currentEvents: SchedulerEvent[], previousEvents: SchedulerEvent[]) => {
    console.log(`🔄 UNDO/REDO: Проверка удалённых событий...`);
    console.log(`🔄 UNDO/REDO: Текущих событий: ${currentEvents.length}, было: ${previousEvents.length}`);
    
    // Находим события которые были удалены (есть в previous, нет в current)
    const currentIds = new Set(currentEvents.map(e => e.id));
    const deletedEvents = previousEvents.filter(e => !currentIds.has(e.id));
    
    if (deletedEvents.length === 0) {
      console.log('✅ Нет удалённых событий для синхронизации');
      return;
    }
    
    console.log(`🔄 UNDO/REDO: Найдено ${deletedEvents.length} удалённых событий:`, deletedEvents.map(e => e.id));
    
    // Помечаем события как удалённые (чтобы Full Sync их не вернул)
    deletedEvents.forEach(event => {
      deletedEventIdsRef.current.add(event.id);
      console.log(`🔄 UNDO/REDO: Пометка удалённого: ${event.id}`);
    });
    
    // Удаляем события на сервере
    try {
      await Promise.all(deletedEvents.map(async (event) => {
        // Пропускаем временные ID
        if (event.id.startsWith('ev_temp_')) {
          console.log(`⏭️ Пропуск временного ID: ${event.id}`);
          return;
        }
        
        // ✅ КРИТИЧНО: Сначала удаляем из loadedEventIds (оптимистично)
        // Это гарантирует, что если удаление пройдёт успешно (или даже с ошибкой),
        // при последующем Redo мы попытаемся СОЗДАТЬ событие (CREATE), а не обновить (UPDATE).
        // Если событие останется в БД (ошибка удаления) и мы пошлём CREATE -> получим "Duplicate key" (лучше чем "Not found")
        // или backend сделает UPSERT.
        if (loadedEventIds.current.has(event.id)) {
          loadedEventIds.current.delete(event.id);
          console.log(`🧹 Оптимистичное удаление из loadedEventIds: ${event.id}`);
        }
        
        try {
          await eventsApi.delete(event.id, accessToken);
          console.log(`✅ Событие удалено на сервере: ${event.id}`);
        } catch (error) {
          console.error(`❌ Ошибка удаления события ${event.id}:`, error);
          // При ошибке можно было бы вернуть в loadedEventIds, но для Redo безопаснее оставить удалённым
          // чтобы попытаться пересоздать
        }
      }));
      
      console.log('✅ Удалённые события синхронизированы с сервером');
      
      // ✅ КРИТИЧНО: Увеличили время хранения пометки с 10 до 60 секунд
      // Это гарантирует что минимум 2 Full Sync'a (каждые 30 сек) пройдут с пометкой
      // Защита от "воскрешения" удалённых событий
      setTimeout(() => {
        deletedEvents.forEach(event => {
          deletedEventIdsRef.current.delete(event.id);
          console.log(`🧹 Очистка пометки удаления: ${event.id}`);
        });
      }, 60000); // ✅ БЫЛО: 10000 (10 сек) → СТАЛО: 60000 (60 сек)
      
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
    hasPendingOperations,
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
    hasPendingOperations,
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