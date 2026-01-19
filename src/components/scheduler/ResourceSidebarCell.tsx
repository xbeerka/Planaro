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
} from "../../types/scheduler";
import { useScheduler } from "../../contexts/SchedulerContext";
import { ResourceRowWithMenu } from "./ResourceRowWithMenu";

// ============================================================
// HELPERS
// ============================================================

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
}: {
  projects: Project[];
}) {
  const [showAllProjects, setShowAllProjects] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const MAX_VISIBLE_PROJECTS = 5;

  const visibleProjects = projects.slice(
    0,
    MAX_VISIBLE_PROJECTS,
  );
  const hiddenProjects = projects.slice(MAX_VISIBLE_PROJECTS);
  const overflowCount = hiddenProjects.length;

  return (
    <div
      className="flex items-center flex-wrap gap-x-2 gap-y-1 mt-[4px]"
      ref={containerRef}
      onMouseEnter={() => {
        if (overflowCount > 0) setShowAllProjects(true);
      }}
      onMouseLeave={() => setShowAllProjects(false)}
    >
      {visibleProjects.map((project) => (
        <div
          key={project.id}
          className="rounded-[4px] px-[6px] py-[1px] max-w-[100px] shrink-0"
          style={{
            backgroundColor:
              project.backgroundColor || "#aeeb3d",
          }}
          title={project.name}
        >
          <div
            className="text-[10px] leading-[14px] font-medium truncate"
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
                <div className="flex flex-col gap-2">
                  {hiddenProjects.map((project) => (
                    <div
                      key={project.id}
                      className="flex items-center gap-2"
                    >
                      <div
                        className="rounded-[2px] shrink-0"
                        style={{
                          backgroundColor:
                            project.backgroundColor ||
                            "#aeeb3d",
                          width: "6px",
                          height: "14px",
                        }}
                      />
                      <span className="text-[11px] leading-[14px] text-gray-700 truncate">
                        {project.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>,
              document.body,
            )}
        </div>
      )}
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
    currentWeekIndex,
    weeksInYear,
    rowHeight,
    sidebarCollapsed,
    showSeparators,
    isLastInDept,
    getUserInitials,
  }: {
    resource: Resource;
    searchQuery?: string;
    onEditUser?: (id: string) => void;
    onDeleteUser?: (id: string) => void;
    events: SchedulerEvent[];
    projects: Project[];
    grades: Grade[];
    currentWeekIndex: number;
    weeksInYear: number;
    rowHeight: number;
    sidebarCollapsed?: boolean;
    showSeparators?: boolean;
    isLastInDept?: boolean;
    getUserInitials: (
      displayName?: string,
      email?: string,
    ) => string;
  }) => {
    const { toggleUserVisibility } = useScheduler();
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
            borderBottom:
              showSeparators && !isLastInDept
                ? "1px solid #f0f0f0"
                : "none",
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
              />
              <div className={rowHeight <= 60 ? "-mt-1" : ""}>
                <ProjectsContainer
                  projects={significantProjects}
                />
              </div>
            </>
          )}
        </div>

        {!sidebarCollapsed && (
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

        {showMenu &&
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
                        "❌ Ошибка при скрыти�� сотрудника:",
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