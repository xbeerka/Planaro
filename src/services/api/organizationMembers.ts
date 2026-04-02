import { apiRequest } from './base';

// Unified response item: either a member or an invite
export interface OrgAccessEntry {
  type: 'member' | 'invite';
  user_id?: string;
  invite_id?: number;
  role: 'owner' | 'editor' | 'viewer';
  email: string;
  display_name: string;
  avatar_url: string | null;
  created_at?: string | null;
}

export interface OrgInviteResponse {
  added_members: number;
  created_invites: number;
  pending_emails: string[];
  direct_emails: string[];
}

export interface OrgInfo {
  id: number | string;
  name: string;
  created_by?: string;
}

export const organizationMembersApi = {
  // Get current user's organization info
  getMyOrganization: (token?: string) =>
    apiRequest<OrgInfo>(`/organization`, { token }),

  // Get organization info by ID (any member can view)
  getOrgById: (orgId: string | number, token?: string) =>
    apiRequest<OrgInfo>(`/organizations/${orgId}`, { token }),

  // Get all: owner + members + pending invites
  getMembers: (orgId: string | number, token?: string) =>
    apiRequest<OrgAccessEntry[]>(`/organizations/${orgId}/members`, { token }),

  // Invite by email
  inviteMembers: (orgId: string | number, emails: string[], role: 'editor' | 'viewer', token?: string) =>
    apiRequest<OrgInviteResponse>(`/organizations/${orgId}/members`, {
      method: 'POST',
      body: { emails, role },
      token
    }),

  // Update member role
  updateMemberRole: (orgId: string | number, userId: string, role: 'editor' | 'viewer', token?: string) =>
    apiRequest<{ success: boolean }>(`/organizations/${orgId}/members/${userId}`, {
      method: 'PUT',
      body: { role },
      token
    }),

  // Update invite role
  updateInviteRole: (orgId: string | number, inviteId: number, role: 'editor' | 'viewer', token?: string) =>
    apiRequest<{ success: boolean }>(`/organizations/${orgId}/invites/${inviteId}`, {
      method: 'PUT',
      body: { role },
      token
    }),

  // Remove member
  removeMember: (orgId: string | number, userId: string, token?: string) =>
    apiRequest<{ success: boolean }>(`/organizations/${orgId}/members/${userId}`, {
      method: 'DELETE',
      token
    }),

  // Revoke invite
  revokeInvite: (orgId: string | number, inviteId: number, token?: string) =>
    apiRequest<{ success: boolean }>(`/organizations/${orgId}/invites/${inviteId}`, {
      method: 'DELETE',
      token
    }),

  // Update organization name
  updateName: (orgId: string | number, name: string, token?: string) =>
    apiRequest<{ success: boolean }>(`/organizations/${orgId}`, {
      method: 'PUT',
      body: { name },
      token
    }),
};