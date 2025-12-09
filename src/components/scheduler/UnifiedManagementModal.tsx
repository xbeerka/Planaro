import { useState, useEffect } from 'react';
import { Resource, Department, Project, Grade, Company, EventPattern, SchedulerEvent } from '../../types/scheduler';
import { UsersManagementContent } from './UsersManagementContent';
import { DepartmentsManagementContent } from './DepartmentsManagementContent';
import { ProjectsManagementContent } from './ProjectsManagementContent';

export type TabType = 'users' | 'departments' | 'projects';

interface UnifiedManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: TabType;
  
  // Users props
  resources: Resource[];
  departments: Department[];
  grades: Grade[];
  companies: Company[];
  onUpdateUser: (userId: string, updates: Partial<Resource>) => Promise<void>;
  onCreateUser: (userData: Omit<Resource, 'id'>) => Promise<void>;
  onDeleteUser: (userId: string) => Promise<void>;
  onUploadUserAvatar: (userId: string, file: File) => Promise<string>;
  
  // Departments props
  onRenameDepartment: (deptId: string, newName: string) => void;
  onReorderDepartments: (newOrder: Department[]) => Promise<void>;
  onToggleDepartmentVisibility: (deptId: string) => void;
  onCreateDepartment: (name: string) => Promise<void>;
  onDeleteDepartment: (deptId: string) => Promise<void>;
  onGetDepartmentUsersCount: (deptId: string) => Promise<number>;
  
  // Projects props
  projects: Project[];
  events: SchedulerEvent[];
  eventPatterns: EventPattern[];
  onCreateProject: (projectData: { name: string; backgroundColor?: string; textColor?: string; patternId?: string }) => Promise<void>;
  onUpdateProject: (projectId: string, projectData: { name: string; backgroundColor?: string; textColor?: string; patternId?: string }) => Promise<void>;
  onDeleteProject: (projectId: string) => Promise<void>;
  onResetHistory?: () => void;
  
  // User selection (for auto-scroll)
  highlightedUserId?: string | null;
}

export function UnifiedManagementModal({
  isOpen,
  onClose,
  defaultTab = 'users',
  resources,
  departments,
  grades,
  companies,
  onUpdateUser,
  onCreateUser,
  onDeleteUser,
  onUploadUserAvatar,
  onRenameDepartment,
  onReorderDepartments,
  onToggleDepartmentVisibility,
  onCreateDepartment,
  onDeleteDepartment,
  onGetDepartmentUsersCount,
  projects,
  events,
  eventPatterns,
  onCreateProject,
  onUpdateProject,
  onDeleteProject,
  onResetHistory,
  highlightedUserId
}: UnifiedManagementModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>(defaultTab);
  const [hasUsersChanges, setHasUsersChanges] = useState(false);
  const [hasDepartmentsChanges, setHasDepartmentsChanges] = useState(false);
  const [hasProjectsChanges, setHasProjectsChanges] = useState(false);

  // Reset active tab when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab);
    }
  }, [isOpen, defaultTab]);

  if (!isOpen) return null;

  const tabs = [
    { 
      id: 'users' as TabType, 
      label: 'Сотрудники', 
      icon: '👥',
      hasChanges: hasUsersChanges
    },
    { 
      id: 'departments' as TabType, 
      label: 'Департаменты', 
      icon: '📁',
      hasChanges: hasDepartmentsChanges
    },
    { 
      id: 'projects' as TabType, 
      label: 'Проекты', 
      icon: '🎨',
      hasChanges: hasProjectsChanges
    }
  ];

  const handleClose = () => {
    const hasAnyChanges = hasUsersChanges || hasDepartmentsChanges || hasProjectsChanges;
    if (hasAnyChanges) {
      const confirmed = window.confirm('У вас есть несохраненные изменения. Вы уверены, что хотите закрыть?');
      if (!confirmed) return;
    }
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50"
      onClick={handleClose}
    >
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header with Tabs */}
        <div className="border-b">
          <div className="flex items-center justify-between px-6 pt-6 pb-0">
            <h2 className="text-2xl font-semibold text-gray-900">Управление</h2>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Закрыть"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
          
          {/* Tabs */}
          <div className="flex gap-0 px-6 mt-4">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  relative px-6 py-3 font-medium transition-all
                  ${activeTab === tab.id 
                    ? 'text-blue-600 border-b-2 border-blue-600' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }
                `}
              >
                <span className="flex items-center gap-2">
                  <span>{tab.label}</span>
                  {tab.hasChanges && (
                    <span 
                      className="w-2 h-2 bg-orange-500 rounded-full" 
                      title="Есть несохраненные изменения"
                    />
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {activeTab === 'users' && (
            <UsersManagementContent
              resources={resources}
              departments={departments}
              grades={grades}
              companies={companies}
              onUpdateUser={onUpdateUser}
              onCreateUser={onCreateUser}
              onDeleteUser={onDeleteUser}
              onUploadUserAvatar={onUploadUserAvatar}
              onHasChanges={setHasUsersChanges}
              onClose={onClose}
              highlightedUserId={highlightedUserId}
            />
          )}
          
          {activeTab === 'departments' && (
            <DepartmentsManagementContent
              departments={departments}
              onRenameDepartment={onRenameDepartment}
              onReorderDepartments={onReorderDepartments}
              onToggleDepartmentVisibility={onToggleDepartmentVisibility}
              onCreateDepartment={onCreateDepartment}
              onDeleteDepartment={onDeleteDepartment}
              onGetDepartmentUsersCount={onGetDepartmentUsersCount}
              onHasChanges={setHasDepartmentsChanges}
              onClose={onClose}
            />
          )}
          
          {activeTab === 'projects' && (
            <ProjectsManagementContent
              projects={projects}
              events={events}
              eventPatterns={eventPatterns}
              onCreateProject={onCreateProject}
              onUpdateProject={onUpdateProject}
              onDeleteProject={onDeleteProject}
              onResetHistory={onResetHistory}
              onHasChanges={setHasProjectsChanges}
              onClose={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}