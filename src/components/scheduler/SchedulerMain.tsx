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
import { SchedulerEvent as SchedulerEventComponent } from "./SchedulerEvent";
import { RealtimeCursors } from "./RealtimeCursors";
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
  } = useScheduler();

  const sortedDepartments = useMemo(() => {
    return [...departments].sort((a, b) => (a.queue || 0) - (b.queue || 0));
  }, [departments]);

  const {
    enabledCompanies,
    enabledDepartments,
    enabledProjects,
  } = useFilters();

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

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
    events,
    searchQuery,
  ]);

  const filteredDepartments = useMemo(() => {
    const departmentIds = new Set(
      filteredResources.map((r) => r.departmentId),
    );
    
    const realDepartments = visibleDepartments.filter((d) =>
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
  }, [visibleDepartments, filteredResources]);

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
    getSnapshot,
  } = useHistory([], []);

  useEffect(() => {
    setHistoryIdUpdater(updateHistoryEventId);
  }, [setHistoryIdUpdater, updateHistoryEventId]);

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
    const state = historyUndo();
    if (!state) return;

    const currentEvents = events;

    setEvents(state.events);
    setProjects(state.projects);
    setEventZOrder(state.eventZOrder);

    const restoredIds = new Set(state.events.map(e => e.id));

    currentEvents.forEach(event => {
      if (!restoredIds.has(event.id)) {
         cancelPendingChange(event.id);
         queueChange(event.id, 'delete');
      }
    });

    state.events.forEach(restoredEvent => {
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

  }, [historyUndo, events, setEvents, setProjects, setEventZOrder, queueChange, cancelPendingChange, resetDeltaSyncTimer, resetProjectsSyncTimer]);

  const handleRedo = useCallback(() => {
    const state = historyRedo();
    if (!state) return;

    const currentEvents = events;

    setEvents(state.events);
    setProjects(state.projects);
    setEventZOrder(state.eventZOrder);

    const restoredIds = new Set(state.events.map(e => e.id));

    currentEvents.forEach(event => {
      if (!restoredIds.has(event.id)) {
         cancelPendingChange(event.id);
         queueChange(event.id, 'delete');
      }
    });

    state.events.forEach(restoredEvent => {
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

  }, [historyRedo, events, setEvents, setProjects, setEventZOrder, queueChange, cancelPendingChange, resetDeltaSyncTimer, resetProjectsSyncTimer]);

  const handleDeleteProject = useCallback(async (id: string) => {
    isUserProjectChangeRef.current = true;
    await deleteProject(id);
  }, [deleteProject]);

  const { isSpacePressed, isCtrlPressed } =
    useKeyboardShortcuts({
      onUndo: handleUndo,
      onRedo: handleRedo,
      onEscape: closeAllModals,
      onShowShortcuts: () => setShortcutsModalOpen(true),
      schedulerRef,
    });

  usePanning(scrollContainerRef, isSpacePressed);

  useEffect(() => {
    setScissorsMode(false);
    setCommentMode(false);
  }, [workspace.id, setScissorsMode, setCommentMode]);

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
  });

  const handleCellMouseMove = useCallback(
    (e: React.MouseEvent, resourceId: string, week: number, explicitUnitIndex?: number) => {
      if (scissorsMode || contextMenu.isVisible || emptyCellContextMenu.isVisible || isUserInteractingRef.current) return;

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
      isUserInteractingRef,
      setHoverHighlight
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
            roundTopLeft={!!(neighbors.flags & MASK_ROUND_TL)}
            roundTopRight={!!(neighbors.flags & MASK_ROUND_TR)}
            roundBottomLeft={!!(neighbors.flags & MASK_ROUND_BL)}
            roundBottomRight={!!(neighbors.flags & MASK_ROUND_BR)}
            innerTopLeftColor={getInnerColor(neighbors.innerTopLeftProjectId)}
            innerBottomLeftColor={getInnerColor(neighbors.innerBottomLeftProjectId)}
            innerTopRightColor={getInnerColor(neighbors.innerTopRightProjectId)}
            innerBottomRightColor={getInnerColor(neighbors.innerBottomRightProjectId)}
            hideProjectName={!!(neighbors.flags & MASK_HIDE_NAME)}
            onContextMenu={handleEventContextMenu}
            onPointerDown={(e, ev) => {
              if (isPending || isBlocked) return;
              const target = e.currentTarget as HTMLElement;
              startDrag(e, target, ev);
            }}
            onHandlePointerDown={(e, ev, edge) => {
              if (isPending || isBlocked) return;
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
    handleCellMouseLeave
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
        
        console.log(`📍 Auto-scroll to week ${currentWeek}`);
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

  const gridChildren = useMemo(() => (
    <EventGapHandles
      gaps={eventGaps}
      config={config}
      resources={filteredResources}
      visibleDepartments={filteredDepartments}
      isCommandKeyHeld={isCtrlPressed}
      onGapMouseDown={startGapDrag}
    />
  ), [eventGaps, config, filteredResources, filteredDepartments, isCtrlPressed, startGapDrag]);

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

  return (
    <div 
      className="flex flex-col w-full bg-white text-slate-900 select-none relative" 
      style={{ height: '100vh', overflow: 'hidden' }}
    >
      <RealtimeCursors />

      <SchedulerToolbar
        workspace={workspace}
        onBackToWorkspaces={onBackToWorkspaces}
        onRenameWorkspace={handleRenameWorkspace}
        onOpenSettingsModal={handleOpenSettingsModal}
        onOpenWorkspaceManagementModal={handleOpenWorkspaceManagementModal}
        onSignOut={onSignOut}
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
      />

      <div className="flex-1 relative scheduler-container min-h-0">
        <SchedulerGrid
          ref={gridRef}
          scrollRef={schedulerRef}
          config={config}
          accessToken={accessToken}
          months={months}
          resources={filteredResources}
          departments={sortedDepartments}
          visibleDepartments={filteredDepartments}
          lastWeeks={lastWeeks}
          currentWeekIndex={getCurrentWeekIndex(workspace.timeline_year)}
          showCurrentWeekMarker={showCurrentWeekMarker}
          onCellClick={handleCellClick}
          onCellMouseMove={handleCellMouseMove}
          onCellMouseLeave={handleCellMouseLeave}
          onCellContextMenu={handleCellContextMenu}
          renderEvents={renderEvents}
          hoverHighlight={hoverHighlight}
          ghost={ghost}
          eventsContainerRef={eventsContainerRef}
          grades={grades}
          companies={companies}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onEditUser={(userId) => {
            setHighlightUserId(userId);
            setManagementModalTab('users');
            setManagementModalOpen(true);
          }}
          onDeleteUser={(userId) => {
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
          }}
          isLoading={isLoadingResources}
          onSidebarCollapsedChange={setSidebarCollapsed}
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
        
        workspaceName={workspace?.name || ''}
        workspaceYear={workspace?.year || new Date().getFullYear()}
        updateWorkspaceName={async (name: string) => {
          console.log('🔧 TODO: Update workspace name:', name);
        }}
        updateWorkspaceYear={async (year: number) => {
          console.log('🔧 TODO: Update workspace year:', year);
        }}
        
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
    </div>
  );
}
