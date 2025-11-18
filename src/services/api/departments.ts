import { Department } from '../../types/scheduler';
import { apiRequest, apiRequestNoResponse } from './base';

export interface UpdateDepartmentData {
  name?: string;
  visible?: boolean;
  queue?: number;
}

export interface UpdateDepartmentQueueData {
  departments: Array<{
    id: string;
    queue: number;
  }>;
}

export interface CreateDepartmentData {
  name: string;
  workspace_id: string;
}

export const departmentsApi = {
  getAll: (token?: string, workspaceId?: string) => {
    const endpoint = workspaceId ? `/departments?workspace_id=${workspaceId}` : '/departments';
    return apiRequest<Department[]>(endpoint, { token });
  },
  
  getUsersCount: (id: string, token?: string) =>
    apiRequest<{ count: number }>(`/departments/${id}/users-count`, { token }),
  
  create: (data: CreateDepartmentData, token?: string) =>
    apiRequest<Department>('/departments', {
      method: 'POST',
      body: data,
      token
    }),
  
  delete: (id: string, token?: string) =>
    apiRequestNoResponse(`/departments/${id}`, {
      method: 'DELETE',
      token
    }),
    
  update: (id: string, data: UpdateDepartmentData, token?: string) =>
    apiRequest<Department>(`/departments/${id}`, {
      method: 'PUT',
      body: data,
      token
    }),
    
  updateQueue: (data: UpdateDepartmentQueueData, token?: string) =>
    apiRequestNoResponse('/departments/queue', {
      method: 'PUT',
      body: data,
      token
    })
};
