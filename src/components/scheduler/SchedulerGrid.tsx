import React, {
  useMemo,
  forwardRef,
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  useImperativeHandle,
  memo,
} from "react";
import { createPortal } from "react-dom";
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
  weekLabel,
  sortResourcesByGrade,
  getWeeksInYear,
} from "../../utils/scheduler";
import { getDisplayNameFromToken } from "../../utils/jwt";
import { LayoutConfig } from "../../utils/schedulerLayout";
import {
  X,
  MoreVertical,
  Edit,
  Trash2,
  PanelLeft,
  PanelLeftClose,
  EyeOff,
} from "lucide-react";
import svgPaths from "../../imports/svg-k0w039fxgr";
import Fakebottomfix from "../../imports/Fakebottomfix";
import Header from "../../imports/Header";
import { useScheduler } from "../../contexts/SchedulerContext";
import { useSettings } from "../../contexts/SettingsContext";
import { useUI } from "../../contexts/UIContext";
import { ResourceRowWithMenu } from "./ResourceRowWithMenu";
import { ResourceSidebarCell } from "./ResourceSidebarCell";
import { ResourceRowSkeleton } from "./ResourceRowSkeleton";
import { DepartmentRowSkeleton } from "./DepartmentRowSkeleton";
import EventBlock from "../../imports/EventBlock";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { CustomScrollbars } from "./CustomScrollbars";
import { CommentMarker } from "./CommentMarker";
import { CommentModal } from "./CommentModal";
import {
  getWeekIndexFromDate,
  getWeekStartDate,
} from "../../utils/scheduler";
import { Comment } from "../../types/scheduler";

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
  renderEvents: (
    visibleResourceIds?: Set<string>,
  ) => React.ReactNode;
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
    unitIndex: number,
  ) => void;
  onCellMouseMove: (
    e: React.MouseEvent,
    resourceId: string,
    week: number,
    unitIndex?: number,
  ) => void;
  onCellMouseLeave: () => void;
  onBackToWorkspaces?: () => void;
  onSignOut?: () => void;
  onOpenProfileModal?: () => void;
  onOpenSettingsModal?: () => void;
  onOpenWorkspaceManagementModal?: () => void;
  onRenameWorkspace?: (newName: string) => void;
  currentUserDisplayName?: string;
  currentUserEmail?: string;
  currentUserAvatarUrl?: string;
  isModalOpen?: boolean;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  // scissorsMode and onToggleScissors removed (using useUI)
  onEditUser?: (resourceId: string) => void;
  onDeleteUser?: (resourceId: string) => void;
  hoveredResourceId?: string | null;
  onHoveredResourceIdChange?: (id: string | null) => void;
  onEventMouseEnter?: (resourceId: string) => void;
  children?: React.ReactNode;
  scrollRef?: React.RefObject<HTMLDivElement>;
  isLoading?: boolean;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  onSidebarCollapsedChange?: (collapsed: boolean) => void;
}

// ============================================================
// КОНСТАНТЫ
// ============================================================
const LEFT_SIDEBAR_WIDTH = 284;
const LEFT_SIDEBAR_WIDTH_COLLAPSED = 60;
// const HEADER_ROW_HEIGHT = 80; // 🗑️ Removed as it's external now
const MONTH_ROW_HEIGHT = 36;
const WEEK_ROW_HEIGHT = 36;
const DEPARTMENT_ROW_HEIGHT = 52;
const OVERSCAN_COUNT = 5;

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

function SidebarToggleButton({
  collapsed,
  onClick,
}: {
  collapsed: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      className="rounded-[12px] w-[36px] cursor-pointer hover:bg-gray-100 transition-colors"
      onClick={onClick}
      title={
        collapsed ? "Развернуть сайдбар" : "Свернуть сайдбар"
      }
    >
      <div className="px-[8px] py-[8px] flex items-center justify-center">
        {collapsed ? (
          <PanelLeft size={20} color="#868789" />
        ) : (
          <PanelLeftClose size={20} color="#868789" />
        )}
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
        <div className="flex-none h-[5.266px] w-[8.933px]">
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
  onOpenWorkspaceManagement,
  onDelete,
}: {
  name: string;
  onRename?: (newName: string) => void;
  onOpenSettings?: () => void;
  onOpenWorkspaceManagement?: () => void;
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
        <div
          className="px-[4px] h-[20px] rounded-bl-[4px] rounded-tl-[4px] cursor-text transition-colors flex items-center header-title-left flex-1 min-w-0"
          onClick={handleStartEdit}
        >
          <p className="font-semibold text-[14px] text-black whitespace-nowrap truncate w-full">
            {name}
          </p>
        </div>

        <DropdownMenuTrigger asChild>
          <div className="size-[20px] rounded-br-[4px] rounded-tr-[4px] cursor-pointer transition-colors flex items-center justify-center header-title-right shrink-0">
            <div
              className="transition-transform duration-200"
              style={{
                transform: isOpen
                  ? "rotate(180deg)"
                  : "rotate(0deg)",
              }}
            >
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
            onOpenWorkspaceManagement?.();
            setIsOpen(false);
          }}
          className="py-2.5 cursor-pointer"
        >
          Настройки
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onOpenSettings?.();
            setIsOpen(false);
          }}
          className="py-2.5 cursor-pointer"
        >
          Управление
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.();
            setIsOpen(false);
          }}
          className="text-red-600 focus:text-red-600 focus:bg-red-50 py-2.5 cursor-pointer"
        >
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
  const [isFocused, setIsFocused] = React.useState(false);

  return (
    <div
      className={`w-full h-[36px] rounded-[10px] transition-all duration-200 ${
        isFocused
          ? "bg-transparent border border-[#f0f0f0]"
          : "bg-[rgba(0,0,0,0.03)] hover:bg-[rgba(0,0,0,0.015)] border border-transparent"
      }`}
    >
      <div className="flex items-center h-full px-[12px] gap-[6px]">
        <InterfaceEssentialMagnifier />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
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
export const SchedulerGrid = memo(
  forwardRef<HTMLDivElement, SchedulerGridProps>(
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
        onOpenWorkspaceManagementModal,
        onRenameWorkspace,
        currentUserDisplayName,
        currentUserEmail,
        currentUserAvatarUrl,
        isModalOpen = false,
        searchQuery,
        onSearchChange,
        onEditUser,
        onDeleteUser,
        hoveredResourceId,
        onHoveredResourceIdChange,
        onEventMouseEnter,
        children,
        scrollRef,
        isLoading,
        canUndo,
        canRedo,
        onUndo,
        onRedo,
        onSidebarCollapsedChange,
      },
      ref,
    ) => {
      const {
        events,
        projects,
        comments,
        createComment,
        updateComment,
        moveComment,
        deleteComment,
      } = useScheduler();
      const { showSeparators, showGaps } = useSettings();
      const { commentMode, scissorsMode, isLoadingComments } = useUI();

      const currentUserDisplayNameFromToken = useMemo(() => {
        if (!accessToken) return "Unknown";
        return (
          getDisplayNameFromToken(accessToken) || "Unknown"
        );
      }, [accessToken]);

      const eventsByResource = useMemo(() => {
        const map = new Map<string, SchedulerEvent[]>();
        events.forEach((ev) => {
          if (!map.has(ev.resourceId)) {
            map.set(ev.resourceId, []);
          }
          map.get(ev.resourceId)!.push(ev);
        });
        return map;
      }, [events]);

      // ====================================
      // STATE & REFS
      // ====================================
      const [scrollTop, setScrollTop] = useState(0);
      const [scrollLeft, setScrollLeft] = useState(0);
      const [viewportHeight, setViewportHeight] = useState(600);
      const [viewportWidth, setViewportWidth] = useState(0);
      const [scrollDimensions, setScrollDimensions] = useState({
        width: 0,
        height: 0,
      });
      const [srAnnouncement, setSrAnnouncement] = useState("");
      const [sidebarCollapsed, setSidebarCollapsed] =
        useState(false);
      const [
        internalHoverHighlight,
        setInternalHoverHighlight,
      ] = useState<{
        visible: boolean;
        left: number;
        top: number;
        width: number;
        height: number;
      }>({
        visible: false,
        left: 0,
        top: 0,
        width: 0,
        height: 0,
      });
      const [commentModalState, setCommentModalState] =
        useState<{
          isOpen: boolean;
          comment?: Comment;
          isCreating: boolean;
          createData?: {
            resourceId: string;
            weekIndex: number;
            weekDate: string;
          };
        }>({ isOpen: false, isCreating: false });
      const [expandedCommentId, setExpandedCommentId] =
        useState<string | null>(null);

      // ====================================
      // COMMENT DRAG STATE
      // ====================================
      const [draggedCommentState, setDraggedCommentState] =
        useState<{
          id: string;
          startX: number;
          startY: number;
          currentX: number;
          currentY: number;
          offsetX: number;
          offsetY: number;
          comment: Comment;
        } | null>(null);

      const [commentGhostPosition, setCommentGhostPosition] =
        useState<{
          visible: boolean;
          weekIndex: number;
          resourceId: string;
          top: number;
          left: number;
        } | null>(null);

      const lastHoverRef = useRef<{
        resourceId: string | null;
        week: number | null;
        unitIndex: number | null;
      }>({
        resourceId: null,
        week: null,
        unitIndex: null,
      });

      const handleToggleSidebar = useCallback(() => {
        setSidebarCollapsed((prev) => {
          const newValue = !prev;
          onSidebarCollapsedChange?.(newValue);
          return newValue;
        });
      }, [onSidebarCollapsedChange]);

      const timelineYear =
        workspace?.timeline_year || new Date().getFullYear();

      // 🗑️ Header is removed, so TOP is just Months + Weeks
      const TOTAL_TOP_HEIGHT =
        MONTH_ROW_HEIGHT + WEEK_ROW_HEIGHT;

      // ✅ FIX: Сохраняем позицию скролла при изменении масштаба (S/M/L)
      // Когда меняется weekPx, мы корректируем scrollLeft пропорционально
      // Когда меняется eventRowH, мы корректируем scrollTop (для контента ниже заголовка)
      const prevWeekPxRef = useRef(config.weekPx);
      const prevEventRowHRef = useRef(config.eventRowH);

      useLayoutEffect(() => {
        const scrollEl = scrollRef?.current;
        if (!scrollEl) return;

        let scrollAdjusted = false;

        // 1. Horizontal Scroll Adjustment (Scale)
        if (prevWeekPxRef.current !== config.weekPx) {
          const ratio = config.weekPx / prevWeekPxRef.current;
          const newScrollLeft = scrollEl.scrollLeft * ratio;
          scrollEl.scrollLeft = newScrollLeft;
          setScrollLeft(newScrollLeft); // Sync state
          prevWeekPxRef.current = config.weekPx;
          scrollAdjusted = true;
        }

        // 2. Vertical Scroll Adjustment (Row Height)
        if (prevEventRowHRef.current !== config.eventRowH) {
          // Only adjust vertical scroll if we are scrolled past the fixed header
          if (scrollEl.scrollTop > TOTAL_TOP_HEIGHT) {
            // Calculate relative scroll position within the content area (subtract fixed headers)
            const contentScrollTop =
              scrollEl.scrollTop - TOTAL_TOP_HEIGHT;

            // Calculate ratio of height change
            // We need to account for department headers which don't change height, but they are mixed in.
            // However, a simple ratio of row heights is usually a good approximation if resources dominate.
            // For exact precision, we would need to map the exact row at the top, but simple ratio is standard for this UX.
            // NOTE: The previous TOTAL_TOP_HEIGHT should strictly be the same as current unless header config changes.

            const ratio =
              config.eventRowH / prevEventRowHRef.current;

            // Apply new scroll position: Header + (ContentScroll * Ratio)
            const newScrollTop =
              TOTAL_TOP_HEIGHT + contentScrollTop * ratio;

            scrollEl.scrollTop = newScrollTop;
            setScrollTop(newScrollTop); // Sync state
          }
          prevEventRowHRef.current = config.eventRowH;
          scrollAdjusted = true;
        }

        // Force instant update if needed
        if (scrollAdjusted) {
          // Optionally force a re-render or layout check if needed, but setting state does that.
        }
      }, [
        config.weekPx,
        config.eventRowH,
        scrollRef,
        TOTAL_TOP_HEIGHT,
      ]);

      const weeksInYear = useMemo(
        () => getWeeksInYear(timelineYear),
        [timelineYear],
      );

      // ====================================
      // COMMENTS MAP
      // ====================================
      const commentsByResource = useMemo(() => {
        const map = new Map<string, Comment[]>();
        if (!comments) return map;

        comments.forEach((comment) => {
          if (!map.has(comment.userId)) {
            map.set(comment.userId, []);
          }

          // Calculate week index if not present (backend returns date)
          if (
            comment.weekIndex === undefined &&
            comment.weekDate
          ) {
            const date = new Date(comment.weekDate);
            const weekIndex = getWeekIndexFromDate(
              date,
              timelineYear,
            );
            comment.weekIndex = weekIndex;
          }

          map.get(comment.userId)!.push(comment);
        });
        return map;
      }, [comments, timelineYear]);

      // ====================================
      // SCROLL TRACKING
      // ====================================
      useEffect(() => {
        const scrollEl = scrollRef?.current;
        if (!scrollEl) return;

        let rafId: number | null = null;
        let ticking = false;

        const handleScroll = () => {
          if (!ticking) {
            ticking = true;
            rafId = requestAnimationFrame(() => {
              setScrollTop(scrollEl.scrollTop);
              setScrollLeft(scrollEl.scrollLeft);
              ticking = false;
              rafId = null;
            });
          }
        };

        const handleResize = () => {
          setViewportHeight(scrollEl.clientHeight);
          setViewportWidth(scrollEl.clientWidth);
          setScrollDimensions({
            width: scrollEl.scrollWidth,
            height: scrollEl.scrollHeight,
          });
        };

        setScrollTop(scrollEl.scrollTop);
        setScrollLeft(scrollEl.scrollLeft);
        setViewportHeight(scrollEl.clientHeight);
        setViewportWidth(scrollEl.clientWidth);
        setScrollDimensions({
          width: scrollEl.scrollWidth,
          height: scrollEl.scrollHeight,
        });

        scrollEl.addEventListener("scroll", handleScroll, {
          passive: true,
        });
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
      // АВТОМАТИЧЕСКОЕ СВОРАЧИВАНИЕ САЙДБАРА
      // ====================================
      useEffect(() => {
        const handleResize = () => {
          if (window.innerWidth < 768) {
            setSidebarCollapsed(true);
            onSidebarCollapsedChange?.(true);
          } else {
            setSidebarCollapsed(false);
            onSidebarCollapsedChange?.(false);
          }
        };

        handleResize();

        window.addEventListener("resize", handleResize);
        return () =>
          window.removeEventListener("resize", handleResize);
      }, [onSidebarCollapsedChange]);

      useImperativeHandle(
        ref,
        () => ({
          scrollContainer: scrollRef?.current || null,
          hideHoverHighlight: () => {
            setInternalHoverHighlight((prev) => ({
              ...prev,
              visible: false,
            }));
          },
        }),
        [scrollRef],
      );

      // Фильтрация ��есурсов
      const filteredResources = useMemo(() => {
        return resources.filter((r) => r.isVisible !== false);
      }, [resources]);

      const filteredDepartments = useMemo(() => {
        const hasNoDeptResources = filteredResources.some(
          (r) => !r.departmentId,
        );

        let result = [...visibleDepartments];

        const hasNoDeptGroup = result.some(
          (d) => d.id === "NO_DEPT",
        );

        if (hasNoDeptResources && !hasNoDeptGroup) {
          result.push({
            id: "NO_DEPT",
            name: "Без департамента",
            queue: 9999,
            visible: true,
          });
        }

        const activeDeptIds = new Set(
          filteredResources.map(
            (r) => r.departmentId || "NO_DEPT",
          ),
        );

        return result.filter((dept) =>
          activeDeptIds.has(dept.id),
        );
      }, [visibleDepartments, filteredResources]);

      // Построение структуры grid
      const gridItems = useMemo(() => {
        const items: Array<{
          type:
            | "department"
            | "resource"
            | "skeleton"
            | "skeleton-department";
          dept?: Department;
          resource?: Resource;
          row: number;
          offset: number;
          height: number;
          isLastInDept?: boolean;
        }> = [];

        if (isLoading) {
          let currentRow = 4;
          let currentOffset = 0;

          const availableHeight =
            viewportHeight -
            TOTAL_TOP_HEIGHT -
            DEPARTMENT_ROW_HEIGHT;
          const resourceCount =
            Math.ceil(availableHeight / config.eventRowH) + 1;

          items.push({
            type: "skeleton-department",
            row: currentRow,
            offset: currentOffset,
            height: DEPARTMENT_ROW_HEIGHT,
          });
          currentRow++;
          currentOffset += DEPARTMENT_ROW_HEIGHT;

          for (let r = 0; r < resourceCount; r++) {
            items.push({
              type: "skeleton",
              row: currentRow,
              offset: currentOffset,
              height: config.eventRowH,
            });
            currentRow++;
            currentOffset += config.eventRowH;
          }

          return items;
        }

        let currentRow = 4;
        let currentOffset = 0;

        filteredDepartments.forEach((dept) => {
          const deptResources = sortResourcesByGrade(
            filteredResources.filter((r) =>
              dept.id === "NO_DEPT"
                ? !r.departmentId
                : r.departmentId === dept.id,
            ),
            grades,
          );

          items.push({
            type: "department",
            dept,
            row: currentRow,
            offset: currentOffset,
            height: DEPARTMENT_ROW_HEIGHT,
          });
          currentRow++;
          currentOffset += DEPARTMENT_ROW_HEIGHT;

          deptResources.forEach((resource, index) => {
            items.push({
              type: "resource",
              resource,
              row: currentRow,
              offset: currentOffset,
              height: config.eventRowH,
              isLastInDept: index === deptResources.length - 1,
            });
            currentRow++;
            currentOffset += config.eventRowH;
          });
        });

        return items;
      }, [
        filteredDepartments,
        filteredResources,
        isLoading,
        viewportHeight,
        TOTAL_TOP_HEIGHT,
        DEPARTMENT_ROW_HEIGHT,
        config.eventRowH,
      ]);

      const totalContentHeight = useMemo(() => {
        if (gridItems.length === 0) return 0;
        const lastItem = gridItems[gridItems.length - 1];
        // ✅ Последняя строка ПОЛНОСТЬЮ + фиксированный отступ 96px снизу
        const BOTTOM_PADDING = 96;
        return (
          lastItem.offset + lastItem.height + BOTTOM_PADDING
        );
      }, [gridItems, config.eventRowH]);

      // ====================================
      // VIRTUALIZATION
      // ====================================
      const { visibleItems, topSpacer } = useMemo(() => {
        if (gridItems.length === 0) {
          return { visibleItems: [], topSpacer: 0 };
        }

        const scrollOffset = Math.max(
          0,
          scrollTop - TOTAL_TOP_HEIGHT,
        );
        const viewportStart = scrollOffset;
        const viewportEnd = scrollOffset + viewportHeight;

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

        const bufferedStart = Math.max(
          0,
          startIndex - OVERSCAN_COUNT,
        );
        const bufferedEnd = Math.min(
          gridItems.length,
          endIndex + OVERSCAN_COUNT,
        );

        const visible = gridItems.slice(
          bufferedStart,
          bufferedEnd,
        );

        const departmentsAboveViewport = gridItems
          .slice(0, bufferedStart)
          .filter(
            (item) =>
              item.type === "department" ||
              item.type === "skeleton-department",
          );

        const visibleWithStickyDepts = [
          ...departmentsAboveViewport,
          ...visible,
        ];

        const spacer =
          visibleWithStickyDepts.length > 0
            ? visibleWithStickyDepts[0].offset
            : gridItems[bufferedStart]?.offset || 0;

        return {
          visibleItems: visibleWithStickyDepts,
          topSpacer: spacer,
        };
      }, [
        gridItems,
        scrollTop,
        viewportHeight,
        TOTAL_TOP_HEIGHT,
        OVERSCAN_COUNT,
        totalContentHeight,
      ]);

      // ====================================
      // COMMENT DRAG EFFECT & HANDLERS (Moved down to access gridItems)
      // ====================================
      const handleCommentPointerDown = useCallback(
        (
          e: React.PointerEvent | React.MouseEvent,
          comment: Comment,
        ) => {
          e.preventDefault();
          e.stopPropagation();

          const target = e.currentTarget as HTMLElement;
          const rect = target.getBoundingClientRect();
          const offsetX = e.clientX - rect.left;
          const offsetY = e.clientY - rect.top;

          setDraggedCommentState({
            id: comment.id,
            startX: e.clientX,
            startY: e.clientY,
            currentX: e.clientX,
            currentY: e.clientY,
            offsetX,
            offsetY,
            comment,
          });
        },
        [],
      );

      // Global listeners for comment drag
      useEffect(() => {
        if (!draggedCommentState) return;

        const handleMove = (e: PointerEvent) => {
          e.preventDefault();
          setDraggedCommentState((prev) =>
            prev
              ? {
                  ...prev,
                  currentX: e.clientX,
                  currentY: e.clientY,
                }
              : null,
          );

          // Calculate ghost position
          const scrollContainer = scrollRef?.current;
          if (!scrollContainer) {
            setCommentGhostPosition(null);
            return;
          }

          const rect = scrollContainer.getBoundingClientRect();
          const xInScroll =
            e.clientX - rect.left + scrollContainer.scrollLeft;
          const yInScroll =
            e.clientY - rect.top + scrollContainer.scrollTop;

          const sidebarWidth = sidebarCollapsed
            ? LEFT_SIDEBAR_WIDTH_COLLAPSED
            : LEFT_SIDEBAR_WIDTH;
          const xInContent = xInScroll - sidebarWidth;
          const yInContent = yInScroll - TOTAL_TOP_HEIGHT;

          if (xInContent < 0 || yInContent < 0) {
            setCommentGhostPosition(null);
            return;
          }

          const weekIndex = Math.floor(
            xInContent / config.weekPx,
          );
          const targetItem = gridItems.find(
            (item) =>
              item.type === "resource" &&
              yInContent >= item.offset &&
              yInContent < item.offset + item.height,
          );

          if (
            targetItem &&
            targetItem.resource &&
            weekIndex >= 0 &&
            weekIndex < weeksInYear
          ) {
            setCommentGhostPosition({
              visible: true,
              weekIndex,
              resourceId: targetItem.resource.id,
              top:
                TOTAL_TOP_HEIGHT +
                targetItem.offset +
                config.gap * 1,
              left:
                weekIndex * config.weekPx + config.gap * 0.5,
            });
          } else {
            setCommentGhostPosition(null);
          }
        };

        const handleUp = async (e: PointerEvent) => {
          const state = draggedCommentState;
          setDraggedCommentState(null); // Clear state immediately
          setCommentGhostPosition(null); // Clear ghost

          const dist = Math.sqrt(
            Math.pow(e.clientX - state.startX, 2) +
              Math.pow(e.clientY - state.startY, 2),
          );

          // If moved less than 5px, treat as accidental drag (do nothing)
          // The CommentMarker component handles mini→maxi expansion on its own click
          if (dist < 5) {
            return;
          }

          // Drop Logic
          const scrollContainer = scrollRef?.current;
          if (!scrollContainer) return;

          const rect = scrollContainer.getBoundingClientRect();
          // X relative to scroll container content
          const xInScroll =
            e.clientX - rect.left + scrollContainer.scrollLeft;
          const yInScroll =
            e.clientY - rect.top + scrollContainer.scrollTop;

          // Adjust for Sidebar
          const sidebarWidth = sidebarCollapsed
            ? LEFT_SIDEBAR_WIDTH_COLLAPSED
            : LEFT_SIDEBAR_WIDTH;
          const xInContent = xInScroll - sidebarWidth;
          const yInContent = yInScroll - TOTAL_TOP_HEIGHT; // Top headers

          if (xInContent < 0 || yInContent < 0) return;

          const weekIndex = Math.floor(
            xInContent / config.weekPx,
          );

          // Find Resource
          const targetItem = gridItems.find(
            (item) =>
              item.type === "resource" &&
              yInContent >= item.offset &&
              yInContent < item.offset + item.height,
          );

          if (
            targetItem &&
            targetItem.resource &&
            weekIndex >= 0 &&
            weekIndex < weeksInYear
          ) {
            // Only move if changed
            if (
              targetItem.resource.id !== state.comment.userId ||
              weekIndex !== state.comment.weekIndex
            ) {
              await moveComment(
                state.comment.id,
                weekIndex,
                targetItem.resource.id,
              );
            }
          }
        };

        window.addEventListener("pointermove", handleMove);
        window.addEventListener("pointerup", handleUp);

        return () => {
          window.removeEventListener("pointermove", handleMove);
          window.removeEventListener("pointerup", handleUp);
        };
      }, [
        draggedCommentState,
        gridItems,
        sidebarCollapsed,
        TOTAL_TOP_HEIGHT,
        config.weekPx,
        weeksInYear,
        moveComment,
        scrollRef,
      ]);

      useEffect(() => {
        const resourceCount = visibleItems.filter(
          (item) => item.type === "resource",
        ).length;
        const totalResources = gridItems.filter(
          (item) => item.type === "resource",
        ).length;

        setSrAnnouncement(
          `Showing ${resourceCount} of ${totalResources} resources. Scroll to see more.`,
        );
      }, [visibleItems.length, gridItems.length]);

      useEffect(() => {
        if (scrollRef.current) {
          setScrollDimensions({
            width: scrollRef.current.scrollWidth,
            height: scrollRef.current.scrollHeight,
          });
        }
      }, [
        gridItems,
        totalContentHeight,
        isLoading,
        scrollRef,
        config.weekPx,
      ]);

      // ====================================
      // GLOBAL INTERACTION HANDLER
      // ====================================

      const findItemAtY = useCallback(
        (y: number) => {
          let left = 0;
          let right = gridItems.length - 1;

          while (left <= right) {
            const mid = Math.floor((left + right) / 2);
            const item = gridItems[mid];

            if (
              y >= item.offset &&
              y < item.offset + item.height
            ) {
              return item;
            }

            if (y < item.offset) {
              right = mid - 1;
            } else {
              left = mid + 1;
            }
          }
          return null;
        },
        [gridItems],
      );

      const updateHoverHighlight = useCallback(
        (data: {
          visible: boolean;
          left: number;
          top: number;
          width: number;
          height: number;
        }) => {
          setInternalHoverHighlight(data);
        },
        [],
      );

      const handleGlobalMouseMove = useCallback(
        (e: React.MouseEvent) => {
          if (!scrollRef.current) return;

          // ✅ Игнорируем события мыши, если курсор находится над событием (event bubbling)
          // Это предотвращает появление хайлайта сетки поверх события
          if (
            (e.target as HTMLElement).closest(
              ".scheduler-event",
            )
          ) {
            updateHoverHighlight({
              ...internalHoverHighlight,
              visible: false,
            });
            return;
          }

          let dataY: number;
          // Optimization & Fix: If event triggered on the interactive overlay, use its rect directly.
          // This avoids issues with external headers/offsets affecting scrollRef calculation.
          // The overlay is positioned exactly over the resources area (below headers).
          const isOverlay =
            e.currentTarget !== scrollRef.current;

          if (isOverlay) {
            const rect =
              e.currentTarget.getBoundingClientRect();
            dataY = e.clientY - rect.top;
          } else {
            const rect =
              scrollRef.current.getBoundingClientRect();
            const relativeY = e.clientY - rect.top + scrollTop;
            dataY = relativeY - TOTAL_TOP_HEIGHT;
          }

          if (dataY < 0) {
            updateHoverHighlight({
              ...internalHoverHighlight,
              visible: false,
            });
            return;
          }

          const item = findItemAtY(dataY);

          if (
            item &&
            item.type === "resource" &&
            item.resource
          ) {
            const sidebarWidth = sidebarCollapsed
              ? LEFT_SIDEBAR_WIDTH_COLLAPSED
              : LEFT_SIDEBAR_WIDTH;

            // Calculate X relative to scroll container for consistent horizontal positioning
            const scrollRect =
              scrollRef.current.getBoundingClientRect();
            const relativeX =
              e.clientX - scrollRect.left + scrollLeft;
            const weekStartX = sidebarWidth + 8;

            if (relativeX < weekStartX) {
              updateHoverHighlight({
                ...internalHoverHighlight,
                visible: false,
              });
              return;
            }

            const xInGrid = relativeX - weekStartX;
            const week = Math.floor(xInGrid / config.weekPx);

            const yInRow = dataY - item.offset;
            const unitIndex = Math.floor(
              (yInRow - config.rowPaddingTop) /
                config.unitStride,
            );

            // Оптимизация: проверяем также unitIndex
            if (
              lastHoverRef.current.resourceId !==
                item.resource.id ||
              lastHoverRef.current.week !== week ||
              lastHoverRef.current.unitIndex !== unitIndex
            ) {
              lastHoverRef.current = {
                resourceId: item.resource.id,
                week,
                unitIndex,
              };

              // Вызываем внешний обр��ботчик с явным unitIndex
              if (onCellMouseMove) {
                onCellMouseMove(
                  e,
                  item.resource.id,
                  week,
                  unitIndex,
                );

                // ✅ Если есть внешний обработчик, отключаем внутренний хайлайт
                // Это передаёт полный контроль родителю (SchedulerMain), который может скрыть хайлайт над событи��ми
                if (internalHoverHighlight.visible) {
                  updateHoverHighlight({
                    ...internalHoverHighlight,
                    visible: false,
                  });
                }
                return;
              }

              // Вычисляем координаты для ховер-хайлайта (локальный fallback)
              // For comment mode: match comment container exactly (full week width, no cell padding)
              // For normal mode: use cell padding and unit positioning
              const left = commentMode
                ? week * config.weekPx + config.gap * 0.5
                : week * config.weekPx + config.cellPaddingLeft;

              const top = commentMode
                ? TOTAL_TOP_HEIGHT +
                  item.offset +
                  config.gap * 1
                : TOTAL_TOP_HEIGHT +
                  item.offset +
                  config.rowPaddingTop +
                  unitIndex * config.unitStride;

              // Calculate max units dynamically based on row height and padding
              // Assuming symmetric padding (top = bottom) if bottom is not defined
              const rowPaddingBottom =
                (config as any).rowPaddingBottom ??
                config.rowPaddingTop;
              const maxUnits = Math.floor(
                (config.eventRowH -
                  config.rowPaddingTop -
                  rowPaddingBottom) /
                  config.unitStride,
              );

              // Only show if unitIndex is valid (not in padding area) OR in comment mode
              if (
                commentMode ||
                (unitIndex >= 0 && unitIndex < maxUnits)
              ) {
                updateHoverHighlight({
                  visible: true,
                  left,
                  top,
                  width: commentMode
                    ? config.weekPx
                    : config.weekPx -
                      config.cellPaddingLeft -
                      config.cellPaddingRight,
                  height: commentMode ? 28 : config.unitStride,
                });
              } else {
                updateHoverHighlight({
                  ...internalHoverHighlight,
                  visible: false,
                });
              }
            }
          } else {
            updateHoverHighlight({
              ...internalHoverHighlight,
              visible: false,
            });
          }
        },
        [
          scrollRef,
          scrollTop,
          scrollLeft,
          TOTAL_TOP_HEIGHT,
          findItemAtY,
          sidebarCollapsed,
          config,
          onCellMouseMove,
          internalHoverHighlight,
          updateHoverHighlight,
        ],
      );

      const handleGlobalMouseLeave = useCallback(() => {
        // ✅ СБРОС REF, чтобы при возврате на ту же ячейку хайлайт сработал
        lastHoverRef.current = {
          resourceId: null,
          week: null,
          unitIndex: null,
        };

        if (onCellMouseLeave) {
          onCellMouseLeave();
        }
        updateHoverHighlight({
          ...internalHoverHighlight,
          visible: false,
        });
      }, [
        onCellMouseLeave,
        internalHoverHighlight,
        updateHoverHighlight,
      ]);

      // Функция для обработки ховера в строках (при showSeparators = true) - REMOVED
      // Using handleGlobalMouseMove for unified logic

      return (
        <div
          className="relative flex flex-col h-full bg-white select-none"
          style={{
            height: "100vh",
          }}
        >
          <style>{`
          .scheduler-scroll-container::-webkit-scrollbar {
            display: none;
          }
          .scheduler-scroll-container {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
          
          /* ✅ Ультра-легкий фон для недельных линий (используем тонкие div вместо градиентов) */
          .week-line {
            position: absolute;
            top: 0;
            width: 0.5px;
            height: 100%;
            background-color: rgba(223, 231, 238, 0.3);
            pointer-events: none;
          }
          
          .month-line {
            position: absolute;
            top: 0;
            width: 1px;
            height: 100%;
            background-color: rgba(180, 190, 200, 0.3);
            pointer-events: none;
          }
        `}</style>
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
              overflow: isLoading ? "hidden" : "auto",
            }}
            onMouseMove={handleGlobalMouseMove}
            onMouseLeave={handleGlobalMouseLeave}
          >
            {/* ====================================== */}
            {/* OPTIMIZATION: УПРОЩЕННЫЙ ФОН при showSeparators = false */}
            {/* ====================================== */}

            {!showSeparators && !isLoading && (
              <>
                {/* ✅ ПРОСТОЙ БЕЛЫЙ ФОН без градиентов */}
                <div
                  style={{
                    position: "absolute",
                    top: `${TOTAL_TOP_HEIGHT}px`,
                    left: `${sidebarCollapsed ? LEFT_SIDEBAR_WIDTH_COLLAPSED : LEFT_SIDEBAR_WIDTH}px`,
                    width: `${config.weekPx * weeksInYear + 4}px`,
                    height: `${totalContentHeight}px`,
                    backgroundColor: "#fff",
                    zIndex: 0,
                    pointerEvents: "none",
                  }}
                />

                {/* ✅ ВЕРТИКАЛЬНЫЕ ЛИНИИ НЕДЕЛЬ */}
                {Array.from({ length: weeksInYear - 1 }).map(
                  (_, i) => {
                    const weekPos = i + 1;
                    return (
                      <div
                        key={`week-line-${weekPos}`}
                        className="week-line"
                        style={{
                          left: `${weekPos * config.weekPx}px`,
                          top: `${TOTAL_TOP_HEIGHT}px`,
                          height: `${totalContentHeight}px`,
                        }}
                      />
                    );
                  },
                )}

                {/* ✅ ВЕРТИКАЛЬНЫЕ ЛИНИИ МЕСЯЦ��В */}
                {months.slice(0, -1).map((_, i) => {
                  const weeks = months
                    .slice(0, i + 1)
                    .reduce((a, b) => a + b.weeks, 0);
                  return (
                    <div
                      key={`month-line-${i}`}
                      className="month-line"
                      style={{
                        left: `${weeks * config.weekPx}px`,
                        top: `${TOTAL_TOP_HEIGHT}px`,
                        height: `${totalContentHeight}px`,
                      }}
                    />
                  );
                })}

                {/* ✅ ЕДИНЫЙ ИНТЕРАКТИВНЫЙ СЛОЙ - С ПРАВИЛЬНОЙ ВЫСОТОЙ */}
              </>
            )}

            {!isLoading && (
              <div
                onClick={(e) => {
                  if (!scrollRef.current) return;

                  const rect =
                    scrollRef.current.getBoundingClientRect();
                  const relativeY =
                    e.clientY - rect.top + scrollTop;
                  const dataY = relativeY - TOTAL_TOP_HEIGHT;

                  if (dataY < 0) return;

                  const item = findItemAtY(dataY);

                  if (
                    item &&
                    item.type === "resource" &&
                    item.resource
                  ) {
                    const sidebarWidth = sidebarCollapsed
                      ? LEFT_SIDEBAR_WIDTH_COLLAPSED
                      : LEFT_SIDEBAR_WIDTH;
                    const relativeX =
                      e.clientX - rect.left + scrollLeft;
                    const weekStartX = sidebarWidth + 4;

                    if (relativeX < weekStartX) return;

                    const xInGrid = relativeX - weekStartX;
                    const week = Math.floor(
                      xInGrid / config.weekPx,
                    );

                    const yInRow = dataY - item.offset;
                    const unitIndex = Math.floor(
                      (yInRow - config.rowPaddingTop) /
                        config.unitStride,
                    );

                    // ✅ INTERCEPT CLICK FOR COMMENTS
                    if (commentMode) {
                      const weekDate = getWeekStartDate(
                        timelineYear,
                        week,
                      ).toISOString();
                      setCommentModalState({
                        isOpen: true,
                        isCreating: true,
                        createData: {
                          resourceId: item.resource.id,
                          weekIndex: week,
                          weekDate,
                        },
                      });
                      return;
                    }

                    onCellClick(
                      item.resource.id,
                      week,
                      unitIndex,
                    );
                  }
                }}
                onMouseMove={handleGlobalMouseMove}
                onMouseLeave={handleGlobalMouseLeave}
                onContextMenu={(e) => {
                  if (!scrollRef.current || !onCellContextMenu)
                    return;

                  const rect =
                    scrollRef.current.getBoundingClientRect();
                  const relativeY =
                    e.clientY - rect.top + scrollTop;
                  const dataY = relativeY - TOTAL_TOP_HEIGHT;

                  if (dataY < 0) return;

                  const item = findItemAtY(dataY);

                  if (
                    item &&
                    item.type === "resource" &&
                    item.resource
                  ) {
                    const sidebarWidth = sidebarCollapsed
                      ? LEFT_SIDEBAR_WIDTH_COLLAPSED
                      : LEFT_SIDEBAR_WIDTH;
                    const relativeX =
                      e.clientX - rect.left + scrollLeft;
                    const weekStartX = sidebarWidth + 4;

                    if (relativeX < weekStartX) return;

                    const xInGrid = relativeX - weekStartX;
                    const week = Math.floor(
                      xInGrid / config.weekPx,
                    );

                    const yInRow = dataY - item.offset;
                    const unitIndex = Math.floor(
                      (yInRow - config.rowPaddingTop) /
                        config.unitStride,
                    );

                    onCellContextMenu(
                      e,
                      item.resource.id,
                      week,
                      unitIndex,
                    );
                  }
                }}
                style={{
                  position: "absolute",
                  top: `${TOTAL_TOP_HEIGHT}px`,
                  left: `${sidebarCollapsed ? LEFT_SIDEBAR_WIDTH_COLLAPSED : LEFT_SIDEBAR_WIDTH}px`,
                  width: `${config.weekPx * weeksInYear + 4}px`,
                  height: `${Math.max(totalContentHeight, viewportHeight - TOTAL_TOP_HEIGHT)}px`,
                  zIndex: 1,
                  cursor: "pointer",
                }}
              />
            )}

            {/* ====================================== */}
            {/* UNIFIED CSS GRID */}
            {/* ====================================== */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `${sidebarCollapsed ? LEFT_SIDEBAR_WIDTH_COLLAPSED : LEFT_SIDEBAR_WIDTH}px 0px ${sidebarCollapsed ? 0 : 8}px repeat(${weeksInYear}, ${config.weekPx}px) 4px${commentMode ? " 292px" : ""}`,
                minWidth: "max-content",
              }}
            >
              {/* ========== ROW 1 (WAS ROW 2): SEARCH + MONTHS ========== */}

              {/* Left Corner: Search */}
              <div
                style={{
                  gridColumn: 1,
                  gridRow: 1,
                  position: "sticky",
                  left: 0,
                  top: 0,
                  height: `${MONTH_ROW_HEIGHT}px`,
                  backgroundColor: "#fff",
                  zIndex: 501,
                }}
              >
                <SidePaddedBox>
                  {!sidebarCollapsed && (
                    <div className="px-2 h-full flex items-center">
                      <SearchInput
                        value={searchQuery || ""}
                        onChange={(val) =>
                          onSearchChange?.(val)
                        }
                      />
                    </div>
                  )}
                </SidePaddedBox>
              </div>

              {/* Spacer Column for Months */}
              {!sidebarCollapsed && (
                <div
                  style={{
                    gridColumn: 3,
                    gridRow: 1,
                    position: "sticky",
                    top: 0,
                    height: `${MONTH_ROW_HEIGHT}px`,
                    backgroundColor: "#fff",
                    zIndex: 301,
                  }}
                >
                  <div className="w-[8px] shrink-0 h-full bg-white" />
                </div>
              )}

              {/* Month Headers */}
              {months.map((month, idx) => {
                const startCol =
                  months
                    .slice(0, idx)
                    .reduce((sum, m) => sum + m.weeks, 0) + 4;

                const isFirst = idx === 0;
                const isLast = idx === months.length - 1;
                let paddingClass = "px-0.5";
                if (isFirst && isLast) {
                  paddingClass = "px-1";
                } else if (isFirst) {
                  paddingClass = sidebarCollapsed
                    ? "pl-1 pr-0.5"
                    : "pl-0 pr-0.5";
                } else if (isLast) {
                  paddingClass = "pl-0.5 pr-1";
                }

                return (
                  <div
                    key={`month-${idx}`}
                    style={{
                      gridColumn: `${startCol} / span ${month.weeks}`,
                      gridRow: 1,
                      position: "sticky",
                      top: 0,
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

              {/* ========== ROW 2 (WAS ROW 3): WEEK HEADERS ========== */}

              {/* Left Corner: Empty */}
              <div
                style={{
                  gridColumn: 1,
                  gridRow: 2,
                  position: "sticky",
                  left: 0,
                  top: `${MONTH_ROW_HEIGHT}px`,
                  height: `${WEEK_ROW_HEIGHT}px`,
                  backgroundColor: "#fff",
                  zIndex: 501,
                }}
              >
                <SidePaddedBox>{null}</SidePaddedBox>
              </div>

              {/* Spacer Column for Weeks */}
              {!sidebarCollapsed && (
                <div
                  style={{
                    gridColumn: 3,
                    gridRow: 2,
                    position: "sticky",
                    top: `${MONTH_ROW_HEIGHT}px`,
                    height: `${WEEK_ROW_HEIGHT}px`,
                    backgroundColor: "#fff",
                    zIndex: 166,
                  }}
                >
                  <div className="w-[8px] shrink-0 h-full bg-white" />
                </div>
              )}

              {/* Week Headers */}
              {Array.from({ length: weeksInYear }).map(
                (_, w) => (
                  <div
                    key={`week-${w}`}
                    style={{
                      gridColumn: w + 4,
                      gridRow: 2,
                      position: "sticky",
                      top: `${MONTH_ROW_HEIGHT}px`,
                      height: `${WEEK_ROW_HEIGHT}px`,
                      backgroundColor: "#fff",
                      zIndex: 165,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <p className="font-normal text-[12px] text-[#868789] truncate">
                      {weekLabel(
                        w,
                        timelineYear,
                        config.weekPx,
                      )}
                    </p>
                  </div>
                ),
              )}

              {/* ========== ROW 3+ (WAS ROW 4+): DEPARTMENTS + RESOURCES (VIRTUALIZED) ========== */}

              {/* Top Spacer */}
              {topSpacer > 0 && (
                <div
                  style={{
                    gridColumn: "1 / -1",
                    gridRow: 3,
                    height: `${topSpacer}px`,
                  }}
                />
              )}

              {visibleItems.map((item, idx) => {
                // GAP SPACER
                const gapElement = (() => {
                  if (idx === 0) return null;

                  const prevRow = visibleItems[idx - 1].row;
                  if (item.row > prevRow + 1) {
                    const prevItem = visibleItems[idx - 1];
                    const gapHeight =
                      item.offset -
                      (prevItem.offset + prevItem.height);

                    if (gapHeight > 0) {
                      return (
                        <div
                          key={`gap-before-${item.type}-${item.row}`}
                          style={{
                            gridColumn: "1 / -1",
                            gridRow: prevRow + 1,
                            height: `${gapHeight}px`,
                            pointerEvents: "none",
                          }}
                        />
                      );
                    }
                  }
                  return null;
                })();

                // ✨ SKELETON ROW
                if (item.type === "skeleton") {
                  return (
                    <React.Fragment
                      key={`skeleton-${item.row}`}
                    >
                      {gapElement}
                      {/* Skeleton Name (Left) */}
                      <div
                        style={{
                          gridColumn: 1,
                          gridRow: item.row,
                          position: "sticky",
                          left: 0,
                          height: `${config.eventRowH}px`,
                          backgroundColor: "#fff",
                          zIndex: 200,
                        }}
                      >
                        <div className="w-full h-full flex items-center pl-2">
                          <div
                            className={`w-full h-full border-l border-r border-[#f0f0f0] ${sidebarCollapsed ? "" : "px-4"}`}
                            style={{
                              borderBottom: showSeparators
                                ? "1px solid #f0f0f0"
                                : "none",
                            }}
                          >
                            <ResourceRowSkeleton
                              sidebarCollapsed={
                                sidebarCollapsed
                              }
                              rowHeight={config.eventRowH}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Skeleton Row (52 weeks) - ТОЛЬКО при showSeparators = true */}
                      {showSeparators && (
                        <div
                          style={{
                            gridColumn: "3 / -1",
                            gridRow: item.row,
                            width: `${config.weekPx * weeksInYear + 4}px`,
                            backgroundColor: "#fff",
                            borderBottom: "1px solid #DFE7EE",
                            position: "relative",
                          }}
                        >
                          {/* Skeleton Event */}
                          {(() => {
                            const skeletonHeight =
                              config.eventRowH -
                              config.rowPaddingTop * 2;

                            return (
                              <div
                                className="animate-pulse"
                                style={{
                                  position: "absolute",
                                  left: `${config.cellPaddingLeft + 4}px`,
                                  top: `${config.rowPaddingTop}px`,
                                  width: `${weeksInYear * config.weekPx - config.cellPaddingLeft - config.cellPaddingRight}px`,
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
                      )}
                    </React.Fragment>
                  );
                }

                if (item.type === "skeleton-department") {
                  return (
                    <React.Fragment
                      key={`skeleton-dept-${item.row}`}
                    >
                      {gapElement}
                      {/* Department Skeleton (Left) */}
                      <div
                        style={{
                          gridColumn: 1,
                          gridRow: item.row,
                          position: "sticky",
                          left: 0,
                          top: `${MONTH_ROW_HEIGHT + WEEK_ROW_HEIGHT}px`,
                          height: `${DEPARTMENT_ROW_HEIGHT}px`,
                          backgroundColor: "#fff",
                          zIndex: 201,
                        }}
                      >
                        <SidePaddedBox>
                          <DepartmentRowSkeleton
                            sidebarCollapsed={sidebarCollapsed}
                          />
                        </SidePaddedBox>
                      </div>

                      {/* Department Row (52 weeks) */}
                      <div
                        style={{
                          gridColumn: "3 / -1",
                          gridRow: item.row,
                          position: "sticky",
                          left: 0,
                          top: `${MONTH_ROW_HEIGHT + WEEK_ROW_HEIGHT}px`,
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
                    <React.Fragment
                      key={`dept-${item.dept.id}`}
                    >
                      {gapElement}
                      {/* Department Name (Left) */}
                      <div
                        style={{
                          gridColumn: 1,
                          gridRow: item.row,
                          position: "sticky",
                          left: 0,
                          top: `${MONTH_ROW_HEIGHT + WEEK_ROW_HEIGHT}px`,
                          height: `${DEPARTMENT_ROW_HEIGHT}px`,
                          backgroundColor: "#fff",
                          zIndex: 201,
                        }}
                      >
                        <SidePaddedBox>
                          {!sidebarCollapsed && (
                            <div className="px-4 h-full flex items-center justify-between">
                              <p className="font-medium text-xs text-[#868789] uppercase truncate mr-2">
                                {item.dept.name}
                              </p>
                              {item.dept.last_activity_at && (
                                <p className="text-[10px] text-[#A3A3A3] font-normal uppercase whitespace-nowrap">
                                  upd{" "}
                                  {new Date(
                                    item.dept.last_activity_at,
                                  )
                                    .getDate()
                                    .toString()
                                    .padStart(2, "0")}
                                  .
                                  {(
                                    new Date(
                                      item.dept.last_activity_at,
                                    ).getMonth() + 1
                                  )
                                    .toString()
                                    .padStart(2, "0")}
                                </p>
                              )}
                            </div>
                          )}
                        </SidePaddedBox>
                      </div>

                      {/* Department Row (52 weeks) */}
                      <div
                        style={{
                          gridColumn: "3 / -1",
                          gridRow: item.row,
                          position: "sticky",
                          left: 0,
                          top: `${MONTH_ROW_HEIGHT + WEEK_ROW_HEIGHT}px`,
                          height: `${DEPARTMENT_ROW_HEIGHT}px`,
                          backgroundColor: "#fff",
                          zIndex: 165,
                        }}
                      />
                    </React.Fragment>
                  );
                }

                if (item.type === "resource" && item.resource) {
                  return (
                    <React.Fragment
                      key={`resource-${item.resource.id}`}
                    >
                      {gapElement}
                      {/* Resource Name (Left) - ВСЕГДА рендерим */}
                      <div
                        style={{
                          gridColumn: 1,
                          gridRow: item.row,
                          position: "sticky",
                          left: 0,
                          height: `${config.eventRowH}px`,
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
                          grades={grades}
                          currentWeekIndex={currentWeekIndex}
                          weeksInYear={weeksInYear}
                          rowHeight={config.eventRowH}
                          sidebarCollapsed={sidebarCollapsed}
                          showSeparators={showSeparators}
                          isLastInDept={item.isLastInDept}
                          getUserInitials={getUserInitials}
                        />
                      </div>

                      {/* Resource Row - Interaction Layer + Background */}
                      <div
                        className="cell resource-row event-row"
                        role="row"
                        aria-label={`${item.resource!.displayName}, ${
                          grades.find(
                            (g) =>
                              g.id === item.resource!.gradeId,
                          )?.name || ""
                        }, ${
                          companies.find(
                            (c) =>
                              c.id === item.resource!.companyId,
                          )?.name || ""
                        }`}
                        style={{
                          gridColumn: "3 / -1",
                          gridRow: item.row,
                          width: `${config.weekPx * weeksInYear + 4}px`,
                          backgroundColor: "#fff",
                          backgroundImage: (() => {
                            const monthStops = [];
                            const weekStops = [];

                            // 1. Week lines (lighter)
                            // We start at i=1 (divider between Week 1 and Week 2)
                            // We end at i < weeksInYear (divider between Week 51 and Week 52)
                            // We do NOT draw at i=0 (left edge) or i=weeksInYear (right edge)
                            for (
                              let i = 1;
                              i < weeksInYear;
                              i++
                            ) {
                              const px = i * config.weekPx;
                              weekStops.push(
                                `transparent ${px - 1}px`,
                              );
                              weekStops.push(
                                `#F0F0F0 ${px - 1}px`,
                              );
                              weekStops.push(`#F0F0F0 ${px}px`);
                              weekStops.push(
                                `transparent ${px}px`,
                              );
                            }

                            // 2. Month lines (darker)
                            let accumulatedWeeks = 0;
                            months.forEach((month, index) => {
                              accumulatedWeeks += month.weeks;
                              if (index === months.length - 1)
                                return;

                              const px =
                                accumulatedWeeks *
                                config.weekPx;
                              monthStops.push(
                                `transparent ${px - 1}px`,
                              );
                              monthStops.push(
                                `#D4D4D4 ${px - 1}px`,
                              );
                              monthStops.push(
                                `#D4D4D4 ${px}px`,
                              );
                              monthStops.push(
                                `transparent ${px}px`,
                              );
                            });

                            const gradients = [];
                            if (monthStops.length > 0) {
                              gradients.push(
                                `linear-gradient(to right, ${monthStops.join(", ")})`,
                              );
                            }
                            if (weekStops.length > 0) {
                              gradients.push(
                                `linear-gradient(to right, ${weekStops.join(", ")})`,
                              );
                            }

                            return gradients.length > 0
                              ? gradients.join(", ")
                              : "none";
                          })(),
                          backgroundSize: `${config.weekPx * weeksInYear}px 100%`,
                          backgroundPosition: "9px 0",
                          backgroundRepeat: "no-repeat",
                          cursor: "pointer",
                          borderBottom:
                            showSeparators && !item.isLastInDept
                              ? "1px solid #DFE7EE"
                              : "none",
                          position: "relative",
                          zIndex: 0, // Explicit low z-index
                          pointerEvents: "auto", // ✅ Ensure mouse events are captured
                        }}
                        data-resource-id={item.resource!.id}
                        // Events handled by Global Interaction Layer
                        tabIndex={0}
                      />
                    </React.Fragment>
                  );
                }

                return null;
              })}

              {/* Bottom Spacer */}
              {visibleItems.length > 0 && (
                <div
                  style={{
                    gridColumn: "1 / -1",
                    gridRow:
                      (visibleItems[visibleItems.length - 1]
                        ?.row || 4) + 1,
                    height: `${Math.max(0, totalContentHeight - (visibleItems[visibleItems.length - 1] ? visibleItems[visibleItems.length - 1].offset + visibleItems[visibleItems.length - 1].height : topSpacer))}px`,
                  }}
                />
              )}

              {/* 🌸 СПЕЙСЕР - Заполняет пространство до низа экрана */}
              <div
                style={{
                  position: "fixed",
                  left: 0,
                  top: `${MONTH_ROW_HEIGHT + WEEK_ROW_HEIGHT}px`,
                  bottom: 0,
                  width: `${sidebarCollapsed ? LEFT_SIDEBAR_WIDTH_COLLAPSED : LEFT_SIDEBAR_WIDTH}px`,
                  zIndex: 160,
                }}
              >
                <SidePaddedBox>
                  {/* Спейсер для заполнения пространства */}
                </SidePaddedBox>
              </div>

              {/* ========== CHRONO OVERLAY (Current Week Marker) ========== */}
              <div
                style={{
                  gridColumn: "4 / -2",
                  gridRow: "4 / -1", // Should extend from below weeks
                  position: "sticky",
                  top: `${MONTH_ROW_HEIGHT + WEEK_ROW_HEIGHT}px`,
                  height: 0,
                  pointerEvents: "none",
                  zIndex: 155,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: -9,
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
                          width: `${currentWeekIndex * config.weekPx + 9}px`,
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
                        left: `${currentWeekIndex * config.weekPx + 9}px`,
                        height: "100%",
                        width: "1px",
                        backgroundColor: "#0062FF",
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
                  gridColumn: "4 / -2",
                  gridRow: "1 / -1",
                  position: "relative",
                  zIndex: 100,
                  pointerEvents: "none",
                  // ✅ CSS-переменная для sticky-позиционирования названий событий
                  ["--sticky-name-left" as any]: `${sidebarCollapsed ? LEFT_SIDEBAR_WIDTH_COLLAPSED + 8 : LEFT_SIDEBAR_WIDTH + 12}px`,
                }}
              >
                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    height: "100%",
                    paddingTop: 0,
                    pointerEvents: "none",
                  }}
                >
                  {renderEvents && renderEvents()}

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

                  {/* Hover Highlight (Rendered INSIDE Events Layer) */}
                  {!isLoading &&
                    (hoverHighlight?.visible ||
                      internalHoverHighlight.visible) && (
                      <div
                        style={{
                          position: "absolute",
                          left: hoverHighlight?.visible
                            ? hoverHighlight.left
                            : internalHoverHighlight.left,
                          top: hoverHighlight?.visible
                            ? hoverHighlight.top
                            : internalHoverHighlight.top,
                          width: hoverHighlight?.visible
                            ? hoverHighlight.width
                            : internalHoverHighlight.width,
                          height: hoverHighlight?.visible
                            ? hoverHighlight.height
                            : internalHoverHighlight.height,
                          backgroundColor:
                            "rgba(59, 130, 246, 0.15)",
                          borderRadius: showGaps
                            ? "12px"
                            : "0px",
                          pointerEvents: "none",
                          zIndex: commentMode ? 150 : -1,
                        }}
                      />
                    )}
                </div>
              </div>

              {/* ========== COMMENTS LAYER ========== */}
              <div
                style={{
                  gridColumn: "4 / -2",
                  gridRow: "1 / -1",
                  position: "relative",
                  zIndex: 160, // Higher than Events(100) and Overlay(1)
                  pointerEvents: "none",
                }}
              >
                {visibleItems.map((item) => {
                  if (
                    item.type !== "resource" ||
                    !item.resource
                  )
                    return null;
                  const resourceComments =
                    commentsByResource.get(item.resource.id);
                  if (
                    !resourceComments ||
                    resourceComments.length === 0
                  )
                    return null;

                  return resourceComments.map((comment) => {
                    if (
                      comment.weekIndex === undefined ||
                      comment.weekIndex < 0 ||
                      comment.weekIndex >= weeksInYear
                    )
                      return null;

                    const top =
                      TOTAL_TOP_HEIGHT +
                      item.offset +
                      config.gap;
                    const left =
                      comment.weekIndex * config.weekPx +
                      config.gap * 0.5;

                    const isDragging =
                      draggedCommentState?.id === comment.id;

                    return (
                      <div
                        key={`comment-${comment.id}`}
                        style={{
                          position: "absolute",
                          left: `${left}px`,
                          top: `${top}px`,
                          width: `${config.weekPx}px`,
                          height: `${config.eventRowH}px`,
                          pointerEvents: "none",
                          opacity: isDragging ? 0.4 : 1,
                          transition: isDragging
                            ? "none"
                            : "opacity 0.2s",
                        }}
                      >
                        <div style={{ pointerEvents: "auto" }}>
                          <CommentMarker
                            comment={comment}
                            cellWidth={config.weekPx}
                            gap={0}
                            isOpen={
                              expandedCommentId === comment.id
                            }
                            onToggle={(isOpen) =>
                              setExpandedCommentId(
                                isOpen ? comment.id : null,
                              )
                            }
                            onClick={() => {}}
                            onEdit={() =>
                              setCommentModalState({
                                isOpen: true,
                                isCreating: false,
                                comment,
                              })
                            }
                            onDelete={() => {
                              if (
                                window.confirm(
                                  "Вы уверены, что хотите удалить этот комментарий?",
                                )
                              ) {
                                deleteComment(comment.id);
                              }
                            }}
                            onDragStart={(e) =>
                              handleCommentPointerDown(
                                e,
                                comment,
                              )
                            }
                          />
                        </div>
                      </div>
                    );
                  });
                })}

                {/* Ghost Comment Preview */}
                {commentGhostPosition?.visible && (
                  <div
                    style={{
                      position: "absolute",
                      left: `${commentGhostPosition.left}px`,
                      top: `${commentGhostPosition.top}px`,
                      width: `${config.weekPx - config.gap}px`,
                      height: `28px`,
                      backgroundColor:
                        "rgba(59, 130, 246, 0.15)",
                      borderRadius: "12px",
                      pointerEvents: "none",
                      zIndex: 1000,
                    }}
                  />
                )}
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
              width: `${sidebarCollapsed ? LEFT_SIDEBAR_WIDTH_COLLAPSED : LEFT_SIDEBAR_WIDTH}px`,
              height: "25px",
              zIndex: 400,
              pointerEvents: "none",
            }}
          >
            <Fakebottomfix />
          </div>

          {/* Right Sidebar Panel (Independent Scroll) */}
          <div
            style={{
              position: "fixed",
              top: 0,
              right: commentMode ? 0 : "-300px",
              bottom: 0,
              width: "292px",
              zIndex: 600,
              pointerEvents: "none",
              padding: "8px 8px 8px 0",
              background: "#fff",
              display: "flex",
              flexDirection: "row",
              transition: "right 0.2s ease-in-out",
            }}
          >
            {/* Panel Content */}
            <div
              style={{
                height: "100%",
                width: "100%",
                border: "1px solid #f0f0f0",
                borderRadius: "16px",
                overflow: "hidden",
                backgroundColor: "#fff",
                pointerEvents: "auto",
                display: "flex",
                flexDirection: "column",
                position: "relative",
              }}
            >
              {/* Header Section */}
              <div
                style={{
                  padding: "16px",
                  flexShrink: 0,
                }}
              >
                <h2
                  style={{
                    fontSize: "14px",
                    fontWeight: 500,
                    margin: 0,
                    color: "#000",
                    fontFamily: "Onest, sans-serif",
                  }}
                >
                  Комментарии
                </h2>
                {isLoading ? (
                  <div className="h-3 w-24 bg-gray-100 rounded animate-pulse mt-1" />
                ) : (
                  <p
                    style={{
                      fontSize: "12px",
                      lineHeight: "16px",
                      color: "#868789",
                      marginTop: "0px",
                      fontFamily: "Onest, sans-serif",
                    }}
                  >
                    {(() => {
                      const count = Array.from(
                        commentsByResource.values(),
                      ).flat().length;
                      const cases = [2, 0, 1, 1, 1, 2];
                      const titles = [
                        "комментарий",
                        "комментария",
                        "комментариев",
                      ];
                      const declension =
                        titles[
                          count % 100 > 4 && count % 100 < 20
                            ? 2
                            : cases[
                                count % 10 < 5 ? count % 10 : 5
                              ]
                        ];
                      return `${count} ${declension}`;
                    })()}
                  </p>
                )}
              </div>

              {/* Scrollable List */}
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  width: "100%",
                  padding: "0 16px 16px 16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                {isLoading || isLoadingComments
                  ? Array.from({ length: 4 }).map((_, i) => (
                      <div
                        key={`skeleton-comment-${i}`}
                        className="rounded-[12px] w-full shrink-0 border border-gray-100 p-[10px] flex gap-[8px] animate-pulse"
                      >
                        <div className="size-[16px] rounded-full bg-gray-100 shrink-0 mt-[2px]" />
                        <div className="flex flex-col gap-2 w-full">
                          <div className="h-2 w-20 bg-gray-100 rounded" />
                          <div className="h-3 w-full bg-gray-100 rounded" />
                          <div className="h-3 w-2/3 bg-gray-100 rounded" />
                        </div>
                      </div>
                    ))
                  : Array.from(commentsByResource.values())
                      .flat()
                      .sort(
                        (a, b) =>
                          new Date(b.createdAt).getTime() -
                          new Date(a.createdAt).getTime(),
                      )
                      .map((comment) => (
                        <div
                          key={comment.id}
                          className="backdrop-blur-[2px] backdrop-filter bg-[rgba(255,255,255,0.8)] relative rounded-[12px] w-full shrink-0"
                          style={{
                            border: "1px solid #f0f0f0",
                          }}
                        >
                          <div className="flex gap-[8px] items-start p-[10px] relative w-full">
                            {/* Avatar Frame */}
                            <div className="h-[18px] relative shrink-0 w-[16px] mt-[2px]">
                              {comment.authorAvatarUrl ? (
                                <img
                                  src={comment.authorAvatarUrl}
                                  className="absolute left-0 rounded-[20px] size-[16px] top-px object-cover"
                                  alt=""
                                />
                              ) : (
                                <div className="absolute bg-[#4677ee] left-0 rounded-[20px] size-[16px] top-px" />
                              )}
                            </div>

                            {/* Content Frame1 */}
                            <div
                              className="flex flex-col grow items-start justify-center min-w-0 cursor-pointer"
                              onClick={() => {
                                if (!scrollRef.current) return;

                                setExpandedCommentId(
                                  comment.id,
                                );

                                // X Scroll (Horizontal)
                                if (
                                  comment.weekIndex !==
                                  undefined
                                ) {
                                  const x =
                                    comment.weekIndex *
                                    config.weekPx;
                                  const centeredX =
                                    x -
                                    (scrollRef.current
                                      .clientWidth || 0) /
                                      2 +
                                    config.weekPx / 2;
                                  scrollRef.current.scrollLeft =
                                    Math.max(0, centeredX);
                                }

                                // Y Scroll (Vertical)
                                const targetItem =
                                  gridItems.find(
                                    (i) =>
                                      i.type === "resource" &&
                                      i.resource?.id ===
                                        comment.userId,
                                  );

                                if (targetItem) {
                                  const top =
                                    targetItem.offset +
                                    TOTAL_TOP_HEIGHT;
                                  const centeredY =
                                    top -
                                    (scrollRef.current
                                      .clientHeight || 0) /
                                      2 +
                                    config.eventRowH / 2;

                                  scrollRef.current.scrollTop =
                                    Math.max(0, centeredY);
                                }
                              }}
                            >
                              <div className="flex w-full justify-between items-baseline gap-2">
                                <p className="font-medium leading-[18px] text-[10px] text-[rgba(0,0,0,0.5)] whitespace-nowrap overflow-hidden text-ellipsis">
                                  {comment.userDisplayName}
                                </p>
                                <span className="text-[10px] text-[rgba(0,0,0,0.3)] shrink-0">
                                  {new Date(
                                    comment.createdAt,
                                  ).toLocaleDateString()}
                                </span>
                              </div>
                              <p className="font-normal leading-normal text-[12px] text-black w-full break-words whitespace-pre-wrap mt-[2px]">
                                {comment.comment}
                              </p>

                              {/* Actions (ButtonGroup) */}
                              {/* 
                            <div className="flex gap-[8px] items-start pt-[8px] w-full mt-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCommentModalState({
                                    isOpen: true,
                                    isCreating: false,
                                    comment,
                                  })
                                }}
                                className="basis-0 grow h-[32px] relative rounded-[12px] shrink-0 border border-[rgba(0,0,0,0.12)] flex items-center justify-center hover:bg-gray-50 transition-colors"
                              >
                                <span className="font-medium text-[12px] text-black">
                                  Изменить
                                </span>
                              </button>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (
                                    window.confirm(
                                      "Вы уверены, что хотите удалить этот комментарий?",
                                    )
                                  ) {
                                    deleteComment(comment.id);
                                  }
                                }}
                                className="basis-0 grow h-[32px] relative rounded-[12px] shrink-0 border border-[rgba(0,0,0,0.12)] flex items-center justify-center hover:bg-gray-50 transition-colors"
                              >
                                <span className="font-medium text-[12px] text-[#e7000b]">
                                  Удалить
                                </span>
                              </button>
                            </div> 
                            */}
                            </div>
                          </div>
                        </div>
                      ))}
              </div>
            </div>
          </div>

          {/* ====================================== */}
          {/* TOGGLE SIDEBAR BUTTON */}
          {/* ====================================== */}
          <div
            className="lg:hidden"
            style={{
              position: "fixed",
              bottom: "16px",
              left: "16px",
              zIndex: 401,
              pointerEvents: "auto",
              backgroundColor: "rgba(255, 255, 255, 0.9)",
              borderRadius: "8px",
            }}
          >
            <SidebarToggleButton
              collapsed={sidebarCollapsed}
              onClick={handleToggleSidebar}
            />
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

          {/* Dragged Comment Ghost */}
          {draggedCommentState && (
            <div
              style={{
                position: "fixed",
                left:
                  draggedCommentState.currentX -
                  draggedCommentState.offsetX,
                top:
                  draggedCommentState.currentY -
                  draggedCommentState.offsetY,
                width: `${config.weekPx}px`,
                height: `${config.eventRowH}px`,
                pointerEvents: "none",
                zIndex: 2000,
                opacity: 0.9,
              }}
            >
              <CommentMarker
                comment={draggedCommentState.comment}
                cellWidth={config.weekPx}
                gap={0}
                onClick={() => {}}
              />
            </div>
          )}

          {!isLoading && (
            <CustomScrollbars
              scrollRef={
                scrollRef as React.RefObject<HTMLDivElement>
              }
              scrollTop={scrollTop}
              scrollLeft={scrollLeft}
              scrollHeight={scrollDimensions.height}
              scrollWidth={scrollDimensions.width}
              clientHeight={viewportHeight}
              clientWidth={viewportWidth}
              verticalTopOffset={152} // Offset to avoid header + toolbar
              horizontalLeftOffset={
                sidebarCollapsed
                  ? LEFT_SIDEBAR_WIDTH_COLLAPSED + 8
                  : LEFT_SIDEBAR_WIDTH + 8
              }
              rightOffset={commentMode ? 292 : 0}
              isModalOpen={isModalOpen}
              sidebarCollapsed={sidebarCollapsed}
            />
          )}

          {/* Comment Modal */}
          <CommentModal
            isOpen={commentModalState.isOpen}
            onClose={() =>
              setCommentModalState((prev) => ({
                ...prev,
                isOpen: false,
              }))
            }
            isCreating={commentModalState.isCreating}
            initialText={
              commentModalState.isCreating
                ? ""
                : commentModalState.comment?.comment
            }
            authorName={
              !commentModalState.isCreating
                ? commentModalState.comment?.userDisplayName
                : undefined
            }
            authorAvatarUrl={
              !commentModalState.isCreating
                ? commentModalState.comment?.authorAvatarUrl
                : undefined
            }
            dateStr={
              !commentModalState.isCreating &&
              commentModalState.comment?.createdAt
                ? new Date(
                    commentModalState.comment.createdAt,
                  ).toLocaleDateString()
                : undefined
            }
            onSave={async (text) => {
              if (
                commentModalState.isCreating &&
                commentModalState.createData
              ) {
                await createComment({
                  userId:
                    commentModalState.createData.resourceId,
                  userDisplayName:
                    currentUserDisplayName ||
                    currentUserDisplayNameFromToken ||
                    "Unknown",
                  authorAvatarUrl: currentUserAvatarUrl,
                  comment: text,
                  weekDate:
                    commentModalState.createData.weekDate,
                  weekIndex:
                    commentModalState.createData.weekIndex, // ✅ Pass the explicit week index
                });
              } else if (
                !commentModalState.isCreating &&
                commentModalState.comment
              ) {
                await updateComment(
                  commentModalState.comment.id,
                  text,
                );
              }
            }}
            onDelete={
              !commentModalState.isCreating &&
              commentModalState.comment
                ? async () => {
                    await deleteComment(
                      commentModalState.comment!.id,
                    );
                  }
                : undefined
            }
          />
        </div>
      );
    },
  ),
);

SchedulerGrid.displayName = "SchedulerGrid";