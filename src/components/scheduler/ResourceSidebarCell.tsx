import React, {
  useMemo,
  useState,
  useRef,
  useEffect,
  memo,
} from "react";
import { createPortal } from "react-dom";
import { MoreVertical, Edit, EyeOff } from "lucide-react";
import {
  Resource,
  SchedulerEvent,
  Project,
  Grade,
  Company,
} from "../../types/scheduler";
import { useScheduler } from "../../contexts/SchedulerContext";
import { useSettings } from "../../contexts/SettingsContext";
import { ResourceRowWithMenu } from "./ResourceRowWithMenu";

// ============================================================
// HELPERS
// ============================================================

// Size badge colors
const SIZE_BADGE_STYLES: Record<string, { bg: string; text: string }> = {
  S: { bg: '#22c55e', text: '#fff' },
  M: { bg: '#eab308', text: '#fff' },
  L: { bg: '#ef4444', text: '#fff' },
  XL: { bg: '#991b1b', text: '#fff' },
};

// Grade color based on position in sorted grades list
// Top (senior) = weight 1 → maroon, Bottom (junior) = weight 3 → green
function getGradeColor(resource: Resource, grades: Grade[]): string | null {
  if (!resource.grade && !resource.gradeId) return null;
  const sorted = [...grades].sort((a, b) => a.sort_order - b.sort_order);
  const n = sorted.length;
  if (n === 0) return null;
  
  const idx = sorted.findIndex(g => 
    (resource.gradeId && String(g.id) === String(resource.gradeId)) ||
    (!resource.gradeId && g.name === resource.grade)
  );
  if (idx === -1) return null;
  
  const weight = n === 1 ? 2 : 1 + (idx / (n - 1)) * 2;
  if (weight >= 2.5) return '#22c55e';   // green (junior)
  if (weight >= 1.75) return '#eab308';  // yellow (middle)
  if (weight >= 1.25) return '#ef4444';  // red (senior)
  return '#991b1b';                       // maroon (top/lead)
}

function SizeBadge({ size }: { size?: string | null }) {
  if (!size) return null;
  const style = SIZE_BADGE_STYLES[size] || { bg: '#9ca3af', text: '#fff' };
  return (
    <span
      className="inline-flex items-center justify-center rounded-[4px] font-semibold shrink-0"
      style={{
        backgroundColor: style.bg,
        color: style.text,
        fontSize: '10px',
        lineHeight: '14px',
        padding: '2px 5px',
        minWidth: '22px',
      }}
    >
      {size}
    </span>
  );
}

function getCompanyName(resource: Resource, companies?: Company[]): string | null {
  if (!companies || companies.length === 0 || !resource.companyId) return null;
  const sorted = [...companies].sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999));
  const mainCompanyId = sorted[0]?.id;
  if (String(resource.companyId) === String(mainCompanyId)) return null;
  const company = companies.find(c => String(c.id) === String(resource.companyId));
  return company?.name || null;
}

function getUserSignificantProjects(
  resourceId: string,
  events: SchedulerEvent[],
  projects: Project[],
  currentWeekIndex: number,
  weeksInYear: number,
): Project[] {
  const rangeStart = Math.max(0, currentWeekIndex - 1);
  const rangeEnd = Math.min(weeksInYear, currentWeekIndex + 5);
  const totalWeeksInRange = rangeEnd - rangeStart;
  const averageLoad = 2;

  const userEvents = events.filter(
    (e) =>
      e.resourceId === resourceId &&
      e.startWeek < rangeEnd &&
      e.startWeek + e.weeksSpan > rangeStart,
  );

  if (userEvents.length === 0) return [];

  const projectWeightMap = new Map<string, number>();

  userEvents.forEach((event) => {
    const eventStart = Math.max(event.startWeek, rangeStart);
    const eventEnd = Math.min(
      event.startWeek + event.weeksSpan,
      rangeEnd,
    );
    const weeksInRange = eventEnd - eventStart;

    if (weeksInRange > 0) {
      const weight = weeksInRange * event.unitsTall;
      const current =
        projectWeightMap.get(event.projectId) || 0;
      projectWeightMap.set(event.projectId, current + weight);
    }
  });

  const threshold = totalWeeksInRange * 0.25 * averageLoad;
  const significantProjectIds = Array.from(
    projectWeightMap.entries(),
  )
    .filter(([, weight]) => weight >= threshold)
    .map(([projectId]) => projectId);

  const sortedProjectIds = Array.from(
    projectWeightMap.entries(),
  )
    .filter(([projectId]) =>
      significantProjectIds.includes(projectId),
    )
    .sort((a, b) => b[1] - a[1])
    .map(([projectId]) => projectId);

  return sortedProjectIds
    .map((id) => projects.find((p) => p.id === id))
    .filter((p): p is Project => p !== undefined);
}

function ProjectBadge({ project }: { project: Project }) {
  return (
    <div
      className="rounded-[8px] shrink-0"
      style={{
        backgroundColor: project.backgroundColor || "#aeeb3d",
        width: "6px",
        height: "16px",
      }}
      title={project.name}
    />
  );
}

function ProjectsContainer({
  projects,
  rowHeight = 144,
}: {
  projects: Project[];
  rowHeight?: number;
}) {
  const [showAllProjects, setShowAllProjects] = useState(false);
  const [visibleCount, setVisibleCount] = useState(projects.length);
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);

  // Dynamically measure how many badges fit in one line
  useEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    const calculateVisible = () => {
      const containerWidth = container.clientWidth;
      const children = measure.children;
      if (children.length === 0) {
        setVisibleCount(projects.length);
        return;
      }

      const badgeGap = 8; // gap-x-2 = 8px
      const overflowBadgeWidth = 36; // approximate "+N" badge width
      let usedWidth = 0;
      let count = 0;

      for (let i = 0; i < children.length; i++) {
        const childWidth = (children[i] as HTMLElement).offsetWidth;
        const neededForRest = i < children.length - 1 ? overflowBadgeWidth + badgeGap : 0;
        
        if (usedWidth + childWidth + neededForRest <= containerWidth) {
          usedWidth += childWidth + (i > 0 ? badgeGap : 0);
          count++;
        } else {
          // Check if ALL remaining items would need a +N badge
          // If this is the last item and it fits without the badge space, show it
          if (i === children.length - 1 && usedWidth + childWidth <= containerWidth) {
            count++;
          }
          break;
        }
      }

      setVisibleCount(Math.max(1, count));
    };

    calculateVisible();

    const observer = new ResizeObserver(calculateVisible);
    observer.observe(container);
    return () => observer.disconnect();
  }, [projects]);

  const visibleProjects = projects.slice(0, visibleCount);
  const hiddenProjects = projects.slice(visibleCount);
  const overflowCount = hiddenProjects.length;

  return (
    <div
      className="relative mt-[4px]"
      ref={containerRef}
      onMouseEnter={() => {
        if (overflowCount > 0) setShowAllProjects(true);
      }}
      onMouseLeave={() => setShowAllProjects(false)}
    >
      {/* Hidden measurement container */}
      <div
        ref={measureRef}
        className="flex items-center gap-x-2 absolute top-0 left-0 invisible pointer-events-none whitespace-nowrap"
        style={{ width: 'max-content' }}
        aria-hidden="true"
      >
        {projects.map((project) => (
          <div
            key={project.id}
            className={`rounded-[4px] px-[6px] shrink-0 ${rowHeight <= 96 ? "py-[0px]" : "py-[1px]"}`}
            style={{ backgroundColor: project.backgroundColor || "#aeeb3d" }}
          >
            <div
              className={`${rowHeight <= 96 ? "text-[8px] leading-[12px]" : "text-[10px] leading-[14px]"} font-medium truncate max-w-[100px]`}
              style={{ color: project.textColor || "#000000" }}
            >
              {project.name}
            </div>
          </div>
        ))}
      </div>

      {/* Visible container - single line */}
      <div className="flex items-center gap-x-2 overflow-hidden">
        {visibleProjects.map((project) => (
          <div
            key={project.id}
            className={`rounded-[4px] px-[6px] max-w-[100px] shrink-0 ${rowHeight <= 96 ? "py-[0px]" : "py-[1px]"}`}
            style={{
              backgroundColor: project.backgroundColor || "#aeeb3d",
            }}
            title={project.name}
          >
            <div
              className={`${rowHeight <= 96 ? "text-[8px] leading-[12px]" : "text-[10px] leading-[14px]"} font-medium truncate`}
              style={{ color: project.textColor || "#000000" }}
            >
              {project.name}
            </div>
          </div>
        ))}

        {overflowCount > 0 && (
          <div className="relative">
            <div
              className="relative rounded-[8px] shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
              style={{ backgroundColor: "#e5e5e5" }}
            >
              <div className="px-[7px] py-[2px] flex items-center justify-center">
                <p
                  className="font-semibold text-[10px] leading-[16px] whitespace-nowrap"
                  style={{ color: "#666" }}
                >
                  +{overflowCount}
                </p>
              </div>
            </div>

            {showAllProjects &&
              createPortal(
                <div
                  className="bg-white rounded-lg shadow-lg border border-gray-200 py-2 px-3 min-w-[140px] max-w-[240px]"
                  style={{
                    position: "fixed",
                    top: `${containerRef.current?.getBoundingClientRect().bottom ?? 0}px`,
                    left: `${containerRef.current?.getBoundingClientRect().left ?? 0}px`,
                    zIndex: 9999,
                  }}
                >
                  <div className="flex flex-wrap gap-1.5">
                    {hiddenProjects.map((project) => (
                      <div
                        key={project.id}
                        className={`rounded-[4px] px-[6px] max-w-[100px] shrink-0 ${rowHeight <= 96 ? "py-[0px]" : "py-[1px]"}`}
                        style={{
                          backgroundColor: project.backgroundColor || "#aeeb3d",
                        }}
                        title={project.name}
                      >
                        <div
                          className={`${rowHeight <= 96 ? "text-[8px] leading-[12px]" : "text-[10px] leading-[14px]"} font-medium truncate`}
                          style={{ color: project.textColor || "#000000" }}
                        >
                          {project.name}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>,
                document.body,
              )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// TABLE VIEW
// ============================================================

function TableViewCell({
  resource,
  grades,
  companies,
  significantProjects,
  rowHeight,
}: {
  resource: Resource;
  grades: Grade[];
  companies?: Company[];
  significantProjects: Project[];
  rowHeight: number;
}) {
  const companyName = getCompanyName(resource, companies);
  const gradeName = resource.grade || '';
  const size = resource.size;
  const fullName = resource.fullName || 'Unknown';
  const position = resource.position || '';
  const gradeColor = getGradeColor(resource, grades);
  const isExtraSmall = rowHeight <= 60; // XS size

  return (
    <div className={`flex flex-col justify-center h-full ${isExtraSmall ? 'gap-0' : 'gap-2'}`}>
      <div className={`flex items-start gap-2`}>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium leading-[18px] text-black truncate">{fullName}</p>
          {!isExtraSmall && (
            <div className="flex items-center gap-1 text-[10px]">
              {companyName && (
                <span className="leading-[13px] text-[#0062FF] shrink-0">{companyName}</span>
              )}
              <span className="leading-[14px] text-[#868789] truncate">{position}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {gradeName && (
            <div
              className="rounded-[4px] border inline-flex items-center justify-center shrink-0"
              style={{
                borderColor: gradeColor || '#e5e7eb',
                backgroundColor: gradeColor ? `${gradeColor}20` : 'transparent',
                padding: '1px 5px',
              }}
            >
                <span
                  className="text-[10px] leading-[14px] font-medium whitespace-nowrap"
                  style={{ color: gradeColor || '#555' }}
                >
                  {gradeName}
                </span>
            </div>
          )}
          <SizeBadge size={size} />
        </div>
      </div>
      <ProjectsContainer projects={significantProjects} rowHeight={rowHeight} />
    </div>
  );
}

// ============================================================
// COMPONENT
// ============================================================

export const ResourceSidebarCell = memo(
  ({
    resource,
    searchQuery,
    onEditUser,
    onDeleteUser,
    events,
    projects,
    grades,
    companies,
    resourceIndex,
    currentWeekIndex,
    weeksInYear,
    rowHeight,
    sidebarCollapsed,
    showSeparators,
    isLastInDept,
    departmentColor,
    getUserInitials,
  }: {
    resource: Resource;
    searchQuery?: string;
    onEditUser?: (id: string) => void;
    onDeleteUser?: (id: string) => void;
    events: SchedulerEvent[];
    projects: Project[];
    grades: Grade[];
    companies?: Company[];
    resourceIndex?: number;
    currentWeekIndex: number;
    weeksInYear: number;
    rowHeight: number;
    sidebarCollapsed?: boolean;
    showSeparators?: boolean;
    isLastInDept?: boolean;
    departmentColor?: string | null;
    getUserInitials: (
      displayName?: string,
      email?: string,
    ) => string;
  }) => {
    const { toggleUserVisibility } = useScheduler();
    const { tableView } = useSettings();
    const [isHovered, setIsHovered] = React.useState(false);
    const [showMenu, setShowMenu] = React.useState(false);
    const [menuPosition, setMenuPosition] = React.useState({
      top: 0,
      left: 0,
    });
    const menuRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    const significantProjects = useMemo(() => {
      return getUserSignificantProjects(
        resource.id,
        events,
        projects,
        currentWeekIndex,
        weeksInYear,
      );
    }, [
      resource.id,
      events,
      projects,
      currentWeekIndex,
      weeksInYear,
    ]);

    useEffect(() => {
      if (showMenu && buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setMenuPosition({
          top: rect.bottom + 4,
          left: rect.right - 140,
        });
      }
    }, [showMenu]);

    useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (
          menuRef.current &&
          !menuRef.current.contains(e.target as Node)
        ) {
          setShowMenu(false);
        }
      };

      if (showMenu) {
        document.addEventListener(
          "mousedown",
          handleClickOutside,
        );
        return () =>
          document.removeEventListener(
            "mousedown",
            handleClickOutside,
          );
      }
    }, [showMenu]);

    const gapClass = rowHeight <= 96 ? "gap-1" : "gap-3";

    return (
      <div
        className="w-full h-full flex items-center pl-2"
        style={{ position: "relative" }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div
          className={`w-full h-full flex flex-col ${rowHeight <= 60 ? "gap-0" : gapClass} justify-center border-l border-r border-[#f0f0f0] ${sidebarCollapsed ? "px-0" : "px-4"}`}
          style={{
            boxShadow: [
              departmentColor ? `inset 2px 0 0 0 ${departmentColor}` : '',
              showSeparators && !isLastInDept
                ? (departmentColor ? `inset 2px -1px 0 0 #f0f0f0` : `inset 0 -1px 0 0 #f0f0f0`)
                : '',
            ].filter(Boolean).join(', ') || undefined,
            backgroundColor: departmentColor ? `color-mix(in srgb, ${departmentColor} 7%, transparent)` : undefined,
          }}
        >
          {sidebarCollapsed ? (
            <ResourceRowWithMenu
              resource={resource}
              grades={grades}
              searchQuery={searchQuery}
              getUserInitials={getUserInitials}
              onEdit={onEditUser}
              onDelete={onDeleteUser}
              rowHeight={rowHeight}
              isHovered={isHovered}
              showOnlyAvatar={true}
              departmentColor={departmentColor || undefined}
            />
          ) : tableView ? (
            <TableViewCell
              resource={resource}
              grades={grades}
              companies={companies}
              significantProjects={significantProjects}
              rowHeight={rowHeight}
            />
          ) : (
            <>
              <ResourceRowWithMenu
                resource={resource}
                grades={grades}
                searchQuery={searchQuery}
                getUserInitials={getUserInitials}
                onEdit={onEditUser}
                onDelete={onDeleteUser}
                rowHeight={rowHeight}
                isHovered={isHovered}
                departmentColor={departmentColor || undefined}
              />
              <div className={rowHeight <= 60 ? "-mt-1" : ""}>
                <ProjectsContainer
                  projects={significantProjects}
                  rowHeight={rowHeight}
                />
              </div>
            </>
          )}
        </div>

        {!sidebarCollapsed && (onEditUser || onDeleteUser) && (
          <button
            ref={buttonRef}
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="transition-all"
            title="Действия"
            style={{
              position: "absolute",
              right: "4px",
              top: "50%",
              transform: "translateY(-50%)",
              boxSizing: "border-box",
              display: "flex",
              gap: "6px",
              alignItems: "center",
              justifyContent: "center",
              padding: "0",
              width: "20px",
              height: "24px",
              borderRadius: "12px",
              cursor: "pointer",
              background: "#ffffff",
              opacity: isHovered ? 1 : 0,
              pointerEvents: isHovered ? "auto" : "none",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#f5f5f5";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#ffffff";
            }}
          >
            <MoreVertical className="w-4 h-4 text-gray-600" />
          </button>
        )}

        {showMenu && (onEditUser || onDeleteUser) &&
          createPortal(
            <div
              ref={menuRef}
              className="bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[140px]"
              style={{
                position: "fixed",
                top: `${menuPosition.top}px`,
                left: `${menuPosition.left}px`,
                zIndex: 9999,
              }}
            >
              {onEditUser && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditUser(resource.id);
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 text-gray-700 transition-colors"
                >
                  <Edit className="w-4 h-4" />
                  Изменить
                </button>
              )}
              {onDeleteUser && (
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    try {
                      await toggleUserVisibility(resource.id);
                      setShowMenu(false);
                    } catch (error) {
                      console.error(
                        "Ошибка при скрытии сотрудника:",
                        error,
                      );
                    }
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 text-red-600 transition-colors"
                >
                  <EyeOff className="w-4 h-4" />
                  Скрыть
                </button>
              )}
            </div>,
            document.body,
          )}
      </div>
    );
  },
);