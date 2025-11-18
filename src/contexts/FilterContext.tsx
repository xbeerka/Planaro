import { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { getFilterCookie, setFilterCookie } from '../utils/cookies';
import { useDebouncedValue } from '../hooks/useDebounce';

interface FilterContextType {
  // Company filters
  enabledCompanies: Set<string>;
  toggleCompany: (companyId: string) => void;
  setEnabledCompanies: (companies: Set<string>) => void;
  
  // Department filters
  enabledDepartments: Set<string>;
  toggleDepartment: (departmentId: string) => void;
  setEnabledDepartments: (departments: Set<string>) => void;
  
  // Project filters (show only people with these projects)
  enabledProjects: Set<string>;
  toggleProject: (projectId: string) => void;
  setEnabledProjects: (projects: Set<string>) => void;
  
  // Search filter (debounced)
  searchQuery: string; // Immediate value (для UI responsiveness)
  debouncedSearchQuery: string; // Debounced value (для фильтрации)
  setSearchQuery: (query: string) => void;
  
  // Reset filters
  resetFilters: () => void;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

interface FilterProviderProps {
  children: ReactNode;
  workspaceId: string | number; // Добавляем workspaceId для изоляции фильтров между воркспейсами
}

export function FilterProvider({ children, workspaceId }: FilterProviderProps) {
  // Ключи cookies теперь зависят от workspaceId - каждый воркспейс имеет свои фильтры
  const companiesKey = `scheduler_filter_companies_${workspaceId}`;
  const departmentsKey = `scheduler_filter_departments_${workspaceId}`;
  const projectsKey = `scheduler_filter_projects_${workspaceId}`;
  
  const [enabledCompanies, setEnabledCompaniesState] = useState<Set<string>>(() => {
    const saved = getFilterCookie<string[]>(companiesKey, []);
    return new Set(saved);
  });

  const [enabledDepartments, setEnabledDepartmentsState] = useState<Set<string>>(() => {
    const saved = getFilterCookie<string[]>(departmentsKey, []);
    return new Set(saved);
  });

  const [enabledProjects, setEnabledProjectsState] = useState<Set<string>>(() => {
    const saved = getFilterCookie<string[]>(projectsKey, []);
    return new Set(saved);
  });

  // Search query (immediate + debounced)
  const [searchQuery, setSearchQuery] = useState<string>('');
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);

  // При смене workspaceId обновляем фильтры из cookies нового воркспейса
  useEffect(() => {
    const savedCompanies = getFilterCookie<string[]>(companiesKey, []);
    const savedDepartments = getFilterCookie<string[]>(departmentsKey, []);
    const savedProjects = getFilterCookie<string[]>(projectsKey, []);
    
    setEnabledCompaniesState(new Set(savedCompanies));
    setEnabledDepartmentsState(new Set(savedDepartments));
    setEnabledProjectsState(new Set(savedProjects));
    setSearchQuery(''); // Сбрасываем поиск при смене воркспейса
  }, [workspaceId, companiesKey, departmentsKey, projectsKey]);

  // Save to cookies when state changes
  useEffect(() => {
    setFilterCookie(companiesKey, Array.from(enabledCompanies));
  }, [enabledCompanies, companiesKey]);

  useEffect(() => {
    setFilterCookie(departmentsKey, Array.from(enabledDepartments));
  }, [enabledDepartments, departmentsKey]);

  useEffect(() => {
    setFilterCookie(projectsKey, Array.from(enabledProjects));
  }, [enabledProjects, projectsKey]);

  const toggleCompany = (companyId: string) => {
    setEnabledCompaniesState(prev => {
      const next = new Set(prev);
      if (next.has(companyId)) {
        next.delete(companyId);
      } else {
        next.add(companyId);
      }
      return next;
    });
  };

  const toggleDepartment = (departmentId: string) => {
    setEnabledDepartmentsState(prev => {
      const next = new Set(prev);
      if (next.has(departmentId)) {
        next.delete(departmentId);
      } else {
        next.add(departmentId);
      }
      return next;
    });
  };

  const toggleProject = (projectId: string) => {
    setEnabledProjectsState(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  const setEnabledCompanies = (companies: Set<string>) => {
    setEnabledCompaniesState(companies);
  };

  const setEnabledDepartments = (departments: Set<string>) => {
    setEnabledDepartmentsState(departments);
  };

  const setEnabledProjects = (projects: Set<string>) => {
    setEnabledProjectsState(projects);
  };

  const resetFilters = () => {
    setEnabledCompaniesState(new Set());
    setEnabledDepartmentsState(new Set());
    setEnabledProjectsState(new Set());
    setSearchQuery('');
  };

  return (
    <FilterContext.Provider
      value={{
        enabledCompanies,
        toggleCompany,
        setEnabledCompanies,
        enabledDepartments,
        toggleDepartment,
        setEnabledDepartments,
        enabledProjects,
        toggleProject,
        setEnabledProjects,
        searchQuery,
        debouncedSearchQuery,
        setSearchQuery,
        resetFilters
      }}
    >
      {children}
    </FilterContext.Provider>
  );
}

export function useFilters() {
  const context = useContext(FilterContext);
  if (context === undefined) {
    throw new Error('useFilters must be used within a FilterProvider');
  }
  return context;
}