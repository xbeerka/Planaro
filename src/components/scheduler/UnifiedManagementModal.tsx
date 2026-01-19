import { useState, useEffect, useRef } from 'react';
import { Resource, Department, Project, Grade, Company, EventPattern, SchedulerEvent } from '../../types/scheduler';
import { UsersManagementContent, UsersManagementHandle } from './UsersManagementContent';
import { DepartmentsManagementContent, DepartmentsManagementHandle } from './DepartmentsManagementContent';
import { ProjectsManagementContent, ProjectsManagementHandle } from './ProjectsManagementContent';

export type TabType = 'users' | 'departments' | 'projects';

interface UnifiedManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: TabType;
  isLoading?: boolean;
  
  // Users props
  resources: Resource[];
  departments: Department[];
  grades: Grade[];
  companies: Company[];
  onUpdateUser: (userId: string, updates: Partial<Resource>) => Promise<void>;
  onCreateUser: (userData: Omit<Resource, 'id'>) => Promise<void>;
  onDeleteUser: (userId: string) => Promise<void>;
  onToggleUserVisibility?: (userId: string) => Promise<void>;
  onUploadUserAvatar: (userId: string, file: File) => Promise<string>;
  
  // Grades props
  onCreateGrade?: (name: string) => Promise<void>;
  onUpdateGrade?: (gradeId: string, name: string) => Promise<void>;
  onDeleteGrade?: (gradeId: string) => Promise<void>;
  onGradesUpdated?: () => Promise<void>;
  updateGradesSortOrder?: (updates: Array<{ id: string; sortOrder: number }>) => Promise<void>;
  
  // Companies props
  onCreateCompany?: (name: string) => Promise<void>;
  onUpdateCompany?: (companyId: string, name: string) => Promise<void>;
  onDeleteCompany?: (companyId: string) => Promise<void>;
  onCompaniesUpdated?: () => Promise<void>;
  updateCompaniesSortOrder?: (updates: Array<{ id: string; sortOrder: number }>) => Promise<void>;
  
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
  isLoading = false,
  resources,
  departments,
  grades,
  companies,
  onUpdateUser,
  onCreateUser,
  onDeleteUser,
  onToggleUserVisibility,
  onUploadUserAvatar,
  onCreateGrade,
  onUpdateGrade,
  onDeleteGrade,
  onGradesUpdated,
  updateGradesSortOrder,
  onCreateCompany,
  onUpdateCompany,
  onDeleteCompany,
  onCompaniesUpdated,
  updateCompaniesSortOrder,
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

  // Derived state to handle "split second" loading when departments load before users
  const [isTimeoutOver, setIsTimeoutOver] = useState(false);
  
  const isLikelyLoadingUsers = activeTab === 'users' && resources.length === 0 && departments.length > 0;
  const isLikelyLoadingProjects = activeTab === 'projects' && projects.length === 0 && eventPatterns.length > 0;
  
  const isSmartLoading = isLikelyLoadingUsers || isLikelyLoadingProjects;
  
  useEffect(() => {
    if (isSmartLoading) {
      const timer = setTimeout(() => setIsTimeoutOver(true), 1000);
      return () => clearTimeout(timer);
    } else {
      setIsTimeoutOver(false);
    }
  }, [isSmartLoading]);

  const shouldShowSkeleton = isLoading || (isSmartLoading && !isTimeoutOver);
  const [hasUsersChanges, setHasUsersChanges] = useState(false);
  const [hasDepartmentsChanges, setHasDepartmentsChanges] = useState(false);
  const [hasProjectsChanges, setHasProjectsChanges] = useState(false);
  const usersRef = useRef<UsersManagementHandle>(null);
  const departmentsRef = useRef<DepartmentsManagementHandle>(null);
  const projectsRef = useRef<ProjectsManagementHandle>(null);

  // Reset active tab when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]); // ✅ Ignore defaultTab changes while open to prevent jumping

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

  const handleAdd = () => {
    if (activeTab === 'users') usersRef.current?.onAdd();
    if (activeTab === 'departments') departmentsRef.current?.onAdd();
    if (activeTab === 'projects') projectsRef.current?.onAdd();
  };

  const getAddButtonLabel = () => {
    if (activeTab === 'users') return 'Добавить сотрудника';
    if (activeTab === 'departments') return 'Добавить департамент';
    if (activeTab === 'projects') return 'Добавить проект';
    return 'Добавить';
  };

  return (
    <div 
      className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/40 backdrop-blur-sm transition-all"
      onClick={handleClose}
    >
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col border border-gray-100/20"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-gray-100 bg-white rounded-t-xl px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Управление</h2>
            <button
              onClick={handleClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
              title="Закрыть"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>

          {shouldShowSkeleton ? (
            <div className="flex items-center justify-between animate-pulse">
              <div className="flex p-1 gap-1">
                <div className="w-28 h-9 bg-gray-100 rounded-md" />
                <div className="w-32 h-9 bg-gray-100 rounded-md" />
                <div className="w-24 h-9 bg-gray-100 rounded-md" />
              </div>
              <div className="w-36 h-9 bg-gray-100 rounded-lg" />
            </div>
          ) : (
            <div className="flex items-center justify-between">
              {/* Tabs */}
              <div className="flex p-1 bg-gray-100/50 rounded-lg gap-1">
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      relative px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2
                      ${activeTab === tab.id 
                        ? 'bg-white text-gray-900 shadow-sm' 
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                      }
                    `}
                  >
                    <span>{tab.label}</span>
                    {tab.hasChanges && (
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                    )}
                  </button>
                ))}
              </div>

              {/* Add Button */}
              <button
                onClick={handleAdd}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm active:scale-[0.98]"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" />
                  <path d="M12 5v14" />
                </svg>
                {getAddButtonLabel()}
              </button>
            </div>
          )}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden flex flex-col bg-white rounded-b-xl">
          {shouldShowSkeleton ? (
            <div className="flex-1 flex flex-col animate-pulse">
              {/* Search Skeleton */}
              <div className="px-6 py-4 border-b border-[rgba(0,0,0,0.12)]">
                <div className="h-10 bg-gray-100 rounded-xl w-full" />
              </div>
              {/* List Skeleton */}
              <div className="flex-1 px-6 py-2 space-y-0">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="py-3 border-b border-gray-100 flex items-center gap-4">
                    <div className="w-9 h-9 bg-gray-100 rounded-[12px] shrink-0" />
                    <div className="flex-1 grid grid-cols-12 gap-4">
                      <div className="col-span-4 h-4 bg-gray-100 rounded mt-2.5" />
                      <div className="col-span-3 h-4 bg-gray-100 rounded mt-2.5" />
                      <div className="col-span-3 h-4 bg-gray-100 rounded mt-2.5" />
                    </div>
                    <div className="w-9 h-9 bg-gray-100 rounded-[12px] shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className={`flex-1 flex flex-col h-full overflow-y-auto ${activeTab === 'users' ? 'block' : 'hidden'}`}>
                <UsersManagementContent
              ref={usersRef}
              resources={resources}
              departments={departments}
              grades={grades}
              companies={companies}
              onUpdateUser={onUpdateUser}
              onCreateUser={onCreateUser}
              onDeleteUser={onDeleteUser}
              onToggleUserVisibility={onToggleUserVisibility}
              onUploadUserAvatar={onUploadUserAvatar}
              onCreateGrade={onCreateGrade}
              onUpdateGrade={onUpdateGrade}
              onDeleteGrade={onDeleteGrade}
              onGradesUpdated={onGradesUpdated}
              updateGradesSortOrder={updateGradesSortOrder}
              onCreateCompany={onCreateCompany}
              onUpdateCompany={onUpdateCompany}
              onDeleteCompany={onDeleteCompany}
              onCompaniesUpdated={onCompaniesUpdated}
              updateCompaniesSortOrder={updateCompaniesSortOrder}
              onHasChanges={setHasUsersChanges}
              onClose={onClose}
              highlightedUserId={highlightedUserId}
            />
          </div>
          
          <div className={`flex-1 flex flex-col h-full overflow-y-auto ${activeTab === 'departments' ? 'block' : 'hidden'}`}>
            <DepartmentsManagementContent
              ref={departmentsRef}
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
          </div>
          
          <div className={`flex-1 flex flex-col h-full overflow-y-auto ${activeTab === 'projects' ? 'block' : 'hidden'}`}>
            <ProjectsManagementContent
              ref={projectsRef}
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
          </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}