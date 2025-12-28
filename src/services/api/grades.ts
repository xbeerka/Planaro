import { Grade } from '../../types/scheduler';
import { apiRequest } from './base';

export const gradesApi = {
  getAll: (workspaceId: number, token?: string) =>
    apiRequest<Grade[]>(`/grades?workspace_id=${workspaceId}`, { token }),
  
  create: (name: string, workspaceId: number, token?: string) =>
    apiRequest<Grade>('/grades', {
      method: 'POST',
      body: { name, workspace_id: workspaceId },
      token
    }),
  
  update: (id: string, name: string, workspaceId: number, token?: string) =>
    apiRequest<Grade>(`/grades/${id}`, {
      method: 'PUT',
      body: { name, workspace_id: workspaceId },
      token
    }),
  
  delete: (id: string, token?: string) =>
    apiRequest<void>(`/grades/${id}`, {
      method: 'DELETE',
      token
    }),
  
  updateSortOrder: (updates: Array<{ id: string; sortOrder: number }>, token?: string) =>
    apiRequest<{ success: boolean }>('/grades/sort-order', {
      method: 'PATCH',
      body: { updates },
      token
    })
};