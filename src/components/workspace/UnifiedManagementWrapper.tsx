import { useState, useEffect } from 'react';
import { Workspace, Resource, Department, Project, Grade, Company, EventPattern } from '../../types/scheduler';
import { UnifiedManagementModal } from '../scheduler/UnifiedManagementModal';
import { resourcesApi } from '../../services/api/resources';
import { departmentsApi } from '../../services/api/departments';
import { projectsApi } from '../../services/api/projects';
import { gradesApi } from '../../services/api/grades';
import { companiesApi } from '../../services/api/companies';
import { eventPatternsApi } from '../../services/api/eventPatterns';
import { toast } from 'sonner@2.0.3';
import { updateWorkspace } from '../../services/api/workspaces';

interface UnifiedManagementWrapperProps {
  workspace: Workspace;
  onClose: () => void;
  accessToken?: string | null;
}

export function UnifiedManagementWrapper({
  workspace,
  onClose,
  accessToken,
}: UnifiedManagementWrapperProps) {
  const [resources, setResources] = useState<Resource[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [patterns, setPatterns] = useState<EventPattern[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [workspace.id]);

  const loadData = async () => {
    try {
      console.log('🔄 UnifiedManagementWrapper: загрузка данных для workspace', workspace.id);
      
      const [
        resourcesData,
        departmentsData,
        projectsData,
        gradesData,
        companiesData,
        patternsData,
      ] = await Promise.all([
        resourcesApi.getAll(accessToken || undefined, workspace.id),
        departmentsApi.getAll(accessToken || undefined, workspace.id),
        projectsApi.getAll(accessToken || undefined, workspace.id),
        gradesApi.getAll(Number(workspace.id)),
        companiesApi.getAll(Number(workspace.id)),
        eventPatternsApi.getAll(accessToken || undefined),
      ]);

      console.log('✅ Данные загружены:', {
        resources: resourcesData.length,
        departments: departmentsData.length,
        projects: projectsData.length,
        grades: gradesData.length,
        companies: companiesData.length,
        patterns: patternsData.length,
      });

      setResources(resourcesData);
      setDepartments(departmentsData);
      setProjects(projectsData);
      setGrades(gradesData);
      setCompanies(companiesData);
      setPatterns(patternsData);
    } catch (error: any) {
      console.error('❌ UnifiedManagementWrapper: ошибка загрузки данных:', error);
      console.error('❌ Детали:', error.message, error.stack);
      toast.error('Ошибка загрузки', {
        description: error.message || 'Не удалось загрузить данные',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateWorkspaceName = async (name: string) => {
    try {
      await updateWorkspace(workspace.id, { name });
      toast.success('Сохранено', {
        description: 'Название воркспейса обновлено',
      });
    } catch (error) {
      console.error('Failed to update workspace name:', error);
      toast.error('Ошибка', {
        description: 'Не удалось обновить название',
      });
      throw error;
    }
  };

  const handleUpdateWorkspaceYear = async (year: number) => {
    try {
      await updateWorkspace(workspace.id, { timeline_year: year });
      toast.success('Сохранено', {
        description: 'Год воркспейса обновлен',
      });
    } catch (error) {
      console.error('Failed to update workspace year:', error);
      toast.error('Ошибка', {
        description: 'Не удалось обновить год',
      });
      throw error;
    }
  };

  const handleCreateUser = async (data: any) => {
    try {
      const newUser = await resourcesApi.create(data, accessToken || undefined, String(workspace.id));
      setResources((prev) => [...prev, newUser]);
      toast.success('Создано', {
        description: 'Сотрудник добавлен',
      });
      return newUser;
    } catch (error) {
      console.error('Failed to create user:', error);
      toast.error('Ошибка', {
        description: 'Не удалось создать сотрудника',
      });
      throw error;
    }
  };

  const handleUpdateUser = async (userId: string, data: any) => {
    try {
      const updatedUser = await resourcesApi.update(userId, data, accessToken || undefined);
      setResources((prev) =>
        prev.map((r) => (r.id === userId ? updatedUser : r))
      );
      toast.success('Сохранено', {
        description: 'Данные сотрудника обновлены',
      });
      return updatedUser;
    } catch (error) {
      console.error('Failed to update user:', error);
      toast.error('Ошибка', {
        description: 'Не удалось обновить данные',
      });
      throw error;
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await resourcesApi.delete(userId, accessToken || undefined);
      setResources((prev) => prev.filter((r) => r.id !== userId));
      toast.success('Удалено', {
        description: 'Сотрудник удален',
      });
    } catch (error) {
      console.error('Failed to delete user:', error);
      toast.error('Ошибка', {
        description: 'Не удалось удалить сотрудника',
      });
      throw error;
    }
  };

  const handleCreateDepartment = async (data: any) => {
    try {
      const newDepartment = await departmentsApi.create(data);
      setDepartments((prev) => [...prev, newDepartment]);
      toast.success('Создано', {
        description: 'Департамент добавлен',
      });
      return newDepartment;
    } catch (error) {
      console.error('Failed to create department:', error);
      toast.error('Ошибка', {
        description: 'Не удалось создать департамент',
      });
      throw error;
    }
  };

  const handleUpdateDepartment = async (deptId: string, data: any) => {
    try {
      const updatedDept = await departmentsApi.update(deptId, data);
      setDepartments((prev) =>
        prev.map((d) => (d.id === deptId ? updatedDept : d))
      );
      toast.success('Сохранено', {
        description: 'Департамент обновлен',
      });
      return updatedDept;
    } catch (error) {
      console.error('Failed to update department:', error);
      toast.error('Ошибка', {
        description: 'Не удалось обновить департамент',
      });
      throw error;
    }
  };

  const handleDeleteDepartment = async (deptId: string) => {
    try {
      await departmentsApi.delete(deptId);
      setDepartments((prev) => prev.filter((d) => d.id !== deptId));
      toast.success('Удалено', {
        description: 'Департамент удален',
      });
    } catch (error) {
      console.error('Failed to delete department:', error);
      toast.error('Ошибка', {
        description: 'Не удалось удалить департамент',
      });
      throw error;
    }
  };

  const handleCreateProject = async (data: any) => {
    try {
      const newProject = await projectsApi.create(data);
      setProjects((prev) => [...prev, newProject]);
      toast.success('Создано', {
        description: 'Проект добавлен',
      });
      return newProject;
    } catch (error) {
      console.error('Failed to create project:', error);
      toast.error('Ошибка', {
        description: 'Не удалось создать проект',
      });
      throw error;
    }
  };

  const handleUpdateProject = async (projectId: string, data: any) => {
    try {
      const updatedProject = await projectsApi.update(projectId, data);
      setProjects((prev) =>
        prev.map((p) => (p.id === projectId ? updatedProject : p))
      );
      toast.success('Сохранено', {
        description: 'Проект обновлен',
      });
      return updatedProject;
    } catch (error) {
      console.error('Failed to update project:', error);
      toast.error('Ошибка', {
        description: 'Не удалось обновить проект',
      });
      throw error;
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      await projectsApi.delete(projectId);
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      toast.success('Удалено', {
        description: 'Проект удален',
      });
    } catch (error) {
      console.error('Failed to delete project:', error);
      toast.error('Ошибка', {
        description: 'Не удалось удалить проект',
      });
      throw error;
    }
  };

  const handleGetDepartmentUsersCount = async (deptId: string): Promise<number> => {
    try {
      const result = await departmentsApi.getUsersCount(deptId, accessToken || undefined);
      return result.count;
    } catch (error) {
      console.error('Failed to get department users count:', error);
      return 0;
    }
  };

  const handleRenameDepartment = async (deptId: string, newName: string) => {
    await handleUpdateDepartment(deptId, { name: newName });
  };

  const handleReorderDepartments = async (newOrder: Department[]) => {
    try {
      const updates = newOrder.map((dept, index) => ({
        id: dept.id,
        queue: index,
      }));

      await departmentsApi.updateQueue({ departments: updates }, accessToken || undefined);
      setDepartments(newOrder);
      toast.success('Сохранено', {
        description: 'Порядок департаментов обновлен',
      });
    } catch (error) {
      console.error('Failed to reorder departments:', error);
      toast.error('Ошибка', {
        description: 'Не удалось обновить порядок',
      });
      throw error;
    }
  };

  const handleToggleDepartmentVisibility = async (deptId: string) => {
    const dept = departments.find((d) => d.id === deptId);
    if (dept) {
      await handleUpdateDepartment(deptId, { visible: !dept.visible });
    }
  };

  const handleUploadUserAvatar = async (userId: string, file: File): Promise<string> => {
    try {
      // This would need to be implemented with your avatar upload logic
      // For now, return empty string
      console.warn('Avatar upload not implemented in wrapper');
      return '';
    } catch (error) {
      console.error('Failed to upload avatar:', error);
      throw error;
    }
  };

  return (
    <UnifiedManagementModal
      isOpen={true}
      onClose={onClose}
      defaultTab="users"
      isLoading={isLoading}
      
      // Users tab
      resources={resources}
      departments={departments}
      grades={grades}
      companies={companies}
      onCreateUser={handleCreateUser}
      onUpdateUser={handleUpdateUser}
      onDeleteUser={handleDeleteUser}
      onUploadUserAvatar={handleUploadUserAvatar}
      highlightedUserId={undefined}
      onRefreshResources={async () => {
        try {
          const data = await resourcesApi.getAll(accessToken || undefined, workspace.id);
          setResources(data);
        } catch (err) {
          console.error('❌ Ошибка рефреша ресурсов:', err);
        }
      }}
      workspaceId={String(workspace.id)}
      
      // Departments tab
      onRenameDepartment={handleRenameDepartment}
      onReorderDepartments={handleReorderDepartments}
      onToggleDepartmentVisibility={handleToggleDepartmentVisibility}
      onCreateDepartment={handleCreateDepartment}
      onDeleteDepartment={handleDeleteDepartment}
      onGetDepartmentUsersCount={handleGetDepartmentUsersCount}
      
      // Projects tab
      projects={projects}
      events={[]} // No events in workspace list
      eventPatterns={patterns}
      onCreateProject={handleCreateProject}
      onUpdateProject={handleUpdateProject}
      onDeleteProject={handleDeleteProject}
      onResetHistory={() => {}} // Not needed in workspace list
    />
  );
}