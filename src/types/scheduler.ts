export interface Department {
  id: string;
  name: string;
  queue: number;
  visible: boolean;
}

export interface Resource {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  position: string;
  departmentId: string;
  grade?: string;
  companyId?: string;
  avatarUrl?: string; // Avatar URL from Supabase Storage
}

export interface Project {
  id: string;
  name: string;
  backgroundColor?: string;
  textColor?: string;
  patternId?: string;
  workspaceId?: string;
}

export interface EventPattern {
  id: string;
  name: string;
  pattern: string;
}

export interface Grade {
  id: string;
  name: string;
}

export interface Company {
  id: string;
  name: string;
}

export interface Workspace {
  id: string;
  name: string;
  timeline_year: number;
  owner_id?: string;
  company_id?: string;
  created_at: string;
  updated_at?: string;
}

export interface WorkspaceSummary {
  id: string; // В view это поле называется 'id', а не 'workspace_id'
  project_count: number;
  member_count: number;
  department_count: number;
  last_activity_at?: string;
  last_updated?: string;
  updated_at?: string;
  summary_json?: Record<string, any>;
}

export interface SchedulerEvent {
  id: string;
  resourceId: string;
  startWeek: number;
  weeksSpan: number;
  unitStart: number;
  unitsTall: number;
  projectId: string;
  patternId?: string;
  patternName?: string;
  patternValue?: string;
}

export interface Comment {
  id: string;
  resourceId: string;
  week: number;
  text: string;
  createdBy: string; // email пользователя
  createdAt: string;
  updatedAt?: string;
}

// ✨ Промежуток между двумя событиями (для двустороннего resize)
export interface EventGap {
  id: string; // уникальный ID gap
  type: 'vertical' | 'horizontal'; // тип промежутка
  resourceId: string; // ресурс где находится gap
  
  // Для vertical gap (между событиями по вертикали в пределах одной недели)
  week?: number; // неделя где находится gap
  unitBoundary?: number; // граница между событиями (unitStart второго события)
  
  // Для horizontal gap (между событиями по горизонтали в пределах одного unitStart)
  unitStart?: number; // unitStart где находится gap  
  weekBoundary?: number; // граница между событиями (startWeek второго события)
  
  // События-участники
  event1: SchedulerEvent; // верхнее или левое событие
  event2: SchedulerEvent; // нижнее или правое событие
}

export interface Month {
  name: string;
  weeks: number;
}

export interface PointerState {
  type: 'drag' | 'resize';
  id: string;
  pointerId: number;
  el: HTMLElement;
  evData: SchedulerEvent;
  tableRect: DOMRect;
  lastValidModel?: {
    startWeek: number;
    resourceId: string;
    unitStart: number;
    unitsTall: number;
  };
  offsetX?: number;
  offsetY?: number;
  edges?: {
    left?: boolean;
    right?: boolean;
    top?: boolean;
    bottom?: boolean;
  };
  startLeft?: number;
  startTop?: number;
  startWidth?: number;
  startHeight?: number;
  startX?: number;
  startY?: number;
  originalStartWeek?: number;
  originalWeeksSpan?: number;
  originalUnitStart?: number;
  originalUnitsTall?: number;
}

export interface HistoryState {
  events: SchedulerEvent[];
  eventZOrder: Map<string, number>;
}

// ================== BATCH API TYPES ==================

/**
 * Операция для Batch API
 */
export interface BatchOperation {
  op: 'create' | 'update' | 'delete';
  id: string;
  data?: Partial<SchedulerEvent>;
  workspace_id?: string;
}

/**
 * Результат выполнения Batch операции
 */
export interface BatchResult {
  created: SchedulerEvent[];
  updated: SchedulerEvent[];
  deleted: string[];
  errors: Array<{
    op: 'create' | 'update' | 'delete';
    id?: string;
    error: string;
    message?: string;
  }>;
}