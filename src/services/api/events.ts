import { SchedulerEvent } from '../../types/scheduler';
import { apiRequest, apiRequestNoResponse } from './base';

export const eventsApi = {
  getAll: (token?: string, workspaceId?: string) => {
    const endpoint = workspaceId ? `/events?workspace_id=${workspaceId}` : '/events';
    return apiRequest<SchedulerEvent[]>(endpoint, { token });
  },
  
  // ✨ Get only changed events (delta sync) - БОЛЕЕ ЭФФЕКТИВНО!
  // since: ISO timestamp (например: "2024-11-17T12:00:00Z")
  getChanges: (token: string, workspaceId: string, since?: string) => {
    const endpoint = since 
      ? `/events/changes?workspace_id=${workspaceId}&since=${encodeURIComponent(since)}`
      : `/events/changes?workspace_id=${workspaceId}`;
    return apiRequest<{ events: SchedulerEvent[]; timestamp: string }>(endpoint, { token });
  },
    
  create: (event: Partial<SchedulerEvent>, token?: string) =>
    apiRequest<SchedulerEvent>('/events', {
      method: 'POST',
      body: event,
      token
    }),
  
  // Batch create events (optimized for bulk generation)
  createBatch: (events: Partial<SchedulerEvent>[], token?: string) =>
    apiRequest<{ created: number; events: SchedulerEvent[] }>('/events/batch-create', {
      method: 'POST',
      body: { events },
      token
    }),
    
  update: (id: string, event: Partial<SchedulerEvent>, token?: string) =>
    apiRequest<SchedulerEvent>(`/events/${id}`, {
      method: 'PUT',
      body: event,
      token
    }),
    
  delete: (id: string, token?: string) =>
    apiRequestNoResponse(`/events/${id}`, {
      method: 'DELETE',
      token
    })
};