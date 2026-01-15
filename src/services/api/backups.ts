import { apiRequest } from './base';

export interface Backup {
  id: string; // Filename
  timestamp: number;
  label: string;
  version: number;
  size: number;
}

export interface BackupListResponse {
  backups: Backup[];
}

export interface CreateBackupResponse {
  success: boolean;
  fileName: string;
  count: number;
}

export interface RestoreBackupResponse {
  success: boolean;
  restoredCount: number;
}

export const backupsApi = {
  // Create a new backup (auto-backup)
  create: (workspaceId: string) =>
    apiRequest<CreateBackupResponse>(`/backups/${workspaceId}`, {
      method: 'POST'
    }),

  // List available backups
  list: (workspaceId: string) =>
    apiRequest<BackupListResponse>(`/backups/${workspaceId}`),

  // Restore a specific backup
  restore: (workspaceId: string, fileId: string) =>
    apiRequest<RestoreBackupResponse>(`/backups/${workspaceId}/restore`, {
      method: 'POST',
      body: { fileId }
    })
};
