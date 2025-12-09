import React, {
  useMemo,
  forwardRef,
  useRef,
  useEffect,
  useCallback,
} from "react";
import {
  Department,
  Resource,
  Grade,
  Company,
  Workspace,
  Month,
  LayoutConfig as LayoutConfigType,
  Project,
  SchedulerEvent,
} from "../../types/scheduler";
import {
  generateMonths,
  getLastWeeksOfMonths,
  WEEKS,
  weekLabel,
  sortResourcesByGrade,
} from "../../utils/scheduler";
import { LayoutConfig } from "../../utils/schedulerLayout";
import { X } from "lucide-react";
import svgPaths from "../../imports/svg-k0w039fxgr";
import FakeSpaser from "../../imports/FakeSpaser";
import Fakebottomfix from "../../imports/Fakebottomfix";
import Header from "../../imports/Header";
import { useScheduler } from "../../contexts/SchedulerContext";
import { highlightMatch } from "../../utils/highlightMatch";
import { ResourceRowWithMenu } from "./ResourceRowWithMenu";

interface SchedulerGridProps {
  config: LayoutConfig;
  accessToken: string | null;
  visibleDepartments: Department[];
  departments: Department[];
  resources: Resource[];
  grades: Grade[];
  companies: Company[];
  workspace?: Workspace;
  months: Month[];
  lastWeeks: Set<number>;
  currentWeekIndex: number;
  showCurrentWeekMarker: boolean;
  renderEvents: () => React.ReactNode;
  hoverHighlight: any;
  ghost: any;
  eventsContainerRef: React.RefObject<HTMLDivElement>;
  onCellClick: (
    resourceId: string,
    week: number,
    unitIndex: number,
  ) => void;
  onCellContextMenu?: (
    e: React.MouseEvent,
    resourceId: string,
    week: number,
  ) => void;
  onCellMouseMove: (
    e: React.MouseEvent,
    resourceId: string,
    week: number,
  ) => void;
  onCellMouseLeave: () => void;
  onBackToWorkspaces?: () => void;
  onSignOut?: () => void;
  onOpenProfileModal?: () => void;
  onOpenSettingsModal?: () => void;
  currentUserDisplayName?: string;
  currentUserEmail?: string;
  currentUserAvatarUrl?: string;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  scissorsMode?: boolean;
  commentMode?: boolean;
  onToggleScissors?: () => void;
  onToggleComment?: () => void;
  onEditUser?: (resourceId: string) => void;
  onDeleteUser?: (resourceId: string) => void;
  hoveredResourceId?: string | null;
  onHoveredResourceIdChange?: (id: string | null) => void;
  onEventMouseEnter?: (resourceId: string) => void;
  children?: React.ReactNode;
  scrollRef?: React.RefObject<HTMLDivElement>;
}

function getUserInitials(
  displayName?: string,
  email?: string,
): string {
  if (displayName) {
    const parts = displayName.split(" ").filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return parts[0][0].toUpperCase();
  }
  if (email) {
    return email[0].toUpperCase();
  }
  return "U";
}

/**
 * Вычисляет значимые проекты пользователя за диапазон (1 неделя назад + 5 недель вперёд).
 * Возвращает проекты, которые занимают >= 25% от объема в этом диапазоне.
 * Учитывает как количество недель, так и высоту события (unitsTall).
 */
function getUserSignificantProjects(
  resourceId: string,
  events: SchedulerEvent[],
  projects: Project[],
  currentWeekIndex: number,
): Project[] {
  // Диапазон: 1 неделя назад + 5 недель вперед = 6 недель
  const rangeStart = Math.max(0, currentWeekIndex - 1);
  const rangeEnd = Math.min(WEEKS, currentWeekIndex + 5);
  const totalWeeksInRange = rangeEnd - rangeStart;

  // Предполагаем 4 юнита на ресурс (стандартная высота)
  const unitsPerResource = 4;
  const averageLoad = 2; // Средняя загрузка (50% от полной высоты)

  // Получить события пользователя в диапазоне
  const userEvents = events.filter(
    (e) =>
      e.resourceId === resourceId &&
      e.startWeek < rangeEnd &&
      e.startWeek + e.weeksSpan > rangeStart,
  );

  if (userEvents.length === 0) return [];

  // Подсчет "веса" по проектам (недели × unitsTall для учета загруженности)
  const projectWeightMap = new Map<string, number>();

  userEvents.forEach((event) => {
    const eventStart = Math.max(event.startWeek, rangeStart);
    const eventEnd = Math.min(
      event.startWeek + event.weeksSpan,
      rangeEnd,
    );
    const weeksInRange = eventEnd - eventStart;

    if (weeksInRange > 0) {
      // Вес = количество недель × высота события (юнит-недели)
      const weight = weeksInRange * event.unitsTall;
      const current =
        projectWeightMap.get(event.projectId) || 0;
      projectWeightMap.set(event.projectId, current + weight);
    }
  });

  // Фильтр: проекты, занимающие >= 25% от диапазона при средней загрузке
  // Порог = 25% от диапазона × средняя загрузка (2 units)
  const threshold = totalWeeksInRange * 0.25 * averageLoad;
  const significantProjectIds = Array.from(
    projectWeightMap.entries(),
  )
    .filter(([, weight]) => weight >= threshold)
    .map(([projectId]) => projectId);

  // Вернуть объекты проектов, отсортированные по весу (больше времени = выше)
  const sortedProjectIds = Array.from(
    projectWeightMap.entries(),
  )
    .filter(([projectId]) =>
      significantProjectIds.includes(projectId),
    )
    .sort((a, b) => b[1] - a[1]) // ✅ Сортировка: больший вес ПЕРВЫМ
    .map(([projectId]) => projectId);

  return sortedProjectIds
    .map((id) => projects.find((p) => p.id === id))
    .filter((p): p is Project => p !== undefined);
}

// --- Components from Figma Import ---

// ⚡ Optimized Resource Sidebar Cell with React.memo
// This prevents re-rendering of the heavy user projects calculation during scroll/updates
interface ResourceSidebarCellProps {
  resource: Resource;
  searchQuery?: string;
  getUserInitials: (name?: string, email?: string) => string;
  onEditUser?: (id: string) => void;
  onDeleteUser?: (id: string) => void;
  events: SchedulerEvent[];
  projects: Project[];
  currentWeekIndex: number;
}

const ResourceSidebarCell = React.memo(
  ({
    resource,
    searchQuery,
    getUserInitials,
    onEditUser,
    onDeleteUser,
    events,
    projects,
    currentWeekIndex,
  }: ResourceSidebarCellProps) => {
    // Memoize significant projects to avoid recalculation on every render
    const significantProjects = useMemo(() => {
      return getUserSignificantProjects(
        resource.id,
        events,
        projects,
        currentWeekIndex,
      );
    }, [resource.id, events, projects, currentWeekIndex]);

    return (
      <div
        className="w-full flex flex-col gap-3 items-start justify-center px-2 h-full 
             overflow-visible transform-gpu will-change-transform"
        style={{
          contain: "layout style",
          backfaceVisibility: "hidden",
        }}
      >
        {/* Profile (Avatar + Name + Position) */}
        <div className="w-full h-full  flex flex-col gap-3 items-start justify-center box-border border-l border-r px-4 border-[#f0f0f0]">
          <ResourceRowWithMenu
            resource={resource}
            searchQuery={searchQuery}
            getUserInitials={getUserInitials}
            onEdit={onEditUser}
            onDelete={onDeleteUser}
          />

          {/* Значимые проекты пользователя */}
          <ProjectsContainer projects={significantProjects} />
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison for better performance
    // Only re-render if critical props change
    return (
      prevProps.resource === nextProps.resource &&
      prevProps.searchQuery === nextProps.searchQuery &&
      prevProps.currentWeekIndex ===
        nextProps.currentWeekIndex &&
      prevProps.events === nextProps.events &&
      prevProps.projects === nextProps.projects
    );
  },
);

function ArrowUp() {
  return (
    <div
      className="relative size-full"
      data-name="Arrow - Up 2"
    >
      <div className="absolute bottom-[-0.01%] left-0 right-0 top-0">
        <svg
          className="block size-full"
          fill="none"
          preserveAspectRatio="none"
          viewBox="0 0 11 11"
        >
          <g id="Arrow - Up 2">
            <path
              d={svgPaths.p22ff0c80}
              fill="var(--fill-0, black)"
              id="Stroke 1 (Stroke)"
            />
          </g>
        </svg>
      </div>
    </div>
  );
}

function IconlyLightArrowUp() {
  return (
    <div
      className="relative size-[16px]"
      data-name="Iconly/Light/Arrow - Up 2"
    >
      <div className="absolute bottom-[13.74%] flex items-center justify-center left-1/2 top-[17.92%] translate-x-[-50%] w-[10.933px]">
        <div className="flex-none h-[10.934px] rotate-[180deg] w-[10.933px]">
          <ArrowUp />
        </div>
      </div>
    </div>
  );
}

function IconlyRegularLightArrowUp1() {
  return (
    <div
      className="relative size-[20px]"
      data-name="Iconly/Regular/Light/Arrow - Up 3"
    >
      <div
        className="absolute flex items-center justify-center left-1/2 size-[16px] top-1/2 translate-x-[-50%] translate-y-[-50%]"
        style={
          {
            "--transform-inner-width": "16",
            "--transform-inner-height": "16",
          } as React.CSSProperties
        }
      >
        <div className="flex-none rotate-[270deg] scale-y-[-100%]">
          <IconlyLightArrowUp />
        </div>
      </div>
    </div>
  );
}

// Back Button Wrapper
function HeaderBackButton({
  onClick,
}: {
  onClick?: () => void;
}) {
  return (
    <div
      className="relative rounded-[12px] shrink-0 w-[36px] cursor-pointer hover:bg-gray-100 transition-colors"
      data-name="input"
      onClick={onClick}
    >
      <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border content-stretch flex gap-[6px] items-center justify-center px-[12px] py-[8px] relative w-[36px]">
        <div className="flex items-center justify-center relative shrink-0">
          <div className="flex-none rotate-[180deg] scale-y-[-100%]">
            <IconlyRegularLightArrowUp1 />
          </div>
        </div>
      </div>
    </div>
  );
}

function ArrowUp1() {
  return (
    <div
      className="relative size-full"
      data-name="Arrow - Up 2"
    >
      <div className="absolute bottom-0 left-0 right-[-0.01%] top-[-0.01%]">
        <svg
          className="block size-full"
          fill="none"
          preserveAspectRatio="none"
          viewBox="0 0 9 6"
        >
          <g id="Arrow - Up 2">
            <path
              d={svgPaths.p1c596770}
              fill="var(--fill-0, black)"
              id="Stroke 1 (Stroke)"
            />
          </g>
        </svg>
      </div>
    </div>
  );
}

function IconlyRegularLightArrowUp() {
  return (
    <div
      className="relative shrink-0 size-[20px]"
      data-name="Iconly/Regular/Light/Arrow - Up 2"
    >
      <div className="absolute flex inset-[37.67%_27.67%_36%_27.67%] items-center justify-center">
        <div className="flex-none h-[5.266px] rotate-[180deg] scale-y-[-100%] w-[8.933px]">
          <ArrowUp1 />
        </div>
      </div>
    </div>
  );
}

function HeaderTitle({ name }: { name: string }) {
  return (
    <div
      className="content-stretch flex gap-[4px] items-start relative shrink-0"
      data-name="Header Title"
    >
      <p className="font-semibold leading-[normal] relative shrink-0 text-[14px] text-black text-nowrap whitespace-pre truncate max-w-[180px]">
        {name}
      </p>
      <IconlyRegularLightArrowUp />
    </div>
  );
}

function YearContainer({ year }: { year: number | string }) {
  return (
    <div
      className="h-[16px] relative shrink-0 w-full"
      data-name="Container"
    >
      <p className="absolute font-normal leading-[normal] left-0 text-[#868789] text-[12px] text-nowrap top-px whitespace-pre">
        {year}
      </p>
    </div>
  );
}

function InterfaceEssentialMagnifier() {
  return (
    <div
      className="relative shrink-0 size-[20px]"
      data-name="Interface essential/Magnifier"
    >
      <svg
        className="block size-full"
        fill="none"
        preserveAspectRatio="none"
        viewBox="0 0 20 20"
      >
        <g id="Interface essential/Magnifier">
          <path
            clipRule="evenodd"
            d={svgPaths.p2a8c8580}
            fill="var(--fill-0, #868789)"
            fillRule="evenodd"
            id="Icon"
          />
        </g>
      </svg>
    </div>
  );
}

// Search Input Wrapper
function SearchInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <div
      className="basis-0 bg-[rgba(0,0,0,0.03)] grow h-[36px] min-h-px min-w-px relative rounded-[10px] shrink-0"
      data-name="input"
    >
      <div className="flex flex-row items-center justify-center size-full">
        <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border content-stretch flex gap-[6px] h-[36px] items-center justify-center px-[12px] py-[10px] relative w-full">
          <InterfaceEssentialMagnifier />
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Поиск"
            className="basis-0 font-normal grow leading-[20px] min-h-px min-w-px relative shrink-0 text-black text-[14px] bg-transparent border-none outline-none placeholder-[#868789]"
          />
          {value && (
            <div
              className="cursor-pointer flex items-center justify-center text-[#868789] hover:text-black transition-colors"
              onClick={() => onChange("")}
            >
              <X size={14} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Project Badge Component
function ProjectBadge({ project }: { project: Project }) {
  const backgroundColor = project.backgroundColor || "#aeeb3d";
  const textColor = project.textColor || "#000";

  return (
    <div
      className="relative rounded-[8px] shrink-0"
      data-name="Container"
      style={{ backgroundColor }}
    >
      <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border content-stretch flex gap-[8px] items-center justify-center px-[7px] py-[2px] relative">
        <p
          className="font-semibold leading-[16px] relative shrink-0 text-[10px] text-nowrap whitespace-pre"
          style={{ color: textColor }}
        >
          {project.name}
        </p>
      </div>
    </div>
  );
}

// Projects Container
function ProjectsContainer({
  projects,
}: {
  projects: Project[];
}) {
  if (projects.length === 0) return null;

  return (
    <div
      className="content-center flex flex-wrap gap-[6px] items-center relative shrink-0 w-full"
      data-name="Container"
    >
      {projects.map((project) => (
        <ProjectBadge key={project.id} project={project} />
      ))}
    </div>
  );
}

export const SchedulerGrid = forwardRef<
  HTMLDivElement,
  SchedulerGridProps
>(
  (
    {
      config,
      accessToken,
      visibleDepartments,
      departments,
      resources,
      grades,
      companies,
      workspace,
      months,
      lastWeeks,
      currentWeekIndex,
      showCurrentWeekMarker,
      renderEvents,
      hoverHighlight,
      ghost,
      eventsContainerRef,
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
      searchQuery,
      onSearchChange,
      scissorsMode,
      commentMode,
      onToggleScissors,
      onToggleComment,
      onEditUser,
      onDeleteUser,
      hoveredResourceId,
      onHoveredResourceIdChange,
      onEventMouseEnter,
      children,
      scrollRef,
    },
    ref,
  ) => {
    const { events, projects } = useScheduler();

    // Constants - ДОЛЖНЫ быть ДО любых useCallback/useMemo которые их используют
    const LEFT_WIDTH = config.resourceW;
    const TOP_BAR_HEIGHT = 80; // ✅ Исправлено: при sticky не должен уезжать вверх на 16px
    const TITLE_AREA_HEIGHT = 96; // ✅ Title Area слева
    const SEARCH_AREA_HEIGHT = 80; // ✅ Search Area слева
    const HEADER_HEIGHT = config.rowH * 2; // Matches Month + Week rows
    const SEARCH_ROW_HEIGHT = 80; // ↑ Увеличено с 64px до 80px (сдвинули департаменты вниз на 16px)
    const TOTAL_TOP_HEIGHT = HEADER_HEIGHT + SEARCH_ROW_HEIGHT;

    const timelineYear =
      workspace?.timeline_year || new Date().getFullYear();

    // Refs for scroll synchronization
    // We use a single container for native scrolling performance
    const internalScrollRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = scrollRef || internalScrollRef;

    // Forward the scroll container ref
    React.useImperativeHandle(ref, () => ({
      scrollContainer:
        scrollContainerRef.current as HTMLDivElement,
    }));

    // Resources passed from parent are already filtered by search query
    const filteredResources = resources;

    // Filter departments - only show departments that have matching resources
    const filteredDepartments = useMemo(() => {
      // If search query is active, hide departments with no matching resources
      if (searchQuery) {
        const activeDeptIds = new Set(
          filteredResources.map((r) => r.departmentId),
        );
        return visibleDepartments.filter((dept) =>
          activeDeptIds.has(dept.id),
        );
      }
      return visibleDepartments;
    }, [visibleDepartments, filteredResources, searchQuery]);

    // Calculate used height for fake spacer
    // Note: This is less critical now as we use a single grid, but still good for the bottom spacer
    const usedHeight = useMemo(() => {
      return filteredDepartments.reduce((acc, dept) => {
        const deptResCount = filteredResources.filter(
          (r) => r.departmentId === dept.id,
        ).length;
        return acc + 44 + deptResCount * 144;
      }, TOTAL_TOP_HEIGHT);
    }, [
      filteredDepartments,
      filteredResources,
      TOTAL_TOP_HEIGHT,
    ]);

    // Build left cells (gridColumn: 1) - NOW STICKY
    const leftCells = useMemo(() => {
      const elements: JSX.Element[] = [];
      let gridRow = 4;

      filteredDepartments.forEach((dept) => {
        const deptResources = sortResourcesByGrade(
          filteredResources.filter(
            (r) => r.departmentId === dept.id,
          ),
        );

        // Department header
        elements.push(
          <div
            className="cell department-row"
            key={`dept-header-${dept.id}`}
            style={{
              gridColumn: 1,
              gridRow,
              position: "sticky",
              left: 0,
              zIndex: 300,
              height: "44px",
              display: "flex",
              alignItems: "center",
              padding: "0 8px",
              backgroundColor: "#fff",
            }}
          >
            <div
              className="w-full h-full flex items-center box-border pl-2"
              style={{
                padding: "0px 16px",
                borderLeft: "1px solid rgb(240, 240, 240)",
                borderRight: "1px solid rgb(240, 240, 240)",
              }}
            >
              <p className="font-medium text-xs text-[#868789] uppercase whitespace-nowrap">
                {dept.name}
              </p>
            </div>
          </div>,
        );
        gridRow++;

        // Resources in department
        deptResources.forEach((resource, resIndex) => {
          // Resource header
          elements.push(
            <div
              key={`resource-header-${resource.id}`}
              className="cell resource-row"
              style={{
                gridColumn: 1,
                gridRow,
                position: "sticky",
                left: 0,
                zIndex: 300,
                height: "144px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                backgroundColor: "#fff",
              }}
            >
              <div
                className="w-full h-full"
                data-resource-id={resource.id}
              >
                <ResourceSidebarCell
                  resource={resource}
                  searchQuery={searchQuery}
                  getUserInitials={getUserInitials}
                  onEdit={onEditUser}
                  onDelete={onDeleteUser}
                  events={events}
                  projects={projects}
                  currentWeekIndex={currentWeekIndex}
                />
              </div>
            </div>,
          );
          gridRow++;
        });
      });

      return elements;
    }, [
      filteredDepartments,
      filteredResources,
      events,
      projects,
      currentWeekIndex,
      searchQuery,
      onEditUser,
      onDeleteUser,
    ]);

    // Build right cells (gridColumn: 2+)
    const rightCells = useMemo(() => {
      const elements: JSX.Element[] = [];

      // Month headers (Row 2) - Shifted down by 1 for Header
      let col = 2; // Start at column 2 (1 is resources)
      months.forEach((month, idx) => {
        elements.push(
          <div
            key={`month-${idx}`}
            className="cell month"
            style={{
              gridColumn: `${col} / span ${month.weeks}`,
              gridRow: 2,
              position: "sticky",
              top: `${TOP_BAR_HEIGHT}px`, // ✅ 80px - на 16px выше чем Search Area
              zIndex: 200,
              height: `${config.rowH}px`,
              display: "flex",
              alignItems: "flex-start", // ✅ Прижать контент к верху
              alignSelf: "start", // ✅ Прижать к верху ячейки
              backgroundColor: "#fff",
              border: "none",
              paddingTop: 0, // ✅ Убрать верхний отступ
            }}
          >
            <div className="content-stretch flex items-start px-[4px] py-0 relative size-full w-full">
              <div className="basis-0 bg-[#f6f6f6] grow h-[36px] min-h-px min-w-px relative rounded-[12px] shrink-0">
                <div className="bg-clip-padding content-stretch flex h-[36px] items-center justify-center relative w-full">
                  <p className="font-semibold leading-[20px] not-italic relative shrink-0 text-[#1a1a1a] text-[12px] text-nowrap whitespace-pre">
                    {month.name}
                  </p>
                </div>
              </div>
            </div>
          </div>,
        );
        col += month.weeks;
      });

      // Week headers (Row 3) - Shifted down by 1
      for (let i = 0; i < WEEKS; i++) {
        elements.push(
          <div
            key={`week-${i}`}
            className="cell"
            style={{
              gridColumn: i + 2, // +2 because col 1 is resources
              gridRow: 3,
              position: "sticky",
              top: `${TOP_BAR_HEIGHT + config.rowH}px`, // ✅ 80 + 48 = 128px - на 16px выше
              zIndex: 200,
              height: `${config.rowH}px`,
              backgroundColor: "#fff",
              display: "flex",
              alignItems: "center", // ✅ Центрирование по вертикали
            }}
          >
            <div className="flex flex-row items-center justify-center w-full h-full">
              <div className="box-border content-stretch flex items-center justify-center px-[6px] relative w-full">
                <p className="font-normal leading-[16px] relative shrink-0 text-[#868789] text-[12px] text-nowrap whitespace-pre">
                  {weekLabel(i, timelineYear)}
                </p>
              </div>
            </div>
          </div>,
        );
      }

      // Department and resource rows (Start from Row 4)
      let gridRow = 4;

      filteredDepartments.forEach((dept) => {
        const deptResources = sortResourcesByGrade(
          filteredResources.filter(
            (r) => r.departmentId === dept.id,
          ),
        );

        // Department cells
        for (let w = 0; w < WEEKS; w++) {
          elements.push(
            <div
              key={`dept-${dept.id}-week-${w}`}
              className="cell department-row"
              style={{
                gridColumn: w + 2,
                gridRow,
                height: "44px",
                background: "#fff",
                zIndex: 40,
              }}
            />,
          );
        }
        gridRow++;

        // Resources in department
        deptResources.forEach((resource, resIndex) => {
          // Resource cells
          for (let w = 0; w < WEEKS; w++) {
            const isLastInMonth = lastWeeks.has(w);
            elements.push(
              <div
                key={`resource-${resource.id}-week-${w}`}
                className={`cell resource-row event-row ${isLastInMonth ? "last-in-month" : ""}`}
                style={{
                  gridColumn: w + 2,
                  gridRow,
                  height: "144px",
                  background: "#fff",
                  borderRight: "0.5px solid #DFE7EE",
                  cursor: "pointer",
                }}
                data-resource-id={resource.id}
                data-week={w}
                onClick={(e) => {
                  const rect =
                    e.currentTarget.getBoundingClientRect();
                  const y = e.clientY - rect.top;
                  const unitIndex = Math.floor(
                    (y - config.rowPaddingTop) /
                      config.unitStride,
                  );
                  onCellClick(resource.id, w, unitIndex);
                }}
                onContextMenu={(e) =>
                  onCellContextMenu?.(e, resource.id, w)
                }
                onMouseMove={(e) =>
                  onCellMouseMove(e, resource.id, w)
                }
                onMouseLeave={onCellMouseLeave}
              />,
            );
          }
          gridRow++;
        });
      });

      return elements;
    }, [
      config,
      months,
      lastWeeks,
      filteredDepartments,
      filteredResources,
      timelineYear,
      onCellMouseMove,
      onCellClick,
      onCellContextMenu,
    ]);

    return (
      <div
        ref={scrollContainerRef}
        className="scheduler-scroll-container"
        style={{
          height: "100%",
          overflow: "auto",
          position: "relative",
          // Optimize scroll performance
          willChange: "scroll-position",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div
          className="scheduler-grid"
          style={{
            display: "grid",
            // Column 1: Resources (Fixed Width), Columns 2...N: Weeks (Fixed Width)
            gridTemplateColumns: `${LEFT_WIDTH}px repeat(${WEEKS}, ${config.weekPx}px)`,
            // ✅ ЯВНО задаём высоту первых 3 строк
            gridTemplateRows: `${TOP_BAR_HEIGHT}px ${config.rowH}px ${config.rowH}px`,
            // Rows will be implicit
            minWidth: "max-content",
            position: "relative",
          }}
        >
          {/* --- LEFT HEADER (Sticky Top & Left) --- */}
          {/* Spans Rows 1-3 (Total 176px) */}
          <div
            style={{
              gridColumn: 1,
              gridRow: "1 / span 3",
              position: "sticky",
              top: 0,
              left: 0,
              zIndex: 500,
              height: "152px",
              backgroundColor: "#fff",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Внутренний контейнер с рамкой слева/справа/сверху */}
            <div
              style={{
                height: "100%", // заполнить внешний блок
                width: "100%",
                boxSizing: "border-box", // важно, чтобы рамки шли внутрь

                display: "flex",
                flexDirection: "column",
                padding: "8px 8px 0px 8px",
              }}
            >
              {/* Title Area (Matches Figma ~96px) */}
              <div
                style={{
                  height: "72px",
                  padding: "16px 12px 16px 8px",
                  borderTop: "1px solid #f0f0f0",
                  borderLeft: "1px solid #f0f0f0",
                  borderRight: "1px solid #f0f0f0",
                  borderTopLeftRadius: "16px",
                  borderTopRightRadius: "16px",
                }}
              >
                <div className="flex flex-col gap-1 px-4">
                  <div className="flex items-center gap-2 mb-1">
                    {onBackToWorkspaces && (
                      <HeaderBackButton
                        onClick={onBackToWorkspaces}
                      />
                    )}
                    <div className="flex flex-col">
                      <HeaderTitle
                        name={
                          workspace?.name ||
                          "Рабочее пространство"
                        }
                      />
                      <YearContainer year={timelineYear} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Search Area */}
              <div
                style={{
                  height: "72px",
                  padding: "0px 16px",
                  borderLeft: "1px solid rgb(240, 240, 240)",
                  borderRight: "1px solid rgb(240, 240, 240)",
                }}
              >
                <SearchInput
                  value={searchQuery || ""}
                  onChange={(val) => onSearchChange?.(val)}
                />
              </div>
            </div>
          </div>
          {/* --- RIGHT HEADER (Sticky Top) --- */}
          {/* Row 1: Filters/Header */}
          <div
            style={{
              gridColumn: "2 / -1",
              gridRow: 1,
              position: "sticky",
              top: 0,
              zIndex: 400,
              height: `${TOP_BAR_HEIGHT}px`,
              // Sticky left trick to keep it visible while scrolling horizontally
              // We position it sticky left at the start of the scrollport (after left panel)
              left: `${LEFT_WIDTH}px`,
              width: `calc(100vw - ${LEFT_WIDTH}px)`,
              maxWidth: "100%",
            }}
          >
            <div className="w-full h-full bg-white">
              <Header
                workspaceId={workspace?.id?.toString()}
                accessToken={accessToken}
                scissorsMode={scissorsMode}
                commentMode={commentMode}
                onToggleScissors={onToggleScissors}
                onToggleComment={onToggleComment}
                companies={companies}
                departments={visibleDepartments}
                projects={projects}
              />
            </div>
          </div>
          {/* --- GRID CELLS --- */}
          {rightCells}{" "}
          {/* Months (Row 2), Weeks (Row 3), Content (Row 4+) */}
          {leftCells}{" "}
          {/* Departments & Resources (Row 4+, Col 1) */}
          {/* EVENTS LAYER (Overlay) */}
          {/* We place this in a grid item that spans the data area */}
          <div
            ref={eventsContainerRef}
            style={{
              gridColumn: "2 / -1",
              gridRow: "2 / -1", // Starts at Month row (matches old gridRef top)
              position: "relative", // Anchor for absolute children
              zIndex: 100,
              pointerEvents: "none", // Allow clicks to pass through to cells
              width: `${WEEKS * config.weekPx}px`,
              height: "100%",
            }}
          >
            {/* Wrapper to ensure pointer-events: auto for children */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
              }}
            >
              {renderEvents && renderEvents()}
            </div>

            {/* Past weeks overlay */}
            {showCurrentWeekMarker && currentWeekIndex > 0 && (
              <div
                className="past-weeks-overlay"
                style={{
                  position: "absolute",
                  left: 0,
                  top: "96px", // ✅ Month (48px) + Week (48px) = 96px
                  width: `${currentWeekIndex * config.weekPx}px`,
                  height: "500px", // 🐛 DEBUG: Большая высота
                  backgroundColor: "rgba(255, 0, 0, 0.8)", // 🐛 DEBUG: ЯРКО-КРАСНЫЙ!
                  pointerEvents: "none",
                  zIndex: 9999, // 🐛 DEBUG: Максимальный z-index
                  border: "10px solid blue", // 🐛 DEBUG: Синяя рамка
                }}
              />
            )}

            {/* Current week line */}
            {showCurrentWeekMarker && (
              <div
                className="current-week-line"
                style={{
                  position: "absolute",
                  top: "96px", // ✅ Month (48px) + Week (48px) = 96px
                  left: `${currentWeekIndex * config.weekPx}px`,
                  width: "30px", // 🐛 DEBUG: Толстая для видимости
                  height: "500px", // 🐛 DEBUG: Большая высота
                  backgroundColor: "#00FF00", // 🐛 DEBUG: ЗЕЛЕНАЯ!
                  zIndex: 9999,
                  pointerEvents: "none",
                }}
              />
            )}

            {hoverHighlight?.visible && (
              <div
                className="hover-highlight"
                style={{
                  position: "absolute",
                  left: hoverHighlight.left,
                  top: hoverHighlight.top,
                  width: hoverHighlight.width,
                  height: hoverHighlight.height,
                  border: "2px dashed #3b82f6",
                  borderRadius: "6px",
                  pointerEvents: "none",
                  zIndex: 100,
                  backgroundColor: "rgba(59, 130, 246, 0.05)",
                }}
              />
            )}

            {ghost?.visible && (
              <div
                className="ghost-event"
                style={{
                  position: "absolute",
                  left: ghost.left,
                  top: ghost.top,
                  width: ghost.width,
                  height: ghost.height,
                  backgroundColor: "rgba(59, 130, 246, 0.3)",
                  border: "1px solid #2563eb",
                  borderRadius: "4px",
                  pointerEvents: "none",
                  zIndex: 1000,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                }}
              />
            )}

            {children}
          </div>
          {/* 🌸 РОЗОВЫЙ СПЕЙСЕР - Заполняет пространство до низа экрана */}
          <div
            className="bg-pink-300"
            style={{
              gridColumn: 1, // ✅ Только левая колонка (сайдбар)
              gridRow: 9998, // Перед Fake Spacer
              position: "sticky",
              left: 0,
              zIndex: 300,
              borderLeft: "1px solid rgb(240, 240, 240)",
              borderRight: "1px solid rgb(240, 240, 240)",
              marginRight: "8px",
              minHeight: `max(0px, calc(100vh - ${usedHeight}px - 24px))`,
            }}
          />
        </div>

        {/* Fake Bottom Fix */}
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            width: `${config.resourceW}px`,
            height: "25px",
            zIndex: 400,
            pointerEvents: "none",
          }}
        >
          <Fakebottomfix />
        </div>
      </div>
    );
  },
);

SchedulerGrid.displayName = "SchedulerGrid";