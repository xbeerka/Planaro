/**
 * useHistory - Wrapper around useOptimisticHistory for backward compatibility
 * 
 * This hook provides the same API as the old useHistory implementation
 * while using the new useOptimisticHistory under the hood.
 */

import { SchedulerEvent, Project } from '../types/scheduler';
import { useOptimisticHistory } from './useOptimisticHistory';

export function useHistory(
  initialEvents: SchedulerEvent[],
  initialProjects: Project[]
) {
  const {
    undo,
    redo,
    pushState,
    resetHistory: originalResetHistory,
    updateHistoryEventId,
    canUndo,
    canRedo,
    currentEvents,
    currentProjects,
    currentEventZOrder, // ✅ Получаем eventZOrder
  } = useOptimisticHistory(initialEvents, initialProjects);

  // Wrapper for saveHistory to match old API
  // Old API: saveHistory(events, eventZOrder, projects)
  // New API: pushState(events, projects, eventZOrder)
  const saveHistory = (
    events: SchedulerEvent[],
    eventZOrder: Record<string, number> | Map<string, number>,
    projects: Project[]
  ) => {
    // Convert to Map if needed
    const zOrderMap = eventZOrder instanceof Map 
      ? eventZOrder 
      : new Map(Object.entries(eventZOrder).map(([k, v]) => [k, Number(v)]));
    
    pushState(events, projects, zOrderMap); // ✅ Передаём eventZOrder
  };

  // Wrapper for resetHistory to match old API
  // Old API: resetHistory(events, eventZOrder, projects)
  // New API: resetHistory(events, projects, eventZOrder)
  const resetHistory = (
    events: SchedulerEvent[],
    eventZOrder: Record<string, number> | Map<string, number>,
    projects: Project[]
  ) => {
    // Convert to Map if needed
    const zOrderMap = eventZOrder instanceof Map 
      ? eventZOrder 
      : new Map(Object.entries(eventZOrder).map(([k, v]) => [k, Number(v)]));
    
    originalResetHistory(events, projects, zOrderMap); // ✅ Передаём eventZOrder
  };

  // Placeholder for updateHistoryProjectId (not implemented in useOptimisticHistory)
  const updateHistoryProjectId = (tempId: string, realId: string) => {
    // TODO: Implement if needed
    console.warn('updateHistoryProjectId not yet implemented in useOptimisticHistory');
  };

  return {
    saveHistory,
    undo,
    redo,
    canUndo,
    canRedo,
    resetHistory,
    updateHistoryEventId,
    updateHistoryProjectId,
    currentEvents,
    currentProjects,
    currentEventZOrder, // ✅ Экспортируем eventZOrder
  };
}