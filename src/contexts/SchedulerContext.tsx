import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo, useRef } from 'react';
import { SchedulerEvent, Department, Resource, Project, Grade, EventPattern, Company, BatchOperation, BatchResult, Comment } from '../types/scheduler';
import { 
  eventsApi, 
  resourcesApi, 
  projectsApi, 
  departmentsApi, 
  gradesApi, 
  companiesApi,
  eventPatternsApi,
  CreateResourceData,
  UpdateResourceData,
  CreateProjectData,
  UpdateProjectData,
  getWorkspaceSnapshot
} from '../services/api';
import * as commentsApi from '../services/api/comments'; // Import comments API
import { usersApi } from '../services/api/users';
import { getStorageJSON, setStorageJSON } from '../utils/storage';
import { usePendingOperations } from '../hooks/usePendingOperations';
import { useSyncManager } from '../hooks/useSyncManager';
import { useUI } from './UIContext';
import { projectId } from '../utils/supabase/info';
import { handleCloudflareError } from '../utils/cloudflareErrorHandler';
import { toast } from 'sonner@2.0.3';
import { throttledRequest } from '../utils/requestThrottle';
import { getWeeksInYear } from '../utils/scheduler'; // ✅ Для динамического вычисления недель
import { useRealtimeEvents } from '../hooks/useRealtimeEvents';
import { useRealtimeProjects } from '../hooks/useRealtimeProjects';
import { useRealtimeComments } from '../hooks/useRealtimeComments';
import { useRealtimeResources } from '../hooks/useRealtimeResources';
import { useRealtimeDepartments } from '../hooks/useRealtimeDepartments';

interface SchedulerContextType {
  // Data
  events: SchedulerEvent[];
  departments: Department[];
  resources: Resource[];
  projects: Project[];
  grades: Grade[];
  eventPatterns: EventPattern[];
  companies: Company[];
  comments: Comment[]; // ✅ Комментарии
  
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

  // 🔄 History Rebase Registration (для Realtime)
  setHistoryRebasers: (rebasers: {
    rebaseEvent: (eventId: string, newData: Partial<SchedulerEvent>) => void;
    rebaseDeleteEvent: (eventId: string) => void;
    rebaseInsertEvent: (event: SchedulerEvent) => void;
  }) => void;

  // 🚫 User interaction state (для отключения polling во время drag/resize)
  isUserInteractingRef: React.MutableRefObject<boolean>;
  setIsUserInteracting: (value: boolean) => void;
  
  // 🔑 accessToken ref — чтобы обновление токена НЕ вызывало полную перезагрузку данных
  accessTokenRef: React.MutableRefObject<string | undefined>;
  
  // ⏱️ Delta Sync control (для блокировки синхронизации после локальных изменений)
  resetDeltaSyncTimer: () => void;
  resetProjectsSyncTimer: () => void; // ✅ Для проектов
  resetResourcesSyncTimer: () => void; // ✅ Для сотрудников
  resetDepartmentsSyncTimer: () => void; // ✅ Для департаментов
  
  // Resource operations
  createResource: (data: CreateResourceData) => Promise<void>;
  updateResource: (id: string, data: UpdateResourceData) => Promise<void>;
  deleteResource: (id: string) => Promise<void>;
  loadResources: () => Promise<void>; // ✅ Add loadResources function
  toggleUserVisibility: (id: string) => Promise<void>;
  uploadUserAvatar: (userId: string, file: File) => Promise<string>;
  
  // Project operations
  createProject: (data: CreateProjectData) => Promise<void>;
  updateProject: (id: string, data: UpdateProjectData) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  setProjects: (projects: Project[] | ((prev: Project[]) => Project[])) => void;
  
  // Department operations
  createDepartment: (name: string, color?: string | null) => Promise<void>;
  deleteDepartment: (id: string) => Promise<void>;
  getDepartmentUsersCount: (id: string) => Promise<number>;
  renameDepartment: (id: string, name: string, color?: string | null) => Promise<void>;
  reorderDepartments: (departments: Department[]) => Promise<void>;
  toggleDepartmentVisibility: (id: string) => Promise<void>;
  
  // Utility
  getGradeName: (gradeId: string | undefined) => string | undefined;
  loadedEventIds: Set<string>;
  getEvents: () => { events: SchedulerEvent[], projects: Project[], eventZOrder: Map<string, number> }; // ✅ Функция для получения свежего снапшота
  
  // Grade operations
  createGrade: (name: string) => Promise<void>;
  updateGrade: (gradeId: string, name: string) => Promise<void>;
  deleteGrade: (gradeId: string) => Promise<void>;
  loadGrades: () => Promise<void>;
  updateGradesSortOrder: (updates: Array<{ id: string; sortOrder: number }>) => Promise<void>;
  
  // Company operations
  createCompany: (name: string) => Promise<void>;
  updateCompany: (companyId: string, name: string) => Promise<void>;
  deleteCompany: (companyId: string) => Promise<void>;
  loadCompanies: () => Promise<void>;
  updateCompaniesSortOrder: (updates: Array<{ id: string; sortOrder: number }>) => Promise<void>;
  
  // Comment operations
  createComment: (data: { userId: string; comment: string; weekDate: string; weekIndex?: number }) => Promise<Comment>;
  updateComment: (id: string, text: string) => Promise<Comment>;
  moveComment: (id: string, newWeekIndex: number, newResourceId: string) => Promise<Comment>;
  deleteComment: (id: string) => Promise<void>;
}

const SchedulerContext = createContext<SchedulerContextType | undefined>(undefined);

interface SchedulerProviderProps {
  children: ReactNode;
  accessToken?: string;
  workspaceId?: string;
  timelineYear?: number; // ✅ Год воркспейса для вычисления количества недель
}

export function SchedulerProvider({ children, accessToken, workspaceId, timelineYear }: SchedulerProviderProps) {
  const [eventsState, setEventsState] = useState<SchedulerEvent[]>([]);
  const loadedEventIds = useRef<Set<string>>(new Set());

  // 🔄 Reference to history updater (for background syncs)
  const historyIdUpdaterRef = useRef<((oldId: string, newId: string) => void) | null>(null);
  const setHistoryIdUpdater = useCallback((updater: (oldId: string, newId: string) => void) => {
    historyIdUpdaterRef.current = updater;
  }, []);

  // 🔄 Reference to history rebasers (for Realtime)
  const historyRebasersRef = useRef<{
    rebaseEvent: (eventId: string, newData: Partial<SchedulerEvent>) => void;
    rebaseDeleteEvent: (eventId: string) => void;
    rebaseInsertEvent: (event: SchedulerEvent) => void;
  } | null>(null);
  const setHistoryRebasers = useCallback((rebasers: {
    rebaseEvent: (eventId: string, newData: Partial<SchedulerEvent>) => void;
    rebaseDeleteEvent: (eventId: string) => void;
    rebaseInsertEvent: (event: SchedulerEvent) => void;
  }) => {
    historyRebasersRef.current = rebasers;
  }, []);

  // 🗑️ Отслеживание удаленных событий (для защиты от "воскрешения")
  const deletedEventIdsRef = useRef<Set<string>>(new Set());
  const lastLocalChangeRef = useRef<number>(0);
  
  // ⏱️ Per-event modification timestamps (для защиты от устаревших Realtime-обновлений)
  const localEventModTimesRef = useRef<Map<string, number>>(new Map());
  
  const pendingOps = usePendingOperations();
  
  // ✨ SyncManager - новый движок синхронизации (v4.0.0)
  const { queueChange, flush: flushSync, remapKey, isSyncing, queueSize, hasPendingChanges } = useSyncManager({
    delay: 500, // 500мс задержки (быстрая синхронзация между пользователями)
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
               // ✅ КРИТИЧНО: Удаляем дубликат с realId (мог прилететь через Realtime INSERT)
               setEventsState(prev => {
                 const withoutDuplicate = prev.filter(e => e.id !== realId);
                 return withoutDuplicate.map(e => e.id === tempId ? { ...e, ...createdEvent } : e);
               });
               
               // 2. Обновляем loadedEventIds
               loadedEventIds.current.delete(tempId);
               loadedEventIds.current.add(realId);
               
               // 3. Обновляем очередь (если были измнения пока летело)
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
      
      // Удаляем з UI pending успешно обновленные/удаленные
      operations.forEach(op => {
        if (op.op !== 'create') {
           pendingOps.removePending(op.id);
        }
      });
      
      lastLocalChangeRef.current = Date.now();
    }
  });
  
  const { 
    isLoadingDepartments, setIsLoadingDepartments,
    isLoadingResources, setIsLoadingResources,
    isLoadingProjects, setIsLoadingProjects,
    isLoadingGrades, setIsLoadingGrades,
    isLoadingEventPatterns, setIsLoadingEventPatterns,
    isLoadingCompanies, setIsLoadingCompanies,
    isLoadingEvents, setIsLoadingEvents,
    isLoadingComments, setIsLoadingComments,
  } = useUI();
  
  // 🚫 User interaction state (для отключения polling во время drag/resize)
  const isUserInteractingRef = useRef(false);
  const setIsUserInteracting = useCallback((value: boolean) => {
    isUserInteractingRef.current = value;
  }, []);

  // 🔑 accessToken ref — чтобы обновление токена НЕ вызывало полную перезагрузку данных
  const accessTokenRef = useRef(accessToken);
  accessTokenRef.current = accessToken;

  // Data state
  const [departments, setDepartments] = useState<Department[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [eventPatterns, setEventPatterns] = useState<EventPattern[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [comments, setComments] = useState<Comment[]>([]); // ✅ State for comments
  
  // Refs для tracking локальных изменени (защита от синхронизации)
  const lastResourcesChangeRef = useRef<number>(0);
  const lastDepartmentsChangeRef = useRef<number>(0);
  const lastProjectsChangeRef = useRef<number>(0);
  const lastCommentsChangeRef = useRef<number>(0);
  
  // Alias для удобства
  const events = eventsState;

  // 📡 Realtime подписка на изменения событий от других пользоателей
  useRealtimeEvents({
    workspaceId: workspaceId || '',
    enabled: !!accessToken && !!workspaceId && workspaceId !== 'loading',
    setEvents: setEventsState,
    hasPendingChanges,
    isUserInteractingRef,
    lastLocalChangeRef,
    deletedEventIdsRef,
    historyRebasersRef,
    localEventModTimesRef,
  });

  // 📡 Realtime подписка на изменения проектов от других пользователей
  useRealtimeProjects({
    workspaceId: workspaceId || '',
    enabled: !!accessToken && !!workspaceId && workspaceId !== 'loading',
    setProjects,
    lastLocalChangeRef: lastProjectsChangeRef,
  });

  // 📡 Realtime подписка на изменения комментариев от других пользователей
  useRealtimeComments({
    workspaceId: workspaceId || '',
    enabled: !!accessToken && !!workspaceId && workspaceId !== 'loading',
    setComments,
    lastLocalChangeRef: lastCommentsChangeRef,
  });

  // 📡 Realtime подписка на изменения ресурсов от других пользователей
  useRealtimeResources({
    workspaceId: workspaceId || '',
    enabled: !!accessToken && !!workspaceId && workspaceId !== 'loading',
    setResources,
    lastLocalChangeRef: lastResourcesChangeRef,
  });

  // 📡 Realtime подписка на изменения департаментов от других пользователей
  useRealtimeDepartments({
    workspaceId: workspaceId || '',
    enabled: !!accessToken && !!workspaceId && workspaceId !== 'loading',
    setDepartments,
    lastLocalChangeRef: lastDepartmentsChangeRef,
  });

  // ==================== DATA LOADING ====================
  
  // Загрузка данных воркспейса (только если изменился workspace или токен)
  useEffect(() => {
    // 1. Сброс состояния при выходе из воркспейса
    if (!workspaceId) {
      if (accessToken) { // Только если мы залогинены, но нет воркспейса (вышли в меню)
        console.log('🧹 Чистка данных при выходе из воркспейса');
        setEventsState([]);
        setDepartments([]);
        setResources([]);
        setProjects([]);
        setComments([]);
        setGrades([]);
        setEventPatterns([]);
        setCompanies([]);
        loadedEventIds.current = new Set();
      }
      
      // ✅ ИСПРАВЛЕНИЕ: Оборачиваем setIsLoading в queueMicrotask чтобы избежать "Cannot update component while rendering"
      queueMicrotask(() => {
        setIsLoadingEvents(false);
        setIsLoadingResources(false);
        setIsLoadingDepartments(false);
        setIsLoadingProjects(false);
        setIsLoadingComments(false);
        setIsLoadingGrades(false);
        setIsLoadingEventPatterns(false);
        setIsLoadingCompanies(false);
      });
      return;
    }

    // 2. Если воркспейс в состоянии загрузки - показываем скелетоны
    if (workspaceId === "loading") {
      // ✅ ИСПРАВЛЕНИЕ: Оборачиваем setIsLoading в queueMicrotask
      queueMicrotask(() => {
        setIsLoadingEvents(true);
        setIsLoadingResources(true);
        setIsLoadingDepartments(true);
        setIsLoadingProjects(true);
        setIsLoadingComments(true);
        setIsLoadingGrades(true);
        setIsLoadingEventPatterns(true);
        setIsLoadingCompanies(true);
      });
      return;
    }

    // 3. Загрузка данных воркспейса
    if (!accessTokenRef.current) return;

    const loadWorkspaceData = async () => {
      const currentToken = accessTokenRef.current;
      if (!currentToken) return;
      
      // Helper для загрузки с кэшем
      const loadCache = async <T,>(
        key: string, 
        setter: (data: T) => void,
        label: string
      ) => {
        const start = performance.now();
        try {
          const cacheKey = `cache_${key}_${workspaceId}`;
          const cachedData = await getStorageJSON<T>(cacheKey);
          if (cachedData) {
            setter(cachedData);
            const duration = Math.round(performance.now() - start);
            if (label === 'events' && Array.isArray(cachedData)) {
              loadedEventIds.current = new Set((cachedData as any[]).map(e => e.id));
            }
            return true;
          }
        } catch (error) {
          console.warn(`Cache miss for ${label}`);
        }
        return false;
      };

      // 1. Сначала грузим из кэша (быстрый UI)
      const cacheStart = performance.now();
      // НЕ ставим isLoading=true сразу — сначала проверяем кэш, чтобы избежать flash скелетона

      const cacheResults = await Promise.all([
        loadCache('departments', setDepartments, 'departments'),
        loadCache('resources', setResources, 'resources'),
        loadCache('projects', setProjects, 'projects'),
        loadCache('grades', setGrades, 'grades'),
        loadCache('patterns', setEventPatterns, 'patterns'),
        loadCache('companies', setCompanies, 'companies'),
        loadCache('comments', setComments, 'comments'),
        loadCache('events', setEventsState, 'events'),
      ]);

      
      // ✅ ИСПРАВЛЕНИЕ: Оборачиваем setIsLoading в queueMicrotask
      // Показываем скелетон ТОЛЬКО для данных без кэша
      const [hasDepts, hasRes, hasProj, hasGrades, hasPatterns, hasCompanies, hasComments, hasEvents] = cacheResults;
      queueMicrotask(() => {
        if (!hasDepts) setIsLoadingDepartments(true);
        if (!hasRes) setIsLoadingResources(true);
        if (!hasProj) setIsLoadingProjects(true);
        if (!hasGrades) setIsLoadingGrades(true);
        if (!hasPatterns) setIsLoadingEventPatterns(true);
        if (!hasCompanies) setIsLoadingCompanies(true);
        if (!hasComments) setIsLoadingComments(true);
        if (!hasEvents) setIsLoadingEvents(true);
      });
      
      // 2. Затем грузим свежий снапшот с сервера (одним запросом)
      const snapshotStart = performance.now();
      
      try {
        const snapshot = await getWorkspaceSnapshot(workspaceId, currentToken);
        const snapshotDuration = Math.round(performance.now() - snapshotStart);
        console.log(`✅ Snapshot received in ${snapshotDuration}ms`);
        
        // Обновляем стейт
        setDepartments(snapshot.departments.sort((a, b) => (a.queue ?? 999) - (b.queue ?? 999)));
        setResources(snapshot.resources);
        setProjects(snapshot.projects);
        setGrades(snapshot.grades);
        setEventPatterns(snapshot.eventPatterns);
        setCompanies(snapshot.companies);
        setComments(snapshot.comments);
        setEventsState(snapshot.events);
        
        loadedEventIds.current = new Set(snapshot.events.map(e => e.id));
        
        // Обновляем кэш в фоне
        Promise.all([
          setStorageJSON(`cache_departments_${workspaceId}`, snapshot.departments),
          setStorageJSON(`cache_resources_${workspaceId}`, snapshot.resources),
          setStorageJSON(`cache_projects_${workspaceId}`, snapshot.projects),
          setStorageJSON(`cache_grades_${workspaceId}`, snapshot.grades),
          setStorageJSON(`cache_patterns_${workspaceId}`, snapshot.eventPatterns),
          setStorageJSON(`cache_companies_${workspaceId}`, snapshot.companies),
          setStorageJSON(`cache_comments_${workspaceId}`, snapshot.comments),
          setStorageJSON(`cache_events_${workspaceId}`, snapshot.events),
        ]).catch(err => console.warn('Ошбка обновления кэша:', err));
        
      } catch (error) {
        console.error('❌ Ошибка загрузки snapshot:', error);
        handleCloudflareError(error);
        toast.error('Ошибка синхронизации данных');
      } finally {
        setIsLoadingEvents(false);
        setIsLoadingResources(false);
        setIsLoadingDepartments(false);
        setIsLoadingProjects(false);
        setIsLoadingComments(false);
        setIsLoadingGrades(false);
        setIsLoadingEventPatterns(false);
        setIsLoadingCompanies(false);
      }
    };

    loadWorkspaceData();

  }, [workspaceId]); // ✅ Только workspaceId — обновление токена НЕ перезагружает данные

  // ✨ Delta Sync - синхронизация ТОЛЬКО изменённых событий
  // 📡 С Realtime: polling спользуется только как СТРАХОВКА (редкий full sync)
  // Realtime обрабатывает INSERT/UPDATE/DELETE в реальном времени
  useEffect(() => {
    if (!accessTokenRef.current || !workspaceId || isLoadingEvents) return;
    
    const FULL_SYNC_INTERVAL = 120000; // 🔄 2 минуты (страховочный full sync, основной канал — Realtime)
    
    const syncChanges = async () => {
      const currentToken = accessTokenRef.current;
      if (!currentToken) return;
      
      // 🛑 Don't sync if tab is hidden
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }

      // Пропускаем если пользователь взаимодействует с событиями
      if (isUserInteractingRef.current) {
        return;
      }
      
      // Пропускаем если было локальное изменение < 10 секунд назад
      const timeSinceLastChange = Date.now() - lastLocalChangeRef.current;
      if (timeSinceLastChange < 10000) {
        return;
      }
      
      try {
        // 🛡️ Throttled request - защита от перегрузки
        const allEvents = await throttledRequest(
          `events-full-sync-${workspaceId}`,
          () => eventsApi.getAll(currentToken, workspaceId)
        );
        
        if (!allEvents) {
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
          
          // Фильтруем события которые были удалены текущим пользователм
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
              // ✅ Проверяем - если событие ыло изменено локально < 60 сек назад,
              // используем локальную версию (защита от перезаписи после Undo/Redo и при лагах репликации)
              const timeSinceLastChange = Date.now() - lastLocalChangeRef.current;
              if (timeSinceLastChange < 60000) {
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
            
            // 2. Если это старое событие которого нет на сервере - значит удалено другим
            return null;
          }).filter(Boolean) as SchedulerEvent[];
          
          // Добавляем новые события с сервера, которых у нас нет
          const newServerEvents = filtered.filter(serverEvent => !currentIds.has(serverEvent.id));
          if (newServerEvents.length > 0) {
            console.log(`✨ Full Sync: получено ${newServerEvents.length} новых событий`);
            return [...mergedEvents, ...newServerEvents];
          }
          
          // Если изменений нет, возвращаем prev для избежания ре-рендера
          if (mergedEvents.length === prev.length && mergedEvents.every((e, i) => e === prev[i])) {
            return prev;
          }
          
          return mergedEvents;
        });
        
        loadedEventIds.current = new Set(allEvents.map(e => e.id));
      } catch (error) {
        console.error('❌ Full sync failed:', error);
        handleCloudflareError(error);
      }
    };
    
    const timer = setInterval(syncChanges, FULL_SYNC_INTERVAL);
    return () => clearInterval(timer);
  }, [workspaceId, isLoadingEvents]); // ✅ Убран accessToken — используем accessTokenRef

  // Rest of the implementation remains the same (createEvent, etc.)
  // We need to preserve all other functions
  
  // -----------------------------------------------------------
  // Implement context methods
  
  const createEvent = useCallback(async (event: Partial<SchedulerEvent>) => {
    // Optimistic update
    const tempId = `ev_temp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const newEvent: SchedulerEvent = {
      ...event,
      id: tempId,
      workspace_id: workspaceId,
    } as SchedulerEvent;
    
    setEventsState(prev => [...prev, newEvent]);
    lastLocalChangeRef.current = Date.now();
    
    // Queue for sync
    queueChange(tempId, 'create', newEvent);
    
    return newEvent;
  }, [workspaceId, queueChange]);

  const updateEvent = useCallback(async (id: string, updates: Partial<SchedulerEvent>) => {
    setEventsState(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
    lastLocalChangeRef.current = Date.now();
    localEventModTimesRef.current.set(id, Date.now());
    
    queueChange(id, 'update', updates);
  }, [queueChange]);

  const deleteEvent = useCallback(async (id: string) => {
    setEventsState(prev => prev.filter(e => e.id !== id));
    deletedEventIdsRef.current.add(id);
    lastLocalChangeRef.current = Date.now();
    
    queueChange(id, 'delete');
  }, [queueChange]);

  // Sync control
  const cancelPendingChange = useCallback((id: string) => {
    pendingOps.removePending(id);
  }, [pendingOps]);
  
  const flushPendingChanges = useCallback(async (updateHistoryEventId?: (oldId: string, newId: string) => void) => {
    await flushSync({ updateHistoryEventId });
  }, [flushSync]);
  
  const syncRestoredEventsToServer = useCallback(async (events: SchedulerEvent[], updateHistoryEventId?: (oldId: string, newId: string) => void) => {
     // Implementation for Undo/Redo restoration
     const operations: BatchOperation[] = events.map(e => ({
       op: 'create',
       id: e.id,
       data: e,
       workspace_id: workspaceId
     }));
     
     // ... sync logic similar to SyncManager but immediate ...
     // For brevity, we assume SyncManager handles this via queueChange if called individually
     // But for restore we need bulk.
     // Let's rely on individual createEvents calls in the hook, OR implement batch here.
     // Given the context size, let's keep it simple:
     
     for (const e of events) {
       queueChange(e.id, 'create', e);
     }
     await flushSync({ updateHistoryEventId });
  }, [queueChange, flushSync, workspaceId]);
  
  const syncDeletedEventsToServer = useCallback(async (currentEvents: SchedulerEvent[], previousEvents: SchedulerEvent[]) => {
    const currentIds = new Set(currentEvents.map(e => e.id));
    const deletedEvents = previousEvents.filter(e => !currentIds.has(e.id));
    
    deletedEvents.forEach(e => {
      queueChange(e.id, 'delete');
    });
    
    await flushSync();
  }, [queueChange, flushSync]);

  // Resource operations
  const createResource = useCallback(async (data: CreateResourceData) => {
    if (!accessToken || !workspaceId) return;
    try {
      await resourcesApi.create(data, accessToken, workspaceId);
      // ✅ НЕ делаем refresh здесь — handleSave вызовет loadResources один раз в конце
    } catch (error) {
      console.error('Error creating resource:', error);
      throw error;
    }
  }, [accessToken, workspaceId]);
  
  const updateResource = useCallback(async (id: string, data: UpdateResourceData) => {
    if (!accessToken) return;
    try {
      await resourcesApi.update(id, data, accessToken);
      // ✅ Optimistic update — мгновенное отображение изменений в UI
      setResources(prev => prev.map(r => r.id === id ? { ...r, ...data } : r));
    } catch (error) {
      console.error('Error updating resource:', error);
      throw error;
    }
  }, [accessToken]);
  
  const deleteResource = useCallback(async (id: string) => {
    if (!accessToken) return;
    try {
      await resourcesApi.delete(id, accessToken);
      // ✅ Optimistic update — мгновенное удаление из UI
      setResources(prev => prev.filter(r => r.id !== id));
    } catch (error) {
      console.error('Error deleting resource:', error);
      throw error;
    }
  }, [accessToken]);
  
  const loadResources = useCallback(async () => {
    if (!accessToken || !workspaceId) return;
    try {
      lastResourcesChangeRef.current = Date.now(); // ✅ Блокируем Realtime на время загрузки
      const data = await resourcesApi.getAll(accessToken, workspaceId);
      setResources(data);
      lastResourcesChangeRef.current = Date.now(); // ✅ И после загрузки тоже
    } catch (error) {
      console.error('Error loading resources:', error);
    }
  }, [accessToken, workspaceId]);

  const toggleUserVisibility = useCallback(async (id: string) => {
    if (!accessToken) return;
    const resource = resources.find(r => r.id === id);
    if (!resource) return;
    
    const newVisibility = !resource.isVisible;
    
    // Optimistic
    setResources(prev => prev.map(r => r.id === id ? { ...r, isVisible: newVisibility } : r));
    
    try {
      await resourcesApi.update(id, { isVisible: newVisibility }, accessToken);
    } catch (error) {
      // Revert
      setResources(prev => prev.map(r => r.id === id ? { ...r, isVisible: !newVisibility } : r));
      console.error('Error toggling visibility:', error);
      throw error;
    }
  }, [accessToken, resources]);

  const uploadUserAvatar = useCallback(async (userId: string, file: File) => {
    if (!accessToken) throw new Error('No access token');
    const url = await usersApi.uploadAvatar(userId, file);
    setResources(prev => prev.map(r => r.id === userId ? { ...r, avatarUrl: url } : r));
    return url;
  }, [accessToken]);

  // Project operations
  const createProject = useCallback(async (data: CreateProjectData) => {
    if (!accessToken || !workspaceId) return;
    try {
      await projectsApi.create({ ...data, workspace_id: workspaceId }, accessToken);
      const newProjects = await projectsApi.getAll(accessToken, workspaceId);
      setProjects(newProjects);
    } catch (error) {
      console.error('Error creating project:', error);
      throw error;
    }
  }, [accessToken, workspaceId]);
  
  const updateProject = useCallback(async (id: string, data: UpdateProjectData) => {
    if (!accessToken) return;
    try {
      await projectsApi.update(id, data, accessToken);
      setProjects(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
    } catch (error) {
      console.error('Error updating project:', error);
      throw error;
    }
  }, [accessToken]);
  
  const deleteProject = useCallback(async (id: string) => {
    if (!accessToken) return;
    try {
      await projectsApi.delete(id, accessToken);
      setProjects(prev => prev.filter(p => p.id !== id));
    } catch (error) {
      console.error('Error deleting project:', error);
      throw error;
    }
  }, [accessToken]);
  
  const setProjectsWrapper = useCallback((projectsOrFn: Project[] | ((prev: Project[]) => Project[])) => {
    setProjects(projectsOrFn);
  }, []);

  // Department operations
  const createDepartment = useCallback(async (name: string, color?: string | null) => {
    if (!accessToken || !workspaceId) return;
    try {
      lastDepartmentsChangeRef.current = Date.now();
      await departmentsApi.create({ name, workspace_id: workspaceId, color: color || undefined } as any, accessToken);
      const newDepts = await departmentsApi.getAll(accessToken, workspaceId);
      setDepartments(newDepts);
    } catch (error) {
      console.error('Error creating department:', error);
      throw error;
    }
  }, [accessToken, workspaceId]);
  
  const deleteDepartment = useCallback(async (id: string) => {
    if (!accessToken) return;
    try {
      lastDepartmentsChangeRef.current = Date.now();
      await departmentsApi.delete(id, accessToken);
      setDepartments(prev => prev.filter(d => d.id !== id));
    } catch (error) {
      console.error('Error deleting department:', error);
      throw error;
    }
  }, [accessToken]);
  
  const getDepartmentUsersCount = useCallback(async (id: string) => {
    // Calculate locally
    return resources.filter(r => r.departmentId === id).length;
  }, [resources]);
  
  const renameDepartment = useCallback(async (id: string, name: string, color?: string | null) => {
    if (!accessToken) return;
    try {
      lastDepartmentsChangeRef.current = Date.now();
      const updateData: Record<string, any> = { name };
      if (color !== undefined) updateData.color = color;
      await departmentsApi.update(id, updateData, accessToken);
      // Update local state immediately (no re-fetch — reorderDepartments does final re-fetch)
      setDepartments(prev => prev.map(d => {
        if (d.id !== id) return d;
        const updated = { ...d, name };
        if (color !== undefined) updated.color = color;
        return updated;
      }));
    } catch (error) {
      console.error('Error renaming department:', error);
      throw error;
    }
  }, [accessToken, workspaceId]);
  
  const reorderDepartments = useCallback(async (newDepartments: Department[]) => {
    console.log('🔄 reorderDepartments: Applying new order locally...', newDepartments.map(d => d.name));
    lastDepartmentsChangeRef.current = Date.now();

    // Merge new order with existing data to preserve properties like usersCount
    setDepartments(prevDepts => {
      const deptMap = new Map(prevDepts.map(d => [d.id, d]));
      return newDepartments.map((newDept, index) => {
        const existing = deptMap.get(newDept.id);
        // Preserve existing properties (like usersCount) if they are missing in newDept
        // CRITICAL: Force update 'queue' to match the new array index to persist sorting!
        const merged = existing ? { ...existing, ...newDept } : newDept;
        return { ...merged, queue: index };
      });
    });

    // Debounced save logic would go here or in the component
    // For now we assume immediate save or external handler
    if (accessToken && workspaceId) {
       console.log('💾 Saving department queue to server...');
       await departmentsApi.updateQueue({
         departments: newDepartments.map((d, index) => ({ id: d.id, queue: index }))
       }, accessToken);
       // Re-fetch to get updated last_activity_at from DB
       const freshDepts = await departmentsApi.getAll(accessToken, workspaceId);
       console.log('📋 Re-fetched departments after reorder, colors:', freshDepts.map((d: any) => ({ id: d.id, name: d.name, color: d.color })));
       setDepartments(freshDepts);
    }
  }, [accessToken, workspaceId]);
  
  const toggleDepartmentVisibility = useCallback(async (id: string) => {
     // Not implemented in backend yet, assume local state for now
     // But interface requires Promise<void>
     console.warn('toggleDepartmentVisibility not implemented backend-side');
  }, []);

  // Grade operations
  const createGrade = useCallback(async (name: string) => {
    if (!accessToken || !workspaceId) return;
    await gradesApi.create(name, Number(workspaceId), accessToken);
    const data = await gradesApi.getAll(Number(workspaceId), accessToken);
    setGrades(data);
  }, [accessToken, workspaceId]);

  const updateGrade = useCallback(async (gradeId: string, name: string) => {
    if (!accessToken || !workspaceId) return;
    await gradesApi.update(gradeId, name, Number(workspaceId), accessToken);
    setGrades(prev => prev.map(g => g.id === gradeId ? { ...g, name } : g));
  }, [accessToken, workspaceId]);

  const deleteGrade = useCallback(async (gradeId: string) => {
    if (!accessToken) return;
    await gradesApi.delete(gradeId, accessToken);
    setGrades(prev => prev.filter(g => g.id !== gradeId));
  }, [accessToken]);

  const loadGrades = useCallback(async () => {
    if (!accessToken || !workspaceId) return;
    const data = await gradesApi.getAll(Number(workspaceId), accessToken);
    setGrades(data);
  }, [accessToken, workspaceId]);

  const updateGradesSortOrder = useCallback(async (updates: Array<{ id: string; sortOrder: number }>) => {
    if (!accessToken) return;
    await gradesApi.updateSortOrder(updates, accessToken);
    // Optimistic update done in component or here if we passed the full array
  }, [accessToken]);

  // Company operations
  const createCompany = useCallback(async (name: string) => {
    if (!accessToken || !workspaceId) return;
    await companiesApi.create(name, workspaceId, accessToken);
    const data = await companiesApi.getAll(workspaceId, accessToken);
    setCompanies(data);
  }, [accessToken, workspaceId]);

  const updateCompany = useCallback(async (companyId: string, name: string) => {
    if (!accessToken) return;
    await companiesApi.update(companyId, name, accessToken);
    setCompanies(prev => prev.map(c => c.id === companyId ? { ...c, name } : c));
  }, [accessToken]);

  const deleteCompany = useCallback(async (companyId: string) => {
    if (!accessToken) return;
    await companiesApi.delete(companyId, accessToken);
    setCompanies(prev => prev.filter(c => c.id !== companyId));
  }, [accessToken]);

  const loadCompanies = useCallback(async () => {
    if (!accessToken || !workspaceId) return;
    const data = await companiesApi.getAll(workspaceId, accessToken);
    setCompanies(data);
  }, [accessToken, workspaceId]);

  const updateCompaniesSortOrder = useCallback(async (updates: Array<{ id: string; sortOrder: number }>) => {
    if (!accessToken) return;
    await companiesApi.updateSortOrder(updates, accessToken);
  }, [accessToken]);

  // Comment operations
  const createComment = useCallback(async (data: { userId: string; comment: string; weekDate: string; weekIndex?: number }) => {
    if (!accessToken || !workspaceId) throw new Error("No access");
    lastCommentsChangeRef.current = Date.now();
    const newComment = await commentsApi.createComment({ ...data, workspaceId }, accessToken);
    setComments(prev => [...prev, newComment]);
    return newComment;
  }, [accessToken, workspaceId]);

  const updateComment = useCallback(async (id: string, text: string) => {
    if (!accessToken || !workspaceId) throw new Error("No access");
    lastCommentsChangeRef.current = Date.now();
    const updated = await commentsApi.updateComment(id, workspaceId, text, undefined, undefined, accessToken);
    setComments(prev => prev.map(c => c.id === id ? { 
      ...c, 
      ...updated, 
      resourceId: updated.resourceId || (updated as any).userId || c.resourceId,
      authorAvatarUrl: updated.authorAvatarUrl || c.authorAvatarUrl,
    } : c));
    return updated;
  }, [accessToken, workspaceId]);

  const moveComment = useCallback(async (id: string, newWeekIndex: number, newResourceId: string) => {
    if (!accessToken || !workspaceId) throw new Error("No access");
    lastCommentsChangeRef.current = Date.now();
    // 1. Snapshot previous state
    const previousComments = comments;
    
    // 2. Optimistic Update
    setComments(prev => prev.map(c => 
      c.id === id 
        ? { ...c, weekIndex: newWeekIndex, resourceId: newResourceId } 
        : c
    ));

    try {
      // 3. API Call
      const updated = await commentsApi.updateComment(id, workspaceId, undefined, newWeekIndex, newResourceId, accessToken);
      
      // 4. Update with real server response (usually matches optimistic)
      setComments(prev => prev.map(c => c.id === id ? { 
        ...c, 
        ...updated, 
        resourceId: updated.resourceId || (updated as any).userId || c.resourceId,
        authorAvatarUrl: updated.authorAvatarUrl || c.authorAvatarUrl,
      } : c));
      return updated;
    } catch (error) {
      // 5. Rollback on error
      console.error("❌ Error moving comment:", error);
      setComments(previousComments);
      throw error;
    }
  }, [accessToken, workspaceId, comments]);

  const deleteComment = useCallback(async (id: string) => {
    if (!accessToken || !workspaceId) throw new Error("No access");
    lastCommentsChangeRef.current = Date.now();
    await commentsApi.deleteComment(id, workspaceId, accessToken);
    setComments(prev => prev.filter(c => c.id !== id));
  }, [accessToken, workspaceId]);

  // Derived state
  const visibleDepartments = useMemo(() => {
    return departments; // Implement visibility logic if needed
  }, [departments]);
  
  const visibleEvents = eventsState; // Filter logic would go here

  const getGradeName = useCallback((gradeId: string | undefined) => {
    if (!gradeId) return undefined;
    return grades.find(g => g.id === gradeId)?.name;
  }, [grades]);
  
  const getEventsSnapshot = useCallback(() => {
    // This is a helper to get fresh state in event handlers/callbacks that might have stale closures
    // Since we use refs for tracking some things, but state for rendering.
    // However, React state inside useCallback is captured at creation.
    // To solve this properly, we'd need a ref that tracks current events, or just rely on the fact 
    // that this function is recreated when events change (if added to deps).
    return {
      events: eventsState,
      projects: projects,
      eventZOrder: new Map<string, number>() // We don't track Z-order in context currently
    };
  }, [eventsState, projects]);

  const hasPendingOperationsFn = useCallback(() => queueSize > 0, []);
  const resetDeltaSyncTimerFn = useCallback(() => { lastLocalChangeRef.current = Date.now(); }, []);
  const resetProjectsSyncTimerFn = useCallback(() => { lastProjectsChangeRef.current = Date.now(); }, []);
  const resetResourcesSyncTimerFn = useCallback(() => { lastResourcesChangeRef.current = Date.now(); }, []);
  const resetDepartmentsSyncTimerFn = useCallback(() => { lastDepartmentsChangeRef.current = Date.now(); }, []);

  const value = useMemo(() => ({
    events: eventsState,
    departments,
    resources,
    projects,
    grades,
    eventPatterns,
    companies,
    comments,
    visibleDepartments,
    visibleEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    setEvents: setEventsState,
    queueChange,
    cancelPendingChange,
    flushPendingChanges,
    syncRestoredEventsToServer,
    syncDeletedEventsToServer,
    hasPendingOperations: hasPendingOperationsFn,
    setHistoryIdUpdater,
    setHistoryRebasers,
    isUserInteractingRef,
    setIsUserInteracting,
    accessTokenRef,
    resetDeltaSyncTimer: resetDeltaSyncTimerFn,
    resetProjectsSyncTimer: resetProjectsSyncTimerFn,
    resetResourcesSyncTimer: resetResourcesSyncTimerFn,
    resetDepartmentsSyncTimer: resetDepartmentsSyncTimerFn,
    createResource,
    updateResource,
    deleteResource,
    loadResources,
    toggleUserVisibility,
    uploadUserAvatar,
    createProject,
    updateProject,
    deleteProject,
    setProjects: setProjectsWrapper,
    createDepartment,
    deleteDepartment,
    getDepartmentUsersCount,
    renameDepartment,
    reorderDepartments,
    toggleDepartmentVisibility,
    getGradeName,
    loadedEventIds: loadedEventIds.current,
    getEvents: getEventsSnapshot,
    createGrade,
    updateGrade,
    deleteGrade,
    loadGrades,
    updateGradesSortOrder,
    createCompany,
    updateCompany,
    deleteCompany,
    loadCompanies,
    updateCompaniesSortOrder,
    createComment,
    updateComment,
    moveComment,
    deleteComment
  }), [
    eventsState, departments, resources, projects, grades, eventPatterns, companies, comments,
    visibleDepartments, visibleEvents,
    createEvent, updateEvent, deleteEvent,
    queueChange, cancelPendingChange, flushPendingChanges,
    syncRestoredEventsToServer, syncDeletedEventsToServer, hasPendingOperationsFn,
    setHistoryIdUpdater, setHistoryRebasers, setIsUserInteracting,
    resetDeltaSyncTimerFn, resetProjectsSyncTimerFn, resetResourcesSyncTimerFn, resetDepartmentsSyncTimerFn,
    createResource, updateResource, deleteResource, loadResources,
    toggleUserVisibility, uploadUserAvatar,
    createProject, updateProject, deleteProject, setProjectsWrapper,
    createDepartment, deleteDepartment, getDepartmentUsersCount, renameDepartment,
    reorderDepartments, toggleDepartmentVisibility,
    getGradeName, getEventsSnapshot,
    createGrade, updateGrade, deleteGrade, loadGrades, updateGradesSortOrder,
    createCompany, updateCompany, deleteCompany, loadCompanies, updateCompaniesSortOrder,
    createComment, updateComment, moveComment, deleteComment
  ]);

  return (
    <SchedulerContext.Provider value={value}>
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