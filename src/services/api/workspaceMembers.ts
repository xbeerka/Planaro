import { apiRequest, apiRequestNoResponse } from './base';

// Unified response item: either a member (fact of access) or an invite (intent)
export interface WorkspaceAccessEntry {
  type: 'member' | 'invite';
  // For members
  user_id?: string;
  // For invites
  invite_id?: number;
  // Common
  role: 'owner' | 'editor' | 'viewer';
  email: string;
  display_name: string;
  avatar_url: string | null;
  created_at?: string | null;
}

export interface InviteResponse {
  added_members: number;
  created_invites: number;
  pending_emails: string[];
  direct_emails: string[];
}

export const workspaceMembersApi = {
  // Get all: owner + members + pending invites
  getMembers: (workspaceId: string | number, token?: string) =>
    apiRequest<WorkspaceAccessEntry[]>(`/workspaces/${workspaceId}/members`, { token }),

  // Invite by email (auto-splits into members vs invites)
  inviteMembers: (workspaceId: string | number, emails: string[], role: 'editor' | 'viewer', token?: string) =>
    apiRequest<InviteResponse>(`/workspaces/${workspaceId}/members`, {
      method: 'POST',
      body: { emails, role },
      token
    }),

  // Update member role (fact of access)
  updateMemberRole: (workspaceId: string | number, userId: string, role: 'editor' | 'viewer', token?: string) =>
    apiRequest<{ success: boolean }>(`/workspaces/${workspaceId}/members/${userId}`, {
      method: 'PUT',
      body: { role },
      token
    }),

  // Update invite role (intent)
  updateInviteRole: (workspaceId: string | number, inviteId: number, role: 'editor' | 'viewer', token?: string) =>
    apiRequest<{ success: boolean }>(`/workspaces/${workspaceId}/invites/${inviteId}`, {
      method: 'PUT',
      body: { role },
      token
    }),

  // Remove member (revoke fact of access)
  removeMember: (workspaceId: string | number, userId: string, token?: string) =>
    apiRequestNoResponse(`/workspaces/${workspaceId}/members/${userId}`, {
      method: 'DELETE',
      token
    }),

  // Revoke invite (cancel intent)
  revokeInvite: (workspaceId: string | number, inviteId: number, token?: string) =>
    apiRequestNoResponse(`/workspaces/${workspaceId}/invites/${inviteId}`, {
      method: 'DELETE',
      token
    }),
};
