import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useFilters } from '../../contexts/FilterContext';
import { Company, Department, Project } from '../../types/scheduler';

interface FilterToolbarProps {
  companies: Company[];
  departments: Department[];
  projects: Project[];
}

type FilterType = 'companies' | 'departments' | 'projects';

export interface FilterToolbarRef {
  openCompanyFilter: () => void;
  openDepartmentFilter: () => void;
  openProjectFilter: () => void;
}

export const FilterToolbar = forwardRef<FilterToolbarRef, FilterToolbarProps>(({
  companies,
  departments,
  projects
}, ref) => {
  const {
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
  } = useFilters();

  const [openFilter, setOpenFilter] = useState<FilterType | null>(null);
  const [panelSearch, setPanelSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Reset search when switching tabs
  useEffect(() => {
    setPanelSearch('');
    // Focus search input when panel opens
    if (openFilter) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [openFilter]);

  const toggleFilter = (filter: FilterType) => {
    setOpenFilter(openFilter === filter ? null : filter);
  };

  // Click outside to close
  useEffect(() => {
    if (!openFilter) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenFilter(null);
      }
    };

    // Use setTimeout to avoid closing immediately on the same click that opened it
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openFilter]);

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    openCompanyFilter: () => setOpenFilter('companies'),
    openDepartmentFilter: () => setOpenFilter('departments'),
    openProjectFilter: () => setOpenFilter('projects')
  }));

  // Check if current tab has active filters
  const currentTabHasFilters = openFilter === 'companies' ? enabledCompanies.size > 0
    : openFilter === 'departments' ? enabledDepartments.size > 0
    : openFilter === 'projects' ? enabledProjects.size > 0
    : false;

  const hasActiveFilters = enabledCompanies.size > 0 || enabledDepartments.size > 0 || enabledProjects.size > 0;

  // Reset only the current tab
  const resetCurrentTab = useCallback(() => {
    if (openFilter === 'companies') {
      setEnabledCompanies(new Set());
    } else if (openFilter === 'departments') {
      setEnabledDepartments(new Set());
    } else if (openFilter === 'projects') {
      setEnabledProjects(new Set());
    }
    setPanelSearch('');
  }, [openFilter, setEnabledCompanies, setEnabledDepartments, setEnabledProjects]);

  const toggleAllCompanies = () => {
    if (enabledCompanies.size === companies.length) {
      setEnabledCompanies(new Set());
    } else {
      setEnabledCompanies(new Set(companies.map(c => c.id)));
    }
  };

  const toggleAllDepartments = () => {
    if (enabledDepartments.size === departments.length) {
      setEnabledDepartments(new Set());
    } else {
      setEnabledDepartments(new Set(departments.map(d => d.id)));
    }
  };

  const toggleAllProjects = () => {
    if (enabledProjects.size === projects.length) {
      setEnabledProjects(new Set());
    } else {
      setEnabledProjects(new Set(projects.map(p => p.id)));
    }
  };

  // Filter items by search
  const searchLower = panelSearch.toLowerCase().trim();
  const filteredCompanies = searchLower ? companies.filter(c => c.name.toLowerCase().includes(searchLower)) : companies;
  const filteredDepartments = searchLower ? departments.filter(d => d.name.toLowerCase().includes(searchLower)) : departments;
  const filteredProjects = searchLower ? projects.filter(p => p.name.toLowerCase().includes(searchLower)) : projects;

  const tabLabels: Record<FilterType, string> = {
    companies: 'Компании',
    departments: 'Департаменты',
    projects: 'Проекты',
  };

  return (
    <div ref={containerRef} className="fixed right-[18px] bottom-[18px] flex flex-col items-end gap-2 z-[500]">
      {/* Filter panel */}
      {openFilter && (
        <div className="rounded-xl shadow-[0_6px_20px_rgba(6,18,36,0.12)] bg-white overflow-hidden w-[320px] max-h-[60vh] flex flex-col mb-2">
          {/* Tabs */}
          <div className="flex border-b border-gray-200 bg-gray-50 shrink-0">
            {(['companies', 'departments', 'projects'] as FilterType[]).map(tab => {
              const isActive = openFilter === tab;
              const count = tab === 'companies' ? enabledCompanies.size
                : tab === 'departments' ? enabledDepartments.size
                : enabledProjects.size;
              return (
                <button
                  key={tab}
                  onClick={() => setOpenFilter(tab)}
                  className="flex-1 px-2 py-2.5 text-xs transition-colors outline-none focus:outline-none cursor-pointer relative"
                  style={{
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? 'rgb(59, 130, 246)' : '#6b7280',
                    background: isActive ? 'white' : 'transparent',
                  }}
                >
                  <span>{tabLabels[tab]}</span>
                  {count > 0 && (
                    <span
                      className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full text-white"
                      style={{ fontSize: '10px', fontWeight: 700, backgroundColor: 'rgb(59, 130, 246)' }}
                    >
                      {count}
                    </span>
                  )}
                  {isActive && (
                    <div className="absolute bottom-0 left-2 right-2 h-0.5 rounded-t bg-blue-500" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Search + Reset row */}
          <div className="px-3 pt-3 pb-2 shrink-0">
            <div className="relative flex items-center gap-2">
              <div className="relative flex-1">
                <svg
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={panelSearch}
                  onChange={(e) => setPanelSearch(e.target.value)}
                  placeholder="Поиск..."
                  className="w-full h-8 pl-8 pr-7 text-sm rounded-lg border border-gray-200 bg-gray-50 outline-none focus:border-blue-400 focus:bg-white transition-colors"
                  style={{ fontFamily: 'inherit' }}
                  data-search-focus="20"
                />
                {panelSearch && (
                  <button
                    onClick={() => setPanelSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer outline-none"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6 6 18" />
                      <path d="m6 6 12 12" />
                    </svg>
                  </button>
                )}
              </div>
              {currentTabHasFilters && (
                <button
                  onClick={resetCurrentTab}
                  className="shrink-0 h-8 px-2.5 rounded-lg text-xs bg-red-50 text-red-600 hover:bg-red-100 transition-colors cursor-pointer outline-none focus:outline-none flex items-center gap-1"
                  style={{ fontWeight: 600 }}
                  title={`Сбросить фильтр: ${tabLabels[openFilter]}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                  Сбросить
                </button>
              )}
            </div>
          </div>

          {/* Content */}
          {openFilter === 'companies' && (
            <div className="flex-1 overflow-y-auto">
              <div className="px-3 pb-3">
                <button
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded transition-colors mb-1"
                  onClick={toggleAllCompanies}
                  style={{ fontWeight: 500 }}
                >
                  {enabledCompanies.size === companies.length ? 'Снять все' : 'Выбрать все'}
                </button>
                {filteredCompanies.map(company => (
                  <label
                    key={company.id}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={enabledCompanies.has(company.id)}
                      onChange={() => toggleCompany(company.id)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm">{company.name}</span>
                  </label>
                ))}
                {searchLower && filteredCompanies.length === 0 && (
                  <div className="px-3 py-4 text-sm text-gray-400 text-center">Ничего не найдено</div>
                )}
              </div>
            </div>
          )}

          {openFilter === 'departments' && (
            <div className="flex-1 overflow-y-auto">
              <div className="px-3 pb-3">
                <button
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded transition-colors mb-1"
                  onClick={toggleAllDepartments}
                  style={{ fontWeight: 500 }}
                >
                  {enabledDepartments.size === departments.length ? 'Снять все' : 'Выбрать все'}
                </button>
                {filteredDepartments.map(dept => (
                  <label
                    key={dept.id}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={enabledDepartments.has(dept.id)}
                      onChange={() => toggleDepartment(dept.id)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm">{dept.name}</span>
                  </label>
                ))}
                {searchLower && filteredDepartments.length === 0 && (
                  <div className="px-3 py-4 text-sm text-gray-400 text-center">Ничего не найдено</div>
                )}
              </div>
            </div>
          )}

          {openFilter === 'projects' && (
            <div className="flex-1 overflow-y-auto">
              <div className="px-3 pb-3">
                <button
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded transition-colors mb-1"
                  onClick={toggleAllProjects}
                  style={{ fontWeight: 500 }}
                >
                  {enabledProjects.size === projects.length ? 'Снять все' : 'Выбрать все'}
                </button>
                {filteredProjects.map(project => (
                  <label
                    key={project.id}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={enabledProjects.has(project.id)}
                      onChange={() => toggleProject(project.id)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex items-center gap-2 flex-1">
                      <div
                        className="w-3 h-3 rounded"
                        style={{ backgroundColor: project.backgroundColor || '#3a87ad' }}
                      />
                      <span className="text-sm">{project.name}</span>
                    </div>
                  </label>
                ))}
                {searchLower && filteredProjects.length === 0 && (
                  <div className="px-3 py-4 text-sm text-gray-400 text-center">Ничего не найдено</div>
                )}
              </div>
              {/* "Only current week" toggle */}
              {enabledProjects.size > 0 && (
                <div className="px-4 py-2.5 border-t border-gray-200 bg-gray-50/80 shrink-0">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={projectFilterTodayOnly}
                      onClick={toggleProjectFilterTodayOnly}
                      className="relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none cursor-pointer"
                      style={{
                        backgroundColor: projectFilterTodayOnly ? 'rgb(59, 130, 246)' : 'rgb(209, 213, 219)',
                      }}
                    >
                      <span
                        className="pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ease-in-out"
                        style={{
                          transform: projectFilterTodayOnly ? 'translateX(16px)' : 'translateX(0)',
                        }}
                      />
                    </button>
                    <span className="text-xs text-gray-600" style={{ fontWeight: 500 }}>
                      Только на текущей неделе
                    </span>
                  </label>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Filter buttons */}
      <div className="flex items-center gap-2 p-3 rounded-xl shadow-[0_6px_20px_rgba(6,18,36,0.08)] bg-[rgba(0,0,0,0.75)] backdrop-blur-md">
        {/* Companies button */}
        <button
          className="relative w-10 h-10 rounded-[10px] flex items-center justify-center bg-white hover:bg-gray-100 transition-all outline-none focus:outline-none cursor-pointer"
          onClick={() => {
            toggleFilter('companies');
          }}
          title="Фильтр по компаниям"
          style={{ 
            background: openFilter === 'companies' ? 'rgba(59, 130, 246, 0.15)' : 
                        enabledCompanies.size > 0 ? 'rgba(59, 130, 246, 0.1)' : 'white',
            borderWidth: openFilter === 'companies' || enabledCompanies.size > 0 ? '2px' : '0',
            borderColor: openFilter === 'companies' || enabledCompanies.size > 0 ? 'rgb(59, 130, 246)' : 'transparent'
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke={openFilter === 'companies' || enabledCompanies.size > 0 ? 'rgb(59, 130, 246)' : '#000000'}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 21l18 0" />
            <path d="M9 8l1 0" />
            <path d="M9 12l1 0" />
            <path d="M9 16l1 0" />
            <path d="M14 8l1 0" />
            <path d="M14 12l1 0" />
            <path d="M14 16l1 0" />
            <path d="M5 21v-16a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v16" />
          </svg>
          {enabledCompanies.size > 0 && (
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white text-xs" style={{ fontWeight: 600 }}>
                {enabledCompanies.size}
              </span>
            </div>
          )}
        </button>

        {/* Departments button */}
        <button
          className="relative w-10 h-10 rounded-[10px] flex items-center justify-center bg-white hover:bg-gray-100 transition-all outline-none focus:outline-none cursor-pointer"
          onClick={() => {
            toggleFilter('departments');
          }}
          title="Фильтр по департаментам"
          style={{ 
            background: openFilter === 'departments' ? 'rgba(59, 130, 246, 0.15)' : 
                        enabledDepartments.size > 0 ? 'rgba(59, 130, 246, 0.1)' : 'white',
            borderWidth: openFilter === 'departments' || enabledDepartments.size > 0 ? '2px' : '0',
            borderColor: openFilter === 'departments' || enabledDepartments.size > 0 ? 'rgb(59, 130, 246)' : 'transparent'
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke={openFilter === 'departments' || enabledDepartments.size > 0 ? 'rgb(59, 130, 246)' : '#000000'}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 5a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14z" />
            <path d="M10 10h11" />
            <path d="M10 3v18" />
            <path d="M9 3l-6 6" />
            <path d="M10 7l-7 7" />
            <path d="M10 12l-7 7" />
            <path d="M10 17l-4 4" />
          </svg>
          {enabledDepartments.size > 0 && (
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white text-xs" style={{ fontWeight: 600 }}>
                {enabledDepartments.size}
              </span>
            </div>
          )}
        </button>

        {/* Projects button */}
        <button
          className="relative w-10 h-10 rounded-[10px] flex items-center justify-center bg-white hover:bg-gray-100 transition-all outline-none focus:outline-none cursor-pointer"
          onClick={() => {
            toggleFilter('projects');
          }}
          title="Фильтр по проектам"
          style={{ 
            background: openFilter === 'projects' ? 'rgba(59, 130, 246, 0.15)' : 
                        enabledProjects.size > 0 ? 'rgba(59, 130, 246, 0.1)' : 'white',
            borderWidth: openFilter === 'projects' || enabledProjects.size > 0 ? '2px' : '0',
            borderColor: openFilter === 'projects' || enabledProjects.size > 0 ? 'rgb(59, 130, 246)' : 'transparent'
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke={openFilter === 'projects' || enabledProjects.size > 0 ? 'rgb(59, 130, 246)' : '#000000'}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 4l16 0" />
            <path d="M4 20l16 0" />
            <path d="M6 9m0 2a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v2a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z" />
          </svg>
          {enabledProjects.size > 0 && (
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white text-xs" style={{ fontWeight: 600 }}>
                {enabledProjects.size}
              </span>
            </div>
          )}
        </button>

        {/* Indicator dot when filters active but panel closed */}
        {hasActiveFilters && !openFilter && (
          <>
            <div className="w-px h-[24px] bg-white/20" />
            <div className="flex items-center gap-1.5 px-2">
              <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              <span className="text-xs text-white/70" style={{ fontWeight: 500 }}>
                {enabledCompanies.size + enabledDepartments.size + enabledProjects.size}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
});