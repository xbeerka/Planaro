import { useMemo, memo } from 'react';
import { Department, Resource, Grade, Company, Workspace } from '../../types/scheduler';
import { generateMonths, getLastWeeksOfMonths, WEEKS, weekLabel, sortResourcesByGrade } from '../../utils/scheduler';
import { LayoutConfig } from '../../utils/schedulerLayout';
import { ArrowLeft, User, ChevronDown, Settings, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

interface SchedulerGridProps {
  config: LayoutConfig;
  visibleDepartments: Department[];
  resources: Resource[];
  grades: Grade[];
  companies: Company[];
  workspace?: Workspace;
  onCellClick: (resourceId: string, week: number, unitIndex: number) => void;
  onCellContextMenu?: (e: React.MouseEvent, resourceId: string, week: number) => void;
  onCellMouseMove: (e: React.MouseEvent, resourceId: string, week: number) => void;
  onCellMouseLeave: () => void;
  onBackToWorkspaces?: () => void;
  onSignOut?: () => void;
  onOpenProfileModal?: () => void;
  onOpenSettingsModal?: () => void;
  currentUserDisplayName?: string;
  currentUserEmail?: string;
  currentUserAvatarUrl?: string;
  gridRef: React.RefObject<HTMLDivElement>;
}

// Вспомогательная функция для получения инициалов
function getUserInitials(displayName?: string, email?: string): string {
  if (displayName) {
    const parts = displayName.split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return parts[0][0].toUpperCase();
  }
  if (email) {
    return email[0].toUpperCase();
  }
  return 'U';
}

export function SchedulerGrid({
  config,
  visibleDepartments,
  resources,
  grades,
  companies,
  workspace,
  onCellClick,
  onCellContextMenu,
  onCellMouseMove,
  onCellMouseLeave,
  onBackToWorkspaces,
  onSignOut,
  onOpenProfileModal,
  onOpenSettingsModal,
  currentUserDisplayName,
  currentUserEmail,
  currentUserAvatarUrl,
  gridRef
}: SchedulerGridProps) {
  const timelineYear = workspace?.timeline_year || new Date().getFullYear();
  const months = useMemo(() => generateMonths(timelineYear), [timelineYear]);
  const lastWeeks = useMemo(() => getLastWeeksOfMonths(months), [months]);

  const getGradeName = (gradeId: string | undefined): string | undefined => {
    if (!gradeId) return undefined;
    const grade = grades.find(g => g.id === gradeId);
    return grade?.name;
  };

  const getCompanyName = (companyId: string | undefined): string | undefined => {
    if (!companyId) return undefined;
    const company = companies.find(c => c.id === companyId);
    return company?.name;
  };

  const gridCols = `${config.resourceW}px repeat(${WEEKS}, ${config.weekPx}px)`;
  const cells: JSX.Element[] = [];

  // Month headers
  let col = 2;
  months.forEach((month, idx) => {
    const isLastMonth = idx === months.length - 1;
    cells.push(
      <div
        key={`month-${idx}`}
        className={`cell sticky-top month ${isLastMonth ? 'last-in-month' : ''}`}
        style={{
          gridColumn: `${col} / span ${month.weeks}`,
          gridRow: 1,
          position: 'sticky',
          top: 0,
          background: '#f3f3f3',
          borderRight: '1px solid #bbb',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          padding: '6px 8px',
          height: `${config.rowH}px`,
          zIndex: 60
        }}
      >
        {month.name}
      </div>
    );
    col += month.weeks;
  });

  // Week headers
  for (let i = 0; i < WEEKS; i++) {
    const isLastInMonth = lastWeeks.has(i);
    cells.push(
      <div
        key={`week-${i}`}
        className={`cell sticky-top2 ${isLastInMonth ? 'last-in-month' : ''}`}
        style={{
          gridColumn: i + 2,
          gridRow: 2,
          background: '#f9f9f9',
          position: 'sticky',
          top: `${config.rowH}px`,
          fontSize: `${config.weekPx <= 48 ? 10 : config.weekPx <= 80 ? 11 : config.weekPx <= 112 ? 12 : 14}px`,
          color: '#ccc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 6px',
          height: `${config.rowH}px`,
          borderRight: '0.5px solid #dfe7ee',
          borderBottom: '0.5px solid #dfe7ee',
          zIndex: 60,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}
      >
        {weekLabel(i, timelineYear)}
      </div>
    );
  }

  // Department and resource rows
  let gridRow = 3;
  visibleDepartments.forEach(dept => {
    // Department header
    cells.push(
      <div
        key={`dept-header-${dept.id}`}
        className="cell sticky-col department-row"
        style={{
          gridColumn: 1,
          gridRow,
          height: `${config.rowH}px`,
          position: 'sticky',
          left: 0,
          top: `${config.rowH * 2}px`,
          zIndex: 150,
          background: '#f0f5fa',
          fontWeight: 800,
          fontSize: '14px',
          color: '#2c3e50',
          borderBottom: '1px solid #e6eef8',
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center'
        }}
      >
        {dept.name}
      </div>
    );

    // Department cells
    for (let w = 0; w < WEEKS; w++) {
      const isLastInMonth = lastWeeks.has(w);
      cells.push(
        <div
          key={`dept-${dept.id}-week-${w}`}
          className={`cell department-row ${isLastInMonth ? 'last-in-month' : ''}`}
          style={{
            gridColumn: w + 2,
            gridRow,
            height: `${config.rowH}px`,
            position: 'sticky',
            top: `${config.rowH * 2}px`,
            background: '#f0f5fa',
            borderRight: '0.5px solid #dfe7ee',
            borderBottom: '1px solid #e6eef8',
            zIndex: 140
          }}
        />
      );
    }
    gridRow++;

    // Resources in department
    const deptResources = sortResourcesByGrade(resources.filter(r => r.departmentId === dept.id));
    deptResources.forEach((resource, resIndex) => {
      const isLastInDepartment = resIndex === deptResources.length - 1;
      
      // Resource header
      cells.push(
        <div
          key={`resource-header-${resource.id}`}
          className="cell sticky-col resource-row event-row"
          style={{
            gridColumn: 1,
            gridRow,
            height: `${config.eventRowH}px`,
            position: 'sticky',
            left: 0,
            zIndex: 50,
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            padding: '0 16px',
            borderRight: '0.5px solid #dfe7ee',
            borderBottom: isLastInDepartment ? '2px solid #000' : '0.5px solid #dfe7ee'
          }}
        >
          <div className="resource-info flex flex-col items-start justify-center w-full gap-1">
            <div className="flex items-center gap-2 w-full">
              <div className="resource-name" style={{ fontWeight: 600, fontSize: '14px', width:'100%', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {resource.fullName || `User ${resource.id}`}
              </div>
            </div>
            <div
              className="resource-position"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                color: '#000',
                fontWeight: 400,
                lineHeight: 1.1,
                opacity: 0.4,
                marginTop: '2px',
              }}
            >
              {resource.companyId && resource.companyId !== '1' && getCompanyName(resource.companyId) && (
                <div
                  className="company-badge"
                  style={{
                    fontSize: '11px',
                    color: '#fff',
                    background: '#aa66cc',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontWeight: 600,
                    lineHeight: 1,
                  }}
                >
                  {getCompanyName(resource.companyId)}
                </div>
              )}
              {resource.grade && getGradeName(resource.grade) && (
                <div
                  className="grades"
                  style={{
                    fontSize: '11px',
                    color: '#fff',
                    background: '#3a87ad',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontWeight: 600,
                    lineHeight: 1,
                  }}
                >
                  {getGradeName(resource.grade)}
                </div>
              )}
              <span>{resource.position || 'No position'}</span>
            </div>
          </div>
        </div>
      );

      // Resource cells
      for (let w = 0; w < WEEKS; w++) {
        const isLastInMonth = lastWeeks.has(w);
        cells.push(
          <div
            key={`resource-${resource.id}-week-${w}`}
            className={`cell resource-row event-row ${isLastInMonth ? 'last-in-month' : ''}`}
            style={{
              gridColumn: w + 2,
              gridRow,
              height: `${config.eventRowH}px`,
              background: '#fff',
              borderRight: '0.5px solid #dfe7ee',
              borderBottom: isLastInDepartment ? '2px solid #000' : '0.5px solid #dfe7ee',
              cursor: 'pointer'
            }}
            data-resource-id={resource.id}
            data-week={w}
            onMouseMove={(e) => onCellMouseMove(e, resource.id, w)}
            onMouseLeave={onCellMouseLeave}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const y = e.clientY - rect.top;
              const unitIndex = Math.floor((y - config.rowPaddingTop) / config.unitStride);
              onCellClick(resource.id, w, unitIndex);
            }}
            onContextMenu={(e) => {
              if (onCellContextMenu) {
                onCellContextMenu(e, resource.id, w);
              }
            }}
          />
        );
      }
      gridRow++;
    });
  });

  return (
    <div
      ref={gridRef}
      className="grid-table"
      style={{
        display: 'grid',
        gridTemplateColumns: gridCols,
        width: 'max-content',
        borderTop: '0.5px solid #dfe7ee',
        borderLeft: '0.5px solid #dfe7ee',
        position: 'relative',
        background: 'transparent'
      }}
    >
      {/* Top-left header */}
      <div
        className="cell sticky-top header-cell"
        style={{
          gridColumn: 1,
          gridRow: '1 / span 2',
          position: 'sticky',
          top: 0,
          left: 0,
          background: '#fff',
          zIndex: 201,
          height: '72px',
          display: 'flex',
          alignItems: 'center',
          padding: '6px 12px',
          width: `${config.resourceW}px`,
          borderRight: '0.5px solid #dfe7ee',
          borderBottom: '0.5px solid #dfe7ee'
        }}
      >
        <div className="header-container flex items-center justify-between gap-2 w-full">
          {/* Left side: Back Button + Workspace Name */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {/* Back Button */}
            {onBackToWorkspaces && (
              <button
                onClick={onBackToWorkspaces}
                className="flex-shrink-0 w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
                title="Назад к списку пространств"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
            )}
            
            {/* Workspace Name */}
            <div className="flex-1 min-w-0">
              <div className="text-sm truncate" style={{ fontWeight: 600, color: '#1a1a1a' }}>
                {workspace?.name || 'Рабочее пространство'}
              </div>
              {workspace && (
                <div className="text-xs text-gray-500">
                  {workspace.timeline_year}
                </div>
              )}
            </div>
          </div>

          {/* Right side: Profile dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0">
                {/* Avatar */}
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center overflow-hidden">
                  {currentUserAvatarUrl ? (
                    <img 
                      src={currentUserAvatarUrl} 
                      alt={currentUserDisplayName || currentUserEmail || 'User'} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-white text-xs font-semibold">
                      {getUserInitials(currentUserDisplayName, currentUserEmail)}
                    </span>
                  )}
                </div>
                
                {/* Chevron Down */}
                <ChevronDown className="w-4 h-4 text-gray-500" />
              </button>
            </DropdownMenuTrigger>
            
            <DropdownMenuContent align="end" className="w-56">
              {onOpenProfileModal && (
                <DropdownMenuItem onClick={onOpenProfileModal}>
                  <User className="w-4 h-4 mr-2" />
                  Редактировать профиль
                </DropdownMenuItem>
              )}
              
              {onOpenSettingsModal && (
                <DropdownMenuItem onClick={onOpenSettingsModal}>
                  <Settings className="w-4 h-4 mr-2" />
                  Настройки
                </DropdownMenuItem>
              )}
              
              <DropdownMenuSeparator />
              
              {onSignOut && (
                <DropdownMenuItem onClick={onSignOut} className="text-red-600">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Выйти
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {cells}
    </div>
  );
}
