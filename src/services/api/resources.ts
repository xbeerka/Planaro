import { Resource } from '../../types/scheduler';
import { apiRequest, apiRequestNoResponse } from './base';

export interface CreateResourceData {
  fullName: string;
  position: string;
  departmentId: string;
  workspace_id?: string;
  grade?: string;
  gradeId?: string;
  companyId?: string;
  avatarUrl?: string | null;
  isVisible?: boolean;
  size?: 'S' | 'M' | 'L' | 'XL' | null;
}

export interface UpdateResourceData {
  fullName?: string;
  position?: string;
  departmentId?: string;
  grade?: string;
  gradeId?: string;
  companyId?: string;
  avatarUrl?: string | null;
  isVisible?: boolean;
  size?: 'S' | 'M' | 'L' | 'XL' | null;
}

export const resourcesApi = {
  getAll: (token?: string, workspaceId?: string) => {
    const endpoint = workspaceId ? `/resources?workspace_id=${workspaceId}` : '/resources';
    return apiRequest<Resource[]>(endpoint, { token });
  },
    
  create: (data: CreateResourceData, token?: string, workspaceId?: string) => {
    // Map fullName (frontend) to name (backend)
    const { fullName, grade, ...rest } = data;
    // ✅ FIXED: Map grade → gradeId for backend (server expects gradeId)
    const gradeId = rest.gradeId || grade;
    delete rest.gradeId;
    return apiRequest<Resource>('/resources', {
      method: 'POST',
      body: { ...rest, name: fullName, gradeId, workspace_id: workspaceId || data.workspace_id },
      token
    });
  },
    
  update: (id: string, data: UpdateResourceData, token?: string) => {
    // Map fullName (frontend) to name (backend) if present
    const payload = { ...data } as any;
    if (data.fullName !== undefined) {
      payload.name = data.fullName;
      delete payload.fullName; // ✅ КРИТИЧНО: Удаляем fullName чтобы избежать путаницы
    }
    // ✅ FIXED: Map grade → gradeId for backend (server expects gradeId)
    if (payload.grade !== undefined && payload.gradeId === undefined) {
      payload.gradeId = payload.grade;
    }
    delete payload.grade; // Server doesn't use 'grade', only 'gradeId'
    
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
    }),

  batchCreate: (resources: CreateResourceData[], workspaceId: string, token?: string) =>
    apiRequest<{ success: boolean; created: Resource[] }>('/resources/batch-create', {
      method: 'POST',
      body: {
        resources: resources.map(r => {
          const { fullName, grade, ...rest } = r;
          const gradeId = rest.gradeId || grade;
          delete rest.gradeId;
          return { ...rest, name: fullName, gradeId, workspace_id: workspaceId || r.workspace_id };
        }),
        workspace_id: workspaceId,
      },
      token,
    }),

  batchDelete: (ids: string[], token?: string) =>
    apiRequest<{ success: boolean; deletedCount: number }>('/resources/batch-delete', {
      method: 'POST',
      body: { ids },
      token,
    }),
};