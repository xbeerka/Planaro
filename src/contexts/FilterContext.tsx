import { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
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
  
  // Project filter: only show resources with selected projects in current week
  projectFilterTodayOnly: boolean;
  toggleProjectFilterTodayOnly: () => void;
  
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
  // Ключи localStorage зависят от workspaceId - каждый воркспейс имеет свои фильтры
  const companiesKey = `scheduler_filter_companies_${workspaceId}`;
  const departmentsKey = `scheduler_filter_departments_${workspaceId}`;
  const projectsKey = `scheduler_filter_projects_${workspaceId}`;

  const readLS = <T,>(key: string, fallback: T): T => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  };

  const writeLS = <T,>(key: string, value: T) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  };

  const [enabledCompanies, setEnabledCompaniesState] = useState<Set<string>>(() => {
    return new Set(readLS<string[]>(companiesKey, []));
  });

  const [enabledDepartments, setEnabledDepartmentsState] = useState<Set<string>>(() => {
    return new Set(readLS<string[]>(departmentsKey, []));
  });

  const [enabledProjects, setEnabledProjectsState] = useState<Set<string>>(() => {
    return new Set(readLS<string[]>(projectsKey, []));
  });

  const [projectFilterTodayOnly, setProjectFilterTodayOnly] = useState<boolean>(false);

  // Search query (immediate + debounced)
  const [searchQuery, setSearchQuery] = useState<string>('');
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);

  // При смене workspaceId обновляем фильтры из localStorage нового воркспейса
  useEffect(() => {
    setEnabledCompaniesState(new Set(readLS<string[]>(companiesKey, [])));
    setEnabledDepartmentsState(new Set(readLS<string[]>(departmentsKey, [])));
    setEnabledProjectsState(new Set(readLS<string[]>(projectsKey, [])));
    setSearchQuery(''); // Сбрасываем поиск при смене воркспейса
  }, [workspaceId, companiesKey, departmentsKey, projectsKey]);

  // Сохраняем в localStorage при изменении состояния
  useEffect(() => {
    writeLS(companiesKey, Array.from(enabledCompanies));
  }, [enabledCompanies, companiesKey]);

  useEffect(() => {
    writeLS(departmentsKey, Array.from(enabledDepartments));
  }, [enabledDepartments, departmentsKey]);

  useEffect(() => {
    writeLS(projectsKey, Array.from(enabledProjects));
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

  const toggleProjectFilterTodayOnly = () => {
    setProjectFilterTodayOnly(prev => !prev);
  };

  const resetFilters = () => {
    setEnabledCompaniesState(new Set());
    setEnabledDepartmentsState(new Set());
    setEnabledProjectsState(new Set());
    setSearchQuery('');
    setProjectFilterTodayOnly(false);
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
        projectFilterTodayOnly,
        toggleProjectFilterTodayOnly,
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