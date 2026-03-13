import {
  useState,
  useEffect,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from "react";
import {
  Project,
  EventPattern,
  SchedulerEvent,
} from "../../types/scheduler";
import { Search, ArrowUp, ArrowDown, X } from "lucide-react";
import {
  TextInput,
  SelectInput,
  ColorInput,
} from "./management/SharedInputs";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "../ui/dropdown-menu";

interface ProjectsManagementContentProps {
  projects: Project[];
  events: SchedulerEvent[];
  eventPatterns: EventPattern[];
  onCreateProject: (projectData: {
    name: string;
    backgroundColor?: string;
    textColor?: string;
    patternId?: string;
  }) => Promise<void>;
  onUpdateProject: (
    projectId: string,
    projectData: {
      name: string;
      backgroundColor?: string;
      textColor?: string;
      patternId?: string;
    },
  ) => Promise<void>;
  onDeleteProject: (projectId: string) => Promise<void>;
  onResetHistory?: () => void;
  onHasChanges: (hasChanges: boolean) => void;
  onClose: () => void;
}

interface LocalNewProject {
  tempId: string;
  name: string;
  backgroundColor: string;
  textColor: string;
  patternId: string;
}

export interface ProjectsManagementHandle {
  onAdd: () => void;
}

export const ProjectsManagementContent = forwardRef<
  ProjectsManagementHandle,
  ProjectsManagementContentProps
>(
  (
    {
      projects,
      events,
      eventPatterns,
      onCreateProject,
      onUpdateProject,
      onDeleteProject,
      onResetHistory,
      onHasChanges,
      onClose,
    },
    ref,
  ) => {
    const [editingProjects, setEditingProjects] = useState<
      Record<
        string,
        {
          name: string;
          backgroundColor?: string;
          textColor?: string;
          patternId?: string;
        }
      >
    >({});
    const [localNewProjects, setLocalNewProjects] = useState<
      LocalNewProject[]
    >([]);
    const [deletedProjectIds, setDeletedProjectIds] = useState<
      string[]
    >([]);
    const [colorGenConfirmed, setColorGenConfirmed] =
      useState(false);
    const [editColorGenConfirmed, setEditColorGenConfirmed] =
      useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [sortBy, setSortBy] = useState<
      "name" | "users" | "date"
    >("date");
    const [sortDirection, setSortDirection] = useState<
      "asc" | "desc"
    >("desc");

    useImperativeHandle(ref, () => ({
      onAdd: handleAddNewProject,
    }));

    // Initialize editing state
    useEffect(() => {
      const initialState: Record<
        string,
        {
          name: string;
          backgroundColor?: string;
          textColor?: string;
          patternId?: string;
        }
      > = {};
      projects.forEach((p) => {
        initialState[p.id] = {
          name: p.name,
          backgroundColor: p.backgroundColor || "",
          textColor: p.textColor || "",
          patternId: p.patternId || "",
        };
      });
      setEditingProjects(initialState);
      setLocalNewProjects([]);
      setDeletedProjectIds([]);
      setColorGenConfirmed(false);
      setEditColorGenConfirmed(false);
    }, [projects]);

    // Track changes
    useEffect(() => {
      const hasNewProjects = localNewProjects.length > 0;
      const hasDeletedProjects = deletedProjectIds.length > 0;

      let hasExistingChanges = false;
      for (const projectId in editingProjects) {
        const editedData = editingProjects[projectId];
        const originalData = projects.find(
          (p) => p.id === projectId,
        );

        if (
          originalData &&
          (editedData.name !== originalData.name ||
            editedData.backgroundColor !==
              (originalData.backgroundColor || "") ||
            editedData.textColor !==
              (originalData.textColor || "") ||
            editedData.patternId !==
              (originalData.patternId || ""))
        ) {
          hasExistingChanges = true;
          break;
        }
      }

      onHasChanges(
        hasNewProjects ||
          hasDeletedProjects ||
          hasExistingChanges,
      );
    }, [
      localNewProjects,
      deletedProjectIds,
      editingProjects,
      projects,
      onHasChanges,
    ]);

    const generateRandomColors = () => {
      const hue = Math.floor(Math.random() * 360);
      const saturation = 80 + Math.floor(Math.random() * 20); // 80-100% (яркие, насыщенные)
      const lightness = 40 + Math.floor(Math.random() * 20); // 40-60% (интенсивные, глубокие)

      const h = hue / 360;
      const s = saturation / 100;
      const l = lightness / 100;

      let r, g, b;

      if (s === 0) {
        r = g = b = l;
      } else {
        const hue2rgb = (p: number, q: number, t: number) => {
          if (t < 0) t += 1;
          if (t > 1) t -= 1;
          if (t < 1 / 6) return p + (q - p) * 6 * t;
          if (t < 1 / 2) return q;
          if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
          return p;
        };

        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;

        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
      }

      const toHex = (x: number) => {
        const hex = Math.round(x * 255).toString(16);
        return hex.length === 1 ? "0" + hex : hex;
      };

      const backgroundColor =
        `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
      // Вычисляем контрастный цвет по яркости фона
      const luminance =
        (0.299 * Math.round(r * 255) +
          0.587 * Math.round(g * 255) +
          0.114 * Math.round(b * 255)) /
        255;
      const textColor = luminance > 0.55 ? "#000000" : "#ffffff";

      return { backgroundColor, textColor };
    };

    const generateRandomPattern = () => {
      const patternOptions = [
        "",
        ...eventPatterns.map((p) => p.id),
      ];
      const randomIndex = Math.floor(
        Math.random() * patternOptions.length,
      );
      return patternOptions[randomIndex];
    };

    const handleAddNewProject = () => {
      const tempId = `temp-${Date.now()}-${Math.random()}`;
      setLocalNewProjects((prev) => [
        ...prev,
        {
          tempId,
          name: "",
          backgroundColor: "",
          textColor: "",
          patternId: "",
        },
      ]);
    };

    const handleNewProjectChange = (
      tempId: string,
      field: string,
      value: string,
    ) => {
      setLocalNewProjects((prev) =>
        prev.map((p) =>
          p.tempId === tempId ? { ...p, [field]: value } : p,
        ),
      );
    };

    const handleNewProjectColorGen = (tempId: string) => {
      if (!colorGenConfirmed) {
        const confirmed = window.confirm(
          "🎨 Автоматическая генерация цветов и паттерна\n\n" +
            "Будут заменены текущие цвета фона, текста и паттерн на случайные.\n\n" +
            "Продолжить?",
        );
        if (!confirmed) return;
        setColorGenConfirmed(true);
      }

      const { backgroundColor, textColor } =
        generateRandomColors();
      const patternId = generateRandomPattern();
      setLocalNewProjects((prev) =>
        prev.map((p) =>
          p.tempId === tempId
            ? { ...p, backgroundColor, textColor, patternId }
            : p,
        ),
      );
    };

    const handleDeleteNewProject = (tempId: string) => {
      setLocalNewProjects((prev) =>
        prev.filter((p) => p.tempId !== tempId),
      );
    };

    const handleEditingColorPreviewClick = (
      projectId: string,
    ) => {
      if (!editColorGenConfirmed) {
        const confirmed = window.confirm(
          "🎨 Автоматическая генерация цветов и паттерна\n\n" +
            "Будут заменены текущие цвета фона, текста и паттерн на случайные.\n\n" +
            "Продолжить?",
        );
        if (!confirmed) return;
        setEditColorGenConfirmed(true);
      }

      const { backgroundColor, textColor } =
        generateRandomColors();
      const patternId = generateRandomPattern();
      setEditingProjects((prev) => {
        const currentData = prev[projectId] || { name: "" }; // Защита от undefined
        return {
          ...prev,
          [projectId]: {
            ...currentData,
            backgroundColor,
            textColor,
            patternId,
          },
        };
      });
    };

    const handleChange = (
      projectId: string,
      field: string,
      value: string,
    ) => {
      setEditingProjects((prev) => {
        const currentData = prev[projectId] || { name: "" }; // Защита от undefined
        return {
          ...prev,
          [projectId]: {
            ...currentData,
            [field]: value,
          },
        };
      });
    };

    const handleDelete = (projectId: string) => {
      const project = projects.find((p) => p.id === projectId);
      if (!project) return;

      const affectedEventsCount = events.filter(
        (e) => e.projectId === projectId,
      ).length;

      const confirmed = window.confirm(
        `Вы уверены, что хотите удалить проект "${project.name}"?\n\n` +
          `⚠️ ВНИМАНИЕ: ${affectedEventsCount} событий этого проекта также будут удалены!\n\n` +
          `Удаление будет выполнено после нажатия "Сохранить".`,
      );
      if (!confirmed) return;

      setDeletedProjectIds((prev) => [...prev, projectId]);
      setEditingProjects((prev) => {
        const newState = { ...prev };
        delete newState[projectId];
        return newState;
      });
    };

    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
      setIsSaving(true);
      try {
        // Step 1: Delete projects
        if (deletedProjectIds.length > 0) {
          console.log(
            `🗑️ Удаление ${deletedProjectIds.length} проектов...`,
          );
          await Promise.all(
            deletedProjectIds.map((id) => onDeleteProject(id)),
          );
          console.log(
            `✅ ${deletedProjectIds.length} проектов удалено`,
          );
        }

        // Step 2: Create new projects
        const validNewProjects = localNewProjects.filter((p) =>
          p.name.trim(),
        );
        if (validNewProjects.length > 0) {
          await Promise.all(
            validNewProjects.map((p) =>
              onCreateProject({
                name: p.name,
                backgroundColor: p.backgroundColor?.trim()
                  ? p.backgroundColor
                  : "#aaaaaa",
                textColor: p.textColor?.trim()
                  ? p.textColor
                  : "#ffffff",
                patternId: p.patternId || undefined,
              }),
            ),
          );
        }

        // Step 3: Update existing projects
        const updatePromises: Promise<void>[] = [];

        if (
          editingProjects &&
          typeof editingProjects === "object"
        ) {
          for (const projectId in editingProjects) {
            if (deletedProjectIds.includes(projectId)) continue;

            const editedData = editingProjects[projectId];
            if (!editedData || typeof editedData !== "object") {
              console.warn(
                `⚠️ Пропуск проекта ${projectId}: editedData невалидна`,
                editedData,
              );
              continue;
            }

            const originalData = projects.find(
              (p) => p.id === projectId,
            );

            if (
              originalData &&
              (editedData.name !== originalData.name ||
                editedData.backgroundColor !==
                  (originalData.backgroundColor || "") ||
                editedData.textColor !==
                  (originalData.textColor || "") ||
                editedData.patternId !==
                  (originalData.patternId || ""))
            ) {
              const dataToSave = {
                ...editedData,
                backgroundColor:
                  editedData.backgroundColor?.trim()
                    ? editedData.backgroundColor
                    : "#aaaaaa",
                textColor: editedData.textColor?.trim()
                  ? editedData.textColor
                  : "#ffffff",
              };
              updatePromises.push(
                onUpdateProject(projectId, dataToSave),
              );
            }
          }
        } else {
          console.warn(
            "⚠️ editingProjects невалидный объект:",
            editingProjects,
          );
        }

        if (updatePromises.length > 0) {
          console.log(
            `💾 Сохранение ${updatePromises.length} изменений параллельно...`,
          );
          await Promise.all(updatePromises);
          console.log(
            `✅ Все ${updatePromises.length} изменений сохранены`,
          );
        }

        onClose();
        // ❌ УБРАЛИ: onResetHistory() - вызывался без нужных параметров
        // История автоматически обновится при следующем изменении событий
      } catch (error) {
        console.error(
          "❌ Ошибка при сохранении изменений:",
          error,
        );
        console.error(
          "❌ Stack trace:",
          error instanceof Error ? error.stack : "N/A",
        );
        alert("Ошибка при сохранении изменений");
      } finally {
        setIsSaving(false);
      }
    };

    const renderPatternPreview = (
      backgroundColor: string,
      patternId: string,
      textColor: string,
      showText: boolean = true,
    ) => {
      const style: React.CSSProperties = {
        backgroundColor: backgroundColor?.trim()
          ? backgroundColor
          : "#e5e5e5",
        cursor: "pointer",
      };

      if (patternId) {
        const projectPattern = eventPatterns.find(
          (p) => p.id === patternId,
        );
        if (projectPattern && projectPattern.pattern) {
          const pattern = projectPattern.pattern
            .replace(/\n/g, " ")
            .replace(/\s+/g, " ")
            .trim();

          if (pattern) {
            const parts = pattern
              .split(";")
              .map((p) => p.trim())
              .filter((p) => p);

            if (parts.length > 0) {
              const firstPart = parts[0];

              if (
                !firstPart.includes(":") ||
                firstPart.startsWith("linear-gradient") ||
                firstPart.startsWith("radial-gradient") ||
                firstPart.startsWith("repeating-")
              ) {
                style.backgroundImage = firstPart;

                for (let i = 1; i < parts.length; i++) {
                  const part = parts[i];
                  const colonIndex = part.indexOf(":");
                  if (colonIndex > 0) {
                    const propName = part
                      .substring(0, colonIndex)
                      .trim();
                    const propValue = part
                      .substring(colonIndex + 1)
                      .trim();
                    const camelProp = propName.replace(
                      /-([a-z])/g,
                      (g) => g[1].toUpperCase(),
                    );
                    (style as any)[camelProp] = propValue;
                  }
                }

                const gradientCount = (
                  firstPart.match(/gradient\(/g) || []
                ).length;
                if (
                  gradientCount >= 2 &&
                  !style.backgroundSize
                ) {
                  style.backgroundSize = "12px 12px";
                  if (!style.backgroundPosition) {
                    style.backgroundPosition = "0 0, 6px 6px";
                  }
                }
              }
            }
          }
        }
      }

      return (
        <div
          style={{ ...style, userSelect: "none" }}
          className="w-[60px] h-9 rounded-[12px] border border-transparent flex-shrink-0 flex items-center justify-center"
        >
          {showText && (
            <span
              style={{
                color: backgroundColor?.trim()
                  ? (() => {
                      // Если задан кастомный textColor — используем его
                      if (textColor?.trim()) return textColor.trim();
                      // Иначе вычисляем контрастный цвет по яркости фона
                      const hex = backgroundColor.trim().replace("#", "");
                      if (hex.length === 6) {
                        const r = parseInt(hex.slice(0, 2), 16);
                        const g = parseInt(hex.slice(2, 4), 16);
                        const b = parseInt(hex.slice(4, 6), 16);
                        const luminance =
                          (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                        return luminance > 0.55 ? "#000000" : "#ffffff";
                      }
                      return "#fff";
                    })()
                  : "#999",
                fontSize: "14px",
                fontWeight: "bold",
              }}
            >
              {backgroundColor?.trim() ? "Aa" : "?"}
            </span>
          )}
        </div>
      );
    };

    const projectUserCounts = useMemo(() => {
      const counts: Record<string, number> = {};
      projects.forEach((p) => {
        const projectEvents = events.filter(
          (e) => e.projectId === p.id,
        );
        const uniqueUsers = new Set(
          projectEvents.map((e) => e.resourceId),
        );
        counts[p.id] = uniqueUsers.size;
      });
      return counts;
    }, [projects, events]);

    const visibleProjects = useMemo(() => {
      let filtered = projects.filter(
        (p) => !deletedProjectIds.includes(p.id),
      );

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        filtered = filtered.filter((p) =>
          p.name.toLowerCase().includes(query),
        );
      }

      return filtered.sort((a, b) => {
        let res = 0;
        if (sortBy === "name") {
          res = a.name.localeCompare(b.name);
        } else if (sortBy === "users") {
          res =
            (projectUserCounts[a.id] || 0) -
            (projectUserCounts[b.id] || 0);
        } else {
          // Date (ID)
          const idA = parseInt(a.id.replace("p", "")) || 0;
          const idB = parseInt(b.id.replace("p", "")) || 0;
          res = idA - idB;
        }
        return sortDirection === "asc" ? res : -res;
      });
    }, [
      projects,
      deletedProjectIds,
      searchQuery,
      sortBy,
      sortDirection,
      projectUserCounts,
    ]);

    return (
      <>
        {/* Toolbar */}
        <div className="border-b border-[rgba(0,0,0,0.12)] px-6 py-4">
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="flex-1 relative">
              <div className="box-border content-stretch flex gap-[6px] items-center relative rounded-[12px] w-full">
                <div
                  aria-hidden="true"
                  className="absolute border-[0.8px] border-[rgba(0,0,0,0.12)] border-solid inset-0 pointer-events-none rounded-[12px]"
                />
                <Search className="ml-3 w-4 h-4 text-gray-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Поиск проектов..."
                  value={searchQuery}
                  onChange={(e) =>
                    setSearchQuery(e.target.value)
                  }
                  className="flex-1 py-2 pr-3 bg-transparent border-none focus:outline-none text-[14px]"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="mr-3 p-0.5 hover:bg-gray-100 rounded shrink-0"
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                )}
              </div>
            </div>

            {/* Sort */}
            <div className="relative">
              <div className="box-border content-stretch flex gap-[6px] items-center relative rounded-[12px]">
                <div
                  aria-hidden="true"
                  className="absolute border-[0.8px] border-[rgba(0,0,0,0.12)] border-solid inset-0 pointer-events-none rounded-[12px]"
                />
                <select
                  value={sortBy}
                  onChange={(e) =>
                    setSortBy(e.target.value as any)
                  }
                  className="px-3 py-2 bg-transparent border-none focus:outline-none text-[14px] min-w-[160px] cursor-pointer"
                >
                  <option value="date">По дате создания</option>
                  <option value="users">По кол-ву людей</option>
                  <option value="name">По алфавиту</option>
                </select>
              </div>
            </div>

            <button
              onClick={() =>
                setSortDirection((prev) =>
                  prev === "asc" ? "desc" : "asc",
                )
              }
              className="w-10 h-10 flex items-center justify-center rounded-[12px] border border-[rgba(0,0,0,0.12)] hover:bg-gray-50 text-gray-500 transition-colors"
              title={
                sortDirection === "asc"
                  ? "По возрастанию"
                  : "По убыванию"
              }
            >
              {sortDirection === "asc" ? (
                <ArrowUp size={16} />
              ) : (
                <ArrowDown size={16} />
              )}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden py-0 px-0">
          <div className="space-y-0">
            {/* New projects */}
            {localNewProjects.map((newProject) => (
              <div
                key={newProject.tempId}
                className="px-6 py-3 border-b border-gray-100 bg-blue-50/30 group"
              >
                <div className="flex items-center gap-3">
                  <div className="grid grid-cols-[minmax(0,1fr)_120px_100px_min-content_100px_60px] gap-3 items-center flex-1 min-w-0 w-full">
                    <TextInput
                      value={newProject.name}
                      onChange={(e) =>
                        handleNewProjectChange(
                          newProject.tempId,
                          "name",
                          e.target.value,
                        )
                      }
                      className="min-w-0 w-full box-border h-9 px-3 bg-white border border-gray-200 rounded-lg text-[14px] leading-none outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      placeholder="Название проекта"
                      autoFocus
                    />
                    <SelectInput
                      value={newProject.patternId}
                      onChange={(e) =>
                        handleNewProjectChange(
                          newProject.tempId,
                          "patternId",
                          e.target.value,
                        )
                      }
                      className="h-9 w-full pl-3 pr-8 bg-white border border-gray-200 rounded-lg text-[14px] leading-none transition-all outline-none cursor-pointer text-gray-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    >
                      <option value="">Без паттерна</option>
                      {eventPatterns.map((pattern) => (
                        <option
                          key={pattern.id}
                          value={pattern.id}
                        >
                          {pattern.name}
                        </option>
                      ))}
                    </SelectInput>
                    <ColorInput
                      value={newProject.backgroundColor}
                      onChange={(e) =>
                        handleNewProjectChange(
                          newProject.tempId,
                          "backgroundColor",
                          e.target.value,
                        )
                      }
                      className="min-w-0 w-full box-border h-9 px-3 bg-white border border-gray-200 rounded-lg text-[14px] leading-none outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      placeholder="#3498db"
                    />
                    <div
                      onClick={() =>
                        handleNewProjectColorGen(
                          newProject.tempId,
                        )
                      }
                      title="Клик для генерации"
                      className="flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                    >
                      {renderPatternPreview(
                        newProject.backgroundColor,
                        newProject.patternId,
                        newProject.textColor,
                      )}
                    </div>
                    <ColorInput
                      value={newProject.textColor}
                      onChange={(e) =>
                        handleNewProjectChange(
                          newProject.tempId,
                          "textColor",
                          e.target.value,
                        )
                      }
                      className="min-w-0 w-full box-border h-9 px-3 bg-white border border-gray-200 rounded-lg text-[14px] leading-none outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      placeholder="#ffffff"
                    />
                    <div /> {/* Spacer for users count */}
                  </div>

                  <button
                    onClick={() =>
                      handleDeleteNewProject(newProject.tempId)
                    }
                    className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-[12px] text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
                    title="Удалить"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 6h18" />
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}

            {/* Existing projects */}
            {visibleProjects.map((project) => {
              const projectData = editingProjects[project.id];
              if (!projectData) return null;

              return (
                <div
                  key={project.id}
                  className="px-6 py-3 border-b border-gray-100 bg-white hover:bg-gray-50/50 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="grid grid-cols-[minmax(0,1fr)_120px_100px_min-content_100px_60px] gap-3 items-center flex-1 min-w-0 w-full">
                      <TextInput
                        value={projectData.name}
                        onChange={(e) =>
                          handleChange(
                            project.id,
                            "name",
                            e.target.value,
                          )
                        }
                        className="min-w-0 w-full box-border h-9 px-3 bg-white border border-gray-200 rounded-lg text-[14px] leading-none outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        placeholder="Название проекта"
                      />

                      <SelectInput
                        value={projectData.patternId || ""}
                        onChange={(e) =>
                          handleChange(
                            project.id,
                            "patternId",
                            e.target.value,
                          )
                        }
                        className="h-9 w-full pl-3 pr-8 bg-white border border-gray-200 rounded-lg text-[14px] leading-none transition-all outline-none cursor-pointer text-gray-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      >
                        <option value="">Без паттерна</option>
                        {eventPatterns.map((pattern) => {
                          // Fix: Ensure pattern ID matches the project patternId format (ep prefix)
                          const patternId = String(
                            pattern.id,
                          ).startsWith("ep")
                            ? String(pattern.id)
                            : `ep${pattern.id}`;

                          return (
                            <option
                              key={pattern.id}
                              value={patternId}
                            >
                              {pattern.name}
                            </option>
                          );
                        })}
                      </SelectInput>

                      <ColorInput
                        value={
                          projectData.backgroundColor || ""
                        }
                        onChange={(e) =>
                          handleChange(
                            project.id,
                            "backgroundColor",
                            e.target.value,
                          )
                        }
                        className="min-w-0 w-full box-border h-9 px-3 bg-white border border-gray-200 rounded-lg text-[14px] leading-none outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        placeholder="#3498db"
                      />

                      <div
                        onClick={() =>
                          handleEditingColorPreviewClick(
                            project.id,
                          )
                        }
                        title="Клик для генерции"
                        className="flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                      >
                        {renderPatternPreview(
                          projectData.backgroundColor || "",
                          projectData.patternId || "",
                          projectData.textColor || "",
                        )}
                      </div>

                      <ColorInput
                        value={projectData.textColor || ""}
                        onChange={(e) =>
                          handleChange(
                            project.id,
                            "textColor",
                            e.target.value,
                          )
                        }
                        className="min-w-0 w-full box-border h-9 px-3 bg-white border border-gray-200 rounded-lg text-[14px] leading-none outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        placeholder="#ffffff"
                      />

                      <div className="flex justify-end min-w-[60px]">
                        <span
                          className="bg-gray-100 px-2 py-1 rounded-md text-xs font-medium text-gray-600 whitespace-nowrap"
                          title="Количество людей на проекте"
                        >
                          {projectUserCounts[project.id] || 0}{" "}
                          чел.
                        </span>
                      </div>
                    </div>

                    <div className="relative flex-shrink-0">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className="w-9 h-9 flex items-center justify-center rounded-[12px] text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all outline-none"
                            title="Действия"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="18"
                              height="18"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <circle cx="12" cy="12" r="1" />
                              <circle cx="12" cy="5" r="1" />
                              <circle cx="12" cy="19" r="1" />
                            </svg>
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="w-40"
                        >
                          <DropdownMenuItem
                            onClick={() =>
                              handleDelete(project.id)
                            }
                            className="text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer"
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
                              className="mr-2"
                            >
                              <path d="M3 6h18" />
                              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                            </svg>
                            Удалить
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              );
            })}

            {visibleProjects.length === 0 &&
              localNewProjects.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <p>Нет проектов</p>
                  <p className="text-sm mt-2">
                    {searchQuery
                      ? "Попробуйте изменить поисковый запрос"
                      : 'Нажмите "+ Проект" для создания'}
                  </p>
                </div>
              )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t bg-gray-50 px-6 py-4 flex items-center justify-end gap-3">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Сохранение...
              </>
            ) : (
              "Сохранить"
            )}
          </button>
        </div>
      </>
    );
  },
);

ProjectsManagementContent.displayName =
  "ProjectsManagementContent";