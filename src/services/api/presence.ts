import { apiRequest, apiRequestNoResponse } from './base';

export interface OnlineUser {
  userId: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  lastSeen: string;
}

export const presenceApi = {
  // Send heartbeat
  sendHeartbeat: async (workspaceId: string): Promise<void> => {
    return apiRequestNoResponse('/presence/heartbeat', {
      method: 'POST',
      body: { workspace_id: workspaceId },
      retries: 3,
      retryDelay: 1000
    });
  },

  // Get online users for a single workspace
  getOnlineUsers: async (workspaceId: string): Promise<OnlineUser[]> => {
    const response = await apiRequest<{ users: OnlineUser[] }>(`/presence/online/${workspaceId}`, {
      method: 'GET',
      retries: 3,
      retryDelay: 1000
    });
    return response.users || [];
  },

  // Batch get online users
  getOnlineUsersBatch: async (workspaceIds: string[]): Promise<Record<string, OnlineUser[]>> => {
    const response = await apiRequest<{ workspaces: Record<string, OnlineUser[]> } | Record<string, OnlineUser[]>>('/presence/online-batch', {
      method: 'POST',
      body: { workspace_ids: workspaceIds },
      retries: 3,
      retryDelay: 1000
    });
    
    // Handle both response formats (legacy and new)
    if ('workspaces' in response) {
      return response.workspaces;
    }
    return response;
  },
  
  // Leave workspace
  leaveWorkspace: async (workspaceId: string): Promise<void> => {
    return apiRequestNoResponse(`/presence/leave/${workspaceId}`, {
      method: 'DELETE',
      retries: 1, // Try once, if fails it will expire by TTL anyway
      retryDelay: 500
    });
  }
};
