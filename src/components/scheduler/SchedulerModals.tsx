import React from "react";
import { SimpleEventModal } from "./SimpleEventModal";
import { CommentModal } from "./CommentModal";
import { UnifiedManagementModal, TabType } from "./UnifiedManagementModal";
import { KeyboardShortcutsModal } from "./KeyboardShortcutsModal";
import { SettingsModal } from "./SettingsModal";
import { ProfileModal } from "../auth/ProfileModal";
import { WorkspaceSettingsModal } from "../workspace/WorkspaceSettingsModal";
import { SchedulerEvent, Project, SchedulerResource, Department, Company, Grade, EventPattern, Workspace } from "../../types/scheduler";

interface SchedulerModalsProps {
  // Event Modal
  modalOpen: boolean;
  setModalOpen: (open: boolean) => void;
  modalMode: "create" | "edit";
  modalInitialData: any;
  pendingEvent: any;
  setPendingEvent: (event: any) => void;
  handleModalSave: (data: Partial<SchedulerEvent>) => Promise<void>;
  projects: Project[];
  resources: SchedulerResource[];
  events: SchedulerEvent[]; // Added for projects modal
  
  // Comment Modal
  commentModalOpen: boolean;
  setCommentModalOpen: (open: boolean) => void;
  setPendingComment: (comment: any) => void;
  handleCommentSave: (text: string) => Promise<void>;

  // Unified Management Modal (replaces 3 separate modals)
  managementModalOpen: boolean;
  setManagementModalOpen: (open: boolean) => void;
  managementModalTab?: TabType; // Optional: which tab to open by default
  
  // Users props
  departments: Department[];
  companies: Company[];
  grades: Grade[];
  createResource: (resource: Omit<SchedulerResource, "id">) => Promise<SchedulerResource>;
  updateResource: (id: string, data: Partial<SchedulerResource>) => Promise<void>;
  deleteResource: (id: string) => Promise<void>;
  uploadUserAvatar: (userId: string, file: File) => Promise<string>;
  highlightUserId?: string;

  // Projects props
  eventPatterns: EventPattern[];
  createProject: (project: Omit<Project, "id">) => Promise<Project>;
  updateProject: (id: string, data: Partial<Project>) => Promise<void>;
  handleDeleteProject: (id: string) => Promise<void>;
  resetHistory?: () => void;

  // Departments props
  createDepartment: (department: Omit<Department, "id">) => Promise<Department>;
  deleteDepartment: (id: string) => Promise<void>;
  getDepartmentUsersCount: (departmentId: string) => number;
  renameDepartment: (id: string, name: string) => Promise<void>;
  reorderDepartments: (newOrder: Department[]) => Promise<void>;
  toggleDepartmentVisibility: (id: string) => void;
  
  // Shortcuts Modal
  shortcutsModalOpen: boolean;
  setShortcutsModalOpen: (open: boolean) => void;

  // Profile Modal
  profileModalOpen: boolean;
  setProfileModalOpen: (open: boolean) => void;
  currentUserEmail?: string;
  currentUserDisplayName?: string;
  currentUserAvatarUrl?: string;
  accessToken: string | null;
  onTokenRefresh: (newToken: string) => Promise<void>;

  // Settings Modal
  settingsModalOpen: boolean;
  setSettingsModalOpen: (open: boolean) => void;
}

export const SchedulerModals = React.memo<SchedulerModalsProps>((props) => {
  const {
    modalOpen,
    setModalOpen,
    modalMode,
    modalInitialData,
    pendingEvent,
    setPendingEvent,
    handleModalSave,
    projects,
    resources,
    events,
    commentModalOpen,
    setCommentModalOpen,
    setPendingComment,
    handleCommentSave,
    
    // Unified Management Modal
    managementModalOpen,
    setManagementModalOpen,
    managementModalTab = 'users',
    
    // Users
    departments,
    companies,
    grades,
    createResource,
    updateResource,
    deleteResource,
    uploadUserAvatar,
    highlightUserId,
    
    // Projects
    eventPatterns,
    createProject,
    updateProject,
    handleDeleteProject,
    resetHistory,
    
    // Departments
    createDepartment,
    deleteDepartment,
    getDepartmentUsersCount,
    renameDepartment,
    reorderDepartments,
    toggleDepartmentVisibility,
    
    // Other modals
    shortcutsModalOpen,
    setShortcutsModalOpen,
    profileModalOpen,
    setProfileModalOpen,
    currentUserEmail,
    currentUserDisplayName,
    currentUserAvatarUrl,
    accessToken,
    onTokenRefresh,
    settingsModalOpen,
    setSettingsModalOpen,
  } = props;

  return (
    <>
      <SimpleEventModal
        isOpen={modalOpen}
        mode={modalMode}
        initialData={modalInitialData}
        onClose={() => {
          setModalOpen(false);
          setPendingEvent(null);
        }}
        onSave={handleModalSave}
        projects={projects}
        resources={resources}
        pendingResource={
          pendingEvent
            ? resources.find((r) => r.id === pendingEvent.resourceId)
            : undefined
        }
      />

      <CommentModal
        isOpen={commentModalOpen}
        onClose={() => {
          setCommentModalOpen(false);
          setPendingComment(null);
        }}
        onSave={handleCommentSave}
      />

      <UnifiedManagementModal
        isOpen={managementModalOpen}
        onClose={() => setManagementModalOpen(false)}
        defaultTab={managementModalTab}
        
        // Users props
        resources={resources}
        departments={departments}
        grades={grades}
        companies={companies}
        onUpdateUser={updateResource}
        onCreateUser={createResource}
        onDeleteUser={deleteResource}
        onUploadUserAvatar={uploadUserAvatar}
        highlightedUserId={highlightUserId}
        
        // Departments props
        onRenameDepartment={renameDepartment}
        onReorderDepartments={reorderDepartments}
        onToggleDepartmentVisibility={toggleDepartmentVisibility}
        onCreateDepartment={createDepartment}
        onDeleteDepartment={deleteDepartment}
        onGetDepartmentUsersCount={async (deptId) => getDepartmentUsersCount(deptId)}
        
        // Projects props
        projects={projects}
        events={events}
        eventPatterns={eventPatterns}
        onCreateProject={createProject}
        onUpdateProject={updateProject}
        onDeleteProject={handleDeleteProject}
        onResetHistory={resetHistory}
      />

      <KeyboardShortcutsModal
        isOpen={shortcutsModalOpen}
        onClose={() => setShortcutsModalOpen(false)}
      />

      <ProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        currentEmail={currentUserEmail}
        currentDisplayName={currentUserDisplayName}
        currentAvatarUrl={currentUserAvatarUrl}
        accessToken={accessToken}
        onTokenRefresh={onTokenRefresh}
        onProfileUpdated={() => {
          console.log('Profile updated');
        }}
      />

      <SettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
      />
    </>
  );
});

SchedulerModals.displayName = 'SchedulerModals';