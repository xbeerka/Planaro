import { Resource } from '../../types/scheduler';
import { apiRequest, apiRequestNoResponse } from './base';

export interface CreateResourceData {
  fullName: string;
  position: string;
  departmentId: string;
  workspace_id?: string;
  grade?: string;
  companyId?: string;
  avatarUrl?: string;
}

export interface UpdateResourceData {
  fullName?: string;
  position?: string;
  departmentId?: string;
  grade?: string;
  companyId?: string;
  avatarUrl?: string;
}

export const resourcesApi = {
  getAll: (token?: string, workspaceId?: string) => {
    const endpoint = workspaceId ? `/resources?workspace_id=${workspaceId}` : '/resources';
    return apiRequest<Resource[]>(endpoint, { token });
  },
    
  create: (data: CreateResourceData, token?: string) =>
    apiRequest<Resource>('/resources', {
      method: 'POST',
      body: data,
      token
    }),
    
  update: (id: string, data: UpdateResourceData, token?: string) =>
    apiRequest<Resource>(`/resources/${id}`, {
      method: 'PUT',
      body: data,
      token
    }),
    
  delete: (id: string, token?: string) =>
    apiRequestNoResponse(`/resources/${id}`, {
      method: 'DELETE',
      token
    })
};
