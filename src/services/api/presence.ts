/**
 * Presence API — DEPRECATED (KV Store based)
 * 
 * Presence теперь полностью через Supabase Realtime Presence (PresenceContext).
 * Этот файл оставлен для обратной совместимости, но все методы — заглушки.
 * 
 * Реальная presence логика:
 * - /contexts/PresenceContext.tsx — для курсоров и онлайн в конкретном воркспейсе
 * - /hooks/useWorkspacesPresence.ts — для списка воркспейсов (экран выбора)
 */

export interface OnlineUser {
  userId: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  lastSeen: string;
}

export const presenceApi = {
  // All methods are no-ops — presence is handled by Supabase Realtime Presence
  sendHeartbeat: async (_workspaceId: string): Promise<void> => {},
  getOnlineUsers: async (_workspaceId: string): Promise<OnlineUser[]> => [],
  getOnlineUsersBatch: async (_workspaceIds: string[]): Promise<Record<string, OnlineUser[]>> => ({}),
  leaveWorkspace: async (_workspaceId: string): Promise<void> => {},
};
