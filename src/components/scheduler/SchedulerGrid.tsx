import React, { useMemo, memo, forwardRef, useState, useRef, useEffect, useCallback } from "react";
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
  getCurrentWeekIndex,
} from "../../utils/scheduler";
import { LayoutConfig } from "../../utils/schedulerLayout";
import { X } from "lucide-react";
import svgPaths from "../../imports/svg-k0w039fxgr";
import FakeSpaser from "../../imports/FakeSpaser";
import Fakebottomfix from "../../imports/Fakebottomfix";
import Header from "../../imports/Header";
import { useScheduler } from "../../contexts/SchedulerContext";
import { highlightMatch } from "../../utils/highlightMatch";

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
  children?: React.ReactNode;
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
 * Вычисляет значимые проекты пользователя за диапазон (прошлый месяц + будущие 3 месяца).
 * Возвращает проекты, которые занимают >= 25% от объема в этом диапазоне.
 * Учитывает ак количество недель, так и высоту события (unitsTall).
 */
function getUserSignificantProjects(
  resourceId: string,
  events: SchedulerEvent[],
  projects: Project[],
  currentWeekIndex: number,
): Project[] {
  // Диапазон: 1 месяц назад + 3 месяца вперед = 4 месяца ≈ 17 недель
  const WEEKS_IN_MONTH = 4.33; // среднее количество недель в месяце
  const rangeStart = Math.max(0, Math.floor(currentWeekIndex - WEEKS_IN_MONTH));
  const rangeEnd = Math.min(WEEKS, Math.ceil(currentWeekIndex + WEEKS_IN_MONTH * 3));
  const totalWeeksInRange = rangeEnd - rangeStart;

  // Получить события пользователя в диапазоне
  const userEvents = events.filter(
    (e) =>
      e.resourceId === resourceId &&
      e.startWeek < rangeEnd &&
      e.startWeek + e.weeksSpan > rangeStart,
  );

  if (userEvents.length === 0) return [];

  // Подсчет "веса" по проектам (недели * unitsTall для учета загруженности)
  const projectWeightMap = new Map<string, number>();

  userEvents.forEach((event) => {
    const eventStart = Math.max(event.startWeek, rangeStart);
    const eventEnd = Math.min(event.startWeek + event.weeksSpan, rangeEnd);
    const weeksInRange = eventEnd - eventStart;

    if (weeksInRange > 0) {
      // Вес = количество недель (учитывая что событие может занимать часть времени по высоте)
      // Для простоты считаем что событие любой высоты занимает 1 неделю целиком
      const weight = weeksInRange;
      const current = projectWeightMap.get(event.projectId) || 0;
      projectWeightMap.set(event.projectId, current + weight);
    }
  });

  // Фильтр: проекты, занимающие >= 25% от диапазона
  const threshold = totalWeeksInRange * 0.25;
  const significantProjectIds = Array.from(projectWeightMap.entries())
    .filter(([, weight]) => weight >= threshold)
    .map(([projectId]) => projectId);

  // Вернуть объекты проектов, отсортированные по весу (больше времени = выше)
  const sortedProjectIds = Array.from(projectWeightMap.entries())
    .filter(([projectId]) => significantProjectIds.includes(projectId))
    .sort((a, b) => b[1] - a[1])
    .map(([projectId]) => projectId);

  return sortedProjectIds
    .map((id) => projects.find((p) => p.id === id))
    .filter((p): p is Project => p !== undefined);
}

// --- Components from Figma Import ---

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
function ProjectBadge({
  project,
}: {
  project: Project;
}) {
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
function ProjectsContainer({ projects }: { projects: Project[] }) {
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

export const SchedulerGrid = memo(
  forwardRef<HTMLDivElement, SchedulerGridProps>(
    (
      {
        config,
        accessToken,
        visibleDepartments,
        resources,
        grades = [],
        companies = [],
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
        renderEvents,
        hoverHighlight,
        ghost,
        children,
        searchQuery = "",
        onSearchChange,
        scissorsMode,
        commentMode,
        onToggleScissors,
        onToggleComment,
      },
      ref,
    ) => {
      const { events, projects } = useScheduler();

      // Refs for scroll synchronization
      const leftRef = useRef<HTMLDivElement | null>(null);
      const rightRef = useRef<HTMLDivElement | null>(null);

      // Forward the Right Panel ref to the parent using useImperativeHandle
      React.useImperativeHandle(ref, () => rightRef.current as HTMLDivElement);

      // Debug: Log ref status on mount
      useEffect(() => {
        console.log('📐 SchedulerGrid mounted:', {
          leftRef: leftRef.current ? 'OK' : 'NULL',
          rightRef: rightRef.current ? 'OK' : 'NULL',
          rightRefScrollWidth: rightRef.current?.scrollWidth,
          rightRefClientWidth: rightRef.current?.clientWidth,
          rightRefScrollHeight: rightRef.current?.scrollHeight,
          rightRefClientHeight: rightRef.current?.clientHeight,
          isScrollable: rightRef.current ? 
            (rightRef.current.scrollWidth > rightRef.current.clientWidth || 
             rightRef.current.scrollHeight > rightRef.current.clientHeight) : 
            false
        });
      }, []);

      const LEFT_WIDTH = config.resourceW;

      const timelineYear =
        workspace?.timeline_year || new Date().getFullYear();
      const months = useMemo(
        () => generateMonths(timelineYear),
        [timelineYear],
      );
      const lastWeeks = useMemo(
        () => getLastWeeksOfMonths(months),
        [months],
      );

      // Вычислить индекс текущей недели
      const currentWeekIndex = useMemo(
        () => getCurrentWeekIndex(timelineYear),
        [timelineYear],
      );

      // Heights
      const TOP_BAR_HEIGHT = 80;
      const HEADER_HEIGHT = config.rowH * 2; // Matches Month + Week rows
      const SEARCH_ROW_HEIGHT = 72;
      const TOTAL_TOP_HEIGHT =
        HEADER_HEIGHT + SEARCH_ROW_HEIGHT;

      // Resources passed from parent are already filtered by search query
      const filteredResources = resources;

      // Filter departments - only show departments that have matching resources
      const filteredDepartments = useMemo(() => {
        // If search query is active, hide departments with no matching resources
        if (searchQuery) {
          const activeDeptIds = new Set(filteredResources.map((r) => r.departmentId));
          return visibleDepartments.filter((dept) => activeDeptIds.has(dept.id));
        }
        return visibleDepartments;
      }, [visibleDepartments, filteredResources, searchQuery]);

      // Scroll synchronization effect
      useEffect(() => {
        const left = leftRef.current;
        const right = rightRef.current;
        if (!left || !right) return;

        const onRightScroll = () => {
          // Sync left panel's vertical scroll to match right panel
          // Use requestAnimationFrame for smooth synchronization
          requestAnimationFrame(() => {
            if (left) {
              left.scrollTop = right.scrollTop;
            }
          });
        };

        // Forward wheel events from left panel to right panel
        const onLeftWheel = (e: WheelEvent) => {
          // Skip if middle mouse button is pressed (panning mode)
          // buttons === 4 means middle button is held down
          if (e.buttons === 4) return;
          
          // Forward vertical scroll to right panel
          // The right panel will handle the scroll and trigger onRightScroll
          right.scrollTop += e.deltaY;
          
          // Prevent default to avoid double scrolling
          e.preventDefault();
        };

        // Initial sync on mount
        left.scrollTop = right.scrollTop;

        // Add event listeners
        right.addEventListener("scroll", onRightScroll, { passive: true });
        left.addEventListener("wheel", onLeftWheel, { passive: false });

        return () => {
          right.removeEventListener("scroll", onRightScroll);
          left.removeEventListener("wheel", onLeftWheel);
        };
      }, [filteredDepartments, filteredResources, config.rowH]);

      // Calculate used height for fake spacer
      const usedHeight = useMemo(() => {
        return filteredDepartments.reduce((acc, dept) => {
          const deptResCount = filteredResources.filter(
            (r) => r.departmentId === dept.id,
          ).length;
          return acc + 44 + deptResCount * 144;
        }, TOTAL_TOP_HEIGHT);
      }, [filteredDepartments, filteredResources, TOTAL_TOP_HEIGHT]);

      // Build left cells (gridColumn: 1)
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
              className=" shrink-0 w-full"
              key={`dept-header-${dept.id}`}
              style={{
                height: "44px",
                display: "flex",
                alignItems: "center",
                padding: "0 0 0 8px",
              }}
            >
              <div className="w-full h-full cell sticky-col department-row border-[#f0f0f0] border-[0px_1px] border-solid inset-0">
                <div
                  style={{
                    padding: "0 16px",
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    height: "100%",
                    boxSizing: "border-box",
                  }}
                >
                  <p className="font-medium text-xs text-[#868789] uppercase whitespace-nowrap">
                    {dept.name}
                  </p>
                </div>
              </div>
            </div>,
          );
          gridRow++;

          // Resources in department
          deptResources.forEach((resource, resIndex) => {
            const isLastInDepartment =
              resIndex === deptResources.length - 1;

            // Resource header
            elements.push(
              <div
                key={`resource-header-${resource.id}`}
                className="cell sticky-col resource-row event-row"
                style={{
                  height: "144px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  paddingLeft: "8px",
                }}
              >
                <div
                  style={{
                    flex: 1,
                    minHeight: "1px",
                    minWidth: "1px",
                    width: "100%",
                    position: "relative",
                  }}
                >
                  {/* Нижний бордер с отступом 16px от краёв */}
                  {!isLastInDepartment && (
                    <div
                      aria-hidden="true"
                      style={{
                        position: "absolute",
                        top: 0,
                        bottom: 0,
                        left: "16px",
                        right: 0,
                        borderBottom: "1px solid #f0f0f0",
                        pointerEvents: "none",
                      }}
                    />
                  )}

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                      height: "100%",
                      width: "100%",
                    }}
                  >
                    <div className="w-full border-[#f0f0f0] border-[0px_1px] border-solid inset-0"
                      style={{
                        boxSizing: "border-box",
                        display: "flex",
                        flexDirection: "column",
                        gap: "12px",
                        alignItems: "flex-start",
                        justifyContent: "center",
                        paddingLeft: "16px",
                        paddingRight: "16px",
                        height: "100%",
                        width: "100%",
                      }}
                    >
                      {/* Profile (Avatar + Name + Position) */}
                      <div
                        style={{
                          display: "flex",
                          gap: "12px",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "100%",
                        }}
                      >
                        {/* Avatar */}
                        <div
                          style={{
                            position: "relative",
                            borderRadius: "12px",
                            flexShrink: 0,
                            width: "36px",
                            height: "36px",
                            overflow: "hidden",
                          }}
                        >
                          {resource.avatarUrl ? (
                            <img
                              src={resource.avatarUrl}
                              alt={
                                resource.fullName ||
                                `User ${resource.id}`
                              }
                              style={{
                                position: "absolute",
                                inset: 0,
                                maxWidth: "none",
                                objectFit: "cover",
                                pointerEvents: "none",
                                borderRadius: "12px",
                                width: "100%",
                                height: "100%",
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                background: "#f6f6f6",
                                borderRadius: "12px",
                                width: "100%",
                                height: "100%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <p className="text-sm text-[#868789]">
                                {getUserInitials(
                                  resource.fullName,
                                  undefined,
                                )}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Info (Name + Position) - ОДНА СТРОКА */}
                        <div
                          style={{
                            flex: 1,
                            minWidth: "1px",
                            minHeight: "1px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "0px",
                            alignItems: "flex-start",
                            justifyContent: "flex-start",
                            whiteSpace: "nowrap",
                          }}
                        >
                          <p
                            className="font-medium text-sm text-black w-full"
                            style={{
                              lineHeight: "20px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              flexShrink: 1,
                            }}
                          >
                            {searchQuery
                              ? highlightMatch(
                                  resource.fullName || `User ${resource.id}`,
                                  searchQuery
                                )
                              : resource.fullName || `User ${resource.id}`}
                          </p>
                          <p
                            className="text-xs text-[#868789] w-full"
                            style={{
                              lineHeight: "16px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              flexShrink: 1,
                            }}
                          >
                            {searchQuery
                              ? highlightMatch(
                                  resource.position || "No position",
                                  searchQuery
                                )
                              : resource.position || "No position"}
                          </p>
                        </div>
                      </div>

                      {/* Значимые проекты пользователя */}
                      <ProjectsContainer
                        projects={getUserSignificantProjects(
                          resource.id,
                          events,
                          projects,
                          currentWeekIndex,
                        )}
                      />
                    </div>
                  </div>
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
      ]);

      // Build right cells (gridColumn: 2+)
      const rightCells = useMemo(() => {
        const elements: JSX.Element[] = [];

        // Month headers (Row 1)
        let col = 1;
        months.forEach((month, idx) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const isLastMonth = idx === months.length - 1;
          elements.push(
            <div
              key={`month-${idx}`}
              className="cell sticky-top month"
              style={{
                gridColumn: `${col} / span ${month.weeks}`,
                gridRow: 1,
                position: "sticky",
                top: `${TOP_BAR_HEIGHT}px`,
                zIndex: 60,
                height: `${config.rowH}px`,
                display: "flex",
                alignItems: "center",
                backgroundColor: "#fff",
                border: "none",
                boxShadow: "none",
                outline: "none",
              }}
            >
              <div className="box-border content-stretch flex items-center px-[4px] py-0 relative size-full w-full">
                <div className="basis-0 bg-[#f6f6f6] grow h-[36px] min-h-px min-w-px relative rounded-[12px] shrink-0">
                  <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border content-stretch flex h-[36px] items-center justify-center relative w-full">
                    <p className="font-semibold leading-[20px] not-italic relative shrink-0 text-[#1a1a1a] text-[12px] text-nowrap whitespace-pre">
                      {month.name}
                    </p>
                  </div>
                </div>
                {/* Hack to cover any global grid dividers */}
                <div
                  style={{
                    position: "absolute",
                    right: "-1px",
                    top: 0,
                    bottom: 0,
                    width: "2px",
                    backgroundColor: "#fff",
                    zIndex: 70,
                    pointerEvents: "none",
                  }}
                />
              </div>
            </div>,
          );
          col += month.weeks;
        });

        // Week headers (Row 2)
        for (let i = 0; i < WEEKS; i++) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const isLastInMonth = lastWeeks.has(i);
          elements.push(
            <div
              key={`week-${i}`}
              className="cell sticky-top2"
              style={{
                gridColumn: i + 1,
                gridRow: 2,
                position: "sticky",
                top: `${config.rowH + TOP_BAR_HEIGHT}px`,
                zIndex: 60,
                height: `${config.rowH}px`,
                backgroundColor: "#fff",
              }}
            >
              <div className="flex flex-row items-center justify-center size-full">
                <div className="box-border content-stretch flex items-center justify-center px-[6px] py-0 relative size-full">
                  <p className="font-normal leading-[16px] relative shrink-0 text-[#868789] text-[12px] text-nowrap whitespace-pre">
                    {weekLabel(i, timelineYear)}
                  </p>
                </div>
              </div>
            </div>,
          );
        }

        // Search Row Spacer (Row 3)
        elements.push(

        );

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
            const isLastInMonth = lastWeeks.has(w);
            elements.push(
              <div
                key={`dept-${dept.id}-week-${w}`}
                className="cell department-row"
                style={{
                  gridColumn: w + 1,
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
            const isLastInDepartment =
              resIndex === deptResources.length - 1;

            // Resource cells
            for (let w = 0; w < WEEKS; w++) {
              const isLastInMonth = lastWeeks.has(w);
              elements.push(
                <div
                  key={`resource-${resource.id}-week-${w}`}
                  className={`cell resource-row event-row ${isLastInMonth ? "last-in-month" : ""}`}
                  style={{
                    gridColumn: w + 1,
                    gridRow,
                    height: "144px",
                    background: "#fff",
                    borderRight: "0.5px solid #DFE7EE",
                   
                    cursor: "pointer",
                  }}
                  data-resource-id={resource.id}
                  data-week={w}
                  onMouseMove={(e) =>
                    onCellMouseMove(e, resource.id, w)
                  }
                  onMouseLeave={onCellMouseLeave}
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
                  onContextMenu={(e) => {
                    if (onCellContextMenu) {
                      onCellContextMenu(e, resource.id, w);
                    }
                  }}
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
        onCellMouseLeave,
        onCellClick,
        onCellContextMenu,
        SEARCH_ROW_HEIGHT,
        HEADER_HEIGHT,
      ]);

      return (
        <div
          style={{
            position: "relative",
            height: "100vh",
            overflow: "hidden",
          }}
        >
          {/* LEFT PANEL: overflow-y: auto для sticky headers, скрываем скроллбар */}
          <div
            ref={leftRef}
            className="hide-scrollbar"
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: `${LEFT_WIDTH}px`,
              overflowY: "auto",
              overflowX: "hidden",
              zIndex: 300,
              background: "#fff",
              boxSizing: "border-box",
            }}
          >
            {/* Top Left Header (Title + Year) - STICKY */}
            <div
              className="cell sticky-top header-cell"
                style={{
                  position: "sticky",
                  top: 0,
                  zIndex: 201,
                  height: `${HEADER_HEIGHT}px`,
                  display: "flex",
                  alignItems: "center",
                  padding: "0",
                  width: `${config.resourceW}px`,
                  background: "#fff",
                }}
              >
                <div
                  className="pl-2 pt-2 shrink-0 w-full self-start"
                  data-name="header"
                >
                  <div className="h-[72px] relative rounded-tl-[16px] rounded-tr-[16px] shrink-0 w-full">
                    <div
                      aria-hidden="true"
                      className="absolute border-[#f0f0f0] border-[1px_1px_0px] border-solid inset-0 pointer-events-none rounded-tl-[16px] rounded-tr-[16px]"
                    />
                    <div className="size-full">
                      <div className="box-border content-stretch flex h-[72px] items-start pb-[16px] pl-[5px] pr-[9px] pt-[17px] relative w-full">
                        <div
                          className="basis-0 grow h-[40px] min-h-px min-w-px relative shrink-0"
                          data-name="Container"
                        >
                          <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border content-stretch flex h-[40px] items-center justify-between relative w-full">
                            <div
                              className="basis-0 grow h-[36px] min-h-px min-w-px relative shrink-0"
                              data-name="Container"
                            >
                              <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border content-stretch flex gap-[8px] h-[36px] items-center relative w-full">
                                {/* Back Button */}
                                {onBackToWorkspaces && (
                                  <HeaderBackButton
                                    onClick={onBackToWorkspaces}
                                  />
                                )}

                                {/* Title & Year */}
                                <div
                                  className="basis-0 grow h-[36px] min-h-px min-w-px relative shrink-0"
                                  data-name="Container"
                                >
                                  <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border content-stretch flex flex-col h-[36px] items-start relative w-full">
                                    <HeaderTitle
                                      name={
                                        workspace?.name ||
                                        "Рабочее пространство"
                                      }
                                    />
                                    <YearContainer
                                      year={timelineYear}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Search Row (Left Side) - STICKY */}
              <div
                className="cell sticky-top search-cell"
                style={{
                  position: "sticky",
                  top: `${HEADER_HEIGHT}px`,
                  zIndex: 201,
                  height: `${SEARCH_ROW_HEIGHT}px`,
                  display: "flex",
                  alignItems: "flex-start",
                  padding: "0",
                  width: `${config.resourceW}px`,
                  background: "#fff",
                }}
              >
                <div
                  className=" shrink-0 w-full pl-2"
                  data-name="search_user"
                >
                  <div className="relative shrink-0 w-full">
                    <div
                      aria-hidden="true"
                      className="absolute border-[#f0f0f0] border-[0px_1px] border-solid inset-0 pointer-events-none"
                    />
                    <div className="size-full">
                      <div className="box-border content-stretch flex items-start pb-[36px] pl-[8px] pr-[8px] pt-[8px] relative w-full">
                        <SearchInput
                          value={searchQuery}
                          onChange={(val) => onSearchChange?.(val)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Spacer to align data rows with right panel (compensate for Right Panel Header) */}


              {/* Left Cells (Department headers, Resource headers) */}
              {leftCells}

              {/* Fake Spacer */}
              <div
                className="cell sticky-col"
                style={{
                  background: "#fff",
                  height: `max(0px, calc(100vh - ${usedHeight}px))`,
                  minHeight: `max(0px, calc(100vh - ${usedHeight}px))`,
                }}
              >
                <FakeSpaser />
              </div>
          </div>

          {/* RIGHT PANEL: Native scroll, acts as the master scroll container */}
          <div
            ref={rightRef}
            style={{
              position: "absolute",
              left: `${LEFT_WIDTH}px`,
              right: 0,
              top: 0,
              bottom: 0,
              overflow: "auto",
              WebkitOverflowScrolling: "touch",
              background: "transparent",
            }}
          >
            {/* Header (New Interface Block) - Sticky */}
            <div
              style={{
                position: "sticky",
                top: 0,
                left: 0,
                zIndex: 600,
                width: `calc(100vw - ${LEFT_WIDTH}px)`,
                height: `${TOP_BAR_HEIGHT}px`,
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

            {/* Grid для правых колонок */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${WEEKS}, ${config.weekPx}px)`,
                width: "max-content",
                position: "relative",
                background: "transparent",
              }}
            >
              {rightCells}

              {renderEvents && renderEvents()}

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
          </div>

          {/* Fake Bottom Fix - position: fixed, НЕ в leftInner! */}
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
  ),
);

SchedulerGrid.displayName = "SchedulerGrid";