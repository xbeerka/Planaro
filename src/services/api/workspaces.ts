import { apiRequest, apiRequestNoResponse } from './base';
import { Workspace, WorkspaceSummary } from '../../types/scheduler';

export interface CreateWorkspacePayload {
  name: string;
  timeline_year: number;
  base_workspace_id?: string; // для копирования структуры
}

export interface UpdateWorkspacePayload {
  name?: string;
  timeline_year?: number;
}

// Получить все workspaces текущего пользователя
export async function getWorkspaces(): Promise<Workspace[]> {
  return apiRequest<Workspace[]>('/workspaces', {
    method: 'GET'
  });
}

// Получить один workspace по ID
export async function getWorkspace(id: string): Promise<Workspace> {
  return apiRequest<Workspace>(`/workspaces/${id}`, {
    method: 'GET'
  });
}

// Получить summary для workspace
export async function getWorkspaceSummary(workspaceId: string): Promise<WorkspaceSummary | null> {
  try {
    const summary = await apiRequest<WorkspaceSummary>(`/workspaces/${workspaceId}/summary`, {
      method: 'GET'
    });
    return summary;
  } catch (error) {
    console.warn('Failed to fetch workspace summary:', error);
    return null;
  }
}

// Создать новый workspace
export async function createWorkspace(payload: CreateWorkspacePayload): Promise<Workspace> {
  return apiRequest<Workspace>('/workspaces', {
    method: 'POST',
    body: payload
  });
}

// Обновить workspace
export async function updateWorkspace(id: string, payload: UpdateWorkspacePayload): Promise<Workspace> {
  return apiRequest<Workspace>(`/workspaces/${id}`, {
    method: 'PUT',
    body: payload
  });
}

// Удалить workspace
export async function deleteWorkspace(id: string): Promise<void> {
  return apiRequestNoResponse(`/workspaces/${id}`, {
    method: 'DELETE'
  });
}