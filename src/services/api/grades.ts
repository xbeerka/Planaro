import { Grade } from '../../types/scheduler';
import { apiRequest } from './base';

export const gradesApi = {
  getAll: (token?: string) =>
    apiRequest<Grade[]>('/grades', { token })
};
