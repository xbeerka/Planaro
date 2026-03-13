import { apiRequest } from './base';
import { Department, Resource, Project, Grade, Company, EventPattern, SchedulerEvent, Comment } from '../../types/scheduler';

export interface WorkspaceSnapshot {
  departments: Department[];
  resources: Resource[];
  projects: Project[];
  grades: Grade[];
  companies: Company[];
  eventPatterns: EventPattern[];
  events: SchedulerEvent[];
  comments: Comment[];
}

export async function getWorkspaceSnapshot(workspaceId: string, accessToken: string): Promise<WorkspaceSnapshot> {
  return apiRequest<WorkspaceSnapshot>(`/workspaces/${workspaceId}/snapshot`, {
    method: 'GET',
    token: accessToken
  });
}
