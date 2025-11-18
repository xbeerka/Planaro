import React, {
  useState,
  useRef,
  useMemo,
  useCallback,
  useEffect,
} from "react";
import { useScheduler } from "../../contexts/SchedulerContext";
import { useSettings } from "../../contexts/SettingsContext";
import { useFilters } from "../../contexts/FilterContext";
import { useHistory } from "../../hooks/useHistory";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";
import { usePanning } from "../../hooks/usePanning";
import { useEventInteractions } from "../../hooks/useEventInteractions";
import { useToast } from "../ui/ToastContext";
import { SchedulerEvent as SchedulerEventComponent } from "./SchedulerEvent";
import { SimpleEventModal } from "./SimpleEventModal";
import { CommentModal } from "./CommentModal";
import { ContextMenu } from "./ContextMenu";
import { EmptyCellContextMenu } from "./EmptyCellContextMenu";
import { Toolbar } from "./Toolbar";
import { FilterToolbar } from "./FilterToolbar";
import { OnlineUsers } from "./OnlineUsers";
import { UsersManagementModal } from "./UsersManagementModal";
import { ProjectsManagementModal } from "./ProjectsManagementModal";
import { DepartmentsManagementModal } from "./DepartmentsManagementModal";
import { KeyboardShortcutsModal } from "./KeyboardShortcutsModal";
import { SettingsModal } from "./SettingsModal";
import { SchedulerGrid } from "./SchedulerGrid";
import {
  SchedulerEvent,
  Workspace,
  Project,
} from "../../types/scheduler";
import {
  getEmailFromToken,
  getDisplayNameFromToken,
  decodeSupabaseJWT,
} from "../../utils/jwt";
import {
  projectId,
  publicAnonKey,
} from "../../utils/supabase/info";
import { ProfileModal } from "../workspace/ProfileModal";
import { MessageSquarePlus } from "lucide-react";
import {
  generateMonths,
  getCurrentWeekIndex,
  WEEKS,
  UNITS,
  clamp,
  sortEvents,
  getLastWeeksOfMonths,
} from "../../utils/scheduler";
import { calculateEventNeighbors } from "../../utils/eventNeighbors";
import {
  createLayoutConfig,
  topFor,
  heightFor,
  getAvailableFreeSpace,
  getBorderRadiusForRowHeight,
} from "../../utils/schedulerLayout";

interface SchedulerMainProps {
  accessToken: string | null;
  workspace: Workspace;
  onSignOut: () => void;
  onBackToWorkspaces: () => void;
}

export function SchedulerMain({
  accessToken,
  workspace,
  onSignOut,
  onBackToWorkspaces,
}: SchedulerMainProps) {
  const {
    weekPx,
    eventRowH,
    displayMode,
    setWeekPx,
    setEventRowH,
    setDisplayMode,
  } = useSettings();
  
  const { showToast } = useToast();
  const {
    events,
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
    resetDeltaSyncTimer,
    resetProjectsSyncTimer, // ✅ Для блокировки синхронизации проектов после Undo/Redo
    createResource,
    updateResource,
    deleteResource,
    createProject,
    updateProject,
    deleteProject,
    setProjects,
    createDepartment,
    deleteDepartment,
    getDepartmentUsersCount,
    renameDepartment,
    reorderDepartments,
    toggleDepartmentVisibility,
    loadedEventIds,
  } = useScheduler();

  const {
    enabledCompanies,
    enabledDepartments,
    enabledProjects,
    setEnabledProjects,
  } = useFilters();

  const [eventZOrder, setEventZOrder] = useState<
    Map<string, number>
  >(new Map());
  const [scissorsMode, setScissorsMode] = useState(false);
  const [commentMode, setCommentMode] = useState(false);
  const [pendingEventIds, setPendingEventIds] = useState<
    Set<string>
  >(new Set());

  // Clipboard for copy/paste events
  const [copiedEvent, setCopiedEvent] = useState<SchedulerEvent | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">(
    "create",
  );
  const [modalInitialData, setModalInitialData] = useState<any>(
    {},
  );
  const [pendingEvent, setPendingEvent] = useState<any>(null);

  // Comment modal state
  const [commentModalOpen, setCommentModalOpen] =
    useState(false);
  const [pendingComment, setPendingComment] = useState<{
    resourceId: string;
    week: number;
  } | null>(null);

  // Management modals state
  const [usersModalOpen, setUsersModalOpen] = useState(false);
  const [projectsModalOpen, setProjectsModalOpen] =
    useState(false);
  const [departmentsModalOpen, setDepartmentsModalOpen] =
    useState(false);
  const [shortcutsModalOpen, setShortcutsModalOpen] =
    useState(false);
  const [profileModalOpen, setProfileModalOpen] =
    useState(false);
  const [settingsModalOpen, setSettingsModalOpen] =
    useState(false);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    isVisible: boolean;
    x: number;
    y: number;
    event: SchedulerEvent | null;
  }>({ isVisible: false, x: 0, y: 0, event: null });

  // Empty cell context menu state
  const [emptyCellContextMenu, setEmptyCellContextMenu] = useState<{
    isVisible: boolean;
    x: number;
    y: number;
    resourceId: string | null;
    week: number | null;
    unitIndex: number | null;
  }>({ isVisible: false, x: 0, y: 0, resourceId: null, week: null, unitIndex: null });

  // Hover state
  const [hoverHighlight, setHoverHighlight] = useState<{
    visible: boolean;
    left: number;
    top: number;
    width: number;
    height: number;
  }>({ visible: false, left: 0, top: 0, width: 0, height: 0 });

  // Ghost for drag/resize
  const [ghost, setGhost] = useState<{
    visible: boolean;
    left: number;
    top: number;
    width: number;
    height: number;
  }>({ visible: false, left: 0, top: 0, width: 0, height: 0 });

  const schedulerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const eventsContainerRef = useRef<HTMLDivElement>(null);

  // Track scroll position for canvas sticky headers
  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const months = useMemo(
    () => generateMonths(workspace.timeline_year),
    [workspace.timeline_year],
  );
  const lastWeeks = useMemo(
    () => getLastWeeksOfMonths(months),
    [months],
  );

  // Show current week marker only if current year matches workspace year
  const currentYear = new Date().getFullYear();
  const showCurrentWeekMarker = useMemo(
    () => currentYear === workspace.timeline_year,
    [workspace.timeline_year],
  );

  // Get current user info from token (memoized to prevent unnecessary re-renders)
  const currentUserEmail = useMemo(() => {
    if (!accessToken) return undefined;
    return getEmailFromToken(accessToken);
  }, [accessToken]);

  const currentUserDisplayName = useMemo(() => {
    if (!accessToken) return undefined;
    return getDisplayNameFromToken(accessToken);
  }, [accessToken]);

  const currentUserAvatarUrl = useMemo(() => {
    if (!accessToken) return undefined;
    return decodeSupabaseJWT(accessToken)?.user_metadata
      ?.avatar_url;
  }, [accessToken]);

  // Apply filters to resources
  const filteredResources = useMemo(() => {
    let filtered = resources;

    // Filter by companies
    if (enabledCompanies.size > 0) {
      filtered = filtered.filter(
        (r) => r.companyId && enabledCompanies.has(r.companyId),
      );
    }

    // Filter by departments
    if (enabledDepartments.size > 0) {
      filtered = filtered.filter((r) =>
        enabledDepartments.has(r.departmentId),
      );
    }

    // Filter by projects (show only people with events from selected projects)
    if (enabledProjects.size > 0) {
      const resourcesWithSelectedProjects = new Set<string>();
      events.forEach((event) => {
        if (enabledProjects.has(event.projectId)) {
          resourcesWithSelectedProjects.add(event.resourceId);
        }
      });
      filtered = filtered.filter((r) =>
        resourcesWithSelectedProjects.has(r.id),
      );
    }

    return filtered;
  }, [
    resources,
    enabledCompanies,
    enabledDepartments,
    enabledProjects,
    events,
  ]);

  // Filter departments to show only those with visible resources
  const filteredDepartments = useMemo(() => {
    const departmentIds = new Set(
      filteredResources.map((r) => r.departmentId),
    );
    return visibleDepartments.filter((d) =>
      departmentIds.has(d.id),
    );
  }, [visibleDepartments, filteredResources]);

  // Кэшируем config для предотвращения лишних пересчётов и ре-рендерв
  const config = useMemo(
    () =>
      createLayoutConfig(
        weekPx,
        eventRowH,
        displayMode, // Передаем displayMode для правильных отступов
      ),
    [weekPx, eventRowH, displayMode],
  );

  const {
    saveHistory,
    undo: historyUndo,
    redo: historyRedo,
    canUndo,
    canRedo,
    resetHistory,
    updateHistoryEventId,
    updateHistoryProjectId,
  } = useHistory([], []); // events, projects
  const historyInitializedRef = useRef(false);

  // Инициализация истории после загрузки событий и проектов
  React.useEffect(() => {
    // ✅ КРИТИЧНО: Инициализируем историю ТОЛЬКО после полной загрузки
    // Ждём когда загрузятся И события И проекты
    if (!isLoading && !historyInitializedRef.current) {
      console.log(`📝 Инициализация истории: ${events.length} событий, ${projects.length} проектов`);
      resetHistory(events, eventZOrder, projects);
      historyInitializedRef.current = true;
    }
    
    // Сбрасываем флаг при выходе из воркспейса
    if (events.length === 0 && historyInitializedRef.current) {
      console.log('🧹 Сброс флага истории (выход из воркспейса)');
      historyInitializedRef.current = false;
    }
  }, [isLoading, events.length, projects.length, eventZOrder, resetHistory]);

  // Автосохранение истории при изменении проектов (для undo/redo удаления проектов)
  const prevProjectsRef = useRef<Project[]>([]);
  const isUserProjectChangeRef = useRef<boolean>(false); // ✅ Флаг для отслеживания пользовательских изменений
  const lastUndoRedoTimeRef = useRef<number>(0); // ✅ Timestamp последнего Undo/Redo для блокировки orphaned cleanup
  
  React.useEffect(() => {
    // Пропускаем первую инициализацию
    if (!historyInitializedRef.current) {
      prevProjectsRef.current = projects;
      return;
    }
    
    // Если проекты изменились - проверяем это ли пользовательское изменение
    if (JSON.stringify(prevProjectsRef.current) !== JSON.stringify(projects)) {
      // ✅ Сохраняем историю ТОЛЬКО для пользовательских изменений
      if (isUserProjectChangeRef.current) {
        console.log('📝 Автосохранение истории после пользовательского изменения проектов');
        
        // ✅ КРИТИЧЕСКАЯ ПРОВЕРКА: НЕ сохраняем если есть события но НЕТ проектов
        // Это может произойти из-за race condition между загрузкой events и projects
        if (events.length > 0 && projects.length === 0) {
          console.warn('⚠️ История: пропуск сохранения - events загружены, но projects ещё нет');
          console.warn('⚠️ История: ожидаем следующего цикла когда оба массива будут синхронизированы');
          isUserProjectChangeRef.current = false;
          prevProjectsRef.current = projects;
          return;
        }
        
        saveHistory(events, eventZOrder, projects);
        isUserProjectChangeRef.current = false; // Сбрасываем флаг
      } else {
        console.log('⏭️ Пропуск автосохранения: изменение от polling');
      }
      prevProjectsRef.current = projects;
    }
  }, [projects, events, eventZOrder, saveHistory, events.length, projects.length]);

  // ✅ Дополнительная защита: мониторинг состояния для раннего обнаружения проблем
  React.useEffect(() => {
    // Пропускаем проверку пока не инициализировали историю
    if (!historyInitializedRef.current) return;
    
    // КРИТИЧЕСКОЕ ПРЕДУПРЕЖДЕНИЕ: если есть события но нет проектов
    // Это ненормальное состояние которое приведёт к проблемам с Undo/Redo
    if (events.length > 0 && projects.length === 0) {
      console.error('🚨 КРИТИЧЕСКОЕ СОСТОЯНИЕ: обнаружены события БЕЗ проектов!');
      console.error(`🚨 events.length = ${events.length}, projects.length = ${projects.length}`);
      console.error('🚨 Это может привести к ошибкам в системе Undo/Redo');
      console.error('🚨 Проверьте последовательность загрузки данных и асинхронные операции');
    }
  }, [events.length, projects.length]);

  // Keyboard shortcuts
  const handleUndo = useCallback(async () => {
    const state = historyUndo();
    if (!state) return;
    
    console.log('↩️ Undo: МГНОВЕННОЕ восстановление из истории');
    
    // ✅ Сохраняем текущие события ДО undo (для синхронизации удалений)
    const previousEvents = events;
    
    // ✅ БЛОКИРУЕМ автосохранение при undo (это не пользовательское изменение)
    isUserProjectChangeRef.current = false;
    
    // ✅ БЛОКИРУЕМ очистку orphaned events на 5 секунд (защита от удаления восстановленных событий)
    lastUndoRedoTimeRef.current = Date.now();
    console.log('🛡️ Undo: блокировка orphaned cleanup на 5 секунд');
    
    // ✅ КРИТИЧНО: СБРАСЫВАЕМ ТАЙМЕР ДЕЛЬТА-СИНКА!
    // Это локальное изменение, синхронизация должна быть заблокирована на 5 секунд
    // (увеличено с 2 до 5 сек для защиты от быстрых последовательных Undo/Redo)
    resetDeltaSyncTimer();
    console.log('⏸️ Undo: сброс таймера дельта-синка (блокировка на 5 сек)');
    
    // ✅ Фильтруем дубликаты по ID (на случай если в истории есть дубликаты)
    const uniqueEvents = Array.from(
      new Map(state.events.map(e => [e.id, e])).values()
    );
    
    if (uniqueEvents.length !== state.events.length) {
      console.warn(`⚠️ Обнаружены дубликаты в истории: ${state.events.length} → ${uniqueEvents.length}`);
    }
    
    // ✅ МГНОВЕННО восстанавливаем события и проекты из истории
    setEvents(uniqueEvents);
    setEventZOrder(state.eventZOrder);
    setProjects(state.projects);
    
    console.log(`↩️ Undo: восстановлено ${uniqueEvents.length} событий, ${state.projects.length} проектов`);
    
    // ✅ КРИТИЧНО: Блокируем синхронизацию проектов после Undo (на 5 секунд)
    resetProjectsSyncTimer();
    console.log('🔒 Undo: синхронизация проектов заблокирована на 5 секунд');
    
    // ✅ КРИТИЧНО: Синхронизируем восстановленные событ��я с сервером!
    // Это предотвратит их удаление Full Sync'ом через 30 секунд
    try {
      await syncRestoredEventsToServer(uniqueEvents, updateHistoryEventId);
      console.log('✅ Undo: события успешно синхронизированы с сервером');
    } catch (error) {
      console.error('❌ Undo: ошибка синхронизации с сервером:', error);
      showToast({
        title: 'Ошибка восстановления',
        description: 'Не удалось синхронизировать события с сервером',
        variant: 'destructive'
      });
    }
    
    // ✅ КРИТИЧНО: Синхронизируем удалённые события с сервером!
    // Это предотвратит их возвращение Full Sync'ом через 30 секунд
    try {
      await syncDeletedEventsToServer(uniqueEvents, previousEvents);
      console.log('✅ Undo: удалённые события успешно синхронизированы с сервером');
    } catch (error) {
      console.error('❌ Undo: ошибка синхронизации удалённых событий:', error);
    }
    
    // ✅ Polling в контексте автоматически обновит структуру (сотрудники/департаменты) в фоне
  }, [historyUndo, events, setEvents, setProjects, resetDeltaSyncTimer, resetProjectsSyncTimer, syncRestoredEventsToServer, syncDeletedEventsToServer, updateHistoryEventId, showToast]);

  const handleRedo = useCallback(async () => {
    const state = historyRedo();
    if (!state) return;
    
    console.log('↪️ Redo: МГНОВЕННОЕ восстановление из истории');
    
    // ✅ Сохраняем текущие события ДО redo (для синхронизации удалений)
    const previousEvents = events;
    
    // ✅ БЛОКИРУЕМ автосохранение при redo (это не пользовательское изменение)
    isUserProjectChangeRef.current = false;
    
    // ✅ БЛОКИРУЕМ очистку orphaned events на 5 секунд (защита от удаления восстановленных событий)
    lastUndoRedoTimeRef.current = Date.now();
    console.log('🛡️ Redo: блокировка orphaned cleanup на 5 секунд');
    
    // ✅ КРИТИЧНО: СБРАСЫВАЕМ ТАЙМЕР ДЕЛЬТА-СИНКА!
    // Это локальное изменение, синхронизация должна быть заблокирована на 5 секунд
    // (увеличено с 2 до 5 сек для защиты от быстрых последовательных Undo/Redo)
    resetDeltaSyncTimer();
    console.log('⏸️ Redo: сброс таймера дельта-синка (блокировка на 5 сек)');
    
    // ✅ Фильтруем дубликаты по ID (на случай если в истории есть дубликаты)
    const uniqueEvents = Array.from(
      new Map(state.events.map(e => [e.id, e])).values()
    );
    
    if (uniqueEvents.length !== state.events.length) {
      console.warn(`⚠️ Обнаружены дубликаты в истории: ${state.events.length} → ${uniqueEvents.length}`);
    }
    
    // ✅ МГНОВЕННО восстанавливаем события и проекты из истории
    setEvents(uniqueEvents);
    setEventZOrder(state.eventZOrder);
    setProjects(state.projects);
    
    console.log(`↪️ Redo: восстановлено ${uniqueEvents.length} событий, ${state.projects.length} проектов`);
    
    // ✅ КРИТИЧНО: Блокируем синхронизацию проектов после Redo (на 5 секунд)
    resetProjectsSyncTimer();
    console.log('🔒 Redo: синхронизация проектов заблокирована на 5 секунды');
    
    // ✅ КРИТИЧНО: Синхронизируем восстановленные события с сервером!
    // Это предотвратит их удаление Full Sync'ом через 30 секунд
    try {
      await syncRestoredEventsToServer(uniqueEvents, updateHistoryEventId);
      console.log('✅ Redo: события успешно синхронизированы с сервером');
    } catch (error) {
      console.error('❌ Redo: ошибка синхронизации с сервером:', error);
      showToast({
        title: 'Ошибка восстановления',
        description: 'Не удалось синхронизировать события с сервером',
        variant: 'destructive'
      });
    }
    
    // ✅ КРИТИЧНО: Синхронизируем удалённые события с сервером!
    // Это предотвратит их возвращение Full Sync'ом через 30 секунд
    try {
      await syncDeletedEventsToServer(uniqueEvents, previousEvents);
      console.log('✅ Redo: удалённые события успешно синхронизированы с сервером');
    } catch (error) {
      console.error('❌ Redo: ошибка синхронизации удалённых событий:', error);
    }
    
    // ✅ Polling в контексте автоматически обновит структуру (сотрудни��и/департаменты) в фоне
  }, [historyRedo, events, setEvents, setProjects, resetDeltaSyncTimer, resetProjectsSyncTimer, syncRestoredEventsToServer, syncDeletedEventsToServer, updateHistoryEventId, showToast]);

  // ✅ Обёртка для deleteProject с флагом пользовательского изменения
  const handleDeleteProject = useCallback(async (id: string) => {
    console.log('🗑️ Пользовательское удаление проекта:', id);
    isUserProjectChangeRef.current = true; // Помечаем как пользовательское изменение
    await deleteProject(id);
  }, [deleteProject]);

  const handleEscape = useCallback(() => {
    // Сначала проверяем, есть ли открытые модалки или режимы
    const hasOpenModal = modalOpen || usersModalOpen || projectsModalOpen || 
                         departmentsModalOpen || shortcutsModalOpen || 
                         contextMenu.isVisible || emptyCellContextMenu.isVisible;
    const hasActiveMode = scissorsMode || commentMode;
    
    // Если есть открытые модалки - з��крываем их
    if (hasOpenModal) {
      setModalOpen(false);
      setUsersModalOpen(false);
      setProjectsModalOpen(false);
      setDepartmentsModalOpen(false);
      setShortcutsModalOpen(false);
      setContextMenu({
        isVisible: false,
        x: 0,
        y: 0,
        event: null,
      });
      setEmptyCellContextMenu({
        isVisible: false,
        x: 0,
        y: 0,
        resourceId: null,
        week: null,
        unitIndex: null,
      });
      // Убираем hover при закрытии через Escape
      setHoverHighlight((prev) => ({
        ...prev,
        visible: false,
      }));
    }
    
    // Всегда отключаем режимы (даже если модалки не открыты)
    if (hasActiveMode) {
      setScissorsMode(false);
      setCommentMode(false);
    }
  }, [modalOpen, usersModalOpen, projectsModalOpen, departmentsModalOpen, 
      shortcutsModalOpen, contextMenu.isVisible, emptyCellContextMenu.isVisible, 
      scissorsMode, commentMode]);

  const { isSpacePressed, isCtrlPressed } =
    useKeyboardShortcuts({
      onUndo: handleUndo,
      onRedo: handleRedo,
      onEscape: handleEscape,
      onShowShortcuts: () => setShortcutsModalOpen(true),
      schedulerRef,
    });

  usePanning(schedulerRef, isSpacePressed);

  // Reset scissors mode when component mounts (new workspace opened)
  useEffect(() => {
    setScissorsMode(false);
    setCommentMode(false);
  }, [workspace.id]);

  // Handlers for toggling modes with mutual exclusion
  const handleToggleScissors = useCallback(() => {
    setScissorsMode((prev) => !prev);
    // Если включаем ножницы, отключаем комментирование
    setCommentMode(false);
  }, []);

  const handleToggleComment = useCallback(() => {
    setCommentMode((prev) => !prev);
    // Если включаем комментирование, отключаем ножницы
    setScissorsMode(false);
  }, []);

  // Event interactions
  const { startDrag, startResize } = useEventInteractions({
    config,
    resources: filteredResources,
    visibleDepartments: filteredDepartments,
    events,
    projects,
    eventZOrder,
    onEventsUpdate: setEvents,
    onEventZOrderUpdate: setEventZOrder,
    onSaveHistory: saveHistory,
    onEventUpdate: updateEvent,
    eventsContainerRef,
    setIsUserInteracting,
    resetDeltaSyncTimer, // ✅ v3.3.5: Блокировка Delta Sync после drag/resize
  });

  // Scissors - cut event (оптимистичное обновление UI)
  const cutEventByBoundary = useCallback(
    (evId: string, boundaryWeek: number) => {
      // ⛔ ВАЖНО: Запрещаем резать события, которые находятся в процессе сохранения
      if (pendingEventIds.has(evId)) {
        showToast({
          type: "warning",
          message: "Подождите",
          description: "Событие сохраняется в базу данных",
        });
        return;
      }

      // ✂️ Используем функциональное обновление для получения актуального state
      setEvents((currentEvents) => {
        const ev = currentEvents.find((x) => x.id === evId);
        if (!ev) {
          console.warn(
            "⚠️ Событие для резки не найдено:",
            evId,
          );
          return currentEvents;
        }

        if (
          boundaryWeek <= ev.startWeek ||
          boundaryWeek >= ev.startWeek + ev.weeksSpan
        ) {
          console.warn("⚠️ Некорректная граница разреза:", {
            evId,
            boundaryWeek,
            startWeek: ev.startWeek,
            weeksSpan: ev.weeksSpan,
          });
          return currentEvents;
        }

        const leftSpan = boundaryWeek - ev.startWeek;
        const rightSpan = ev.weeksSpan - leftSpan;

        if (leftSpan < 1 || rightSpan < 1) {
          console.warn(
            "⚠️ Неверная длина частей после разреза:",
            { leftSpan, rightSpan },
          );
          return currentEvents;
        }

        // ✂️ Создаем обновленное событие для левой ча��ти (только меняем weeksSpan)
        const updatedEvent: SchedulerEvent = {
          ...ev,
          weeksSpan: leftSpan,
        };

        // ✂️ Создаем новое событие для правой части с уникальным временным ID
        const tempId = `ev_temp_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
        const newEv: SchedulerEvent = {
          id: tempId,
          resourceId: ev.resourceId,
          startWeek: boundaryWeek,
          weeksSpan: rightSpan,
          unitStart: ev.unitStart,
          unitsTall: ev.unitsTall,
          projectId: ev.projectId,
        };

        // ✂️ Мгновенно обновляем UI - обе колбаски появляются сразу
        const newEvents = currentEvents.map((e) =>
          e.id === evId ? updatedEvent : e,
        );
        const updatedEventsArray = [...newEvents, newEv];

        // 🔄 Фоно����ое сохранение на сервер (не блокируем UI)
        // Пропускаем только если это временное событие
        if (!ev.id.startsWith("ev_temp_")) {
          // ✅ Добавляем события в список pending
          setPendingEventIds((prev) => {
            const next = new Set(prev);
            next.add(ev.id);
            next.add(tempId);
            return next;
          });

          (async () => {
            try {
              // ✅ ВАЖНО: Передаем только измененное поле weeksSpan, а не весь объект события
              await updateEvent(ev.id, { weeksSpan: leftSpan });

              // Затем создаем новое событи (правая часть)
              // createEvent автоматически замент временный ID на реальный ID из БД
              const createdEvent = await createEvent(newEv);

              // ✅ Обновляем историю: заменяем временный ID на реальный
              updateHistoryEventId(tempId, createdEvent.id);
              console.log(`📝 История: обновлен ID ${tempId} → ${createdEvent.id} (scissor split)`);

              // ✅ Убираем из pending (важно убрать и tempId, и новый ID)
              setPendingEventIds((prev) => {
                const next = new Set(prev);
                next.delete(ev.id);
                next.delete(tempId);
                next.delete(createdEvent.id);
                return next;
              });
            } catch (error) {
              console.error(
                "❌ Ошибка сохранения разреза:",
                error,
              );

              // ✅ Убираем из pending даже при ошибке
              setPendingEventIds((prev) => {
                const next = new Set(prev);
                next.delete(ev.id);
                next.delete(tempId);
                return next;
              });

              // При ошибке откатываем изменения к состоянию Д разрза
              setEvents(currentEvents);

              showToast({
                type: "error",
                message: "Ошибка разрезания события",
                description: "Не удалось сохранить изменения",
              });
            }
          })();
        }

        // Сохрняем в историю для undo/redo
        saveHistory(updatedEventsArray, eventZOrder, projects);

        return updatedEventsArray;
      });
    },
    [
      eventZOrder,
      saveHistory,
      updateEvent,
      createEvent,
      showToast,
      pendingEventIds,
      projects,
    ],
  );

  // Event handlers (мемоизирован для оптимизации)
  const handleCellClick = useCallback(
    (resourceId: string, week: number, unitIndex: number) => {
      // Если контекстное меню открыто, игнорируем клик
      if (contextMenu.isVisible) {
        return;
      }

      // В режиме комментирования открываем CommentModal вместо создания события
      if (commentMode) {
        setPendingComment({ resourceId, week });
        setCommentModalOpen(true);
        return;
      }

      // Обычный режим: создание события
      // Проверяем наличие проектов
      if (projects.length === 0) {
        showToast({
          type: "error",
          message: "Невозможно создать событие",
          description:
            'Сначала создайте хотя бы один проект через меню "Проекты"',
        });
        return;
      }

      const free = getAvailableFreeSpace(
        resourceId,
        week,
        unitIndex,
        visibleEvents,
      );
      if (free === 0) {
        showToast({
          type: "warning",
          message: "Нет свободного места",
          description:
            "В этой ячейке нет места для нового события",
        });
        return;
      }

      setPendingEvent({ week, resourceId, unitIndex });
      setModalMode("create");
      setModalInitialData({ maxUnits: free, startWeek: week });
      setModalOpen(true);
    },
    [
      contextMenu.isVisible,
      commentMode,
      projects.length,
      visibleEvents,
      showToast,
    ],
  );

  const handleEventClick = useCallback(
    (e: React.MouseEvent, event: SchedulerEvent) => {
      e.stopPropagation();
      if (scissorsMode) return;

      const maxZ = Math.max(
        ...Array.from(eventZOrder.values()),
        0,
      );
      setEventZOrder((prev) =>
        new Map(prev).set(event.id, maxZ + 1),
      );
    },
    [scissorsMode, eventZOrder],
  );

  const handleEventContextMenu = useCallback(
    (e: React.MouseEvent, event: SchedulerEvent) => {
      // Закрываем контекстное меню пустой ячейки если оно было открыто
      setEmptyCellContextMenu({
        isVisible: false,
        x: 0,
        y: 0,
        resourceId: null,
        week: null,
        unitIndex: null,
      });
      // Убираем hover при закрытии контекстного меню пустой ячейки
      setHoverHighlight((prev) => ({
        ...prev,
        visible: false,
      }));
      
      setContextMenu({
        isVisible: true,
        x: e.clientX,
        y: e.clientY,
        event,
      });
    },
    [],
  );

  const handleContextEdit = () => {
    if (!contextMenu.event) return;
    setModalMode("edit");
    setModalInitialData({
      projectId: contextMenu.event.projectId,
      weeksSpan: contextMenu.event.weeksSpan,
      unitsTall: contextMenu.event.unitsTall,
      maxUnits: UNITS,
      startWeek: contextMenu.event.startWeek,
    });
    setPendingEvent(contextMenu.event);
    setModalOpen(true);
    setContextMenu({
      isVisible: false,
      x: 0,
      y: 0,
      event: null,
    });
  };

  const handleContextDelete = () => {
    if (!contextMenu.event) return;

    const eventId = contextMenu.event.id;
    const zOrderToRestore = eventZOrder.get(eventId);

    // 🗑️ Мгновенно удаляем z-order и закрываем меню
    const newEventZOrder = new Map(eventZOrder);
    newEventZOrder.delete(eventId);
    const newEvents = events.filter((e) => e.id !== eventId);

    setEventZOrder(newEventZOrder);
    setContextMenu({
      isVisible: false,
      x: 0,
      y: 0,
      event: null,
    });

    // Для временных событий просто удаляем из state
    if (eventId.startsWith("ev_temp_")) {
      setEvents(newEvents);
      saveHistory(newEvents, newEventZOrder, projects);
    } else {
      // ✅ КР��ТИЧНО: Сохраняем историю ПЕРЕД удалением на сервере (синхронно!)
      // Это гарантирует что при быстром удалении несколь��их событий
      // все промежуточные состояния сохранятся в истории
      saveHistory(newEvents, newEventZOrder, projects);
      console.log('📝 История сохранена перед удалением события:', eventId);
      
      // Для реальных событий: deleteEvent делает оптимистичное удаление из state
      (async () => {
        try {
          await deleteEvent(eventId); // deleteEvent сам удаляет из state и откатывает при ошибке
          console.log('✅ Событие успешно удалено:', eventId);
        } catch (error) {
          console.error(
            "❌ Ошибка удаления события из БД:",
            error,
          );
          // deleteEvent уже откатил изменения в events, восстанавливаем z-order
          if (zOrderToRestore !== undefined) {
            setEventZOrder((prev) =>
              new Map(prev).set(eventId, zOrderToRestore),
            );
          }
          // ❌ ОТКАТЫВАЕМ историю (делаем Undo при ошибке)
          historyUndo();
          console.log('↩️ История откачена из-за ошибки удаления');
        }
      })();
    }
  };

  const handleContextCopy = () => {
    if (!contextMenu.event) return;
    
    setCopiedEvent(contextMenu.event);
    setContextMenu({
      isVisible: false,
      x: 0,
      y: 0,
      event: null,
    });
  };

  const handleCellContextMenu = useCallback(
    (e: React.MouseEvent, resourceId: string, week: number) => {
      e.preventDefault();
      
      // Закрываем контекстное меню события если оно было открыто
      setContextMenu({
        isVisible: false,
        x: 0,
        y: 0,
        event: null,
      });
      
      // Вычисляем unitIndex из позиции клика
      const rect = e.currentTarget.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const unitIndex = Math.floor(
        (y - config.rowPaddingTop) / config.unitStride,
      );
      
      // Обновляем hover highlight на позицию клика
      const free = getAvailableFreeSpace(
        resourceId,
        week,
        unitIndex,
        visibleEvents,
      );
      if (free > 0 && unitIndex >= 0 && unitIndex < UNITS) {
        const left =
          config.resourceW +
          week * config.weekPx +
          config.cellPaddingLeft;
        const top = topFor(
          resourceId,
          unitIndex,
          filteredResources,
          filteredDepartments,
          config,
        );
        setHoverHighlight({
          visible: true,
          left,
          top,
          width:
            config.weekPx -
            config.cellPaddingLeft -
            config.cellPaddingRight,
          height: heightFor(free, config),
        });
      }
      
      // Открываем контекстное меню для пустой ячейки
      setEmptyCellContextMenu({
        isVisible: true,
        x: e.clientX,
        y: e.clientY,
        resourceId,
        week,
        unitIndex,
      });
    },
    [config, visibleEvents, filteredResources, filteredDepartments],
  );

  const handlePaste = useCallback(() => {
    if (!copiedEvent || !emptyCellContextMenu.resourceId || emptyCellContextMenu.week === null || emptyCellContextMenu.unitIndex === null) {
      return;
    }

    const { resourceId, week, unitIndex } = emptyCellContextMenu;
    
    // Проверяем, есть ли свободное место для вставки
    const free = getAvailableFreeSpace(
      resourceId,
      week,
      unitIndex,
      visibleEvents,
    );
    
    if (free < copiedEvent.unitsTall) {
      showToast({
        type: "warning",
        message: "Недостаточно места",
        description: `Для вставки требуется ${copiedEvent.unitsTall} юнит${copiedEvent.unitsTall > 1 ? 'а' : ''}`,
      });
      setEmptyCellContextMenu({
        isVisible: false,
        x: 0,
        y: 0,
        resourceId: null,
        week: null,
        unitIndex: null,
      });
      // Убираем hover при закрытии контекстного меню
      setHoverHighlight((prev) => ({
        ...prev,
        visible: false,
      }));
      return;
    }
    
    // Вычисляем максимум недель для события
    const maxWeeks = WEEKS - week;
    const validWeeksSpan = Math.min(copiedEvent.weeksSpan, maxWeeks);
    
    if (validWeeksSpan < 1) {
      showToast({
        type: "warning",
        message: "Недостаточно недель",
        description: "Событие не помещается в оставшиеся недели",
      });
      setEmptyCellContextMenu({
        isVisible: false,
        x: 0,
        y: 0,
        resourceId: null,
        week: null,
        unitIndex: null,
      });
      // Убираем hover при закрытии контекстного меню
      setHoverHighlight((prev) => ({
        ...prev,
        visible: false,
      }));
      return;
    }
    
    // Создаем новое событие (копию) с теми же параметрами
    const tempEvent: SchedulerEvent = {
      id: `ev_temp_${Date.now()}`,
      resourceId,
      startWeek: week,
      weeksSpan: validWeeksSpan,
      unitStart: unitIndex,
      unitsTall: copiedEvent.unitsTall,
      projectId: copiedEvent.projectId,
    };
    
    // Закрываем меню
    setEmptyCellContextMenu({
      isVisible: false,
      x: 0,
      y: 0,
      resourceId: null,
      week: null,
      unitIndex: null,
    });
    // Убираем hover при закрытии контекстного меню
    setHoverHighlight((prev) => ({
      ...prev,
      visible: false,
    }));
    
    // Создаём событие
    (async () => {
      try {
        const createdEvent = await createEvent(tempEvent);
        
        // ✅ Обновляем историю: заменяем временный ID на реальный
        updateHistoryEventId(tempEvent.id, createdEvent.id);
        console.log(`📝 История: обновлен ID ${tempEvent.id} → ${createdEvent.id} (paste)`);
        
        // ✅ История: сохраняем после успешного создания события (paste)
        // Используем setEvents для получения свежего state
        setEvents(currentEvents => {
          console.log('История: сохранение после вставки события (paste)');
          saveHistory(currentEvents, eventZOrder, projects);
          return currentEvents;
        });
      } catch (error) {
        console.error("❌ Ошибка вставки события:", error);
      }
    })();
  }, [
    copiedEvent,
    emptyCellContextMenu,
    visibleEvents,
    createEvent,
    showToast,
    saveHistory,
    eventZOrder,
    setEvents,
  ]);

  const handleModalSave = async (
    data: Partial<SchedulerEvent>,
  ) => {
    if (modalMode === "create" && pendingEvent) {
      // Вычисляем максимум недель для события (0-based индексация)
      const maxWeeks = WEEKS - pendingEvent.week;
      const validWeeksSpan = Math.max(
        1,
        Math.min(data.weeksSpan || 1, maxWeeks),
      );

      const tempEvent: SchedulerEvent = {
        id: `ev_temp_${Date.now()}`,
        resourceId: pendingEvent.resourceId,
        startWeek: pendingEvent.week,
        weeksSpan: validWeeksSpan,
        unitStart: Math.min(pendingEvent.unitIndex, UNITS - 1),
        unitsTall: data.unitsTall || 1,
        projectId: data.projectId || projects[0].id,
      };

      if (tempEvent.unitStart + tempEvent.unitsTall > UNITS) {
        tempEvent.unitStart = UNITS - tempEvent.unitsTall;
      }

      try {
        // ✅ createEvent добавляет временное событие в стейт, создаёт на сервере и зам��няет на реальное
        const createdEvent = await createEvent(tempEvent);

        // ✅ Обновляем историю: заменяем временный ID на реальный
        updateHistoryEventId(tempEvent.id, createdEvent.id);
        console.log(`📝 История: обновлен ID ${tempEvent.id} → ${createdEvent.id} (create from modal)`);

        // ✅ История: сохраняем после успешного создания события (модалка)
        setEvents(currentEvents => {
          console.log('История: сохранение после создания события (модалка)');
          saveHistory(currentEvents, eventZOrder, projects);
          return currentEvents;
        });
      } catch (error) {
        console.error("❌ Ошибка создания события:", error);
      }
    } else if (modalMode === "edit" && pendingEvent) {
      // Вычисляем максимум недель для события
      const maxWeeks = WEEKS - pendingEvent.startWeek + 1;
      const validWeeksSpan = Math.max(
        1,
        Math.min(
          data.weeksSpan || pendingEvent.weeksSpan,
          maxWeeks,
        ),
      );

      const updatedEvent = {
        ...pendingEvent,
        projectId: data.projectId || pendingEvent.projectId,
        weeksSpan: validWeeksSpan,
        unitsTall: data.unitsTall || pendingEvent.unitsTall,
      };

      const updatedEvents = events.map((e) =>
        e.id === pendingEvent.id ? updatedEvent : e,
      );
      setEvents(updatedEvents);
      saveHistory(updatedEvents, eventZOrder, projects);

      if (loadedEventIds.has(updatedEvent.id)) {
        await updateEvent(updatedEvent.id, updatedEvent);
      }
    }

    setPendingEvent(null);
  };

  const handleCommentSave = async (text: string) => {
    if (!pendingComment || !currentUserEmail) return;

    console.log("💬 Сохранение комментария:", {
      resourceId: pendingComment.resourceId,
      week: pendingComment.week,
      text,
      createdBy: currentUserEmail,
    });

    // TODO: Здесь будет вызов API для сохранения комментария
    showToast({
      type: "success",
      message: "Комментарий сохранён",
      description: `Комментарий добавлен на неделю ${pendingComment.week + 1}`,
    });

    setPendingComment(null);
  };

  const handleCellMouseMove = useCallback(
    (e: React.MouseEvent, resourceId: string, week: number) => {
      // Не показываем ховеры если открыто контекстное меню (любое)
      if (scissorsMode || contextMenu.isVisible || emptyCellContextMenu.isVisible) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const unitIndex = Math.floor(
        (y - config.rowPaddingTop) / config.unitStride,
      );

      // В режиме комментирования: фиксированный размер 1 неделя × 4 юнита, ВСЕГДА с 0-го юнита
      if (commentMode) {
        // Показываем ховер независимо от положения курсора, всегда с unitStart = 0
        // Уменьшаем зону на 8px со всех сторон для визуального отступа
        const COMMENT_INSET = 8;
        const left =
          config.resourceW +
          week * config.weekPx +
          config.cellPaddingLeft +
          COMMENT_INSET;
        const top =
          topFor(
            resourceId,
            0,
            filteredResources,
            filteredDepartments,
            config,
          ) + COMMENT_INSET;
        setHoverHighlight({
          visible: true,
          left,
          top,
          width:
            config.weekPx -
            config.cellPaddingLeft -
            config.cellPaddingRight -
            COMMENT_INSET * 2,
          height: heightFor(4, config) - COMMENT_INSET * 2,
        });
        return; // ВАЖНО: ранний выход, обычные ховеры не работают в режиме комментирования
      }

      // Обычный режим: показываем доступное свободное место
      const free = getAvailableFreeSpace(
        resourceId,
        week,
        unitIndex,
        visibleEvents,
      );
      if (free > 0 && unitIndex >= 0 && unitIndex < UNITS) {
        const left =
          config.resourceW +
          week * config.weekPx +
          config.cellPaddingLeft;
        const top = topFor(
          resourceId,
          unitIndex,
          filteredResources,
          filteredDepartments,
          config,
        );
        setHoverHighlight({
          visible: true,
          left,
          top,
          width:
            config.weekPx -
            config.cellPaddingLeft -
            config.cellPaddingRight,
          height: heightFor(free, config),
        });
      } else {
        setHoverHighlight((prev) => ({
          ...prev,
          visible: false,
        }));
      }
    },
    [
      scissorsMode,
      commentMode,
      config,
      visibleEvents,
      filteredResources,
      filteredDepartments,
      contextMenu.isVisible,
      emptyCellContextMenu.isVisible,
    ],
  );

  const handleCellMouseLeave = useCallback(() => {
    // Не убираем hover если открыто контекстное меню пустой ячейки или модальное окно создания события
    if (!scissorsMode && !emptyCellContextMenu.isVisible && !modalOpen) {
      setHoverHighlight((prev) => ({
        ...prev,
        visible: false,
      }));
    }
  }, [scissorsMode, emptyCellContextMenu.isVisible, modalOpen]);

  // Кэшируем отфильтрованные события для оптимизации
  const sortedEventsWithZOrder = useMemo(() => {
    console.log('📊 sortedEventsWithZOrder пересчитывается! visibleEvents:', visibleEvents.length, 'filteredResources:', filteredResources.length, 'eventZOrder.size:', eventZOrder.size);
    const filteredResourceIds = new Set(
      filteredResources.map((r) => r.id),
    );
    const filteredEvents = visibleEvents.filter((e) =>
      filteredResourceIds.has(e.resourceId),
    );

    const sorted = sortEvents(
      filteredEvents,
      filteredResources,
    );
    const eventsWithZOrder = [...sorted];

    if (eventZOrder.size > 0) {
      eventsWithZOrder.sort((a, b) => {
        const zA = eventZOrder.get(a.id) || 0;
        const zB = eventZOrder.get(b.id) || 0;
        return zA - zB;
      });
    }

    return eventsWithZOrder;
  }, [visibleEvents, filteredResources, eventZOrder]);

  // Вычисляем соседей для каждого события (для соединения одинаковых проектов)
  const eventNeighbors = useMemo(() => {
    console.log('🔄 eventNeighbors пересчитывается! sortedEventsWithZOrder:', sortedEventsWithZOrder.length, 'projects:', projects.length);
    return calculateEventNeighbors(sortedEventsWithZOrder, projects);
  }, [sortedEventsWithZOrder, projects]);

  // Мемоизируем позиции событий чтобы избежать пересчёта при каждом рендере
  const eventPositions = useMemo(() => {
    console.log('📐 eventPositions пересчитывается!');
    const positions = new Map<string, { left: number; top: number; width: number; height: number }>();
    
    sortedEventsWithZOrder.forEach(event => {
      const neighborInfo = eventNeighbors.get(event.id);
      
      // В режиме производительности отключаем логику склейки
      // Padding убирается ТОЛЬКО при ПОЛНОЙ склейке (одинаковая высота)
      const hasAnyLeftNeighbor = displayMode === 'performance' ? false : 
        (neighborInfo?.hasFullLeftNeighbor);
      const hasAnyRightNeighbor = displayMode === 'performance' ? false : 
        (neighborInfo?.hasFullRightNeighbor);
      
      let paddingLeft = hasAnyLeftNeighbor ? 0 : config.cellPaddingLeft;
      let paddingRight = hasAnyRightNeighbor ? 0 : config.cellPaddingRight;
      
      // DEBUG: проверка padding для событий 10-11 недель
      if (event.startWeek === 10 || event.startWeek === 11) {
        console.log(`🔍 [PADDING] Event ${event.id} (week ${event.startWeek}):`, {
          hasAnyLeftNeighbor,
          hasAnyRightNeighbor,
          paddingLeft,
          paddingRight,
          'cellPaddingLeft': config.cellPaddingLeft,
          'cellPaddingRight': config.cellPaddingRight
        });
      }
      
      // Вычисляем базовые координаты
      let left =
        config.resourceW +
        event.startWeek * config.weekPx +
        paddingLeft;
      const top = topFor(
        event.resourceId,
        event.unitStart,
        filteredResources,
        filteredDepartments,
        config,
      );
      let width =
        event.weeksSpan * config.weekPx -
        paddingLeft -
        paddingRight;
      const height = heightFor(event.unitsTall, config);
      
      // DEBUG: базовая ширина ДО расширения
      const widthBeforeExpand = width;
      
      // Применяем расширение на основе множителей (новая логика v3.0)
      if (neighborInfo?.expandLeftMultiplier) {
        const expandAmount = config.gap * neighborInfo.expandLeftMultiplier;
        left -= expandAmount;
        width += expandAmount;
        
        // DEBUG
        if (event.startWeek === 10 || event.startWeek === 11) {
          console.log(`📏 [expandLeft] Event ${event.id} (week ${event.startWeek}): +${expandAmount}px`);
        }
      }
      if (neighborInfo?.expandRightMultiplier) {
        const expandAmount = config.gap * neighborInfo.expandRightMultiplier;
        width += expandAmount;
        
        // DEBUG: логирование для событий 10-11 недель
        if (event.startWeek === 10 || event.startWeek === 11) {
          console.log(`📏 [expandRight] Event ${event.id} (week ${event.startWeek}): +${expandAmount}px`);
          console.log(`📏 [ПРИМЕНЕНИЕ] Event ${event.id} (week ${event.startWeek}):`, {
            'ширина ДО': widthBeforeExpand,
            paddingLeft,
            paddingRight,
            expandLeftMultiplier: neighborInfo.expandLeftMultiplier,
            expandRightMultiplier: neighborInfo.expandRightMultiplier,
            'config.gap': config.gap,
            'ширина ПОСЛЕ': width,
            'разница': width - widthBeforeExpand
          });
        }
      }
      
      positions.set(event.id, { left, top, width, height });
    });
    
    return positions;
  }, [sortedEventsWithZOrder, eventNeighbors, displayMode, config, filteredResources, filteredDepartments]);

  const renderEvents = useCallback(() => {
    // Viewport culling с большим буфером для плавной подгрузки при быстром скролле
    const scheduler = schedulerRef.current;
    let viewportLeft = 0;
    let viewportTop = 0;
    let viewportWidth = Infinity;
    let viewportHeight = Infinity;

    if (scheduler) {
      viewportLeft = scheduler.scrollLeft;
      viewportTop = scheduler.scrollTop;
      viewportWidth = scheduler.clientWidth;
      viewportHeight = scheduler.clientHeight;
    }

    // Большой буфер: 3x viewport в каждую сторону (события загружаются заранее)
    const BUFFER_MULTIPLIER = 3;
    const bufferX = viewportWidth * BUFFER_MULTIPLIER;
    const bufferY = viewportHeight * BUFFER_MULTIPLIER;

    const cullLeft = viewportLeft - bufferX;
    const cullRight = viewportLeft + viewportWidth + bufferX;
    const cullTop = viewportTop - bufferY;
    const cullBottom = viewportTop + viewportHeight + bufferY;

    return sortedEventsWithZOrder
      .map((event) => {
        // Determine if event should be dimmed (shown at 50% opacity)
        // Dimmed when: project filter is active AND this event's project is NOT in the filter
        const isDimmed =
          enabledProjects.size > 0 &&
          !enabledProjects.has(event.projectId);
        
        // Получаем информацию о соседях для корректировки padding (новая логика v3.0)
        const neighborInfo = eventNeighbors.get(event.id);
        const neighbors = neighborInfo || {
          hasFullLeftNeighbor: false,
          hasPartialLeftNeighbor: false,
          hasBothLeftNeighbors: false,
          hasFullRightNeighbor: false,
          hasPartialRightNeighbor: false,
          hasBothRightNeighbors: false,
          expandLeftMultiplier: 0,
          expandRightMultiplier: 0,
          roundTopLeft: true,
          roundTopRight: true,
          roundBottomLeft: true,
          roundBottomRight: true,
          innerTopLeftColor: 'transparent',
          innerBottomLeftColor: 'transparent',
          innerTopRightColor: 'transparent',
          innerBottomRightColor: 'transparent',
        };
        
        // Получаем мемоизированные позиции (вычисляются только при изменении eventNeighbors)
        const position = eventPositions.get(event.id);
        if (!position) {
          console.error('❌ Позиция не найдена для события', event.id);
          return null;
        }
        const { left, top, width, height } = position;

        // Viewport culling - не рендерим события вне расширенного viewport
        if (
          left + width < cullLeft ||
          left > cullRight ||
          top + height < cullTop ||
          top > cullBottom
        ) {
          return null;
        }

        // Проверяем, находится ли событие в процессе сохранения
        const isPending = pendingEventIds.has(event.id);

        // Проверяем, открыто ли контекстное меню на этом событии
        const isContextMenuOpen = contextMenu.isVisible && contextMenu.event?.id === event.id;

        return (
          <SchedulerEventComponent
            key={event.id}
            event={event}
            config={config}
            projects={projects}
            eventPatterns={eventPatterns}
            scissorsMode={scissorsMode && !isPending}
            commentMode={commentMode && !isPending}
            isCtrlPressed={isCtrlPressed}
            isPending={isPending}
            dimmed={isDimmed}
            displayMode={displayMode}
            isContextMenuOpen={isContextMenuOpen}
            // Упрощённая логика v3.1: round* флаги (позитивная логика)
            roundTopLeft={neighbors.roundTopLeft}
            roundTopRight={neighbors.roundTopRight}
            roundBottomLeft={neighbors.roundBottomLeft}
            roundBottomRight={neighbors.roundBottomRight}
            // Цвета соседей для внутренних скруглений ::before/::after
            innerTopLeftColor={neighbors.innerTopLeftColor}
            innerBottomLeftColor={neighbors.innerBottomLeftColor}
            innerTopRightColor={neighbors.innerTopRightColor}
            innerBottomRightColor={neighbors.innerBottomRightColor}
            onContextMenu={handleEventContextMenu}
            onPointerDown={(e, ev) => {
              // Блокируем перетаскивание для pending событий
              if (isPending) return;
              const target = e.currentTarget as HTMLElement;
              startDrag(e, target, ev);
            }}
            onHandlePointerDown={(e, ev, edge) => {
              // Блокируем ресайз для pending событий
              if (isPending) return;
              const eventEl = (
                e.currentTarget as HTMLElement
              ).closest(".scheduler-event") as HTMLElement;
              if (!eventEl) return;
              const edges = {
                top: edge === "top",
                bottom: edge === "bottom",
                left: edge === "left",
                right: edge === "right",
              };
              startResize(e, eventEl, ev, edges);
            }}
            onClick={handleEventClick}
            onScissorClick={cutEventByBoundary}
            left={left}
            top={top}
            width={width}
            height={height}
            eventRowH={eventRowH}
          />
        );
      })
      .filter(Boolean); // Убираем null элементы (события вне viewport)
  }, [
    sortedEventsWithZOrder,
    eventNeighbors,
    eventPositions, // КРИТИЧНО: мемоизированные позиции
    config,
    projects,
    eventPatterns,
    scissorsMode,
    commentMode,
    isCtrlPressed,
    pendingEventIds,
    enabledProjects,
    filteredResources,
    filteredDepartments,
    eventRowH,
    displayMode, // КРИТИЧНО: добавляем displayMode в зависимости
    handleEventContextMenu,
    startDrag,
    startResize,
    handleEventClick,
    cutEventByBoundary,
    scrollTop,
    scrollLeft,
  ]);

  // Auto scroll to current week on mount (only if current year matches workspace year)
  React.useEffect(() => {
    if (
      schedulerRef.current &&
      gridRef.current &&
      showCurrentWeekMarker
    ) {
      const currentWeek = getCurrentWeekIndex(
        workspace.timeline_year,
      );
      const currentWeekLeft =
        config.resourceW +
        currentWeek * config.weekPx +
        config.weekPx / 2;
      const viewportWidth = schedulerRef.current.clientWidth;
      const desiredScrollLeft =
        currentWeekLeft - viewportWidth * 0.5;
      const maxScrollLeft = Math.max(
        0,
        gridRef.current.scrollWidth - viewportWidth,
      );
      schedulerRef.current.scrollLeft = clamp(
        desiredScrollLeft,
        0,
        maxScrollLeft,
      );
    }
  }, [
    config.resourceW,
    config.weekPx,
    workspace.timeline_year,
    showCurrentWeekMarker,
  ]);

  // Manage body classes for special modes
  React.useEffect(() => {
    if (scissorsMode) {
      document.body.classList.add("scissors-mode");
    } else {
      document.body.classList.remove("scissors-mode");
    }

    if (commentMode) {
      document.body.classList.add("comment-mode");
    } else {
      document.body.classList.remove("comment-mode");
    }

    return () => {
      document.body.classList.remove("scissors-mode");
      document.body.classList.remove("comment-mode");
    };
  }, [scissorsMode, commentMode]);

  // Close context menus on click outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        !target.closest(".scheduler-event") &&
        !target.closest('[role="menu"]')
      ) {
        setContextMenu({
          isVisible: false,
          x: 0,
          y: 0,
          event: null,
        });
        setEmptyCellContextMenu({
          isVisible: false,
          x: 0,
          y: 0,
          resourceId: null,
          week: null,
          unitIndex: null,
        });
        // Убираем hover при закрытии через клик вне меню
        setHoverHighlight((prev) => ({
          ...prev,
          visible: false,
        }));
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () =>
      document.removeEventListener("click", handleClickOutside);
  }, []);

  // Track scroll position for viewport culling (throttled для производительности)
  useEffect(() => {
    let rafId: number | null = null;
    let isScheduled = false;

    const handleScroll = () => {
      if (!isScheduled) {
        isScheduled = true;
        rafId = requestAnimationFrame(() => {
          if (schedulerRef.current) {
            setScrollTop(schedulerRef.current.scrollTop);
            setScrollLeft(schedulerRef.current.scrollLeft);
          }
          isScheduled = false;
        });
      }
    };

    const scheduler = schedulerRef.current;
    if (scheduler) {
      scheduler.addEventListener("scroll", handleScroll, {
        passive: true,
      });
      return () => {
        scheduler.removeEventListener("scroll", handleScroll);
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
        }
      };
    }
  }, []);

  return (
    <div
      className="w-screen h-screen overflow-auto relative bg-[#f7f9fb]"
      ref={schedulerRef}
    >
      <div className="relative w-max h-max">
        {/* Используем только DOM режим - он быстрее на 5000+ событиях благодаря виртуализации */}
        <SchedulerGrid
          config={config}
          visibleDepartments={filteredDepartments}
          resources={filteredResources}
          grades={grades}
          companies={companies}
          workspace={workspace}
          onCellClick={handleCellClick}
          onCellContextMenu={handleCellContextMenu}
          onCellMouseMove={handleCellMouseMove}
          onCellMouseLeave={handleCellMouseLeave}
          onBackToWorkspaces={onBackToWorkspaces}
          onSignOut={onSignOut}
          onOpenProfileModal={() => setProfileModalOpen(true)}
          onOpenSettingsModal={() => setSettingsModalOpen(true)}
          currentUserDisplayName={currentUserDisplayName}
          currentUserEmail={currentUserEmail}
          currentUserAvatarUrl={currentUserAvatarUrl}
          gridRef={gridRef}
        />

        {/* Hover highlight - НИЖНИЙ слой (ВСЕГДА черный, за событиями) - ПЕРЕД events-overlay */}
        {hoverHighlight.visible && (
          <div
            className="hover-highlight-under absolute pointer-events-none rounded-md opacity-100 transition-opacity flex items-center justify-center"
            style={{
              left: `${hoverHighlight.left}px`,
              top: `${hoverHighlight.top}px`,
              width: `${hoverHighlight.width}px`,
              height: `${hoverHighlight.height}px`,
              background: "rgba(0,0,0,0.1)",
              boxShadow: "none",
              border: "2px dashed rgba(0,0,0,0.3)",
              cursor: commentMode
                ? "context-menu"
                : scissorsMode
                  ? "crosshair"
                  : "default",
              zIndex: 5, // ЗА событиями (события начинаются с z-10)
            }}
          >
            {/* Иконка комментария с плюсом - только в режиме к��мментирования, БЕЗ blend mode */}
            {commentMode && (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#000000"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ opacity: 0.5, mixBlendMode: "normal" }}
              >
                <path d="M8 9h8" />
                <path d="M8 13h6" />
                <path d="M12.01 18.594l-4.01 2.406v-3h-2a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v5.5" />
                <path d="M16 19h6" />
                <path d="M19 16v6" />
              </svg>
            )}
          </div>
        )}

        {/* Events overlay */}
        <div
          ref={eventsContainerRef}
          className={`events-overlay absolute top-0 left-0 w-full h-full z-10 ${scissorsMode ? "scissors-mode" : ""} ${commentMode ? "comment-mode" : ""}`}
          style={{
            transform: "translateZ(0)",
            willChange: "transform",
            contain: "layout style paint",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              pointerEvents: commentMode ? "none" : "auto",
            }}
          >
            {renderEvents()}
          </div>
        </div>

        {/* Hover highlight - ВЕРХНИЙ слой (только для режимов ножниц и комментирования, НАД событиями) */}
        {hoverHighlight.visible &&
          (scissorsMode || commentMode) && (
            <div
              className="hover-highlight-top absolute pointer-events-none rounded-md opacity-100 transition-opacity flex items-center justify-center"
              style={{
                left: `${hoverHighlight.left}px`,
                top: `${hoverHighlight.top}px`,
                width: `${hoverHighlight.width}px`,
                height: `${hoverHighlight.height}px`,
                background: commentMode
                  ? "rgba(255,255,255,0.1)"
                  : "rgba(0,0,0,0.1)",
                boxShadow: "none",
                border: commentMode
                  ? "2px dashed rgba(255,255,255,0.2)"
                  : "2px dashed rgba(0,0,0,0.3)",
                cursor: commentMode
                  ? "context-menu"
                  : "crosshair",
                mixBlendMode: "overlay",
                zIndex: 25, // НАД событиями (события имеют z-index до 20)
              }}
            >
              {/* Иконка комментария с плюсом - только в режиме комментирования, С blend mode */}
              {commentMode && (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    opacity: 0.5
                  }}
                >
                  <path d="M8 9h8" />
                  <path d="M8 13h6" />
                  <path d="M12.01 18.594l-4.01 2.406v-3h-2a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v5.5" />
                  <path d="M16 19h6" />
                  <path d="M19 16v6" />
                </svg>
              )}
            </div>
          )}

        {/* Ghost */}
        {ghost.visible && (
          <div
            className="ghost absolute pointer-events-none border-2 border-dashed border-[rgba(0,0,0,0.18)] bg-[rgba(0,0,0,0.02)] z-[50]"
            style={{
              left: `${ghost.left}px`,
              top: `${ghost.top}px`,
              width: `${ghost.width}px`,
              height: `${ghost.height}px`,
              borderRadius: `${getBorderRadiusForRowHeight(eventRowH)}px`,
            }}
          />
        )}

        {/* Current week marker - show only if current year matches workspace year */}
        {showCurrentWeekMarker && (
          <div
            className="current-week-marker absolute top-0 bottom-0 w-px ml-[-0.5px] pointer-events-none z-[145] bg-[#ff000080]"
            style={{
              left: `${config.resourceW + getCurrentWeekIndex(workspace.timeline_year) * config.weekPx + config.weekPx / 2}px`,
            }}
          />
        )}
      </div>

      {/* Toolbar */}
      <Toolbar
        canUndo={canUndo}
        canRedo={canRedo}
        scissorsMode={scissorsMode}
        commentMode={commentMode}
        weekPx={weekPx}
        eventRowH={eventRowH}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onToggleScissors={handleToggleScissors}
        onToggleComment={handleToggleComment}
        onWeekPxChange={setWeekPx}
        onEventRowHChange={setEventRowH}
        onOpenUsersModal={() => setUsersModalOpen(true)}
        onOpenProjectsModal={() => setProjectsModalOpen(true)}
        onOpenDepartmentsModal={() =>
          setDepartmentsModalOpen(true)
        }
      />

      {/* Filter Toolbar */}
      <FilterToolbar
        companies={companies}
        departments={departments}
        projects={projects}
      />

      {/* Online Users */}
      <OnlineUsers
        workspaceId={workspace.id}
        accessToken={accessToken}
        currentUserEmail={currentUserEmail}
      />

      {/* Modal */}
      <SimpleEventModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setPendingEvent(null);
          // Убираем hover при закрытии модального окна
          setHoverHighlight((prev) => ({
            ...prev,
            visible: false,
          }));
        }}
        onSave={handleModalSave}
        projects={projects}
        mode={modalMode}
        initialData={modalInitialData}
      />

      {/* Comment Modal */}
      <CommentModal
        isOpen={commentModalOpen}
        onClose={() => setCommentModalOpen(false)}
        pendingComment={pendingComment}
        resources={filteredResources}
        year={workspace.timeline_year}
        onSave={handleCommentSave}
      />

      {/* Context Menu */}
      <ContextMenu
        isVisible={contextMenu.isVisible}
        x={contextMenu.x}
        y={contextMenu.y}
        event={contextMenu.event}
        onEdit={handleContextEdit}
        onDelete={handleContextDelete}
        onCopy={handleContextCopy}
        onClose={() =>
          setContextMenu({
            isVisible: false,
            x: 0,
            y: 0,
            event: null,
          })
        }
      />

      {/* Empty Cell Context Menu */}
      <EmptyCellContextMenu
        isVisible={emptyCellContextMenu.isVisible}
        x={emptyCellContextMenu.x}
        y={emptyCellContextMenu.y}
        hasCopiedEvent={!!copiedEvent}
        onPaste={handlePaste}
        onClose={() => {
          setEmptyCellContextMenu({
            isVisible: false,
            x: 0,
            y: 0,
            resourceId: null,
            week: null,
            unitIndex: null,
          });
          // Убираем hover при закрытии контекстного меню
          setHoverHighlight((prev) => ({
            ...prev,
            visible: false,
          }));
        }}
      />

      {/* Users Management Modal */}
      <UsersManagementModal
        isOpen={usersModalOpen}
        onClose={() => setUsersModalOpen(false)}
        resources={resources}
        departments={departments}
        grades={grades}
        companies={companies}
        onCreateUser={createResource}
        onUpdateUser={updateResource}
        onDeleteUser={deleteResource}
        onResetHistory={() => {
          // ✅ КРИТИЧНО: передаём проекты для корректной работы Undo/Redo
          console.log('📝 Сброс истории после изменений сотрудников (с проектами)');
          resetHistory(events, eventZOrder, projects);
        }}
      />

      {/* Projects Management Modal */}
      <ProjectsManagementModal
        isOpen={projectsModalOpen}
        onClose={() => setProjectsModalOpen(false)}
        projects={projects}
        events={events}
        eventPatterns={eventPatterns}
        onCreateProject={createProject}
        onUpdateProject={updateProject}
        onDeleteProject={handleDeleteProject}
        onResetHistory={() => {
          // ✅ КРИТИЧНО: передаём проекты для корректной работы Undo/Redo
          console.log('📝 Сброс истории после изменений проектов (с проектами)');
          resetHistory(events, eventZOrder, projects);
        }}
      />

      {/* Departments Management Modal */}
      <DepartmentsManagementModal
        isOpen={departmentsModalOpen}
        onClose={() => setDepartmentsModalOpen(false)}
        departments={departments}
        onRenameDepartment={renameDepartment}
        onReorderDepartments={reorderDepartments}
        onToggleDepartmentVisibility={
          toggleDepartmentVisibility
        }
        onCreateDepartment={createDepartment}
        onDeleteDepartment={deleteDepartment}
        onGetDepartmentUsersCount={getDepartmentUsersCount}
      />

      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal
        isOpen={shortcutsModalOpen}
        onClose={() => setShortcutsModalOpen(false)}
      />

      {/* Profile Modal */}
      {profileModalOpen && (
        <ProfileModal
          isOpen={profileModalOpen}
          onClose={() => setProfileModalOpen(false)}
          onTokenRefresh={async (newToken: string) => {
            // После обновления токена перезагружаем страницу
            console.log(
              "🔄 Токн обновлён, перезагрузка через 2 секунды...",
            );
            setTimeout(() => {
              window.location.reload();
            }, 2000);
          }}
          accessToken={accessToken}
          currentDisplayName={currentUserDisplayName}
          currentEmail={currentUserEmail}
          currentAvatarUrl={currentUserAvatarUrl}
          onProfileUpdated={() => {
            // После обновления профиля данные обновятся при перезагрузке страницы
            console.log("✅ Профиль обновлён");
          }}
        />
      )}

      {/* Settings Modal */}
      <SettingsModal 
        isOpen={settingsModalOpen} 
        onClose={() => setSettingsModalOpen(false)} 
      />
    </div>
  );
}