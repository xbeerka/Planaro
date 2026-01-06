import {
  useState,
  useEffect,
  useRef,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from "react";
import { Department } from "../../types/scheduler";
import { Search, GripVertical } from "lucide-react";
import {
  TextInput,
  SearchInput,
} from "./management/SharedInputs";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "../ui/dropdown-menu";

interface DepartmentsManagementContentProps {
  departments: Department[];
  onRenameDepartment: (deptId: string, newName: string) => void;
  onReorderDepartments: (
    newOrder: Department[],
  ) => Promise<void>;
  onToggleDepartmentVisibility: (deptId: string) => void;
  onCreateDepartment: (name: string) => Promise<void>;
  onDeleteDepartment: (deptId: string) => Promise<void>;
  onGetDepartmentUsersCount: (
    deptId: string,
  ) => Promise<number>;
  onHasChanges: (hasChanges: boolean) => void;
  onClose: () => void;
}

interface LocalDepartment extends Department {
  displayName: string;
  usersCount?: number;
}

interface LocalNewDepartment {
  tempId: string;
  name: string;
}

export interface DepartmentsManagementHandle {
  onAdd: () => void;
}

export const DepartmentsManagementContent = forwardRef<
  DepartmentsManagementHandle,
  DepartmentsManagementContentProps
>(
  (
    {
      departments,
      onRenameDepartment,
      onReorderDepartments,
      onToggleDepartmentVisibility,
      onCreateDepartment,
      onDeleteDepartment,
      onGetDepartmentUsersCount,
      onHasChanges,
      onClose,
    },
    ref,
  ) => {
    const [localDepartments, setLocalDepartments] = useState<
      LocalDepartment[]
    >([]);
    const [localNewDepartments, setLocalNewDepartments] =
      useState<LocalNewDepartment[]>([]);
    const [deletedDeptIds, setDeletedDeptIds] = useState<
      string[]
    >([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [draggedIndex, setDraggedIndex] = useState<
      number | null
    >(null);
    const [dragOverIndex, setDragOverIndex] = useState<
      number | null
    >(null);
    const contentRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({
      onAdd: handleAddNewDepartment,
    }));

    // Initialize local state
    useEffect(() => {
      const sortedDepartments = [...departments].sort(
        (a, b) => {
          const queueA = a.queue || 999;
          const queueB = b.queue || 999;
          return queueA - queueB;
        },
      );

      setLocalDepartments(
        sortedDepartments.map((dept) => ({
          ...dept,
          displayName: dept.name,
        })),
      );

      setLocalNewDepartments([]);
      setDeletedDeptIds([]);
    }, [departments]);

    // Track changes
    useEffect(() => {
      const hasNewDepts = localNewDepartments.length > 0;
      const hasDeletedDepts = deletedDeptIds.length > 0;

      let hasExistingChanges = false;
      for (const localDept of localDepartments) {
        const originalDept = departments.find(
          (d) => d.id === localDept.id,
        );
        if (
          originalDept &&
          (localDept.displayName !== originalDept.name ||
            localDept.visible !== originalDept.visible)
        ) {
          hasExistingChanges = true;
          break;
        }
      }

      if (!hasExistingChanges) {
        const originalOrder = [...departments]
          .filter((d) => !deletedDeptIds.includes(d.id))
          .sort((a, b) => {
            const queueA = a.queue || 999;
            const queueB = b.queue || 999;
            return queueA - queueB;
          })
          .map((d) => d.id);

        const currentOrder = localDepartments.map((d) => d.id);

        if (
          JSON.stringify(originalOrder) !==
          JSON.stringify(currentOrder)
        ) {
          hasExistingChanges = true;
        }
      }

      onHasChanges(
        hasNewDepts || hasDeletedDepts || hasExistingChanges,
      );
    }, [
      localNewDepartments,
      deletedDeptIds,
      localDepartments,
      departments,
      onHasChanges,
    ]);

    const handleAddNewDepartment = () => {
      const tempId = `temp-${Date.now()}-${Math.random()}`;
      setLocalNewDepartments((prev) => [
        ...prev,
        {
          tempId,
          name: "",
        },
      ]);

      setTimeout(() => {
        if (contentRef.current) {
          contentRef.current.scrollTop = 0;
        }
      }, 50);
    };

    const handleNewDepartmentChange = (
      tempId: string,
      value: string,
    ) => {
      setLocalNewDepartments((prev) =>
        prev.map((d) =>
          d.tempId === tempId ? { ...d, name: value } : d,
        ),
      );
    };

    const handleDeleteNewDepartment = (tempId: string) => {
      setLocalNewDepartments((prev) =>
        prev.filter((d) => d.tempId !== tempId),
      );
    };

    const handleDragStart = (index: number) => {
      setDraggedIndex(index);
    };

    const handleDragOver = (
      e: React.DragEvent,
      index: number,
    ) => {
      e.preventDefault();
      if (draggedIndex === null) return;

      // Устанавливаем drop зону
      setDragOverIndex(index);

      // Переставляем только если это другой индекс
      if (draggedIndex === index) return;

      const newDepartments = [...localDepartments];
      const draggedItem = newDepartments[draggedIndex];
      newDepartments.splice(draggedIndex, 1);
      newDepartments.splice(index, 0, draggedItem);

      setLocalDepartments(newDepartments);
      setDraggedIndex(index);
    };

    const handleDragEnd = () => {
      setDraggedIndex(null);
      setDragOverIndex(null);
    };

    const handleDeleteDepartment = (deptId: string) => {
      const dept = localDepartments.find(
        (d) => d.id === deptId,
      );
      if (!dept) return;

      if (
        !confirm(
          `Удалить департамент "${dept.displayName}"?\n\n` +
            `Удаление будет выполнено после нажатия "Сохранить".`,
        )
      ) {
        return;
      }

      setDeletedDeptIds((prev) => [...prev, deptId]);
      setLocalDepartments((prev) =>
        prev.filter((d) => d.id !== deptId),
      );
    };

    // Filter departments by search query
    const visibleDepartments = useMemo(() => {
      if (!searchQuery.trim()) return localDepartments;

      const query = searchQuery.toLowerCase().trim();
      return localDepartments.filter((dept) =>
        dept.displayName.toLowerCase().includes(query),
      );
    }, [localDepartments, searchQuery]);

    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
      setIsSaving(true);
      try {
        // Step 1: Delete departments
        if (deletedDeptIds.length > 0) {
          console.log(
            `🗑️ Удаление ${deletedDeptIds.length} департаментов...`,
          );
          await Promise.all(
            deletedDeptIds.map((id) => onDeleteDepartment(id)),
          );
          console.log(
            `✅ ${deletedDeptIds.length} департаментов удалено`,
          );
        }

        // Step 2: Create new departments
        const validNewDepartments = localNewDepartments.filter(
          (d) => d.name.trim(),
        );
        if (validNewDepartments.length > 0) {
          console.log(
            `💾 Создание ${validNewDepartments.length} новых департаментов...`,
          );
          await Promise.all(
            validNewDepartments.map((d) =>
              onCreateDepartment(d.name.trim()),
            ),
          );
          console.log(
            `✅ ${validNewDepartments.length} новых департаментов сохранено`,
          );
        }

        // Step 3: Update existing departments
        const updatePromises: Promise<void>[] = [];

        localDepartments.forEach((localDept) => {
          const originalDept = departments.find(
            (d) => d.id === localDept.id,
          );

          if (
            originalDept &&
            localDept.displayName !== originalDept.name
          ) {
            updatePromises.push(
              Promise.resolve(
                onRenameDepartment(
                  localDept.id,
                  localDept.displayName,
                ),
              ),
            );
          }

          if (
            originalDept &&
            localDept.visible !== originalDept.visible
          ) {
            updatePromises.push(
              Promise.resolve(
                onToggleDepartmentVisibility(localDept.id),
              ),
            );
          }
        });

        if (updatePromises.length > 0) {
          console.log(
            `💾 Сохранение ${updatePromises.length} изменений департаментов параллельно...`,
          );
          await Promise.all(updatePromises);
          console.log(
            `✅ Все ${updatePromises.length} изменений сохранены`,
          );
        }

        // Step 4: Apply reorder
        const reorderedDepartments: Department[] =
          localDepartments.map(
            ({ displayName, usersCount, ...dept }) => ({
              ...dept,
              name: displayName,
            }),
          );
        await onReorderDepartments(reorderedDepartments);

        onClose();
      } catch (error) {
        console.error(
          "❌ Ошибка при сохранении департаментов:",
          error,
        );
        alert("Ошибка при сохранении департаментов");
      } finally {
        setIsSaving(false);
      }
    };

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
                  placeholder="Поиск департаментов..."
                  value={searchQuery}
                  onChange={(e) =>
                    setSearchQuery(e.target.value)
                  }
                  className="flex-1 py-2 pr-3 bg-transparent border-none focus:outline-none text-[14px]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div
          ref={contentRef}
          className="flex-1 overflow-y-auto p-0"
        >
          <div className="space-y-0">
            {/* New departments */}
            {localNewDepartments.map((newDept) => (
              <div
                key={newDept.tempId}
                className="px-6 py-3 border-b border-gray-100 bg-blue-50/30 group"
              >
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <TextInput
                      value={newDept.name}
                      onChange={(e) =>
                        handleNewDepartmentChange(
                          newDept.tempId,
                          e.target.value,
                        )
                      }
                      placeholder="Название департамента"
                      autoFocus
                    />
                  </div>
                  <button
                    onClick={() =>
                      handleDeleteNewDepartment(newDept.tempId)
                    }
                    className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-[12px] text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
                    title="Удалить строку"
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

            {/* Existing departments */}
            {visibleDepartments.map((dept, index) => {
              const originalIndex = localDepartments.findIndex(
                (d) => d.id === dept.id,
              );
              return (
                <div
                  key={dept.id}
                  draggable={!searchQuery} // Disable drag when searching
                  onDragStart={() =>
                    handleDragStart(originalIndex)
                  }
                  onDragOver={(e) =>
                    handleDragOver(e, originalIndex)
                  }
                  onDragEnd={handleDragEnd}
                  className={`px-6 py-3 border-b border-gray-100 transition-colors group cursor-move ${
                    draggedIndex === originalIndex
                      ? "bg-blue-100 border border-blue-300 opacity-60"
                      : dragOverIndex === originalIndex &&
                          draggedIndex !== null
                        ? "bg-blue-50 border-blue-300"
                        : "bg-white hover:bg-gray-50/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Drag Handle */}
                    <div
                      className={`text-gray-400 ${searchQuery ? "opacity-30 cursor-not-allowed" : "cursor-grab active:cursor-grabbing"}`}
                    >
                      <GripVertical className="w-5 h-5" />
                    </div>

                    {/* Department name input */}
                    <div
                      className={`flex-1 transition-opacity ${!dept.visible ? "opacity-40" : ""}`}
                    >
                      <TextInput
                        value={dept.displayName}
                        onChange={(e) => {
                          const newName = e.target.value;
                          setLocalDepartments((prev) =>
                            prev.map((d) =>
                              d.id === dept.id
                                ? { ...d, displayName: newName }
                                : d,
                            ),
                          );
                        }}
                        placeholder="Название департамента"
                      />
                    </div>

                    {/* Users count */}
                    <div className="text-sm text-gray-500 min-w-[80px] text-right flex-shrink-0">
                      <span className="bg-gray-100 px-2 py-1 rounded-md text-xs font-medium text-gray-600">
                        {dept.usersCount ?? 0} сотр.
                      </span>
                    </div>

                    {/* Menu button with dropdown */}
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
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem
                            onClick={() => {
                              setLocalDepartments((prev) =>
                                prev.map((d) =>
                                  d.id === dept.id
                                    ? {
                                        ...d,
                                        visible: !d.visible,
                                      }
                                    : d,
                                ),
                              );
                            }}
                            className="cursor-pointer"
                          >
                            {dept.visible ? (
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
                                <path d="M9.88 9.88a 3 3 0 1 0 4.24 4.24" />
                                <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                                <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                                <line
                                  x1="2"
                                  x2="22"
                                  y1="2"
                                  y2="22"
                                />
                              </svg>
                            ) : (
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
                                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                            )}
                            {dept.visible
                              ? "Скрыть"
                              : "Показать"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              handleDeleteDepartment(dept.id);
                            }}
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

            {visibleDepartments.length === 0 &&
              localNewDepartments.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <p>Нет департаментов</p>
                  <p className="text-sm mt-2">
                    {searchQuery
                      ? "Попробуйте изменить поисковый запрос"
                      : 'Нажмите "+ Департамент" для создания'}
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

DepartmentsManagementContent.displayName =
  "DepartmentsManagementContent";