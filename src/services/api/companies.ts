import { Company } from '../../types/scheduler';
import { apiRequest } from './base';

export const companiesApi = {
  getAll: (workspaceId: number, token?: string) =>
    apiRequest<Company[]>(`/companies?workspace_id=${workspaceId}`, { token }),
  
  create: (name: string, workspaceId: number, token?: string) =>
    apiRequest<Company>('/companies', {
      method: 'POST',
      body: { name, workspace_id: workspaceId },
      token
    }),
  
  update: (id: string, name: string, workspaceId: number, token?: string) =>
    apiRequest<Company>(`/companies/${id}`, {
      method: 'PUT',
      body: { name, workspace_id: workspaceId },
      token
    }),
  
  delete: (id: string, token?: string) =>
    apiRequest<void>(`/companies/${id}`, {
      method: 'DELETE',
      token
    }),
  
  updateSortOrder: (updates: Array<{ id: string; sortOrder: number }>, token?: string) =>
    apiRequest<{ success: boolean }>('/companies/sort-order', {
      method: 'PATCH',
      body: { 
        companies: updates.map(u => ({ id: u.id, sort_order: u.sortOrder })) 
      },
      token
    })
};

// Backward compatibility
export async function fetchCompanies(token?: string): Promise<Company[]> {
  // Note: This backward compatibility function will need workspaceId passed
  throw new Error('fetchCompanies deprecated: use companiesApi.getAll(workspaceId, token) instead');
}