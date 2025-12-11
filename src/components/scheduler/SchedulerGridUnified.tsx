import React, {
  useMemo,
  forwardRef,
  useState,
  useRef,
  useEffect,
  useCallback,
  useImperativeHandle,
} from "react";
import {
  Department,
  Resource,
  Grade,
  Company,
  Workspace,
  Month,
  Project,
  SchedulerEvent,
} from "../../types/scheduler";
import {
  WEEKS,
  weekLabel,
  sortResourcesByGrade,
} from "../../utils/scheduler";
import { LayoutConfig } from "../../utils/schedulerLayout";
import { X, Settings, Trash2 } from "lucide-react";
import svgPaths from "../../imports/svg-k0w039fxgr";
import Fakebottomfix from "../../imports/Fakebottomfix";
import Header from "../../imports/Header";
import { useScheduler } from "../../contexts/SchedulerContext";
import { ResourceRowWithMenu } from "./ResourceRowWithMenu";
import { ResourceRowSkeleton } from "./ResourceRowSkeleton";
import { DepartmentRowSkeleton } from "./DepartmentRowSkeleton";
import EventBlock from "../../imports/EventBlock";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";

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
  onRenameWorkspace?: (newName: string) => void;
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
  isLoading?: boolean;
}

// ============================================================
// КОНСТАНТЫ
// ============================================================
const LEFT_SIDEBAR_WIDTH = 284;
const HEADER_ROW_HEIGHT = 80; // Row 1: Header/Toolbar
const MONTH_ROW_HEIGHT = 36; // Row 2: Месяцы
const WEEK_ROW_HEIGHT = 36; // Row 3: Недели
const DEPARTMENT_ROW_HEIGHT = 44;
const RESOURCE_ROW_HEIGHT = 144;
const OVERSCAN_COUNT = 3; // Rows above/below viewport for smooth scroll

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ КОМПОНЕНТЫ
// ============================================================

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

function getUserSignificantProjects(
  resourceId: string,
  events: SchedulerEvent[],
  projects: Project[],
  currentWeekIndex: number,
): Project[] {
  const rangeStart = Math.max(0, currentWeekIndex - 1);
  const rangeEnd = Math.min(WEEKS, currentWeekIndex + 5);
  const totalWeeksInRange = rangeEnd - rangeStart;
  const unitsPerResource = 4;
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

// ============================================================
// SIDEBAR BOX (обртка для левой колонки с отступами)
// ============================================================
const SidePaddedBox = ({
  children,
  roundedTop = false,
  topBorder = false,
  topPadding = false,
}: {
  children: React.ReactNode;
  roundedTop?: boolean;
  topBorder?: boolean;
  topPadding?: boolean;
}) => {
  return (
    <div
      style={{
        padding: topPadding ? "8px 0 0 8px" : "0 0 0 8px",
        height: "100%",
        width: "100%",
      }}
    >
      <div
        style={{
          height: "100%",
          width: "100%",
          borderLeft: "1px solid #f0f0f0",
          borderRight: "1px solid #f0f0f0",
          ...(topBorder && { borderTop: "1px solid #f0f0f0" }),
          ...(roundedTop && {
            borderTopLeftRadius: "16px",
            borderTopRightRadius: "16px",
            overflow: "hidden",
          }),
          backgroundColor: "#fff",
        }}
      >
        {children}
      </div>
    </div>
  );
};

// ============================================================
// PROJECT BADGE
// ============================================================
function ProjectBadge({ project }: { project: Project }) {
  return (
    <div
      className="rounded-[8px] shrink-0"
      style={{
        backgroundColor: project.backgroundColor || "#aeeb3d",
      }}
    >
      <div className="px-[7px] py-[2px] flex items-center justify-center">
        <p
          className="font-semibold text-[10px] leading-[16px] whitespace-nowrap"
          style={{ color: project.textColor || "#000" }}
        >
          {project.name}
        </p>
      </div>
    </div>
  );
}

function ProjectsContainer({
  projects,
}: {
  projects: Project[];
}) {
  if (projects.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-[6px] items-center w-full">
      {projects.map((project) => (
        <ProjectBadge key={project.id} project={project} />
      ))}
    </div>
  );
}

// ============================================================
// RESOURCE SIDEBAR CELL
// ============================================================
const ResourceSidebarCell = React.memo(
  ({
    resource,
    searchQuery,
    onEditUser,
    onDeleteUser,
    events,
    projects,
    currentWeekIndex,
  }: {
    resource: Resource;
    searchQuery?: string;
    onEditUser?: (id: string) => void;
    onDeleteUser?: (id: string) => void;
    events: SchedulerEvent[];
    projects: Project[];
    currentWeekIndex: number;
  }) => {
    const significantProjects = useMemo(() => {
      return getUserSignificantProjects(
        resource.id,
        events,
        projects,
        currentWeekIndex,
      );
    }, [resource.id, events, projects, currentWeekIndex]);

    return (
      <div className="w-full h-full flex items-center pl-2">
        <div className="w-full h-full flex flex-col gap-3 justify-center border-l border-r border-[#f0f0f0] px-4">
          <ResourceRowWithMenu
            resource={resource}
            searchQuery={searchQuery}
            getUserInitials={getUserInitials}
            onEdit={onEditUser}
            onDelete={onDeleteUser}
          />
          <ProjectsContainer projects={significantProjects} />
        </div>
      </div>
    );
  },
);

// ============================================================
// HEADER COMPONENTS
// ============================================================
function ArrowUp1() {
  return (
    <div className="relative size-full">
      <div className="absolute bottom-[-0.01%] left-0 right-0 top-0">
        <svg
          className="block size-full"
          fill="none"
          preserveAspectRatio="none"
          viewBox="0 0 11 11"
        >
          <path
            d={svgPaths.p22ff0c80}
            fill="var(--fill-0, black)"
          />
        </svg>
      </div>
    </div>
  );
}

function IconlyLightArrowUp() {
  return (
    <div className="relative size-[16px]">
      <div className="absolute bottom-[13.74%] flex items-center justify-center left-1/2 top-[17.92%] translate-x-[-50%] w-[10.933px]">
        <div className="flex-none h-[10.934px] rotate-[180deg] w-[10.933px]">
          <ArrowUp1 />
        </div>
      </div>
    </div>
  );
}

function IconlyRegularLightArrowUp1() {
  return (
    <div className="relative size-[20px]">
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

function HeaderBackButton({
  onClick,
}: {
  onClick?: () => void;
}) {
  return (
    <div
      className="rounded-[12px] w-[36px] cursor-pointer hover:bg-gray-100 transition-colors"
      onClick={onClick}
    >
      <div className="px-[12px] py-[8px] flex items-center justify-center">
        <div className="rotate-[180deg] scale-y-[-100%]">
          <IconlyRegularLightArrowUp1 />
        </div>
      </div>
    </div>
  );
}

function ArrowUp2() {
  return (
    <div className="relative size-full">
      <div className="absolute bottom-0 left-0 right-[-0.01%] top-[-0.01%]">
        <svg
          className="block size-full"
          fill="none"
          preserveAspectRatio="none"
          viewBox="0 0 9 6"
        >
          <path
            d={svgPaths.p1c596770}
            fill="var(--fill-0, black)"
          />
        </svg>
      </div>
    </div>
  );
}

function IconlyRegularLightArrowUp() {
  return (
    <div className="relative shrink-0 size-[20px]">
      <div className="absolute flex inset-[37.67%_27.67%_36%_27.67%] items-center justify-center">
        <div className="flex-none h-[5.266px] rotate-[180deg] scale-y-[-100%] w-[8.933px]">
          <ArrowUp2 />
        </div>
      </div>
    </div>
  );
}

function HeaderTitle({
  name,
  onRename,
  onOpenSettings,
  onDelete,
}: {
  name: string;
  onRename?: (newName: string) => void;
  onOpenSettings?: () => void;
  onDelete?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditValue(name);
  }, [name]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleSave = () => {
    const trimmedValue = editValue.trim();
    if (trimmedValue && trimmedValue !== name) {
      onRename?.(trimmedValue);
    } else {
      setEditValue(name);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(name);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className="bg-[#f6f6f6] rounded-[4px] px-[4px] h-[20px] flex items-center w-full">
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="font-semibold text-[14px] text-black bg-transparent border-none outline-none w-full"
        />
      </div>
    );
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <div className="w-full flex gap-[2px] items-center header-title-container">
        {/* Левая часть - клик для редактирования */}
        <div
          className="px-[4px] h-[20px] rounded-bl-[4px] rounded-tl-[4px] cursor-text transition-colors flex items-center header-title-left flex-1 min-w-0"
          onClick={handleStartEdit}
        >
          <p className="font-semibold text-[14px] text-black whitespace-nowrap truncate w-full">
            {name}
          </p>
        </div>

        {/* Правая часть - стрелочка открывает dropdown */}
        <DropdownMenuTrigger asChild>
          <div className="size-[20px] rounded-br-[4px] rounded-tr-[4px] cursor-pointer transition-colors flex items-center justify-center header-title-right shrink-0">
            <div className="rotate-[180deg] scale-y-[-100%]">
              <IconlyRegularLightArrowUp />
            </div>
          </div>
        </DropdownMenuTrigger>
      </div>

      <DropdownMenuContent
        align="start"
        className="w-48 rounded-xl"
      >
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onOpenSettings?.();
            setIsOpen(false);
          }}
          className="py-2.5 cursor-pointer"
        >
          <Settings className="w-4 h-4 mr-2 opacity-70" />
          Настройки
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.();
            setIsOpen(false);
          }}
          className="text-red-600 focus:text-red-600 focus:bg-red-50 py-2.5 cursor-pointer"
        >
          <Trash2 className="w-4 h-4 mr-2 opacity-70" />
          Удалить
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function YearContainer({ year }: { year: number | string }) {
  return (
    <div className="px-1 w-full">
      <p className="w-full font-normal text-[#868789] text-[12px] whitespace-nowrap">
        {year}
      </p>
    </div>
  );
}

function InterfaceEssentialMagnifier() {
  return (
    <div className="relative shrink-0 size-[20px]">
      <svg
        className="block size-full"
        fill="none"
        preserveAspectRatio="none"
        viewBox="0 0 20 20"
      >
        <path
          clipRule="evenodd"
          d={svgPaths.p2a8c8580}
          fill="var(--fill-0, #868789)"
          fillRule="evenodd"
        />
      </svg>
    </div>
  );
}

function SearchInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <div className="w-full bg-[rgba(0,0,0,0.03)] h-[36px] rounded-[10px]">
      <div className="flex items-center h-full px-[12px] gap-[6px]">
        <InterfaceEssentialMagnifier />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Поиск"
          className="flex-1 font-normal text-[14px] bg-transparent border-none outline-none placeholder-[#868789] text-black"
        />
        {value && (
          <div
            className="cursor-pointer text-[#868789] hover:text-black transition-colors"
            onClick={() => onChange("")}
          >
            <X size={14} />
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// MAIN GRID COMPONENT
// ============================================================
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
      onRenameWorkspace,
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
      isLoading,
    },
    ref,
  ) => {
    const { events, projects } = useScheduler();

    // ====================================
    // STATE & REFS
    // ====================================
    const [scrollTop, setScrollTop] = useState(0);
    const [viewportHeight, setViewportHeight] = useState(600);
    const [srAnnouncement, setSrAnnouncement] = useState('');

    // Получаем год из workspace
    const timelineYear =
      workspace?.timeline_year || new Date().getFullYear();

    // ====================================
    // КОНСТАНТЫ ДЛЯ ВЫЧИСЛЕНИЙ
    // ====================================
    const TOTAL_TOP_HEIGHT =
      HEADER_ROW_HEIGHT + MONTH_ROW_HEIGHT + WEEK_ROW_HEIGHT;

    // ====================================
    // SCROLL TRACKING (with RAF throttling)
    // ====================================
    useEffect(() => {
      const scrollEl = scrollRef?.current;
      if (!scrollEl) return;

      let rafId: number | null = null;

      const handleScroll = () => {
        if (rafId !== null) return;
        
        rafId = requestAnimationFrame(() => {
          setScrollTop(scrollEl.scrollTop);
          rafId = null;
        });
      };

      const handleResize = () => {
        setViewportHeight(scrollEl.clientHeight);
      };

      // Initial values
      setScrollTop(scrollEl.scrollTop);
      setViewportHeight(scrollEl.clientHeight);

      scrollEl.addEventListener("scroll", handleScroll, { passive: true });
      window.addEventListener("resize", handleResize);

      return () => {
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
        }
        scrollEl.removeEventListener("scroll", handleScroll);
        window.removeEventListener("resize", handleResize);
      };
    }, [scrollRef]);

    // ====================================
    // EXPOSE scrollContainer via ref for autoscroll
    // ====================================
    useImperativeHandle(ref, () => ({
      scrollContainer: scrollRef?.current || null,
    }), [scrollRef]);

    // Фильтрация ресурсов и департаментов
    const filteredResources = resources;
    const filteredDepartments = useMemo(() => {
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

    // Построение структуры grid (departments + resources) с вычислением offsets
    const gridItems = useMemo(() => {
      console.log('🔍 SchedulerGrid: isLoading =', isLoading, ', viewportHeight =', viewportHeight);
      
      const items: Array<{
        type: "department" | "resource" | "skeleton" | "skeleton-department";
        dept?: Department;
        resource?: Resource;
        row: number;
        offset: number; // Y-coordinate from top of data section
        height: number;
      }> = [];

      // ✨ SKELETON STATE - показываем скелетоны во время загрузки
      if (isLoading) {
        let currentRow = 4;
        let currentOffset = 0;
        
        // 🎯 Динамическое вычисление количества ресурсов
        // Заполняем viewport height + 1 ресурс (с запасом)
        const availableHeight = viewportHeight - TOTAL_TOP_HEIGHT - DEPARTMENT_ROW_HEIGHT;
        const resourceCount = Math.ceil(availableHeight / RESOURCE_ROW_HEIGHT) + 1;
        
        console.log(`🎨 Skeleton: ${resourceCount} resources для высоты ${viewportHeight}px`);

        // 1 департамент (фиксированно)
        items.push({
          type: "skeleton-department",
          row: currentRow,
          offset: currentOffset,
          height: DEPARTMENT_ROW_HEIGHT,
        });
        currentRow++;
        currentOffset += DEPARTMENT_ROW_HEIGHT;

        // N ресурсов (динамически)
        for (let r = 0; r < resourceCount; r++) {
          items.push({
            type: "skeleton",
            row: currentRow,
            offset: currentOffset,
            height: RESOURCE_ROW_HEIGHT,
          });
          currentRow++;
          currentOffset += RESOURCE_ROW_HEIGHT;
        }
        
        return items;
      }

      let currentRow = 4; // Row 1=Header, Row 2=Month, Row 3=Week, Row 4+=Data
      let currentOffset = 0;

      filteredDepartments.forEach((dept) => {
        const deptResources = sortResourcesByGrade(
          filteredResources.filter(
            (r) => r.departmentId === dept.id,
          ),
        );

        // Department row
        items.push({
          type: "department",
          dept,
          row: currentRow,
          offset: currentOffset,
          height: DEPARTMENT_ROW_HEIGHT,
        });
        currentRow++;
        currentOffset += DEPARTMENT_ROW_HEIGHT;

        // Resource rows
        deptResources.forEach((resource) => {
          items.push({
            type: "resource",
            resource,
            row: currentRow,
            offset: currentOffset,
            height: RESOURCE_ROW_HEIGHT,
          });
          currentRow++;
          currentOffset += RESOURCE_ROW_HEIGHT;
        });
      });

      return items;
    }, [filteredDepartments, filteredResources, isLoading, viewportHeight, TOTAL_TOP_HEIGHT, DEPARTMENT_ROW_HEIGHT, RESOURCE_ROW_HEIGHT]);

    // Вычисляем общую высоту контента из gridItems
    const totalContentHeight = useMemo(() => {
      if (gridItems.length === 0) return 0;
      const lastItem = gridItems[gridItems.length - 1];
      return lastItem.offset + lastItem.height;
    }, [gridItems]);

    // ====================================
    // VIRTUALIZATION: Calculate visible range (Binary Search O(log n))
    // ====================================
    const { visibleItems, topSpacer } = useMemo(() => {
      if (gridItems.length === 0) {
        return { visibleItems: [], topSpacer: 0 };
      }

      const scrollOffset = Math.max(0, scrollTop - TOTAL_TOP_HEIGHT);
      const viewportStart = scrollOffset;
      const viewportEnd = scrollOffset + viewportHeight;

      // Binary search: Find first visible item (O(log n))
      let left = 0;
      let right = gridItems.length - 1;
      let startIndex = 0;

      while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        const item = gridItems[mid];
        
        if (item.offset + item.height > viewportStart) {
          startIndex = mid;
          right = mid - 1;
        } else {
          left = mid + 1;
        }
      }

      // Binary search: Find last visible item (O(log n))
      left = startIndex;
      right = gridItems.length - 1;
      let endIndex = gridItems.length;

      while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        const item = gridItems[mid];
        
        if (item.offset < viewportEnd) {
          endIndex = mid + 1;
          left = mid + 1;
        } else {
          right = mid - 1;
        }
      }

      // Apply overscan buffer
      const bufferedStart = Math.max(0, startIndex - OVERSCAN_COUNT);
      const bufferedEnd = Math.min(gridItems.length, endIndex + OVERSCAN_COUNT);

      const visible = gridItems.slice(bufferedStart, bufferedEnd);
      const spacer = gridItems[bufferedStart]?.offset || 0;

      // Логируем только в dev mode
      if (process.env.NODE_ENV === 'development') {
        console.log(`🎯 Virtualization: ${visible.length}/${gridItems.length} rows | offset: ${spacer.toFixed(0)}px | total: ${totalContentHeight.toFixed(0)}px`);
      }

      return {
        visibleItems: visible,
        topSpacer: spacer,
      };
    }, [gridItems, scrollTop, viewportHeight, TOTAL_TOP_HEIGHT, OVERSCAN_COUNT, totalContentHeight]);

    // ====================================
    // SCREEN READER ANNOUNCEMENT UPDATE
    // ====================================
    useEffect(() => {
      const resourceCount = visibleItems.filter(item => item.type === 'resource').length;
      const totalResources = gridItems.filter(item => item.type === 'resource').length;
      
      setSrAnnouncement(
        `Showing ${resourceCount} of ${totalResources} resources. Scroll to see more.`
      );
    }, [visibleItems.length, gridItems.length]);

    return (
      <div
        style={{
          position: "relative",
          height: "100vh",
          overflow: "hidden",
        }}
      >
        {/* ====================================== */}
        {/* SCROLLABLE CONTAINER */}
        {/* ====================================== */}
        <div
          ref={scrollRef}
          className="scheduler-scroll-container"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            overflow: isLoading ? "hidden" : "auto", // 🚫 Блокировка скролла при загрузке
          }}
        >
          {/* ====================================== */}
          {/* UNIFIED CSS GRID */}
          {/* ====================================== */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `${LEFT_SIDEBAR_WIDTH}px 4px repeat(${WEEKS}, ${config.weekPx}px)`,
              minWidth: "max-content",
            }}
          >
            {/* ========== ROW 1: HEADER / TOOLBAR ========== */}

            {/* Left Corner: Back Button + Title + Year */}
            <div
              style={{
                gridColumn: 1,
                gridRow: 1,
                position: "sticky",
                left: 0,
                top: 0,
                height: `${HEADER_ROW_HEIGHT}px`,
                backgroundColor: "#fff",
                zIndex: 501,
              }}
            >
              <SidePaddedBox roundedTop topBorder topPadding>
                <div className="flex items-center gap-2 pl-2 pr-4 py-2 w-full h-full">
                  {onBackToWorkspaces && (
                    <HeaderBackButton
                      onClick={onBackToWorkspaces}
                    />
                  )}
                  <div className="flex flex-col flex-1 min-w-0">
                    <HeaderTitle
                      name={workspace?.name || "Workspace"}
                      onRename={onRenameWorkspace}
                      onOpenSettings={onOpenSettingsModal}
                      onDelete={onSignOut}
                    />
                    <YearContainer year={timelineYear} />
                  </div>
                </div>
              </SidePaddedBox>
            </div>

            {/* Header Toolbar (Column 3+) */}
            <div
              style={{
                gridColumn: "3 / -1",
                gridRow: 1,
                position: "sticky",
                left: "292px",
                top: 0,
                width: "calc(100vw - 292px)",
                height: `${HEADER_ROW_HEIGHT}px`,
                backgroundColor: "#fff",
                zIndex: 300,
              }}
            >
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

            {/* ========== ROW 2: SEARCH + MONTHS ========== */}

            {/* Left Corner: Search */}
            <div
              style={{
                gridColumn: 1,
                gridRow: 2,
                position: "sticky",
                left: 0,
                top: `${HEADER_ROW_HEIGHT}px`,
                height: `${MONTH_ROW_HEIGHT}px`,
                backgroundColor: "#fff",
                zIndex: 501,
              }}
            >
              <SidePaddedBox>
                <div className="px-2 h-full flex items-center">
                  <SearchInput
                    value={searchQuery || ""}
                    onChange={(val) => onSearchChange?.(val)}
                  />
                </div>
              </SidePaddedBox>
            </div>

            {/* Month Headers (spanning multiple weeks) */}
            {months.map((month, idx) => {
              const startCol =
                months
                  .slice(0, idx)
                  .reduce((sum, m) => sum + m.weeks, 0) + 3;

              // Определяем паддинг: 8px по краям, 4px между месяцами
              const isFirst = idx === 0;
              const isLast = idx === months.length - 1;
              let paddingClass = "px-0.5"; // 2px с каждой стороны (между месяцами = 4px)
              if (isFirst && isLast) {
                paddingClass = "px-2"; // Единственный месяц: 8px слева, 8px справа
              } else if (isFirst) {
                paddingClass = "pl-1 pr-0.5"; // 4px слева, 2px справа
              } else if (isLast) {
                paddingClass = "pl-0.5 pr-2"; // 2px слева, 8px справа
              }

              return (
                <div
                  key={`month-${idx}`}
                  style={{
                    gridColumn: `${startCol} / span ${month.weeks}`,
                    gridRow: 2,
                    position: "sticky",
                    top: `${HEADER_ROW_HEIGHT}px`,
                    height: `${MONTH_ROW_HEIGHT}px`,
                    backgroundColor: "#fff",
                    zIndex: 300,
                  }}
                >
                  <div
                    className={`${paddingClass} h-full flex items-center`}
                  >
                    <div className="bg-[#f6f6f6] rounded-[12px] h-full w-full flex items-center justify-center">
                      <p className="font-semibold text-[12px] text-[#1a1a1a]">
                        {month.name}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* ========== ROW 3: WEEK HEADERS ========== */}

            {/* Left Corner: Empty (неделя не нужна в левой колонке) */}
            <div
              style={{
                gridColumn: 1,
                gridRow: 3,
                position: "sticky",
                left: 0,
                top: `${HEADER_ROW_HEIGHT + MONTH_ROW_HEIGHT}px`,
                height: `${WEEK_ROW_HEIGHT}px`,
                backgroundColor: "#fff",
                zIndex: 501,
              }}
            >
              <SidePaddedBox>{null}</SidePaddedBox>
            </div>

            {/* Week Headers */}
            {Array.from({ length: WEEKS }).map((_, w) => (
              <div
                key={`week-${w}`}
                style={{
                  gridColumn: w + 3,
                  gridRow: 3,
                  position: "sticky",
                  top: `${HEADER_ROW_HEIGHT + MONTH_ROW_HEIGHT}px`,
                  height: `${WEEK_ROW_HEIGHT}px`,
                  backgroundColor: "#fff",
                  zIndex: 300,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <p className="font-normal text-[12px] text-[#868789]">
                  {weekLabel(w, timelineYear)}
                </p>
              </div>
            ))}

            {/* ========== ROW 4+: DEPARTMENTS + RESOURCES (VIRTUALIZED) ========== */}
            
            {/* Top Spacer - Виртуальное пространство для пропущенных строк сверху */}
            {topSpacer > 0 && (
              <div
                style={{
                  gridColumn: "1 / -1",
                  gridRow: 4,
                  height: `${topSpacer}px`,
                }}
              />
            )}

            {visibleItems.map((item, index) => {
              // ✨ SKELETON ROW
              if (item.type === "skeleton") {
                // 🎯 Fixed positioned скелетоны - заполняют viewport
                const skeletonTop = HEADER_ROW_HEIGHT + MONTH_ROW_HEIGHT + WEEK_ROW_HEIGHT + item.offset - scrollTop;
                
                return (
                  <React.Fragment key={`skeleton-${item.row}`}>
                    {/* Skeleton Name (Left) */}
                    <div
                      style={{
                        gridColumn: 1,
                        gridRow: item.row,
                        position: "sticky",
                        left: 0,
                        height: `${RESOURCE_ROW_HEIGHT}px`,
                        backgroundColor: "#fff",
                        zIndex: 200,
                      }}
                    >
                      <div className="w-full h-full flex items-center pl-2">
                        <div className="w-full h-full border-l border-r border-[#f0f0f0]">
                          <ResourceRowSkeleton />
                        </div>
                      </div>
                    </div>

                    {/* Skeleton Row (52 weeks) */}
                    <div
                      style={{
                        gridColumn: "3 / -1",
                        gridRow: item.row,
                        height: `${RESOURCE_ROW_HEIGHT}px`,
                        backgroundColor: "#fff",
                        backgroundImage: `repeating-linear-gradient(
                          to right,
                          transparent 0,
                          transparent calc(${config.weekPx}px - 0.5px),
                          #DFE7EE calc(${config.weekPx}px - 0.5px),
                          #DFE7EE ${config.weekPx}px
                        )`,
                        backgroundSize: `${config.weekPx}px 100%`,
                        backgroundPosition: "0 0",
                        position: "relative",
                      }}
                    >
                      {/* Skeleton Event - от недели 0 до 51 (все 52 недели) */}
                      {(() => {
                        // 🎯 Адаптивная высота скелетона в зависимости от высоты строки
                        const getDefaultSkeletonUnits = (rowHeight: number): number => {
                          if (rowHeight <= 60) return 1;  // 48-60px → 1 юнит
                          if (rowHeight <= 84) return 2;  // 61-84px → 2 юнита
                          if (rowHeight <= 120) return 3; // 85-120px → 3 юнита
                          return 4;                       // 121-144px → 4 юнита
                        };
                        
                        const skeletonUnits = getDefaultSkeletonUnits(config.rowHeight);
                        const skeletonHeight = skeletonUnits * config.unitStride - config.gap + 8; // +8px (4px сверху + 4px снизу)
                        
                        return (
                          <div
                            className="animate-pulse"
                            style={{
                              position: "absolute",
                              left: `${config.cellPaddingLeft}px`,
                              top: `${config.rowPaddingTop}px`,
                              width: `${WEEKS * config.weekPx - config.cellPaddingLeft - config.cellPaddingRight}px`,
                              height: `${skeletonHeight}px`,
                              padding: `${config.cellPaddingLeft}px`,
                              opacity: 1,
                            }}
                          >
                            <EventBlock />
                          </div>
                        );
                      })()}
                    </div>
                  </React.Fragment>
                );
              }

              if (item.type === "skeleton-department") {
                return (
                  <React.Fragment key={`skeleton-dept-${item.row}`}>
                    {/* Department Skeleton (Left) */}
                    <div
                      style={{
                        gridColumn: 1,
                        gridRow: item.row,
                        position: "sticky",
                        left: 0,
                        top: `${HEADER_ROW_HEIGHT + MONTH_ROW_HEIGHT + WEEK_ROW_HEIGHT}px`,
                        height: `${DEPARTMENT_ROW_HEIGHT}px`,
                        backgroundColor: "#fff",
                        zIndex: 201,
                      }}
                    >
                      <SidePaddedBox>
                        <DepartmentRowSkeleton />
                      </SidePaddedBox>
                    </div>

                    {/* Department Row (52 weeks) */}
                    <div
                      style={{
                        gridColumn: "3 / -1",
                        gridRow: item.row,
                        position: "sticky",
                        left: 0,
                        top: `${HEADER_ROW_HEIGHT + MONTH_ROW_HEIGHT + WEEK_ROW_HEIGHT}px`,
                        height: `${DEPARTMENT_ROW_HEIGHT}px`,
                        backgroundColor: "#fff",
                        borderRight: "0.5px solid #DFE7EE",
                        zIndex: 150,
                      }}
                    />
                  </React.Fragment>
                );
              }

              if (item.type === "department" && item.dept) {
                return (
                  <React.Fragment key={`dept-${item.dept.id}`}>
                    {/* Department Name (Left) */}
                    <div
                      style={{
                        gridColumn: 1,
                        gridRow: item.row,
                        position: "sticky",
                        left: 0,
                        top: `${HEADER_ROW_HEIGHT + MONTH_ROW_HEIGHT + WEEK_ROW_HEIGHT}px`,
                        height: `${DEPARTMENT_ROW_HEIGHT}px`,
                        backgroundColor: "#fff",
                        zIndex: 201,
                      }}
                    >
                      <SidePaddedBox>
                        <div className="px-4 h-full flex items-center">
                          <p className="font-medium text-xs text-[#868789] uppercase">
                            {item.dept.name}
                          </p>
                        </div>
                      </SidePaddedBox>
                    </div>

                    {/* Department Row (52 weeks) */}
                    <div
                      style={{
                        gridColumn: "3 / -1",
                        gridRow: item.row,
                        position: "sticky",
                        left: 0,
                        top: `${HEADER_ROW_HEIGHT + MONTH_ROW_HEIGHT + WEEK_ROW_HEIGHT}px`,
                        height: `${DEPARTMENT_ROW_HEIGHT}px`,
                        backgroundColor: "#fff",
                        borderRight: "0.5px solid #DFE7EE",
                        zIndex: 150,
                      }}
                    />
                  </React.Fragment>
                );
              }

              if (item.type === "resource" && item.resource) {
                return (
                  <React.Fragment key={`resource-${item.resource.id}`}>
                    {/* Resource Name (Left) */}
                    <div
                      style={{
                        gridColumn: 1,
                        gridRow: item.row,
                        position: "sticky",
                        left: 0,
                        height: `${RESOURCE_ROW_HEIGHT}px`,
                        backgroundColor: "#fff",
                        zIndex: 200,
                      }}
                    >
                      <ResourceSidebarCell
                        resource={item.resource}
                        searchQuery={searchQuery}
                        onEditUser={onEditUser}
                        onDeleteUser={onDeleteUser}
                        events={events}
                        projects={projects}
                        currentWeekIndex={currentWeekIndex}
                      />
                    </div>

                    {/* Resource Row (unified 52 weeks) - ONE div instead of 52 */}
                    <div
                      className="cell resource-row event-row"
                      role="row"
                      aria-label={`${item.resource!.displayName}, ${
                        grades.find(g => g.id === item.resource!.gradeId)?.name || ''
                      }, ${
                        companies.find(c => c.id === item.resource!.companyId)?.name || ''
                      }`}
                      style={{
                        gridColumn: "3 / -1", // Spanning all 52 weeks
                        gridRow: item.row,
                        height: `${RESOURCE_ROW_HEIGHT}px`,
                        backgroundColor: "#fff",
                        cursor: "pointer",
                        // CSS Grid background для визуализации границ недель
                        backgroundImage: `repeating-linear-gradient(
                          to right,
                          transparent 0,
                          transparent calc(${config.weekPx}px - 0.5px),
                          #DFE7EE calc(${config.weekPx}px - 0.5px),
                          #DFE7EE ${config.weekPx}px
                        )`,
                        backgroundSize: `${config.weekPx}px 100%`,
                        backgroundPosition: "0 0",
                      }}
                      data-resource-id={item.resource!.id}
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        const y = e.clientY - rect.top;
                        
                        // Вычисляем неделю по X-координате
                        const week = Math.floor(x / config.weekPx);
                        
                        // Вычисляем unitIndex по Y-координате
                        const unitIndex = Math.floor(
                          (y - config.rowPaddingTop) / config.unitStride
                        );
                        
                        onCellClick(item.resource!.id, week, unitIndex);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          // Create event on first week/unit
                          onCellClick(item.resource!.id, 0, 0);
                        } else if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          // Focus next resource
                          const allRows = Array.from(document.querySelectorAll('[data-resource-id]'));
                          const currentIdx = allRows.findIndex(el => el.getAttribute('data-resource-id') === item.resource!.id);
                          if (currentIdx < allRows.length - 1) {
                            (allRows[currentIdx + 1] as HTMLElement).focus();
                          }
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          // Focus previous resource
                          const allRows = Array.from(document.querySelectorAll('[data-resource-id]'));
                          const currentIdx = allRows.findIndex(el => el.getAttribute('data-resource-id') === item.resource!.id);
                          if (currentIdx > 0) {
                            (allRows[currentIdx - 1] as HTMLElement).focus();
                          }
                        }
                      }}
                      onContextMenu={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        const week = Math.floor(x / config.weekPx);
                        onCellContextMenu?.(e, item.resource!.id, week);
                      }}
                      onMouseMove={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        const week = Math.floor(x / config.weekPx);
                        onCellMouseMove(e, item.resource!.id, week);
                      }}
                      onMouseLeave={onCellMouseLeave}
                      tabIndex={0}
                    />
                  </React.Fragment>
                );
              }

              return null;
            })}

            {/* Bottom Spacer - Виртуальное пространство для пропущенных строк снизу */}
            {visibleItems.length > 0 && (
              <div
                style={{
                  gridColumn: "1 / -1",
                  gridRow: (visibleItems[visibleItems.length - 1]?.row || 4) + 1,
                  height: `${Math.max(0, totalContentHeight - topSpacer - visibleItems.reduce((sum, item) => sum + item.height, 0))}px`,
                }}
              />
            )}

            {/* 🌸 СПЕЙСЕР - Заполняет пространство до низа экрана */}
            <div
              style={{
                position: "fixed",
                left: 0,
                top: `${HEADER_ROW_HEIGHT + MONTH_ROW_HEIGHT + WEEK_ROW_HEIGHT}px`,
                bottom: 0,
                width: `${LEFT_SIDEBAR_WIDTH}px`,
                zIndex: 150,
              }}
            >
              <SidePaddedBox>
                <div className="bg-white w-full h-full" />
              </SidePaddedBox>
            </div>

            {/* ========== CHRONO OVERLAY (Current Week Marker) ========== */}
            <div
              style={{
                gridColumn: "3 / -1",
                gridRow: "4 / -1",
                position: "sticky",
                top: `${HEADER_ROW_HEIGHT + MONTH_ROW_HEIGHT + WEEK_ROW_HEIGHT}px`,
                height: 0,
                pointerEvents: "none",
                zIndex: 145,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: "100vh",
                  pointerEvents: "none",
                }}
              >
                {showCurrentWeekMarker &&
                  currentWeekIndex > 0 && (
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        height: "100%",
                        width: `${currentWeekIndex * config.weekPx}px`,
                        backgroundColor:
                          "rgba(255, 255, 255, 0.6)",
                        pointerEvents: "none",
                      }}
                    />
                  )}
                {showCurrentWeekMarker && (
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: `${currentWeekIndex * config.weekPx}px`,
                      height: "100%",
                      width: "2px",
                      backgroundColor: "#ef4444",
                      pointerEvents: "none",
                    }}
                  />
                )}
              </div>
            </div>

            {/* ========== EVENTS LAYER ========== */}
            <div
              ref={eventsContainerRef}
              style={{
                gridColumn: "3 / -1",
                gridRow: "4 / -1",
                position: "relative",
                zIndex: 100,
                pointerEvents: "none",
              }}
            >
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  height: "100%",
                  paddingTop: `${HEADER_ROW_HEIGHT + MONTH_ROW_HEIGHT + WEEK_ROW_HEIGHT}px`,
                  pointerEvents: "none",
                }}
              >
                {renderEvents && renderEvents()}

                {/* Hover Highlight */}
                {hoverHighlight?.visible && (
                  <div
                    style={{
                      position: "absolute",
                      left: hoverHighlight.left,
                      top: hoverHighlight.top,
                      width: hoverHighlight.width,
                      height: hoverHighlight.height,
                      border: "2px dashed #3b82f6",
                      borderRadius: "6px",
                      backgroundColor:
                        "rgba(59, 130, 246, 0.05)",
                      pointerEvents: "none",
                      zIndex: 100,
                    }}
                  />
                )}

                {/* Ghost Event */}
                {ghost?.visible && (
                  <div
                    style={{
                      position: "absolute",
                      left: ghost.left,
                      top: ghost.top,
                      width: ghost.width,
                      height: ghost.height,
                      backgroundColor:
                        "rgba(59, 130, 246, 0.3)",
                      border: "1px solid #2563eb",
                      borderRadius: "4px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                      pointerEvents: "none",
                      zIndex: 1000,
                    }}
                  />
                )}

                {children}
              </div>
            </div>
          </div>
        </div>

        {/* ====================================== */}
        {/* FAKE BOTTOM FIX */}
        {/* ====================================== */}
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            width: `${LEFT_SIDEBAR_WIDTH}px`,
            height: "25px",
            zIndex: 400,
            pointerEvents: "none",
          }}
        >
          <Fakebottomfix />
        </div>

        {/* ====================================== */}
        {/* SCREEN READER LIVE REGION */}
        {/* ====================================== */}
        <div 
          role="status" 
          aria-live="polite" 
          aria-atomic="true"
          className="sr-only"
        >
          {srAnnouncement}
        </div>
      </div>
    );
  },
);

SchedulerGrid.displayName = "SchedulerGrid";