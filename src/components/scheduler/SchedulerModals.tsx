import React from "react";
import { SimpleEventModal } from "./SimpleEventModal";
import { CommentModal } from "./CommentModal";
import { UsersManagementModal } from "./UsersManagementModal";
import { ProjectsManagementModal } from "./ProjectsManagementModal";
import { DepartmentsManagementModal } from "./DepartmentsManagementModal";
import { KeyboardShortcutsModal } from "./KeyboardShortcutsModal";
import { SettingsModal } from "./SettingsModal";
import { ProfileModal } from "../auth/ProfileModal";
import { SchedulerEvent, Project, SchedulerResource, Department, Company, Grade, EventPattern } from "../../types/scheduler";

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
  
  // Comment Modal
  commentModalOpen: boolean;
  setCommentModalOpen: (open: boolean) => void;
  setPendingComment: (comment: any) => void;
  handleCommentSave: (text: string) => Promise<void>;

  // Users Modal
  usersModalOpen: boolean;
  setUsersModalOpen: (open: boolean) => void;
  departments: Department[];
  companies: Company[];
  grades: Grade[];
  createResource: (resource: Omit<SchedulerResource, "id">) => Promise<SchedulerResource>;
  updateResource: (id: string, data: Partial<SchedulerResource>) => Promise<void>;
  deleteResource: (id: string) => Promise<void>;
  getGradeName: (id: string) => string;

  // Projects Modal
  projectsModalOpen: boolean;
  setProjectsModalOpen: (open: boolean) => void;
  eventPatterns: EventPattern[];
  createProject: (project: Omit<Project, "id">) => Promise<Project>;
  updateProject: (id: string, data: Partial<Project>) => Promise<void>;
  handleDeleteProject: (id: string) => Promise<void>;

  // Departments Modal
  departmentsModalOpen: boolean;
  setDepartmentsModalOpen: (open: boolean) => void;
  createDepartment: (department: Omit<Department, "id">) => Promise<Department>;
  deleteDepartment: (id: string) => Promise<void>;
  getDepartmentUsersCount: (departmentId: string) => number;
  renameDepartment: (id: string, name: string) => Promise<void>;
  reorderDepartments: (dragIndex: number, hoverIndex: number) => void;
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

export const SchedulerModals = React.memo<SchedulerModalsProps>(({
  modalOpen,
  setModalOpen,
  modalMode,
  modalInitialData,
  pendingEvent,
  setPendingEvent,
  handleModalSave,
  projects,
  resources,
  commentModalOpen,
  setCommentModalOpen,
  setPendingComment,
  handleCommentSave,
  usersModalOpen,
  setUsersModalOpen,
  departments,
  companies,
  grades,
  createResource,
  updateResource,
  deleteResource,
  getGradeName,
  projectsModalOpen,
  setProjectsModalOpen,
  eventPatterns,
  createProject,
  updateProject,
  handleDeleteProject,
  departmentsModalOpen,
  setDepartmentsModalOpen,
  createDepartment,
  deleteDepartment,
  getDepartmentUsersCount,
  renameDepartment,
  reorderDepartments,
  toggleDepartmentVisibility,
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
}) => {
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

      <UsersManagementModal
        isOpen={usersModalOpen}
        onClose={() => setUsersModalOpen(false)}
        resources={resources}
        departments={departments}
        companies={companies}
        grades={grades}
        onCreateResource={createResource}
        onUpdateResource={updateResource}
        onDeleteResource={deleteResource}
        getGradeName={getGradeName}
      />

      <ProjectsManagementModal
        isOpen={projectsModalOpen}
        onClose={() => setProjectsModalOpen(false)}
        projects={projects}
        eventPatterns={eventPatterns}
        onCreateProject={createProject}
        onUpdateProject={updateProject}
        onDeleteProject={handleDeleteProject}
      />

      <DepartmentsManagementModal
        isOpen={departmentsModalOpen}
        onClose={() => setDepartmentsModalOpen(false)}
        departments={departments}
        onCreateDepartment={createDepartment}
        onDeleteDepartment={deleteDepartment}
        onGetDepartmentUsersCount={getDepartmentUsersCount}
        onRenameDepartment={renameDepartment}
        onReorderDepartments={reorderDepartments}
        onToggleDepartmentVisibility={toggleDepartmentVisibility}
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
