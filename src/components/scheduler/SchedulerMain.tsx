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
import { useGapInteractions } from "../../hooks/useGapInteractions";
import { useUI } from "../../contexts/UIContext";
import { useSchedulerEventActions } from "../../hooks/useSchedulerEventActions";
import { useToast } from "../ui/ToastContext";
import { useIsTouchDevice } from "../../hooks/useIsTouchDevice";
import { SchedulerEvent as SchedulerEventComponent } from "./SchedulerEvent";
import { SchedulerModals } from "./SchedulerModals";
import { SchedulerContextMenus } from "./SchedulerContextMenus";
import { SchedulerToolbar } from "./SchedulerToolbar";
import { SchedulerGrid } from "./SchedulerGrid";
import { EventGapHandles } from "./EventGapHandles";
import {
  SchedulerEvent,
  Workspace,
  Department,
  Project, // Ensure Project is imported
} from "../../types/scheduler";
import {
  getEmailFromToken,
  getDisplayNameFromToken,
  decodeSupabaseJWT,
} from "../../utils/jwt";
import {
  projectId,
} from "../../utils/supabase/info";
import { supabaseClient, setSupabaseAuth } from "../../utils/supabase/client";
import {
  generateMonths,
  getCurrentWeekIndex,
  getWeeksInYear,
  clamp,
  sortEvents,
  getLastWeeksOfMonths,
  UNITS,
} from "../../utils/scheduler";
import {
  calculateEventNeighbors,
  MASK_ROUND_TL,
  MASK_ROUND_TR,
  MASK_ROUND_BL,
  MASK_ROUND_BR,
  MASK_HIDE_NAME,
} from "../../utils/eventNeighbors";
import { findEventGaps } from "../../utils/eventGaps";
import {
  createLayoutConfig,
  topFor,
  heightFor,
  getAvailableFreeSpace,
} from "../../utils/schedulerLayout";
import { smartSearch } from "../../utils/search";
import { offWeeksApi } from "../../services/api/offWeeks";
import { updateWorkspace } from "../../services/api/workspaces";
import { removeStorageItem } from "../../utils/storage";
import { getEffectiveRole, canEdit } from "../../utils/workspaceRole";
import type { EffectiveRole } from "../../utils/workspaceRole";
import { workspaceMembersApi } from "../../services/api/workspaceMembers";
import { getUserIdFromToken } from "../../utils/jwt";
import { ShareWorkspaceModal } from "../workspace/ShareWorkspaceModal";

interface SchedulerMainProps {
  accessToken: string | null;
  workspace: Workspace;
  onSignOut: () => void;
  onBackToWorkspaces: () => void;
  onTokenRefresh: (newToken: string) => Promise<void>;
  onWorkspaceUpdate?: (workspace: Workspace) => void;
}

export function SchedulerMain({
  accessToken,
  workspace,
  onSignOut,
  onBackToWorkspaces,
  onTokenRefresh,
  onWorkspaceUpdate,
}: SchedulerMainProps) {
  const {
    weekPx,
    eventRowH,
    showGaps,
    showPatterns,
    showProjectWeight,
    setWeekPx,
    setEventRowH,
    setShowGaps,
    setShowPatterns,
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
    visibleDepartments,
    visibleEvents,
    createEvent, // Still needed for useEventInteractions? No, moved to hook? No, hook uses context functions.
    updateEvent,
    deleteEvent,
    setEvents,
    cancelPendingChange,
    flushPendingChanges,
    isUserInteractingRef,
    setIsUserInteracting,
    resetDeltaSyncTimer,
    resetProjectsSyncTimer,
    createResource,
    updateResource,
    deleteResource,
    toggleUserVisibility,
    uploadUserAvatar,
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
    queueChange,
    setHistoryIdUpdater,
    setHistoryRebasers,
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
    loadResources,
    resetResourcesSyncTimer
  } = useScheduler();

  const sortedDepartments = useMemo(() => {
    return [...departments].sort((a, b) => {
      const queueA = a.queue ?? 9999;
      const queueB = b.queue ?? 9999;
      return queueA - queueB;
    });
  }, [departments]);

  const {
    enabledCompanies,
    enabledDepartments,
    enabledProjects,
    projectFilterTodayOnly,
  } = useFilters();
  
  const isTouchDevice = useIsTouchDevice(); // ✅ Detect touch device (Tablet/Mobile)

  // 🔐 Role-based access control
  // 1. Попробуем из метаданных воркспейса (мгновенно, если пришли с WorkspaceListScreen)
  // 2. Если нет метаданных (загрузка по URL) — фетчим через members API
  const [fetchedRole, setFetchedRole] = useState<EffectiveRole | null>(null);
  
  const metadataRole = useMemo(() => getEffectiveRole(workspace), [workspace]);
  
  useEffect(() => {
    // Если метаданные есть — не нужно фетчить
    if (metadataRole !== null) {
      setFetchedRole(null);
      return;
    }
    // Нет метаданных — определяем роль через API
    if (!workspace?.id || workspace.id === 'loading' || !accessToken) return;
    
    const userId = getUserIdFromToken(accessToken);
    if (!userId) return;
    
    console.log('🔐 Роль не определена из метаданных, фетчим через members API...');
    
    workspaceMembersApi.getMembers(workspace.id, accessToken)
      .then((members) => {
        const me = members.find(m => m.user_id === userId);
        if (me) {
          const role: EffectiveRole = me.role === 'viewer' ? 'viewer' : me.role === 'owner' ? 'owner' : 'editor';
          console.log(`🔐 Роль определена через API: ${role}`);
          setFetchedRole(role);
        } else {
          // Пользователь не найден в members — возможно owner через org
          // Проверяем created_by
          if (workspace.created_by === userId) {
            console.log('🔐 Роль определена: owner (created_by)');
            setFetchedRole('owner');
          } else {
            // Fallback: если мы вообще можем видеть воркспейс — минимум viewer
            console.log('🔐 Роль определена: viewer (fallback)');
            setFetchedRole('viewer');
          }
        }
      })
      .catch((err) => {
        console.error('❌ Ошибка определения роли:', err);
        // При ошибке — блокируем редактирование (безопасный fallback)
        setFetchedRole('viewer');
      });
  }, [workspace?.id, workspace?.created_by, metadataRole, accessToken]);
  
  const effectiveRole = metadataRole ?? fetchedRole;
  const isViewer = !canEdit(effectiveRole);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // 🔐 Viewer mode: добавляем класс на body для CSS-управления курсорами
  useEffect(() => {
    if (isViewer) {
      document.body.classList.add('viewer-mode');
    } else {
      document.body.classList.remove('viewer-mode');
    }
    return () => {
      document.body.classList.remove('viewer-mode');
    };
  }, [isViewer]);

  // 📡 Realtime: подписка на изменения текущего воркспейса (имя, год)
  const workspaceRef = useRef(workspace);
  workspaceRef.current = workspace;
  const onWorkspaceUpdateRef = useRef(onWorkspaceUpdate);
  onWorkspaceUpdateRef.current = onWorkspaceUpdate;

  useEffect(() => {
    if (!workspace?.id || !onWorkspaceUpdate) return;

    const workspaceId = String(workspace.id);
    const lastLocalChangeTs = { current: 0 };

    const channel = supabaseClient
      .channel(`workspace-${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'workspaces',
          filter: `id=eq.${workspaceId}`,
        },
        (payload) => {
          // Cooldown: skip if we just made a local change
          if (Date.now() - lastLocalChangeTs.current < 3000) return;

          const row = payload.new as any;
          const newName = row.name || '';
          const newYear = row.timeline_year || workspaceRef.current.timeline_year;
          const ws = workspaceRef.current;

          if (newName !== ws.name || newYear !== ws.timeline_year) {
            onWorkspaceUpdateRef.current?.({
              ...ws,
              name: newName,
              timeline_year: newYear,
              updated_at: row.updated_at || ws.updated_at,
            });
            document.title = `${newName} - Planaro`;
          }
        }
      )
      .subscribe();

    // Expose cooldown ref for local rename handler
    (window as any).__wsRealtimeCooldown = lastLocalChangeTs;

    return () => {
      supabaseClient.removeChannel(channel);
      delete (window as any).__wsRealtimeCooldown;
    };
  }, [workspace?.id]); // Only re-subscribe when workspace ID changes

  const {
    isLoading,
    isLoadingResources,
    
    scissorsMode,
    commentMode,
    handleToggleScissors,
    handleToggleComment,
    setScissorsMode,
    setCommentMode,

    pendingEventIds,
    // setPendingEventIds, // Removed as unused directly here (used in hook)

    copiedEvent,
    // setCopiedEvent, // Removed

    modalOpen,
    setModalOpen,
    modalMode,
    // setModalMode, // Removed
    modalInitialData,
    // setModalInitialData, // Removed
    pendingEvent,
    setPendingEvent,

    commentModalOpen,
    setCommentModalOpen,
    pendingComment,
    setPendingComment,

    managementModalOpen,
    setManagementModalOpen,
    managementModalTab,
    setManagementModalTab,
    shortcutsModalOpen,
    setShortcutsModalOpen,
    profileModalOpen,
    setProfileModalOpen,
    settingsModalOpen,
    setSettingsModalOpen,
    workspaceManagementModalOpen,
    setWorkspaceManagementModalOpen,

    contextMenu,
    setContextMenu,
    emptyCellContextMenu,
    setEmptyCellContextMenu,

    hoverHighlight,
    setHoverHighlight,
    ghost,
    // setGhost, // Removed

    closeAllModals,
  } = useUI();

  const [eventZOrder, setEventZOrder] = useState<
    Map<string, number>
  >(new Map());

  const schedulerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<{
    scrollContainer: HTMLDivElement | null;
    showRowHover?: (resourceId: string) => void;
    hideRowHover?: () => void;
    hideHoverHighlight?: () => void;
  } | null>(null);
  const eventsContainerRef = useRef<HTMLDivElement>(null);
  
  // 📅 Off weeks (выходные недели)
  const [offWeekNumbers, setOffWeekNumbers] = useState<Set<number>>(new Set());
  
  // 📤 Share modal
  const [shareModalOpen, setShareModalOpen] = useState(false);
  
  // 📡 Realtime: подписка на access_changed (удаление/смена роли)
  useEffect(() => {
    if (!accessToken) return;
    const userId = getUserIdFromToken(accessToken);
    if (!userId) return;

    const channelName = `notifications:user:${userId}`;


    let channelInstance: any = null;
    let cancelled = false;

    const init = async () => {
      await setSupabaseAuth(accessToken);
      if (cancelled) return;

      channelInstance = supabaseClient
        .channel(channelName)
        .on('broadcast', { event: 'access_changed' }, (msg) => {
          const payload = msg.payload as any;
          console.log('🔐 SchedulerMain: access_changed received', payload);

          const wsId = String(workspace.id);
          const isThisWorkspace = payload.workspace_id && String(payload.workspace_id) === wsId;
          // Проверяем принадлежность воркспейса к организации
          const wsOrgId = workspace.organization_id || workspace._org_id;
          const isThisOrg = payload.scope === 'organization' && payload.organization_id && wsOrgId && String(payload.organization_id) === String(wsOrgId);

          if (payload.action === 'removed' && (isThisWorkspace || isThisOrg)) {
            console.log('🔐 Доступ отозван — возвращаемся к списку воркспейсов');
            showToast({
              type: 'warning',
              message: 'Доступ отозван',
              description: isThisOrg
                ? 'Вас удалили из организации'
                : 'Вас удалили из этого пространства',
            });
            setTimeout(() => onBackToWorkspaces(), 1500);
          } else if (payload.action === 'role_changed' && (isThisWorkspace || isThisOrg)) {
            const roleLabel = payload.new_role === 'editor' ? 'Редактор' : payload.new_role === 'viewer' ? 'Просмотр' : payload.new_role;
            showToast({
              type: 'info',
              message: 'Роль изменена',
              description: `Ваша роль изменена на «${roleLabel}»`,
            });
            setTimeout(() => window.location.reload(), 1500);
          }
        })
        .subscribe((status) => {

        });
    };

    init();

    return () => {
      cancelled = true;
      if (channelInstance) {
        supabaseClient.removeChannel(channelInstance);
      }
    };
  }, [accessToken, workspace.id, onBackToWorkspaces, showToast]);

  useEffect(() => {
    if (!workspace?.id || workspace.id === 'loading') return;
    const wid = String(workspace.id);
    offWeeksApi.list(wid)
      .then((data) => {
        const nums = new Set(data.map((ow) => ow.week_number));
        setOffWeekNumbers(nums);

      })
      .catch((err) => console.error('❌ Failed to load off weeks:', err));
  }, [workspace?.id]);

  const reloadOffWeeks = useCallback(() => {
    if (!workspace?.id || workspace.id === 'loading') return;
    const wid = String(workspace.id);
    offWeeksApi.list(wid)
      .then((data) => {
        const nums = new Set(data.map((ow: any) => ow.week_number));
        setOffWeekNumbers(nums);
        console.log(`📅 Off weeks перезагружены: ${nums.size}`);
      })
      .catch((err) => console.error('❌ Failed to reload off weeks:', err));
  }, [workspace?.id]);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (gridRef.current?.scrollContainer) {
      scrollContainerRef.current = gridRef.current.scrollContainer;
    }
  }, [gridRef.current?.scrollContainer]);

  const [searchQuery, setSearchQuery] = useState("");
  const [highlightUserId, setHighlightUserId] = useState<string | undefined>(undefined);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const months = useMemo(
    () => generateMonths(workspace.timeline_year),
    [workspace.timeline_year],
  );
  const lastWeeks = useMemo(
    () => getLastWeeksOfMonths(months),
    [months],
  );

  const weeksInYear = useMemo(
    () => getWeeksInYear(workspace.timeline_year),
    [workspace.timeline_year],
  );

  const currentYear = new Date().getFullYear();
  const showCurrentWeekMarker = useMemo(
    () => currentYear === workspace.timeline_year,
    [workspace.timeline_year],
  );

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

  const filteredResources = useMemo(() => {
    let filtered = resources;

    if (enabledCompanies.size > 0) {
      filtered = filtered.filter(
        (r) => r.companyId && enabledCompanies.has(r.companyId),
      );
    }

    filtered = filtered.filter(r => r.visible !== false && (r as any).isVisible !== false);

    if (enabledDepartments.size > 0) {
      filtered = filtered.filter((r) => {
        if (!r.departmentId && enabledDepartments.has('NO_DEPT')) {
          return true;
        }
        return enabledDepartments.has(r.departmentId);
      });
    }

    if (enabledProjects.size > 0) {
      const currentWeek = getCurrentWeekIndex(workspace.timeline_year);
      const weekRangeStart = currentWeek - 1; // предыдущая неделя
      const weekRangeEnd = currentWeek + 1;   // следующая неделя
      const resourcesWithSelectedProjects = new Set<string>();
      events.forEach((event) => {
        if (enabledProjects.has(event.projectId)) {
          if (projectFilterTodayOnly) {
            // Показываем только ресурсы, у которых выбранный проект попадает на текущую ±1 неделю
            const eventEnd = event.startWeek + event.weeksSpan - 1;
            if (eventEnd >= weekRangeStart && event.startWeek <= weekRangeEnd) {
              resourcesWithSelectedProjects.add(event.resourceId);
            }
          } else {
            resourcesWithSelectedProjects.add(event.resourceId);
          }
        }
      });
      filtered = filtered.filter((r) =>
        resourcesWithSelectedProjects.has(r.id),
      );
    }

    if (searchQuery) {
      filtered = filtered.filter((r) => {
        const targetText = [
          r.fullName,
          r.position
        ].filter(Boolean).join(" ");
        
        return smartSearch(searchQuery, targetText);
      });
    }

    return filtered;
  }, [
    resources,
    enabledCompanies,
    enabledDepartments,
    enabledProjects,
    projectFilterTodayOnly,
    events,
    searchQuery,
    workspace.timeline_year,
  ]);

  const filteredDepartments = useMemo(() => {
    const departmentIds = new Set(
      filteredResources.map((r) => r.departmentId),
    );
    
    // ✅ Используем sortedDepartments вместо visibleDepartments
    const realDepartments = sortedDepartments.filter((d) =>
      departmentIds.has(d.id),
    );
    
    const hasUsersWithoutDept = filteredResources.some((r) => !r.departmentId);
    
    if (hasUsersWithoutDept) {
      const virtualDept: Department = {
        id: 'NO_DEPT',
        name: 'Без департамента',
        queue: 9999,
        visible: true,
        workspaceId: realDepartments[0]?.workspaceId || '',
      };
      return [...realDepartments, virtualDept];
    }
    
    return realDepartments;
  }, [sortedDepartments, filteredResources]);

  const config = useMemo(
    () =>
      createLayoutConfig(
        weekPx,
        eventRowH,
        showGaps,
      ),
    [weekPx, eventRowH, showGaps],
  );

  const {
    saveHistory,
    undo: historyUndo,
    redo: historyRedo,
    canUndo,
    canRedo,
    resetHistory,
    updateHistoryEventId,
    rebaseEvent,
    rebaseDeleteEvent,
    rebaseInsertEvent,
    getSnapshot,
  } = useHistory([], []);

  useEffect(() => {
    setHistoryIdUpdater(updateHistoryEventId);
  }, [setHistoryIdUpdater, updateHistoryEventId]);

  // 🔄 Регистрация rebase функций для Realtime
  useEffect(() => {
    setHistoryRebasers({ rebaseEvent, rebaseDeleteEvent, rebaseInsertEvent });
  }, [setHistoryRebasers, rebaseEvent, rebaseDeleteEvent, rebaseInsertEvent]);

  const historyInitializedRef = useRef(false);
  
  React.useEffect(() => {
    const snapshot = getSnapshot();
    const historyEventsCount = snapshot.events.length;
    const historyProjectsCount = snapshot.projects.length;
    
    const isEventsDesync = events.length > 0 && historyEventsCount === 0;
    const isProjectsDesync = projects.length > 0 && historyProjectsCount === 0;
    const needsReinitialization = historyInitializedRef.current && !isLoading && (isEventsDesync || isProjectsDesync);

    if (!isLoading && !historyInitializedRef.current) {
      resetHistory(events, eventZOrder, projects);
      historyInitializedRef.current = true;
    }
    else if (needsReinitialization) {
       resetHistory(events, eventZOrder, projects);
    }
  }, [isLoading, events.length, projects.length, eventZOrder, resetHistory, getSnapshot]);
  
  React.useEffect(() => {
    return () => {
      historyInitializedRef.current = false;
    };
  }, []);

  const prevProjectsRef = useRef<Project[]>([]);
  const isUserProjectChangeRef = useRef<boolean>(false);
  
  React.useEffect(() => {
    if (!historyInitializedRef.current) {
      prevProjectsRef.current = projects;
      return;
    }
    
    if (JSON.stringify(prevProjectsRef.current) !== JSON.stringify(projects)) {
      if (isUserProjectChangeRef.current) {
        if (events.length > 0 && projects.length === 0) {
          console.warn('⚠️ History: skip save - events loaded but projects missing');
          isUserProjectChangeRef.current = false;
          prevProjectsRef.current = projects;
          return;
        }
        saveHistory(events, eventZOrder, projects);
        isUserProjectChangeRef.current = false;
      }
      prevProjectsRef.current = projects;
    }
  }, [projects, events, eventZOrder, saveHistory]);

  React.useEffect(() => {
    if (!historyInitializedRef.current) return;
    if (events.length > 0 && projects.length === 0) {
      console.error('🚨 CRITICAL STATE: Events without Projects detected!');
    }
  }, [events.length, projects.length]);

  const handleUndo = useCallback(() => {
    // ✅ v8.12: Блокируем Undo если есть события в процессе создания (ev_temp_) или pending
    const hasPendingEvents = events.some(e => e.id.startsWith('ev_temp_')) || pendingEventIds.size > 0;
    if (hasPendingEvents) {
      console.log('⏸️ UNDO: Заблокировано - есть события в процессе создания/сохранения');
      showToast({
        type: 'warning',
        message: 'Подождите',
        description: 'Дождитесь завершения сохранения событий',
      });
      return;
    }

    const state = historyUndo();
    if (!state) return;

    const currentEvents = events;

    // ✅ Ддупликация: убираем дубликаты по ID (могут появиться из-за race condition rebaseInsert + updateHistoryEventId)
    const seen = new Set<string>();
    const dedupedEvents = state.events.filter(e => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });

    setEvents(dedupedEvents);
    setProjects(state.projects);
    setEventZOrder(state.eventZOrder);

    const restoredIds = new Set(dedupedEvents.map(e => e.id));

    currentEvents.forEach(event => {
      if (!restoredIds.has(event.id)) {
         cancelPendingChange(event.id);
         queueChange(event.id, 'delete');
      }
    });

    dedupedEvents.forEach(restoredEvent => {
       const current = currentEvents.find(e => e.id === restoredEvent.id);
       if (!current) {
          queueChange(restoredEvent.id, 'create', restoredEvent);
       } else {
          if (JSON.stringify(current) !== JSON.stringify(restoredEvent)) {
             queueChange(restoredEvent.id, 'update', restoredEvent);
          }
       }
    });

    resetDeltaSyncTimer();
    resetProjectsSyncTimer();

  }, [historyUndo, events, setEvents, setProjects, setEventZOrder, queueChange, cancelPendingChange, resetDeltaSyncTimer, resetProjectsSyncTimer, pendingEventIds, showToast]);

  const handleRedo = useCallback(() => {
    // ✅ v8.12: Блокируем Redo если есть события в процессе создания (ev_temp_) или pending
    const hasPendingEvents = events.some(e => e.id.startsWith('ev_temp_')) || pendingEventIds.size > 0;
    if (hasPendingEvents) {
      console.log('⏸️ REDO: Заблокировано - есть события в процессе создания/сохранения');
      showToast({
        type: 'warning',
        message: 'Подождите',
        description: 'Дождитесь завершения сохранения событий',
      });
      return;
    }

    const state = historyRedo();
    if (!state) return;

    const currentEvents = events;

    // ✅ Дедупликация
    const seen = new Set<string>();
    const dedupedEvents = state.events.filter(e => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });

    setEvents(dedupedEvents);
    setProjects(state.projects);
    setEventZOrder(state.eventZOrder);

    const restoredIds = new Set(dedupedEvents.map(e => e.id));

    currentEvents.forEach(event => {
      if (!restoredIds.has(event.id)) {
         cancelPendingChange(event.id);
         queueChange(event.id, 'delete');
      }
    });

    dedupedEvents.forEach(restoredEvent => {
       const current = currentEvents.find(e => e.id === restoredEvent.id);
       if (!current) {
          queueChange(restoredEvent.id, 'create', restoredEvent);
       } else {
          if (JSON.stringify(current) !== JSON.stringify(restoredEvent)) {
             queueChange(restoredEvent.id, 'update', restoredEvent);
          }
       }
    });

    resetDeltaSyncTimer();
    resetProjectsSyncTimer();

  }, [historyRedo, events, setEvents, setProjects, setEventZOrder, queueChange, cancelPendingChange, resetDeltaSyncTimer, resetProjectsSyncTimer, pendingEventIds, showToast]);

  const handleDeleteProject = useCallback(async (id: string) => {
    isUserProjectChangeRef.current = true;
    
    // ✅ Удаляем все события связанные с проектом
    const eventsToDelete = events.filter(e => e.projectId === id);
    if (eventsToDelete.length > 0) {
      console.log(`🗑️ Удаление проекта ${id}: удаляем ${eventsToDelete.length} связанных событий...`);
      // Используем Promise.all для параллельного удаления
      await Promise.all(eventsToDelete.map(e => deleteEvent(e.id)));
    }
    
    await deleteProject(id);
  }, [deleteProject, events, deleteEvent]);

  const handleSetModeCursor = useCallback(() => {
    setScissorsMode(false);
    setCommentMode(false);
  }, [setScissorsMode, setCommentMode]);

  const isAnyModalOpen = useMemo(() => {
    return modalOpen || 
           commentModalOpen || 
           managementModalOpen || 
           shortcutsModalOpen || 
           profileModalOpen || 
           settingsModalOpen || 
           workspaceManagementModalOpen;
  }, [
    modalOpen,
    commentModalOpen,
    managementModalOpen,
    shortcutsModalOpen,
    profileModalOpen,
    settingsModalOpen,
    workspaceManagementModalOpen
  ]);

  const { isSpacePressed, isCtrlPressed } =
    useKeyboardShortcuts({
      onUndo: handleUndo,
      onRedo: handleRedo,
      onEscape: closeAllModals,
      onShowShortcuts: () => setShortcutsModalOpen(true),
      onSetModeCursor: handleSetModeCursor,
      onSetModeScissors: handleToggleScissors,
      onSetModeComment: handleToggleComment,
      schedulerRef,
      isAnyModalOpen,
    });

  usePanning(scrollContainerRef, isSpacePressed);

  useEffect(() => {
    setScissorsMode(false);
    setCommentMode(false);
  }, [workspace.id, setScissorsMode, setCommentMode]);

  // 💾 Auto-Backup on workspace load
  useEffect(() => {
    // Don't backup if workspace is loading or invalid
    if (!workspace.id || workspace.id === 'loading') return;
    
    // Slight delay to not block initial rendering
    const timer = setTimeout(async () => {
      // 🛑 Don't trigger if tab is hidden (background)
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        console.log('💾 Auto-Backup: Skipped (tab hidden)');
        return;
      }

      try {

        const { backupsApi } = await import('../../services/api/backups');
        await backupsApi.create(String(workspace.id));
      } catch (error) {
        console.error('❌ Auto-Backup failed:', error);
      }
    }, 5000); // 5s delay
    
    return () => clearTimeout(timer);
  }, [workspace.id]);

  const sortedEventsWithZOrder = useMemo(() => {
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

    if (eventZOrder && eventZOrder.size > 0) {
      eventsWithZOrder.sort((a, b) => {
        const zA = eventZOrder.get(a.id) || 0;
        const zB = eventZOrder.get(b.id) || 0;
        return zA - zB;
      });
    }

    return eventsWithZOrder;
  }, [visibleEvents, filteredResources, eventZOrder]);

  const eventNeighbors = useMemo(() => {
    return calculateEventNeighbors(sortedEventsWithZOrder, projects);
  }, [sortedEventsWithZOrder, projects]);

  const eventsByResource = useMemo(() => {
    const map = new Map<string, SchedulerEvent[]>();
    sortedEventsWithZOrder.forEach(event => {
      if (!map.has(event.resourceId)) {
        map.set(event.resourceId, []);
      }
      map.get(event.resourceId)!.push(event);
    });
    return map;
  }, [sortedEventsWithZOrder]);

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
    resetDeltaSyncTimer,
    flushPendingChanges,
    updateHistoryEventId,
    getEvents: getSnapshot,
    eventNeighbors,
    weeksInYear,
    grades
  });
  
  const { startGapDrag } = useGapInteractions({
    config,
    onEventsUpdate: setEvents,
    onSaveHistory: saveHistory,
    onEventUpdate: updateEvent,
    eventZOrder,
    projects,
    setIsUserInteracting,
    resetDeltaSyncTimer,
    flushPendingChanges,
    updateHistoryEventId,
    events,
  });
  
  const eventGaps = useMemo(() => {
    if (!isCtrlPressed) return [];
    return findEventGaps(visibleEvents, filteredResources, filteredDepartments);
  }, [isCtrlPressed, visibleEvents, filteredResources, filteredDepartments]);

  const {
    cutEventByBoundary,
    handleCellClick,
    handleEventClick,
    handleEventContextMenu,
    handleContextEdit,
    handleContextDelete,
    handleContextCopy,
    handleCellContextMenu,
    handlePaste,
    handleModalSave,
    handleCommentSave
  } = useSchedulerEventActions({
    workspace,
    config,
    events,
    visibleEvents,
    filteredResources,
    filteredDepartments,
    sortedEventsWithZOrder,
    projects,
    eventZOrder,
    setEventZOrder,
    saveHistory,
    weeksInYear,
    updateHistoryEventId,
    grades,
  });

  const handleCellMouseMove = useCallback(
    (e: React.MouseEvent, resourceId: string, week: number, explicitUnitIndex?: number) => {
      if (isViewer) return; // 🔐 No hover highlight for viewers
      if (scissorsMode || contextMenu.isVisible || emptyCellContextMenu.isVisible || isUserInteractingRef.current) return;

      // Block hover on off-weeks (week is 0-based, offWeekNumbers are 1-based)
      if (offWeekNumbers.has(week + 1)) {
        setHoverHighlight((prev) => ({ ...prev, visible: false }));
        return;
      }

      let unitIndex: number;

      if (explicitUnitIndex !== undefined) {
        unitIndex = explicitUnitIndex;
      } else {
        const rect = e.currentTarget.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const rawUnitIndex = Math.floor(
          (y - config.rowPaddingTop) / config.unitStride,
        );
        // Clamp to valid units (0-3) to prevent selecting padding
        unitIndex = Math.max(0, Math.min(rawUnitIndex, 3));
      }

      // In comment mode, we want to allow hovering over events
      if (commentMode) {
        // Gap is usually config.cellPaddingLeft (based on layout config)
        const gap = config.gap;
        const left = week * config.weekPx + (gap * 0.5);
        const top = topFor(
          resourceId,
          0,
          filteredResources,
          filteredDepartments,
          config,
          grades
        ) - config.rowPaddingTop + gap;
        setHoverHighlight({
          visible: true,
          left,
          top,
          width: config.weekPx - gap,
          height: 28,
        });
        return;
      }

      const isOccupied = visibleEvents.some((ev) => {
        return (
          ev.resourceId === resourceId &&
          ev.startWeek <= week &&
          ev.startWeek + ev.weeksSpan > week &&
          ev.unitStart <= unitIndex &&
          ev.unitStart + ev.unitsTall > unitIndex
        );
      });

      if (isOccupied) {
        setHoverHighlight((prev) => ({
          ...prev,
          visible: false,
        }));
        return;
      }

      const free = getAvailableFreeSpace(
        resourceId,
        week,
        unitIndex,
        visibleEvents,
      );
      if (free > 0 && unitIndex >= 0 && unitIndex < UNITS) {
        const left =
          week * config.weekPx +
          config.cellPaddingLeft;
        const top = topFor(
          resourceId,
          unitIndex,
          filteredResources,
          filteredDepartments,
          config,
          grades
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
      isViewer,
      scissorsMode,
      commentMode,
      config,
      visibleEvents,
      filteredResources,
      filteredDepartments,
      contextMenu.isVisible,
      emptyCellContextMenu.isVisible,
      isUserInteractingRef,
      setHoverHighlight,
      offWeekNumbers
    ],
  );

  const handleCellMouseLeave = useCallback(() => {
    if (!scissorsMode && !emptyCellContextMenu.isVisible && !modalOpen && !isUserInteractingRef.current) {
      gridRef.current?.hideHoverHighlight?.();
      setHoverHighlight((prev) => ({
        ...prev,
        visible: false,
        }));
    }
  }, [scissorsMode, emptyCellContextMenu.isVisible, modalOpen, isUserInteractingRef, setHoverHighlight]);

  const eventPositions = useMemo(() => {
    const positions = new Map<string, { left: number; top: number; width: number; height: number }>();
    
    sortedEventsWithZOrder.forEach(event => {
      const neighborInfo = eventNeighbors.get(event.id);
      
      const paddingLeft = showGaps ? config.cellPaddingLeft : 0;
      const paddingRight = showGaps ? config.cellPaddingRight : 0;
      
      let left =
        event.startWeek * config.weekPx +
        paddingLeft;
      const top = topFor(
        event.resourceId,
        event.unitStart,
        filteredResources,
        filteredDepartments,
        config,
        grades
      );
      let width =
        event.weeksSpan * config.weekPx -
        paddingLeft -
        paddingRight;
      const height = heightFor(event.unitsTall, config);
      
      if (neighborInfo?.expandLeftMultiplier) {
        const expandAmount = config.gap * neighborInfo.expandLeftMultiplier;
        left -= expandAmount;
        width += expandAmount;
      }
      if (neighborInfo?.expandRightMultiplier) {
        const expandAmount = config.gap * neighborInfo.expandRightMultiplier;
        width += expandAmount;
      }
      
      positions.set(event.id, { left, top, width, height });
    });
    
    return positions;
  }, [sortedEventsWithZOrder, eventNeighbors, showGaps, config, filteredResources, filteredDepartments]);

  const renderEvents = useCallback((visibleResourceIds?: Set<string>) => {
    if (isLoadingResources) {
      return null;
    }

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

    const BUFFER_MULTIPLIER = 3;
    const bufferX = viewportWidth * BUFFER_MULTIPLIER;
    const bufferY = viewportHeight * BUFFER_MULTIPLIER;

    const cullLeft = viewportLeft - bufferX;
    const cullRight = viewportLeft + viewportWidth + bufferX;
    const cullTop = viewportTop - bufferY;
    const cullBottom = viewportTop + viewportHeight + bufferY;

    const currentWeekIndex = getCurrentWeekIndex(workspace.timeline_year);

    let eventsToRender: SchedulerEvent[] = [];
    if (visibleResourceIds && visibleResourceIds.size > 0) {
      visibleResourceIds.forEach(rId => {
        const evs = eventsByResource.get(rId);
        if (evs) eventsToRender.push(...evs);
      });
    } else {
      eventsToRender = sortedEventsWithZOrder;
    }

    return eventsToRender
      .map((event) => {
        const isDimmed =
          enabledProjects.size > 0 &&
          !enabledProjects.has(event.projectId);
        
        const neighborInfo = eventNeighbors.get(event.id);
        const neighbors = neighborInfo || {
          flags: MASK_ROUND_TL | MASK_ROUND_TR | MASK_ROUND_BL | MASK_ROUND_BR,
          expandLeftMultiplier: 0,
          expandRightMultiplier: 0,
        };

        const getInnerColor = (projectId?: string) => {
          if (!projectId) return 'transparent';
          
          if (enabledProjects.size > 0 && !enabledProjects.has(projectId)) {
             return '#AAA';
          }
          
          const project = projects.find(p => p.id === projectId);
          return project?.backgroundColor || 'transparent';
        };
        
        const position = eventPositions.get(event.id);
        if (!position) {
          console.error('❌ Position not found for event', event.id);
          return null;
        }
        const { left, top, width, height } = position;

        if (
          left + width < cullLeft ||
          left > cullRight ||
          top + height < cullTop ||
          top > cullBottom
        ) {
          return null;
        }

        const isPending = pendingEventIds.has(event.id);
        const isBlocked = event.id.startsWith('ev_temp_');
        const isContextMenuOpen = contextMenu.isVisible && contextMenu.event?.id === event.id;

        return (
          <SchedulerEventComponent
            key={`${event.id}-${showProjectWeight}`}
            event={event}
            config={config}
            projects={projects}
            eventPatterns={eventPatterns}
            scissorsMode={scissorsMode && !isPending}
            commentMode={commentMode && !isPending}
            isCtrlPressed={isCtrlPressed}
            isPending={isPending}
            isBlocked={isBlocked}
            dimmed={isDimmed}
            showGaps={showGaps}
            showPatterns={showPatterns}
            showProjectWeight={showProjectWeight}
            isContextMenuOpen={isContextMenuOpen}
            currentWeekIndex={currentWeekIndex}
            isMobile={isTouchDevice} // ✅ Pass isMobile to disable interactions
            roundTopLeft={!!(neighbors.flags & MASK_ROUND_TL)}
            roundTopRight={!!(neighbors.flags & MASK_ROUND_TR)}
            roundBottomLeft={!!(neighbors.flags & MASK_ROUND_BL)}
            roundBottomRight={!!(neighbors.flags & MASK_ROUND_BR)}
            innerTopLeftColor={getInnerColor(neighbors.innerTopLeftProjectId)}
            innerBottomLeftColor={getInnerColor(neighbors.innerBottomLeftProjectId)}
            innerTopRightColor={getInnerColor(neighbors.innerTopRightProjectId)}
            innerBottomRightColor={getInnerColor(neighbors.innerBottomRightProjectId)}
            hideProjectName={!!(neighbors.flags & MASK_HIDE_NAME)}
            onContextMenu={isViewer ? undefined : handleEventContextMenu}
            onPointerDown={(e, ev) => {
              if (isPending || isBlocked || isViewer) return;
              const target = e.currentTarget as HTMLElement;
              startDrag(e, target, ev);
            }}
            onHandlePointerDown={(e, ev, edge) => {
              if (isPending || isBlocked || isViewer) return;
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
            onMouseEnter={() => {
              if (gridRef.current?.showRowHover) {
                gridRef.current.showRowHover(event.resourceId);
              }
              handleCellMouseLeave();
            }}
            onMouseLeave={() => {
              if (gridRef.current?.hideRowHover) {
                gridRef.current.hideRowHover();
              }
            }}
            data-resource-id={event.resourceId}
            left={left}
            top={top}
            width={width}
            height={height}
            eventRowH={eventRowH}
          />
        );
      })
      .filter(Boolean);
  }, [
    sortedEventsWithZOrder,
    eventsByResource,
    eventNeighbors,
    eventPositions,
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
    showGaps,
    showPatterns,
    showProjectWeight,
    handleEventContextMenu,
    startDrag,
    startResize,
    handleEventClick,
    cutEventByBoundary,
    isLoadingResources,
    handleCellMouseLeave,
    isViewer
  ]);

  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      const currentYear = new Date().getFullYear();
      const workspaceYear = workspace.timeline_year;
      
      if (
        gridRef.current?.scrollContainer &&
        showCurrentWeekMarker &&
        currentYear === workspaceYear &&
        workspace.id !== 'loading'
      ) {
        const currentWeek = getCurrentWeekIndex(
          workspace.timeline_year,
        );
        const currentWeekLeft = currentWeek * config.weekPx;
        const desiredScrollLeft = currentWeekLeft - (config.weekPx * 2);
        const viewportWidth = gridRef.current.scrollContainer.clientWidth;
        const maxScrollLeft = Math.max(
          0,
          gridRef.current.scrollContainer.scrollWidth - viewportWidth,
        );
        gridRef.current.scrollContainer.scrollLeft = clamp(
          desiredScrollLeft,
          0,
          maxScrollLeft,
        );
        

      }
    }, 0);
    
    return () => clearTimeout(timeoutId);
  }, [
    config.weekPx,
    workspace.timeline_year,
    workspace.id,
    showCurrentWeekMarker,
  ]);

  useEffect(() => {
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

  useEffect(() => {
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
        setHoverHighlight((prev) => ({
          ...prev,
          visible: false,
          }));
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () =>
      document.removeEventListener("click", handleClickOutside);
  }, [setContextMenu, setEmptyCellContextMenu, setHoverHighlight]);

  const handleOpenProfileModal = useCallback(() => setProfileModalOpen(true), [setProfileModalOpen]);
  const handleOpenSettingsModal = useCallback(() => setManagementModalOpen(true), [setManagementModalOpen]);
  const handleOpenWorkspaceManagementModal = useCallback(() => setWorkspaceManagementModalOpen(true), [setWorkspaceManagementModalOpen]);

  const handleRenameWorkspace = useCallback(async (newName: string) => {
    if (!accessToken || !workspace) {
      console.warn('⚠️ Missing accessToken or workspace');
      return;
    }
    
    if (!projectId) {
      console.error('❌ projectId not defined!');
      showToast({
        type: 'error',
        message: 'Ошибка конфигурации',
        description: 'Project ID не найден',
      });
      return;
    }
    
    const oldName = workspace.name;
    const updatedWorkspace = { ...workspace, name: newName };
    
    // Set cooldown to prevent realtime echo
    if ((window as any).__wsRealtimeCooldown) {
      (window as any).__wsRealtimeCooldown.current = Date.now();
    }
    
    if (onWorkspaceUpdate) {
      onWorkspaceUpdate(updatedWorkspace);
    }
    
    document.title = `${newName} - Planaro`;
    
    console.log('📝 Rename workspace (optimistic):', {
      oldName,
      newName,
      workspaceId: workspace.id,
    });

    try {
      const { removeStorageItem } = await import('../../utils/storage');
      await removeStorageItem('cache_workspaces_list');
    } catch (err) {
      console.warn('⚠️ Failed to clear workspaces cache:', err);
    }

    try {
      const url = `https://${projectId}.supabase.co/functions/v1/make-server-73d66528/workspaces/${workspace.id}`;
      
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ name: newName }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('❌ Save error:', errorData);
        
        if (onWorkspaceUpdate) {
          onWorkspaceUpdate(workspace);
        }
        document.title = `${oldName} - Planaro`;
        
        showToast({
          type: 'error',
          message: 'Ошибка переименования',
          description: errorData.error || 'Неизвестная ошибка',
        });
      } else {
        console.log('✅ Workspace saved');
      }
    } catch (error) {
      console.error('❌ Network error:', error);
      
      if (onWorkspaceUpdate) {
        onWorkspaceUpdate(workspace);
      }
      document.title = `${oldName} - Planaro`;
      
      showToast({
        type: 'error',
        message: 'Ошибка переименования',
        description: error instanceof Error ? error.message : 'Неизвестная ошибка',
      });
    }
  }, [accessToken, workspace, showToast, onWorkspaceUpdate, projectId]);

  const handleUpdateWorkspaceName = useCallback(async (name: string) => {
    console.log('💾 Обновление названия воркспейса:', name);
    // Cooldown для Realtime
    if ((window as any).__wsRealtimeCooldown) {
      (window as any).__wsRealtimeCooldown.current = Date.now();
    }
    const updated = await updateWorkspace(String(workspace.id), { name });
    console.log('✅ Название обновлено:', updated);
    // Очищаем кэш списка воркспейсов
    await removeStorageItem('cache_workspaces_list').catch(() => {});
    if (onWorkspaceUpdate) {
      onWorkspaceUpdate({ ...workspace, ...updated });
    }
    document.title = `${name} - Planaro`;
  }, [workspace, onWorkspaceUpdate]);

  const handleUpdateWorkspaceYear = useCallback(async (year: number) => {
    console.log('💾 Обновление года воркспейса:', year);
    // Cooldown для Realtime
    if ((window as any).__wsRealtimeCooldown) {
      (window as any).__wsRealtimeCooldown.current = Date.now();
    }
    const updated = await updateWorkspace(String(workspace.id), { timeline_year: year });
    console.log('✅ Год обновлён:', updated);
    // Очищаем кэш списка воркспейсов
    await removeStorageItem('cache_workspaces_list').catch(() => {});
    if (onWorkspaceUpdate) {
      onWorkspaceUpdate({ ...workspace, ...updated });
    }
  }, [workspace, onWorkspaceUpdate]);

  const gridChildren = useMemo(() => (
    <EventGapHandles
      gaps={eventGaps}
      config={config}
      resources={filteredResources}
      visibleDepartments={filteredDepartments}
      isCommandKeyHeld={isCtrlPressed}
      onGapMouseDown={startGapDrag}
      grades={grades}
    />
  ), [eventGaps, config, filteredResources, filteredDepartments, isCtrlPressed, startGapDrag]);

  return (
    <div 
      className="flex flex-col w-full bg-white text-slate-900 select-none relative" 
      style={{ height: '100dvh', overflow: 'hidden' }}
    >

      <SchedulerToolbar
        workspace={workspace}
        onBackToWorkspaces={onBackToWorkspaces}
        onRenameWorkspace={handleRenameWorkspace}
        onOpenSettingsModal={handleOpenSettingsModal}
        onOpenWorkspaceManagementModal={handleOpenWorkspaceManagementModal}
        onSignOut={onSignOut}
        onOpenShareModal={() => setShareModalOpen(true)}
        accessToken={accessToken}
        scissorsMode={scissorsMode}
        commentMode={commentMode}
        onToggleScissors={handleToggleScissors}
        onToggleComment={handleToggleComment}
        companies={companies}
        departments={departments}
        projects={projects}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        sidebarCollapsed={sidebarCollapsed}
        offWeekNumbers={offWeekNumbers}
        isViewer={isViewer}
      />

      <div className="flex-1 relative scheduler-container" style={{ minHeight: 0 }}>
        <SchedulerGrid
          ref={gridRef}
          scrollRef={schedulerRef}
          config={config}
          accessToken={accessToken}
          workspace={workspace}
          months={months}
          resources={filteredResources}
          departments={sortedDepartments}
          visibleDepartments={filteredDepartments}
          lastWeeks={lastWeeks}
          currentWeekIndex={getCurrentWeekIndex(workspace.timeline_year)}
          showCurrentWeekMarker={showCurrentWeekMarker}
          onCellClick={(resourceId, week, unitIndex) => {
            if (isViewer) return;
            if (offWeekNumbers.has(week + 1)) return;
            handleCellClick(resourceId, week, unitIndex);
          }}
          onCellMouseMove={handleCellMouseMove}
          onCellMouseLeave={handleCellMouseLeave}
          onCellContextMenu={(e, resourceId, week, unitIndex) => {
            if (isViewer) return;
            if (offWeekNumbers.has(week + 1)) return;
            handleCellContextMenu(e, resourceId, week, unitIndex);
          }}
          renderEvents={renderEvents}
          hoverHighlight={hoverHighlight}
          ghost={ghost}
          eventsContainerRef={eventsContainerRef}
          grades={grades}
          companies={companies}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onEditUser={!isViewer ? (userId) => {
            setHighlightUserId(userId);
            setManagementModalTab('users');
            setManagementModalOpen(true);
          } : undefined}
          onDeleteUser={!isViewer ? (userId) => {
            const user = resources.find(r => r.id === userId);
            if (user) {
              const confirmed = window.confirm(
                `Вы уверены, что хотите удалить сотрудника "${user.fullName}"?\n\n` +
                `⚠️ ВНИМАНИЕ: Все события этого сотрудника также будут удалены!`
              );
              if (confirmed) {
                deleteResource(userId);
              }
            }
          } : undefined}
          isLoading={isLoadingResources}
          onSidebarCollapsedChange={setSidebarCollapsed}
          offWeekNumbers={offWeekNumbers}
        >
          {gridChildren}
        </SchedulerGrid>
      </div>

      <SchedulerModals
        modalOpen={modalOpen}
        setModalOpen={setModalOpen}
        modalMode={modalMode}
        modalInitialData={modalInitialData}
        pendingEvent={pendingEvent}
        setPendingEvent={setPendingEvent}
        handleModalSave={handleModalSave}
        projects={projects}
        resources={resources}
        events={events}
        weeksInYear={weeksInYear}

        commentModalOpen={commentModalOpen}
        setCommentModalOpen={setCommentModalOpen}
        setPendingComment={setPendingComment}
        handleCommentSave={handleCommentSave}

        managementModalOpen={managementModalOpen}
        setManagementModalOpen={(open) => {
          if (!open) setHighlightUserId(undefined);
          setManagementModalOpen(open);
        }}
        managementModalTab={managementModalTab}
        
        workspaceId={String(workspace?.id || '')}
        workspaceName={workspace?.name || ''}
        workspaceYear={workspace?.timeline_year || new Date().getFullYear()}
        updateWorkspaceName={handleUpdateWorkspaceName}
        updateWorkspaceYear={handleUpdateWorkspaceYear}
        
        departments={departments}
        companies={companies}
        grades={grades}
        createResource={createResource}
        updateResource={updateResource}
        deleteResource={deleteResource}
        toggleUserVisibility={toggleUserVisibility}
        uploadUserAvatar={uploadUserAvatar}
        highlightUserId={highlightUserId}
        
        createGrade={createGrade}
        updateGrade={updateGrade}
        deleteGrade={deleteGrade}
        onGradesUpdated={loadGrades}
        updateGradesSortOrder={updateGradesSortOrder}
        
        createCompany={createCompany}
        updateCompany={updateCompany}
        deleteCompany={deleteCompany}
        onCompaniesUpdated={loadCompanies}
        updateCompaniesSortOrder={updateCompaniesSortOrder}
        onResourcesUpdated={loadResources}
        resetResourcesSyncTimer={resetResourcesSyncTimer}

        eventPatterns={eventPatterns}
        createProject={createProject}
        updateProject={updateProject}
        handleDeleteProject={handleDeleteProject}
        resetHistory={resetHistory}

        createDepartment={createDepartment}
        deleteDepartment={deleteDepartment}
        getDepartmentUsersCount={getDepartmentUsersCount}
        renameDepartment={renameDepartment}
        reorderDepartments={reorderDepartments}
        toggleDepartmentVisibility={toggleDepartmentVisibility}

        shortcutsModalOpen={shortcutsModalOpen}
        setShortcutsModalOpen={setShortcutsModalOpen}

        profileModalOpen={profileModalOpen}
        setProfileModalOpen={setProfileModalOpen}
        currentUserEmail={currentUserEmail}
        currentUserDisplayName={currentUserDisplayName}
        currentUserAvatarUrl={currentUserAvatarUrl}
        accessToken={accessToken}
        onTokenRefresh={onTokenRefresh}

        settingsModalOpen={settingsModalOpen}
        setSettingsModalOpen={setSettingsModalOpen}

        workspaceManagementModalOpen={workspaceManagementModalOpen}
        setWorkspaceManagementModalOpen={setWorkspaceManagementModalOpen}
        onOffWeeksUpdated={reloadOffWeeks}
      />

      <SchedulerContextMenus
        contextMenu={contextMenu}
        onContextMenuClose={() =>
          setContextMenu({
            isVisible: false,
            x: 0,
            y: 0,
            event: null,
          })
        }
        onEdit={handleContextEdit}
        onDelete={handleContextDelete}
        onCopy={handleContextCopy}
        emptyCellContextMenu={emptyCellContextMenu}
        onEmptyCellMenuClose={() =>
          setEmptyCellContextMenu({
            isVisible: false,
            x: 0,
            y: 0,
            resourceId: null,
            week: null,
            unitIndex: null,
          })
        }
        onPaste={handlePaste}
        hasCopiedEvent={!!copiedEvent}
      />

      {shareModalOpen && (
        <ShareWorkspaceModal
          workspace={workspace}
          onClose={() => setShareModalOpen(false)}
          accessToken={accessToken}
          isViewer={isViewer}
        />
      )}
    </div>
  );
}