export interface Department {
  id: string;
  name: string;
  queue: number;
  visible: boolean;
  color?: string | null;
  usersCount?: number; // TODO: rename to resourcesCount
  last_activity_at?: string;
}

export interface Resource {
  id: string;
  fullName: string;
  position: string;
  departmentId: string;
  grade?: string;  // Grade name (for display)
  gradeId?: string;  // Grade ID (for backend)
  companyId?: string;
  avatarUrl?: string | null;
  isVisible?: boolean;
  size?: 'S' | 'M' | 'L' | 'XL' | null;
  sortOrder?: number;
  authUserId?: string | null; // FK -> auth.users(id)
}

// Alias for backward compatibility
export type SchedulerResource = Resource;

export interface Project {
  id: string;
  name: string;
  workspaceId: string;
  backgroundColor: string;
  textColor: string;
  patternId?: string;
}

export interface SchedulerEvent {
  id: string;
  resourceId: string;
  projectId: string;
  startWeek: number;
  weeksSpan: number;
  unitStart: number;
  unitsTall: number;
  patternId?: string;
}

export interface Comment {
  id: string;
  workspaceId: string;
  resourceId: string;
  authorAuthUserId?: string | null;
  authorAvatarUrl?: string;
  comment: string;
  weekDate: string;
  weekIndex: number;
  createdAt: string;
  updatedAt?: string;
  // Deprecated — use resourceId
  userId?: string;
  userDisplayName?: string;
}

export interface Grade {
  id: number | string;
  name: string;
  workspace_id?: number;
  sort_order: number;
}

export interface Company {
  id: number | string;
  name: string;
  workspace_id?: number;
}

export interface EventPattern {
  id: string;
  name: string;
  pattern: string;
}

export interface Workspace {
  id: number | string;
  name: string;
  timeline_year: number;
  created_by?: string;
  created_at?: string;
  organization_id?: number;
  sort_order?: number;
  // Runtime metadata from backend
  _source?: 'organization' | 'owned' | 'shared';
  _ws_role?: 'owner' | 'editor' | 'viewer';
  _org_role?: 'owner' | 'admin' | 'member';
  _is_creator?: boolean;
  _org_id?: number;
  _org_name?: string;
  _shared_count?: number;
}

export interface WorkspaceSummary {
  id: number | string;
  workspace_id: number | string;
  departments_count?: number;
  department_count?: number;
  resources_count?: number;
  member_count?: number;
  visible_count?: number;
  hidden_count?: number;
  project_count?: number;
  projects_count?: number;
  last_activity_at?: string;
  last_updated?: string;
}

export interface Organization {
  id: number | string;
  name: string;
  slug?: string;
  created_by?: string;
  created_at?: string;
}

export interface OrganizationMember {
  id: number | string;
  organization_id: number | string;
  user_id: string; // auth user id
  role: 'owner' | 'admin' | 'member';
  created_at?: string;
}

export interface Profile {
  id: string; // auth user id
  email: string;
  display_name: string;
  avatar_url?: string | null;
  updated_at?: string;
}

export interface WorkspaceMember {
  id: number | string;
  workspace_id: number | string;
  user_id: string; // auth user id
  role: 'owner' | 'editor' | 'viewer';
  created_at?: string;
}

export interface WorkspaceInvite {
  id: number | string;
  workspace_id: number | string;
  email: string;
  role: 'editor' | 'viewer';
  invited_by: string; // auth user id
  token: string;
  accepted_at?: string | null;
  created_at?: string;
}

export interface OrganizationInvite {
  id: number | string;
  organization_id: number | string;
  email: string;
  role: 'owner' | 'admin' | 'member';
  invited_by: string;
  token: string;
  accepted_at?: string | null;
  created_at?: string;
}

export interface Month {
  name: string;
  weeks: number;
}

export interface BatchOperation {
  op: 'create' | 'update' | 'delete';
  id: string;
  data?: any;
  workspace_id?: string;
}

export interface BatchResult {
  created: SchedulerEvent[];
  updated: SchedulerEvent[];
  deleted: string[];
  errors?: Array<{ id: string; error: string }>;
}

export interface EventGap {
  type: 'vertical' | 'horizontal';
  event1Id: string;
  event2Id: string;
  resourceId: string;
  // Position of the gap boundary
  weekIndex?: number;     // For horizontal gaps
  unitIndex?: number;     // For vertical gaps
  // Events data for reference
  event1: SchedulerEvent;
  event2: SchedulerEvent;
}