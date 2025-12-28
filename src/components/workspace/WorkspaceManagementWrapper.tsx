import { useState, useEffect } from 'react';
import { Workspace, Grade, Company, Resource } from '../../types/scheduler';
import { WorkspaceManagementModal } from '../scheduler/WorkspaceManagementModal';
import { gradesApi } from '../../services/api/grades';
import { companiesApi } from '../../services/api/companies';
import { updateWorkspace } from '../../services/api/workspaces';
import { resourcesApi } from '../../services/api/resources';
import { toast } from 'sonner@2.0.3';

interface WorkspaceManagementWrapperProps {
  workspace: Workspace;
  onClose: () => void;
}

export function WorkspaceManagementWrapper({
  workspace,
  onClose,
}: WorkspaceManagementWrapperProps) {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [workspace.id]);

  const loadData = async () => {
    try {
      const [gradesData, companiesData, resourcesData] = await Promise.all([
        gradesApi.getAll(Number(workspace.id)),
        companiesApi.getAll(Number(workspace.id)),
        resourcesApi.getAll(undefined, workspace.id),
      ]);

      setGrades(gradesData);
      setCompanies(companiesData);
      setResources(resourcesData);
    } catch (error) {
      console.error('Failed to load workspace management data:', error);
      toast.error('Ошибка загрузки', {
        description: 'Не удалось загрузить данные',
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

  const handleCreateGrade = async (name: string) => {
    try {
      await gradesApi.create(name, Number(workspace.id));
      await loadData(); // Reload all data
    } catch (error) {
      console.error('Failed to create grade:', error);
      throw error;
    }
  };

  const handleUpdateGrade = async (gradeId: string, name: string) => {
    try {
      await gradesApi.update(gradeId, name, Number(workspace.id));
      await loadData();
    } catch (error) {
      console.error('Failed to update grade:', error);
      throw error;
    }
  };

  const handleDeleteGrade = async (gradeId: string) => {
    try {
      await gradesApi.delete(gradeId);
      await loadData();
    } catch (error) {
      console.error('Failed to delete grade:', error);
      throw error;
    }
  };

  const handleUpdateGradesSortOrder = async (updates: Array<{ id: string; sortOrder: number }>) => {
    try {
      await gradesApi.updateSortOrder(updates);
      await loadData();
    } catch (error) {
      console.error('Failed to update grades sort order:', error);
      throw error;
    }
  };

  const handleCreateCompany = async (name: string) => {
    try {
      await companiesApi.create(name, Number(workspace.id));
      await loadData();
    } catch (error) {
      console.error('Failed to create company:', error);
      throw error;
    }
  };

  const handleUpdateCompany = async (companyId: string, name: string) => {
    try {
      await companiesApi.update(companyId, name, Number(workspace.id));
      await loadData();
    } catch (error) {
      console.error('Failed to update company:', error);
      throw error;
    }
  };

  const handleDeleteCompany = async (companyId: string) => {
    try {
      await companiesApi.delete(companyId);
      await loadData();
    } catch (error) {
      console.error('Failed to delete company:', error);
      throw error;
    }
  };

  const handleUpdateCompaniesSortOrder = async (updates: Array<{ id: string; sortOrder: number }>) => {
    try {
      await companiesApi.updateSortOrder(updates);
      await loadData();
    } catch (error) {
      console.error('Failed to update companies sort order:', error);
      throw error;
    }
  };

  return (
    <WorkspaceManagementModal
      isOpen={true}
      onClose={onClose}
      isLoading={isLoading}
      workspaceName={workspace.name}
      workspaceYear={workspace.timeline_year}
      onUpdateWorkspaceName={handleUpdateWorkspaceName}
      onUpdateWorkspaceYear={handleUpdateWorkspaceYear}
      resources={resources}
      grades={grades}
      onCreateGrade={handleCreateGrade}
      onUpdateGrade={handleUpdateGrade}
      onDeleteGrade={handleDeleteGrade}
      onUpdateGradesSortOrder={handleUpdateGradesSortOrder}
      onGradesUpdated={loadData}
      companies={companies}
      onCreateCompany={handleCreateCompany}
      onUpdateCompany={handleUpdateCompany}
      onDeleteCompany={handleDeleteCompany}
      onUpdateCompaniesSortOrder={handleUpdateCompaniesSortOrder}
      onCompaniesUpdated={loadData}
      onResourcesUpdated={loadData}
    />
  );
}