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
import { VirtualizationState } from '../../hooks/useVirtualization';

interface VirtualizedSchedulerGridProps {
  config: LayoutConfig;
  visibleDepartments: Department[];
  resources: Resource[];
  grades: Grade[];
  companies: Company[];
  workspace?: Workspace;
  onCellClick: (resourceId: string, week: number, unitIndex: number) => void;
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
  virtualization: VirtualizationState;
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

// Мемоизированный компонент для ячейки ресурса
const ResourceCell = memo(({
  resource,
  week,
  config,
  isLastInMonth,
  isLastInDepartment,
  onCellMouseMove,
  onCellMouseLeave,
  onCellClick
}: {
  resource: Resource;
  week: number;
  config: LayoutConfig;
  isLastInMonth: boolean;
  isLastInDepartment: boolean;
  onCellMouseMove: (e: React.MouseEvent, resourceId: string, week: number) => void;
  onCellMouseLeave: () => void;
  onCellClick: (resourceId: string, week: number, unitIndex: number) => void;
}) => {
  return (
    <div
      className={`cell resource-row event-row ${isLastInMonth ? 'last-in-month' : ''}`}
      style={{
        height: `${config.eventRowH}px`,
        background: '#fff',
        borderRight: '0.5px solid #dfe7ee',
        borderBottom: isLastInDepartment ? '2px solid #000' : '0.5px solid #dfe7ee',
        cursor: 'pointer',
        contain: 'layout style paint'
      }}
      data-resource-id={resource.id}
      data-week={week}
      onMouseMove={(e) => onCellMouseMove(e, resource.id, week)}
      onMouseLeave={onCellMouseLeave}
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const unitIndex = Math.floor((y - config.rowPaddingTop) / config.unitStride);
        onCellClick(resource.id, week, unitIndex);
      }}
    />
  );
}, (prev, next) => {
  // Оптимизированное сравнение - ячейка неизменна если не меняются key props
  return (
    prev.resource.id === next.resource.id &&
    prev.week === next.week &&
    prev.isLastInMonth === next.isLastInMonth &&
    prev.isLastInDepartment === next.isLastInDepartment &&
    prev.config.eventRowH === next.config.eventRowH
  );
});

ResourceCell.displayName = 'ResourceCell';

// Мемоизированный заголовок ресурса
const ResourceHeader = memo(({
  resource,
  config,
  isLastInDepartment,
  getGradeName,
  getCompanyName
}: {
  resource: Resource;
  config: LayoutConfig;
  isLastInDepartment: boolean;
  getGradeName: (gradeId: string | undefined) => string | undefined;
  getCompanyName: (companyId: string | undefined) => string | undefined;
}) => {
  return (
    <div
      className="cell sticky-col resource-row event-row"
      style={{
        height: `${config.eventRowH}px`,
        position: 'sticky',
        left: 0,
        zIndex: 50,
        background: '#fff',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        borderRight: '0.5px solid #dfe7ee',
        borderBottom: isLastInDepartment ? '2px solid #000' : '0.5px solid #dfe7ee',
        contain: 'layout style paint'
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
}, (prev, next) => {
  return (
    prev.resource.id === next.resource.id &&
    prev.resource.fullName === next.resource.fullName &&
    prev.resource.position === next.resource.position &&
    prev.resource.grade === next.resource.grade &&
    prev.resource.companyId === next.resource.companyId &&
    prev.config.eventRowH === next.config.eventRowH &&
    prev.isLastInDepartment === next.isLastInDepartment
  );
});

ResourceHeader.displayName = 'ResourceHeader';

export const VirtualizedSchedulerGrid = memo(function VirtualizedSchedulerGrid({
  config,
  visibleDepartments,
  resources,
  grades,
  companies,
  workspace,
  onCellClick,
  onCellMouseMove,
  onCellMouseLeave,
  onBackToWorkspaces,
  onSignOut,
  onOpenProfileModal,
  onOpenSettingsModal,
  currentUserDisplayName,
  currentUserEmail,
  currentUserAvatarUrl,
  gridRef,
  virtualization
}: VirtualizedSchedulerGridProps) {
  const timelineYear = workspace?.timeline_year || new Date().getFullYear();
  const months = useMemo(() => generateMonths(timelineYear), [timelineYear]);
  const lastWeeks = useMemo(() => getLastWeeksOfMonths(months), [months]);

  const getGradeName = useCallback((gradeId: string | undefined): string | undefined => {
    if (!gradeId) return undefined;
    const grade = grades.find(g => g.id === gradeId);
    return grade?.name;
  }, [grades]);

  const getCompanyName = useCallback((companyId: string | undefined): string | undefined => {
    if (!companyId) return undefined;
    const company = companies.find(c => c.id === companyId);
    return company?.name;
  }, [companies]);

  // Подготовка данных для рендеринга с учетом виртуализации
  const { visibleStartRow, visibleEndRow, visibleStartWeek, visibleEndWeek } = virtualization;
  
  // Создаем массив департаментов с ресурсами для виртуализации
  const departmentRows = useMemo(() => {
    const rows: Array<{ type: 'department' | 'resource'; dept: Department; resource?: Resource; isLastInDepartment?: boolean; rowIndex: number }> = [];
    let rowIndex = 0;
    
    visibleDepartments.forEach(dept => {
      // Строка департамента
      rows.push({ type: 'department', dept, rowIndex: rowIndex++ });
      
      // Ресурсы департамента
      const deptResources = sortResourcesByGrade(resources.filter(r => r.departmentId === dept.id));
      deptResources.forEach((resource, resIndex) => {
        rows.push({
          type: 'resource',
          dept,
          resource,
          isLastInDepartment: resIndex === deptResources.length - 1,
          rowIndex: rowIndex++
        });
      });
    });
    
    return rows;
  }, [visibleDepartments, resources]);

  // Фильтруем только видимые строки
  const visibleRows = useMemo(() => {
    return departmentRows.filter(row => 
      row.rowIndex >= visibleStartRow && row.rowIndex < visibleEndRow
    );
  }, [departmentRows, visibleStartRow, visibleEndRow]);

  // Фильтруем только видимые недели для оптимизации
  const visibleWeeks = useMemo(() => {
    return Array.from(
      { length: visibleEndWeek - visibleStartWeek },
      (_, i) => visibleStartWeek + i
    );
  }, [visibleStartWeek, visibleEndWeek]);

  // Общая высота контента для скролла
  const totalHeight = useMemo(() => {
    return departmentRows.reduce((acc, row) => {
      return acc + (row.type === 'department' ? config.rowH : config.eventRowH);
    }, 0);
  }, [departmentRows, config.rowH, config.eventRowH]);

  // Оффсет для виртуализации строк
  const rowOffset = useMemo(() => {
    let offset = 0;
    for (let i = 0; i < visibleStartRow && i < departmentRows.length; i++) {
      offset += departmentRows[i].type === 'department' ? config.rowH : config.eventRowH;
    }
    return offset;
  }, [visibleStartRow, departmentRows, config.rowH, config.eventRowH]);

  return (
    <div
      ref={gridRef}
      className="grid-table"
      style={{
        position: 'relative',
        width: `${config.resourceW + WEEKS * config.weekPx}px`,
        height: `${totalHeight + config.rowH * 2}px`, // +2 rows для заголовков
        borderTop: '0.5px solid #dfe7ee',
        borderLeft: '0.5px solid #dfe7ee',
        background: 'transparent'
      }}
    >
      {/* Top-left sticky header */}
      <div
        className="cell sticky-top header-cell"
        style={{
          position: 'sticky',
          top: 0,
          left: 0,
          background: '#fff',
          zIndex: 201,
          height: `${config.rowH * 2}px`,
          width: `${config.resourceW}px`,
          display: 'flex',
          alignItems: 'center',
          padding: '6px 12px',
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

      {/* Month headers */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: `${config.resourceW}px`,
          height: `${config.rowH}px`,
          display: 'flex',
          width: `${WEEKS * config.weekPx}px`
        }}
      >
        {months.map((month, idx) => {
          const isLastMonth = idx === months.length - 1;
          return (
            <div
              key={`month-${idx}`}
              className={`cell sticky-top month ${isLastMonth ? 'last-in-month' : ''}`}
              style={{
                width: `${month.weeks * config.weekPx}px`,
                height: `${config.rowH}px`,
                position: 'sticky',
                top: 0,
                background: '#f3f3f3',
                borderRight: '1px solid #bbb',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                padding: '6px 8px',
                zIndex: 60,
                contain: 'layout style paint'
              }}
            >
              {month.name}
            </div>
          );
        })}
      </div>

      {/* Week headers - только видимые недели */}
      <div
        style={{
          position: 'absolute',
          top: `${config.rowH}px`,
          left: `${config.resourceW}px`,
          height: `${config.rowH}px`,
          display: 'flex',
          width: `${WEEKS * config.weekPx}px`
        }}
      >
        {visibleWeeks.map(i => {
          const isLastInMonth = lastWeeks.has(i);
          return (
            <div
              key={`week-${i}`}
              className={`cell sticky-top2 ${isLastInMonth ? 'last-in-month' : ''}`}
              style={{
                width: `${config.weekPx}px`,
                height: `${config.rowH}px`,
                background: '#f9f9f9',
                position: 'sticky',
                top: `${config.rowH}px`,
                fontSize: `${config.weekPx <= 48 ? 10 : config.weekPx <= 80 ? 11 : config.weekPx <= 112 ? 12 : 14}px`,
                color: '#ccc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 6px',
                borderRight: '0.5px solid #dfe7ee',
                borderBottom: '0.5px solid #dfe7ee',
                zIndex: 60,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                contain: 'layout style paint'
              }}
            >
              {weekLabel(i, timelineYear)}
            </div>
          );
        })}
      </div>

      {/* Virtualized department and resource rows */}
      <div
        style={{
          position: 'absolute',
          top: `${config.rowH * 2 + rowOffset}px`,
          left: 0,
          right: 0
        }}
      >
        {visibleRows.map((row) => {
          if (row.type === 'department') {
            return (
              <div
                key={`dept-${row.dept.id}`}
                style={{
                  display: 'flex',
                  height: `${config.rowH}px`,
                  contain: 'layout style paint'
                }}
              >
                {/* Department header */}
                <div
                  className="cell sticky-col department-row"
                  style={{
                    width: `${config.resourceW}px`,
                    height: `${config.rowH}px`,
                    position: 'sticky',
                    left: 0,
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
                  {row.dept.name}
                </div>
                
                {/* Department cells - только видимые недели */}
                <div style={{ display: 'flex', flex: 1 }}>
                  {visibleWeeks.map(w => {
                    const isLastInMonth = lastWeeks.has(w);
                    return (
                      <div
                        key={`dept-${row.dept.id}-week-${w}`}
                        className={`cell department-row ${isLastInMonth ? 'last-in-month' : ''}`}
                        style={{
                          width: `${config.weekPx}px`,
                          height: `${config.rowH}px`,
                          background: '#f0f5fa',
                          borderRight: '0.5px solid #dfe7ee',
                          borderBottom: '1px solid #e6eef8',
                          contain: 'layout style paint'
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            );
          } else if (row.resource) {
            return (
              <div
                key={`resource-${row.resource.id}`}
                style={{
                  display: 'flex',
                  height: `${config.eventRowH}px`,
                  contain: 'layout style paint'
                }}
              >
                {/* Resource header */}
                <ResourceHeader
                  resource={row.resource}
                  config={config}
                  isLastInDepartment={row.isLastInDepartment || false}
                  getGradeName={getGradeName}
                  getCompanyName={getCompanyName}
                />
                
                {/* Resource cells - только видимые недели */}
                <div style={{ display: 'flex', flex: 1 }}>
                  {visibleWeeks.map(w => {
                    const isLastInMonth = lastWeeks.has(w);
                    return (
                      <ResourceCell
                        key={`${row.resource!.id}-${w}`}
                        resource={row.resource!}
                        week={w}
                        config={config}
                        isLastInMonth={isLastInMonth}
                        isLastInDepartment={row.isLastInDepartment || false}
                        onCellMouseMove={onCellMouseMove}
                        onCellMouseLeave={onCellMouseLeave}
                        onCellClick={onCellClick}
                      />
                    );
                  })}
                </div>
              </div>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
});

VirtualizedSchedulerGrid.displayName = 'VirtualizedSchedulerGrid';
