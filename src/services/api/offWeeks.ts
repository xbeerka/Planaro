import { apiRequest } from './base';

export interface OffWeek {
  id: number;
  week_number: number;
  workspace_id: number;
}

export const offWeeksApi = {
  async list(workspaceId: string): Promise<OffWeek[]> {
    const data = await apiRequest<{ offWeeks: OffWeek[] }>(`/off-weeks?workspace_id=${workspaceId}`);
    return data.offWeeks;
  },

  async create(workspaceId: string, weekNumber: number): Promise<OffWeek> {
    return apiRequest<OffWeek>('/off-weeks', {
      method: 'POST',
      body: { workspace_id: parseInt(workspaceId), week_number: weekNumber },
    });
  },

  async deleteById(id: number): Promise<void> {
    await apiRequest<{ success: boolean }>(`/off-weeks/${id}`, { method: 'DELETE' });
  },

  async bulkCreate(workspaceId: string, weekNumbers: number[]): Promise<OffWeek[]> {
    return apiRequest<OffWeek[]>('/off-weeks/bulk', {
      method: 'POST',
      body: { workspace_id: parseInt(workspaceId), week_numbers: weekNumbers },
    });
  },

  async bulkDelete(ids: number[]): Promise<void> {
    await apiRequest<{ success: boolean }>('/off-weeks/bulk-delete', {
      method: 'POST',
      body: { ids },
    });
  },
};
