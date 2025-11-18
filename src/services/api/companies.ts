import { Company } from '../../types/scheduler';
import { apiRequest } from './base';

export async function fetchCompanies(token?: string): Promise<Company[]> {
  return apiRequest<Company[]>('/companies', {
    method: 'GET',
    token
  });
}
