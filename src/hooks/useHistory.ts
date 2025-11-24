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
  } = useOptimisticHistory(initialEvents, initialProjects);

  // Wrapper for saveHistory to match old API
  // Old API: saveHistory(events, eventZOrder, projects)
  // New API: pushState(events, projects)
  const saveHistory = (
    events: SchedulerEvent[],
    eventZOrder: Record<string, number> | Map<string, number>,
    projects: Project[]
  ) => {
    // The new history doesn't track eventZOrder separately,
    // so we just push events and projects
    pushState(events, projects);
  };

  // Wrapper for resetHistory to match old API
  // Old API: resetHistory(events, eventZOrder, projects)
  // New API: resetHistory(events, projects)
  const resetHistory = (
    events: SchedulerEvent[],
    eventZOrder: Record<string, number> | Map<string, number>,
    projects: Project[]
  ) => {
    // The new history doesn't track eventZOrder separately,
    // so we just reset with events and projects
    originalResetHistory(events, projects);
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
  };
}