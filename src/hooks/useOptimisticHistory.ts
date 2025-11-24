import { useState, useCallback, useRef, useMemo } from 'react';
import { SchedulerEvent, Project } from '../types/scheduler';

const MAX_HISTORY = 50;

interface HistoryState {
  events: SchedulerEvent[];
  projects: Project[];
  timestamp: number;
}

export function useOptimisticHistory(initialEvents: SchedulerEvent[], initialProjects: Project[]) {
  // We use a Ref for the main storage to avoid closure staleness issues completely,
  // but we also need state to trigger re-renders when undo/redo happens.
  const [version, setVersion] = useState(0);
  
  const historyRef = useRef<{
    past: HistoryState[];
    present: HistoryState;
    future: HistoryState[];
  }>({
    past: [],
    present: { 
      events: initialEvents, 
      projects: initialProjects,
      timestamp: Date.now() 
    },
    future: []
  });

  // Force update helper
  const notifyChange = useCallback(() => {
    setVersion(v => v + 1);
  }, []);

  // Initialize/Reset history
  const resetHistory = useCallback((events: SchedulerEvent[], projects: Project[]) => {
    historyRef.current = {
      past: [],
      present: { 
        events: JSON.parse(JSON.stringify(events)), 
        projects: JSON.parse(JSON.stringify(projects)),
        timestamp: Date.now()
      },
      future: []
    };
    notifyChange();
  }, [notifyChange]);

  // Push new state
  const pushState = useCallback((events: SchedulerEvent[], projects: Project[]) => {
    const current = historyRef.current;
    
    // Don't push if state hasn't changed significantly (deep check is expensive, so we rely on caller usually)
    // But we can check lengths to be quick
    if (
      current.present.events === events && 
      current.present.projects === projects
    ) {
      return;
    }

    // Limit history size
    if (current.past.length >= MAX_HISTORY) {
      current.past.shift();
    }

    current.past.push(current.present);
    current.present = {
      events: JSON.parse(JSON.stringify(events)),
      projects: JSON.parse(JSON.stringify(projects)),
      timestamp: Date.now()
    };
    current.future = []; // Clear future on new change
    
    notifyChange();
  }, [notifyChange]);

  // Undo
  const undo = useCallback(() => {
    const current = historyRef.current;
    if (current.past.length === 0) return null;

    const previous = current.past.pop()!;
    current.future.push(current.present);
    current.present = previous;

    notifyChange();
    return { events: previous.events, projects: previous.projects };
  }, [notifyChange]);

  // Redo
  const redo = useCallback(() => {
    const current = historyRef.current;
    if (current.future.length === 0) return null;

    const next = current.future.pop()!;
    current.past.push(current.present);
    current.present = next;

    notifyChange();
    return { events: next.events, projects: next.projects };
  }, [notifyChange]);

  // Update ID deep in history (for when server confirms a temp ID)
  const updateHistoryEventId = useCallback((tempId: string, realId: string) => {
    const replaceIdInList = (list: SchedulerEvent[]) => {
      return list.map(ev => ev.id === tempId ? { ...ev, id: realId } : ev);
    };

    const current = historyRef.current;

    // Update Past
    current.past.forEach(state => {
      state.events = replaceIdInList(state.events);
    });

    // Update Present
    current.present.events = replaceIdInList(current.present.events);

    // Update Future
    current.future.forEach(state => {
      state.events = replaceIdInList(state.events);
    });
    
    // We don't strictly need to trigger a re-render here if it's just ID swapping in background,
    // but it's safer to do so to ensure UI is consistent
    notifyChange();
  }, [notifyChange]);

  return {
    undo,
    redo,
    pushState,
    resetHistory,
    updateHistoryEventId,
    canUndo: historyRef.current.past.length > 0,
    canRedo: historyRef.current.future.length > 0,
    currentEvents: historyRef.current.present.events,
    currentProjects: historyRef.current.present.projects
  };
}
