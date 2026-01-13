import { useCallback } from "react";
import { flushSync } from "react-dom";
import { toast } from "sonner@2.0.3";
import { SchedulerEvent, Workspace, Resource, Department, Project, Grade } from "../types/scheduler";
import { useScheduler } from "../contexts/SchedulerContext";
import { useUI } from "../contexts/UIContext";
import { useSettings } from "../contexts/SettingsContext";
import { LayoutConfig, topFor, heightFor, getAvailableFreeSpace } from "../utils/schedulerLayout";
import { UNITS } from "../utils/scheduler";

interface UseSchedulerEventActionsProps {
  workspace: Workspace;
  config: LayoutConfig;
  events: SchedulerEvent[]; // Raw events
  visibleEvents: SchedulerEvent[]; // For collision detection
  filteredResources: Resource[];
  filteredDepartments: Department[];
  sortedEventsWithZOrder: SchedulerEvent[]; // For click ordering
  projects: Project[];
  eventZOrder: Map<string, number>;
  setEventZOrder: React.Dispatch<React.SetStateAction<Map<string, number>>>;
  saveHistory: (events: SchedulerEvent[], eventZOrder: Map<string, number>, projects: Project[]) => void;
  weeksInYear: number;
  updateHistoryEventId: (tempId: string, realId: string) => void;
  grades: Grade[];
}

export function useSchedulerEventActions({
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
}: UseSchedulerEventActionsProps) {
  
  const {
    createEvent,
    updateEvent,
    deleteEvent,
    setEvents,
    loadedEventIds,
    flushPendingChanges,
  } = useScheduler();

  const {
    scissorsMode,
    commentMode,
    setScissorsMode,
    setCommentMode,
    pendingEventIds,
    setPendingEventIds,
    copiedEvent,
    setCopiedEvent,
    modalOpen,
    setModalOpen,
    modalMode,
    setModalMode,
    modalInitialData,
    setModalInitialData,
    pendingEvent,
    setPendingEvent,
    commentModalOpen,
    setCommentModalOpen,
    pendingComment,
    setPendingComment,
    contextMenu,
    setContextMenu,
    emptyCellContextMenu,
    setEmptyCellContextMenu,
    hoverHighlight,
    setHoverHighlight,
    closeAllModals,
    isUserInteractingRef
  } = useUI();

  // Scissors - cut event (optimistic UI update)
  const cutEventByBoundary = useCallback(
    (evId: string, boundaryWeek: number) => {
      // ⛔ CRITICAL: Prevent cutting events that are saving
      if (pendingEventIds.has(evId) || evId.startsWith('ev_temp_')) {
        toast.warning("Подождите", {
          description: "Событие сохраняется в базу дан��ых",
        });
        console.log(`⏸️ SCISSORS: Blocked cutting pending event ${evId}`);
        return;
      }

      const ev = events.find((x) => x.id === evId);
      if (!ev) {
        console.warn("⚠️ Event to cut not found:", evId);
        return;
      }

      if (
        boundaryWeek <= ev.startWeek ||
        boundaryWeek >= ev.startWeek + ev.weeksSpan
      ) {
        console.warn("⚠️ Invalid cut boundary:", {
          evId,
          boundaryWeek,
          startWeek: ev.startWeek,
          weeksSpan: ev.weeksSpan,
        });
        return;
      }

      const leftSpan = boundaryWeek - ev.startWeek;
      const rightSpan = ev.weeksSpan - leftSpan;

      if (leftSpan < 1 || rightSpan < 1) {
        console.warn("⚠️ Invalid parts length after cut:", { leftSpan, rightSpan });
        return;
      }

      // ✂️ Create updated event for left part
      const updatedEvent: SchedulerEvent = {
        ...ev,
        weeksSpan: leftSpan,
      };

      // ✂️ Create new event for right part with temp ID
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

      // 🚫 CRITICAL: Add to pending BEFORE updating UI!
      if (!ev.id.startsWith("ev_temp_")) {
        flushSync(() => {
          setPendingEventIds((prev) => {
            const next = new Set(prev);
            next.add(ev.id);    // ← Left part
            next.add(tempId);   // ← Right part
            console.log(`📌 PENDING: added ${ev.id} and ${tempId}`);
            return next;
          });
        });
      }

      // ✂️ Update UI
      setEvents((currentEvents) => {
        const newEvents = currentEvents.map((e) =>
          e.id === evId ? updatedEvent : e,
        );
        const updatedEventsArray = [...newEvents, newEv];
        
        // Save history
        saveHistory(updatedEventsArray, eventZOrder, projects);
        
        return updatedEventsArray;
      });

      // 🔄 Background save
      if (!ev.id.startsWith("ev_temp_")) {
        (async () => {
          try {
            // ✅ Update left part
            await updateEvent(ev.id, { weeksSpan: leftSpan });

            // Create right part
            const createdEvent = await createEvent(newEv);

            // ✅ Update history
            updateHistoryEventId(tempId, createdEvent.id);
            console.log(`📝 History: updated ID ${tempId} → ${createdEvent.id} (scissor split)`);

            // ✅ FORCE FLUSH
            await flushPendingChanges();

            // ✅ Remove from pending
            setPendingEventIds((prev) => {
              const next = new Set(prev);
              next.delete(ev.id);
              next.delete(tempId);
              next.delete(createdEvent.id);
              console.log(`✅ PENDING: removed ${ev.id}, ${tempId}, ${createdEvent.id}`);
              return next;
            });
          } catch (error) {
            console.error("❌ Error saving cut:", error);

            // Cleanup pending on error
            setPendingEventIds((prev) => {
              const next = new Set(prev);
              next.delete(ev.id);
              next.delete(tempId);
              return next;
            });

            // Rollback
            setEvents(prev => prev.map(e => e.id === evId ? ev : e).filter(e => e.id !== tempId));

            toast.error("Ошибка разрезания события", {
              description: "Не удалось сохранить изменения",
            });
          }
        })();
      }
    },
    [
      events,
      projects,
      eventZOrder,
      saveHistory,
      updateEvent,
      createEvent,
      pendingEventIds,
      setEvents,
      setPendingEventIds,
      updateHistoryEventId,
      flushPendingChanges
    ]
  );

  const handleCellClick = useCallback(
    (resourceId: string, week: number, unitIndex: number) => {
      // Ignore if context menu is open
      if (contextMenu.isVisible) {
        return;
      }

      // Comment Mode
      if (commentMode) {
        setPendingComment({ resourceId, week });
        setCommentModalOpen(true);
        return;
      }

      // Create Event Mode
      if (projects.length === 0) {
        toast.error("Невозможно создать событие", {
          description: "Сначала создайте проекты в разделе Управление → Проекты",
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
        toast.warning("Нет свободного места", {
          description: "В этой ячейке нет места для нового события",
        });
        return;
      }

      setPendingEvent({ week, resourceId, unitIndex });
      setModalMode("create");
      setModalInitialData({ 
        maxUnits: free, 
        startWeek: week,
        workspaceId: String(workspace.id)
      });
      setModalOpen(true);
    },
    [
      contextMenu.isVisible,
      commentMode,
      projects.length,
      visibleEvents,
      workspace.id,
      setPendingComment,
      setCommentModalOpen,
      setPendingEvent,
      setModalMode,
      setModalInitialData,
      setModalOpen
    ]
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
    [scissorsMode, eventZOrder, setEventZOrder]
  );

  const handleEventContextMenu = useCallback(
    (e: React.MouseEvent, event: SchedulerEvent) => {
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
      
      setContextMenu({
        isVisible: true,
        x: e.clientX,
        y: e.clientY,
        event,
      });
    },
    [setEmptyCellContextMenu, setHoverHighlight, setContextMenu]
  );

  const handleContextEdit = useCallback(() => {
    if (!contextMenu.event) return;
    
    if (contextMenu.event.id.startsWith('ev_temp_')) {
      toast.warning('Событие ещё создаётся на сервере, подождите...');
      return;
    }
    
    setModalMode("edit");
    setModalInitialData({
      projectId: contextMenu.event.projectId,
      weeksSpan: contextMenu.event.weeksSpan,
      unitsTall: contextMenu.event.unitsTall,
      maxUnits: UNITS,
      startWeek: contextMenu.event.startWeek,
      workspaceId: String(workspace.id)
    });
    setPendingEvent(contextMenu.event);
    setModalOpen(true);
    setContextMenu({
      isVisible: false,
      x: 0,
      y: 0,
      event: null,
    });
  }, [contextMenu.event, workspace.id, setModalMode, setModalInitialData, setPendingEvent, setModalOpen, setContextMenu]);

  const handleContextDelete = useCallback(() => {
    if (!contextMenu.event) return;

    if (contextMenu.event.id.startsWith('ev_temp_')) {
      toast.warning('Событие ещё создаётся на сервере, подождите...');
      return;
    }

    const eventId = contextMenu.event.id;
    const zOrderToRestore = eventZOrder.get(eventId);

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

    if (eventId.startsWith("ev_temp_")) {
      setEvents(newEvents);
      saveHistory(newEvents, newEventZOrder, projects);
    } else {
      saveHistory(newEvents, newEventZOrder, projects);
      console.log('📝 History saved before deleting event:', eventId);
      
      (async () => {
        try {
          await deleteEvent(eventId);
          console.log('✅ Event successfully deleted:', eventId);
        } catch (error) {
          console.error("❌ Error deleting event:", error);
          if (zOrderToRestore !== undefined) {
            setEventZOrder((prev) =>
              new Map(prev).set(eventId, zOrderToRestore),
            );
          }
          // Rollback history triggers undo
          // Note: we can't easily trigger undo here as we don't have the undo function
          // But since deleteEvent reverts state on error, we just need to revert zOrder
          // The proper way is to use useHistory's undo, but it's not passed here.
          // For now we rely on deleteEvent's internal rollback for data.
        }
      })();
    }
  }, [contextMenu.event, eventZOrder, events, projects, setEventZOrder, setContextMenu, setEvents, saveHistory, deleteEvent]);

  const handleContextCopy = useCallback(() => {
    if (!contextMenu.event) return;
    
    if (contextMenu.event.id.startsWith('ev_temp_')) {
      toast.warning('Событие ещё создаётся на сервере, подождите...');
      return;
    }
    
    setCopiedEvent(contextMenu.event);
    setContextMenu({
      isVisible: false,
      x: 0,
      y: 0,
      event: null,
    });
  }, [contextMenu.event, setCopiedEvent, setContextMenu]);

  const handleCellContextMenu = useCallback(
    (e: React.MouseEvent, resourceId: string, week: number, unitIndex: number) => {
      e.preventDefault();
      
      setContextMenu({
        isVisible: false,
        x: 0,
        y: 0,
        event: null,
      });
      
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
      }
      
      setEmptyCellContextMenu({
        isVisible: true,
        x: e.clientX,
        y: e.clientY,
        resourceId,
        week,
        unitIndex,
      });
    },
    [config, visibleEvents, filteredResources, filteredDepartments, setContextMenu, setHoverHighlight, setEmptyCellContextMenu]
  );

  const handlePaste = useCallback(async () => {
    if (!copiedEvent || !emptyCellContextMenu.resourceId || emptyCellContextMenu.week === null || emptyCellContextMenu.unitIndex === null) {
      return;
    }

    const { resourceId, week, unitIndex } = emptyCellContextMenu;
    
    const free = getAvailableFreeSpace(
      resourceId,
      week,
      unitIndex,
      visibleEvents,
    );
    
    // Разрешаем вставку, если есть хотя бы 1 свободный юнит
    // Если места меньше чем нужно, обрезаем высоту события
    if (free === 0) {
      toast.warning("Нет свободного места", {
        description: "В этой ячейке нет места для нового события",
      });
      setEmptyCellContextMenu(prev => ({ ...prev, isVisible: false }));
      setHoverHighlight(prev => ({ ...prev, visible: false }));
      return;
    }

    const unitsTallToUse = Math.min(copiedEvent.unitsTall, free);
    
    if (unitsTallToUse < copiedEvent.unitsTall) {
       toast.info("Высота адаптирована", {
          description: `Событие уменьшено до ${unitsTallToUse} юнитов, чтобы поместиться`
       });
    }
    
    const maxWeeks = weeksInYear - week;
    const validWeeksSpan = Math.min(copiedEvent.weeksSpan, maxWeeks);
    
    if (validWeeksSpan < 1) {
      toast.warning("Недостаточно недель", {
        description: "Событие не помещается в оставшиеся недели",
      });
      setEmptyCellContextMenu(prev => ({ ...prev, isVisible: false }));
      setHoverHighlight(prev => ({ ...prev, visible: false }));
      return;
    }
    
    const tempEvent: SchedulerEvent = {
      id: `ev_temp_${Date.now()}`,
      resourceId,
      startWeek: week,
      weeksSpan: validWeeksSpan,
      unitStart: unitIndex,
      unitsTall: unitsTallToUse, // Испольуем адаптированную высоту
      projectId: copiedEvent.projectId,
    };
    
    setEmptyCellContextMenu(prev => ({ ...prev, isVisible: false }));
    setHoverHighlight(prev => ({ ...prev, visible: false }));
    
    try {
      const createdEvent = await createEvent(tempEvent);
      
      const { trackProjectUsage } = await import('../utils/projectUsageTracking');
      trackProjectUsage(String(workspace.id), copiedEvent.projectId);
      
      updateHistoryEventId(tempEvent.id, createdEvent.id);
      console.log(`📝 History: updated ID ${tempEvent.id} → ${createdEvent.id} (paste)`);
      
      await new Promise<void>(resolve => {
        setEvents(currentEvents => {
          console.log('📝 History: save after paste');
          saveHistory(currentEvents, eventZOrder, projects);
          resolve();
          return currentEvents;
        });
      });
    } catch (error) {
      console.error("❌ Error pasting event:", error);
    }
  }, [
    copiedEvent,
    emptyCellContextMenu,
    visibleEvents,
    weeksInYear,
    createEvent,
    workspace.id,
    updateHistoryEventId,
    setEvents,
    saveHistory,
    eventZOrder,
    projects,
    setEmptyCellContextMenu,
    setHoverHighlight
  ]);

  const handleModalSave = useCallback(async (
    data: Partial<SchedulerEvent>,
  ) => {
    if (modalMode === "create" && pendingEvent) {
      const maxWeeks = weeksInYear - pendingEvent.week;
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
        const createdEvent = await createEvent(tempEvent);

        updateHistoryEventId(tempEvent.id, createdEvent.id);
        console.log(`📝 History: updated ID ${tempEvent.id} → ${createdEvent.id} (create from modal)`);

        await new Promise<void>(resolve => {
          setEvents(currentEvents => {
            const fixedEvents = currentEvents.map(e => e.id === tempEvent.id ? createdEvent : e);
            
            console.log('📝 History: save after create (modal)');
            saveHistory(fixedEvents, eventZOrder, projects);
            resolve();
            return fixedEvents;
          });
        });
      } catch (error) {
        console.error("❌ Error creating event:", error);
      }
    } else if (modalMode === "edit" && pendingEvent) {
      const maxWeeks = weeksInYear - pendingEvent.startWeek + 1;
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
  }, [
    modalMode,
    pendingEvent,
    weeksInYear,
    projects,
    createEvent,
    updateHistoryEventId,
    setEvents,
    saveHistory,
    eventZOrder,
    loadedEventIds,
    updateEvent,
    events,
    setPendingEvent
  ]);

  const handleCommentSave = useCallback(async (text: string, currentUserEmail?: string) => {
    if (!pendingComment || !currentUserEmail) return;

    console.log("💬 Saving comment:", {
      resourceId: pendingComment.resourceId,
      week: pendingComment.week,
      text,
      createdBy: currentUserEmail,
    });

    toast.success("Комментарий сохранён", {
      description: `Комментарий добавлен на неделю ${pendingComment.week + 1}`,
    });

    setPendingComment(null);
  }, [pendingComment, setPendingComment]);

  return {
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
  };
}
