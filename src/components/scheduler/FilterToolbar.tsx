import { useState } from 'react';
import { useFilters } from '../../contexts/FilterContext';
import { Company, Department, Project } from '../../types/scheduler';

interface FilterToolbarProps {
  companies: Company[];
  departments: Department[];
  projects: Project[];
}

type FilterType = 'companies' | 'departments' | 'projects';

export function FilterToolbar({ companies, departments, projects }: FilterToolbarProps) {
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
    resetFilters
  } = useFilters();

  const [openFilter, setOpenFilter] = useState<FilterType | null>(null);

  const toggleFilter = (filter: FilterType) => {
    setOpenFilter(openFilter === filter ? null : filter);
  };

  const hasActiveFilters = enabledCompanies.size > 0 || enabledDepartments.size > 0 || enabledProjects.size > 0;

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

  return (
    <div className="fixed right-[18px] bottom-[18px] flex flex-col items-end gap-2 z-[500]">
      {/* Filter panel */}
      {openFilter && (
        <div className="rounded-xl shadow-[0_6px_20px_rgba(6,18,36,0.12)] bg-white overflow-hidden max-w-[320px] max-h-[60vh] flex flex-col mb-2">
          {openFilter === 'companies' && (
            <div>
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                <span style={{ fontWeight: 600, fontSize: '14px' }}>Компании</span>
              </div>
              <div className="px-4 py-3 max-h-[50vh] overflow-y-auto">
                <button
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded transition-colors mb-1"
                  onClick={toggleAllCompanies}
                  style={{ fontWeight: 500 }}
                >
                  {enabledCompanies.size === companies.length ? 'Снять все' : 'Выбрать все'}
                </button>
                {companies.map(company => (
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
              </div>
            </div>
          )}

          {openFilter === 'departments' && (
            <div>
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                <span style={{ fontWeight: 600, fontSize: '14px' }}>Департаменты</span>
              </div>
              <div className="px-4 py-3 max-h-[50vh] overflow-y-auto">
                <button
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded transition-colors mb-1"
                  onClick={toggleAllDepartments}
                  style={{ fontWeight: 500 }}
                >
                  {enabledDepartments.size === departments.length ? 'Снять все' : 'Выбрать все'}
                </button>
                {departments.map(dept => (
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
              </div>
            </div>
          )}

          {openFilter === 'projects' && (
            <div>
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                <span style={{ fontWeight: 600, fontSize: '14px' }}>Проекты</span>
              </div>
              <div className="px-4 py-3 max-h-[50vh] overflow-y-auto">
                <button
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded transition-colors mb-1"
                  onClick={toggleAllProjects}
                  style={{ fontWeight: 500 }}
                >
                  {enabledProjects.size === projects.length ? 'Снять все' : 'Выбрать все'}
                </button>
                {projects.map(project => (
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
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filter buttons */}
      <div className="flex items-center gap-2 p-3 rounded-xl shadow-[0_6px_20px_rgba(6,18,36,0.08)] bg-[rgba(0,0,0,0.75)] backdrop-blur-md">
        {/* Companies button */}
        <button
          className="relative w-10 h-10 rounded-[10px] flex items-center justify-center bg-white hover:bg-gray-100 transition-all outline-none focus:outline-none cursor-pointer"
          onClick={() => toggleFilter('companies')}
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
          onClick={() => toggleFilter('departments')}
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
          onClick={() => toggleFilter('projects')}
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

        {/* Reset button - shown only when filters are active */}
        {hasActiveFilters && (
          <>
            <div className="w-px h-[24px] bg-white/20" />
            <button
              className="h-10 px-3 rounded-[10px] flex items-center gap-2 bg-red-600/80 hover:bg-red-600 text-white transition-all outline-none focus:outline-none cursor-pointer"
              onClick={resetFilters}
              title="Сбросить все фильтры"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
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
              <span className="text-sm" style={{ fontWeight: 600 }}>
                Сбросить
              </span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
