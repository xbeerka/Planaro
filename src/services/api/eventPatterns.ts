import { EventPattern } from '../../types/scheduler';
import { apiRequest } from './base';

export const eventPatternsApi = {
  getAll: (token?: string) =>
    apiRequest<EventPattern[]>('/event-patterns', { token })
};
