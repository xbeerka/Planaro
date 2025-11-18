import { Project } from '../../types/scheduler';
import { apiRequest, apiRequestNoResponse } from './base';

export interface CreateProjectData {
  name: string;
  backgroundColor?: string;
  pattern?: string;
  textColor?: string;
  patternId?: string;
  workspace_id?: string;
}

export interface UpdateProjectData {
  name?: string;
  backgroundColor?: string;
  patternId?: string;
  textColor?: string;
}

export const projectsApi = {
  getAll: (token?: string, workspaceId?: string) => {
    const endpoint = workspaceId ? `/projects?workspace_id=${workspaceId}` : '/projects';
    return apiRequest<Project[]>(endpoint, { token });
  },
    
  create: (data: CreateProjectData, token?: string) =>
    apiRequest<Project>('/projects', {
      method: 'POST',
      body: data,
      token
    }),
    
  update: (id: string, data: UpdateProjectData, token?: string) =>
    apiRequest<Project>(`/projects/${id}`, {
      method: 'PUT',
      body: data,
      token
    }),
    
  delete: (id: string, token?: string) =>
    apiRequestNoResponse(`/projects/${id}`, {
      method: 'DELETE',
      token
    })
};
