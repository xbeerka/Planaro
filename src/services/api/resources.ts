import { Resource } from '../../types/scheduler';
import { apiRequest, apiRequestNoResponse } from './base';

export interface CreateResourceData {
  fullName: string;
  position: string;
  departmentId: string;
  workspace_id?: string;
  grade?: string;  // ✅ Название грейда (фронтенд)
  gradeId?: string;  // ✅ ID грейда (передаём на бэкенд)
  companyId?: string;
  avatarUrl?: string;
  isVisible?: boolean;
}

export interface UpdateResourceData {
  fullName?: string;
  position?: string;
  departmentId?: string;
  grade?: string;  // ✅ Название грейда (фронтенд)
  gradeId?: string;  // ✅ ID грейда (передаём на бэкенд)
  companyId?: string;
  avatarUrl?: string;
  isVisible?: boolean;
}

export const resourcesApi = {
  getAll: (token?: string, workspaceId?: string) => {
    const endpoint = workspaceId ? `/resources?workspace_id=${workspaceId}` : '/resources';
    return apiRequest<Resource[]>(endpoint, { token });
  },
    
  create: (data: CreateResourceData, token?: string) =>
    apiRequest<Resource>('/resources', {
      method: 'POST',
      // Map fullName (frontend) to name (backend)
      body: { ...data, name: data.fullName },
      token
    }),
    
  update: (id: string, data: UpdateResourceData, token?: string) => {
    // Map fullName (frontend) to name (backend) if present
    const payload = { ...data } as any;
    if (data.fullName !== undefined) {
      payload.name = data.fullName;
    }
    
    return apiRequest<Resource>(`/resources/${id}`, {
      method: 'PUT',
      body: payload,
      token
    });
  },
    
  delete: (id: string, token?: string) =>
    apiRequestNoResponse(`/resources/${id}`, {
      method: 'DELETE',
      token
    })
};