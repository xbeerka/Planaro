import {
  useState,
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
  useMemo,
} from "react";
import {
  Resource,
  Department,
  Grade,
  Company,
} from "../../types/scheduler";
import { usersApi } from "../../services/api/users";
import { resizeImageOnClient } from "../../utils/imageResize";
import { Search, X } from "lucide-react";
import { sortResourcesByGrade } from "../../utils/scheduler";
import {
  TextInput,
  SelectInput,
  SearchInput,
} from "./management/SharedInputs";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "../ui/dropdown-menu";

interface UsersManagementContentProps {
  resources: Resource[];
  departments: Department[];
  grades: Grade[];
  companies: Company[];
  onCreateUser: (
    userData: Omit<Resource, "id">,
  ) => Promise<void>;
  onUpdateUser: (
    userId: string,
    updates: Partial<Resource>,
  ) => Promise<void>;
  onDeleteUser: (userId: string) => Promise<void>;
  onToggleUserVisibility?: (userId: string) => Promise<void>;
  onUploadUserAvatar: (
    userId: string,
    file: File,
  ) => Promise<string>;
  onCreateGrade?: (name: string) => Promise<void>;
  onUpdateGrade?: (
    gradeId: string,
    name: string,
  ) => Promise<void>;
  onDeleteGrade?: (gradeId: string) => Promise<void>;
  onGradesUpdated?: () => Promise<void>;
  updateGradesSortOrder?: (
    updates: Array<{ id: string; sortOrder: number }>,
  ) => Promise<void>;
  onCreateCompany?: (name: string) => Promise<void>;
  onUpdateCompany?: (
    companyId: string,
    name: string,
  ) => Promise<void>;
  onDeleteCompany?: (companyId: string) => Promise<void>;
  onCompaniesUpdated?: () => Promise<void>;
  updateCompaniesSortOrder?: (
    updates: Array<{ id: string; sortOrder: number }>,
  ) => Promise<void>;
  onHasChanges: (hasChanges: boolean) => void;
  onClose: () => void;
  highlightedUserId?: string | null;
}

interface LocalNewUser {
  tempId: string;
  fullName: string;
  position: string;
  departmentId: string;
  grade: string;
  companyId: string;
  avatarUrl?: string | null;
  isVisible?: boolean;
}

export interface UsersManagementHandle {
  onAdd: () => void;
}

export const UsersManagementContent = forwardRef<
  UsersManagementHandle,
  UsersManagementContentProps
>(
  (
    {
      resources,
      departments,
      grades,
      companies,
      onCreateUser,
      onUpdateUser,
      onDeleteUser,
      onToggleUserVisibility,
      onUploadUserAvatar,
      onCreateGrade,
      onUpdateGrade,
      onDeleteGrade,
      onGradesUpdated,
      updateGradesSortOrder,
      onCreateCompany,
      onUpdateCompany,
      onDeleteCompany,
      onCompaniesUpdated,
      updateCompaniesSortOrder,
      onHasChanges,
      onClose,
      highlightedUserId,
    },
    ref,
  ) => {
    const [editingUsers, setEditingUsers] = useState<
      Record<string, Partial<Resource>>
    >({});
    const [localNewUsers, setLocalNewUsers] = useState<
      LocalNewUser[]
    >([]);
    const [isSaving, setIsSaving] = useState(false);
    const [deletedUserIds, setDeletedUserIds] = useState<
      string[]
    >([]);
    const [uploadingAvatars, setUploadingAvatars] = useState<
      Record<string, boolean>
    >({});
    const fileInputRefs = useRef<
      Record<string, HTMLInputElement | null>
    >({});

    const [searchQuery, setSearchQuery] = useState("");
    const [selectedDepartment, setSelectedDepartment] =
      useState<string>("all");
    const [sortBy, setSortBy] = useState<
      "name" | "department" | "grade"
    >("department");

    const contentRef = useRef<HTMLDivElement>(null);
    const userRowRefs = useRef<
      Record<string, HTMLDivElement | null>
    >({});
    const [animatedUserId, setAnimatedUserId] = useState<
      string | null
    >(null);

    // ✅ Ref to track if we have initialized state from resources
    const hasInitializedRef = useRef(false);
    // ✅ Ref to track if user has interacted with the form (edits)
    const hasUserInteractedRef = useRef(false);

    const isUploading = Object.values(uploadingAvatars).some(Boolean);

    useImperativeHandle(ref, () => ({
      onAdd: handleAddNewUser,
    }));

    // Initialize editing state
    useEffect(() => {
      // ✅ Don't reset while saving to avoid UI flickering/race conditions
      if (isSaving) return;

      // ✅ Check if we should block the update due to local changes
      // We block if there are new users, deleted users, or unsaved edits
      const hasLocalChanges = 
        localNewUsers.length > 0 || 
        deletedUserIds.length > 0 || 
        hasUserInteractedRef.current;

      // If already initialized and we have local changes, prevent overwrite
      if (hasInitializedRef.current && resources.length > 0 && hasLocalChanges) {
        return;
      }

      const initialState: Record<
        string,
        Partial<Resource>
      > = {};
      resources.forEach((r) => {
        initialState[r.id] = {
          fullName: r.fullName,
          position: r.position,
          departmentId: r.departmentId,
          grade: r.grade || "",
          companyId: r.companyId || "",
          avatarUrl: r.avatarUrl,
          isVisible: r.isVisible ?? true,
        };
      });
      
      // 🔍 DEBUG: Log first resource to see what component received
      if (resources.length > 0) {
        // console.log('🔍 UsersManagementContent - ПЕРВЫЙ РЕСУРС:', JSON.stringify(resources[0], null, 2));
      }
      
      setEditingUsers(initialState);
      
      // ✅ Only reset UI state (filters, sort) on FIRST load
      // This allows background syncs to update data without clearing the user's search/filter
      if (!hasInitializedRef.current) {
        setLocalNewUsers([]);
        setDeletedUserIds([]);
        setUploadingAvatars({});
        setSearchQuery("");
        setSelectedDepartment("all");
        setSortBy("department");
      }

      // ✅ Reset interaction flag after successful sync
      hasUserInteractedRef.current = false;

      if (resources.length > 0) {
        hasInitializedRef.current = true;
      }
    }, [resources, isSaving, localNewUsers.length, deletedUserIds.length]);

    // Sort departments for dropdowns
    const sortedDepartments = useMemo(() => {
      return [...departments].sort((a, b) => {
        const queueA = a.queue || 999;
        const queueB = b.queue || 999;
        return queueA - queueB;
      });
    }, [departments]);

    // Auto-scroll to highlighted user
    useEffect(() => {
      if (highlightedUserId && contentRef.current) {
        const timer = setTimeout(() => {
          const userRow =
            userRowRefs.current[highlightedUserId];
          if (userRow) {
            userRow.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
            setAnimatedUserId(highlightedUserId);
            setTimeout(() => setAnimatedUserId(null), 2000);
          }
        }, 100);
        return () => clearTimeout(timer);
      }
    }, [highlightedUserId]);

    // Track changes
    useEffect(() => {
      // ✅ Don't reset while saving to avoid UI flickering/race conditions
      if (isSaving) return;

      // 🛡️ Guard: If resources are loaded but editingUsers is empty/mismatch during init, skip check
      // This prevents "flickering" badge when switching tabs or loading data
      if (resources.length > 0 && Object.keys(editingUsers).length === 0 && deletedUserIds.length === 0) {
        return;
      }

      const hasNewUsers = localNewUsers.length > 0;
      const hasDeletedUsers = deletedUserIds.length > 0;

      let hasExistingChanges = false;
      for (const userId in editingUsers) {
        const editedData = editingUsers[userId];
        const originalData = resources.find(
          (r) => r.id === userId,
        );

        if (
          originalData &&
          (editedData.fullName !== originalData.fullName ||
            editedData.position !== originalData.position ||
            editedData.departmentId !==
              originalData.departmentId ||
            editedData.grade !== (originalData.grade || "") ||
            editedData.companyId !==
              (originalData.companyId || "") ||
            editedData.avatarUrl !== originalData.avatarUrl ||
            editedData.isVisible !== originalData.isVisible)
        ) {
          hasExistingChanges = true;
          break;
        }
      }

      onHasChanges(
        hasNewUsers || hasDeletedUsers || hasExistingChanges,
      );
    }, [
      localNewUsers,
      deletedUserIds,
      editingUsers,
      resources,
      onHasChanges,
    ]);

    const handleAddNewUser = () => {
      const tempId = `temp-${Date.now()}-${Math.random()}`;
      setLocalNewUsers((prev) => [
        ...prev,
        {
          tempId,
          fullName: "",
          position: "",
          departmentId: "",
          grade: "",
          companyId: "",
          avatarUrl: undefined,
          isVisible: true,
        },
      ]);

      setTimeout(() => {
        if (contentRef.current) {
          contentRef.current.scrollTop = 0;
        }
      }, 50);
    };

    const handleNewUserChange = (
      tempId: string,
      field: string,
      value: string,
    ) => {
      setLocalNewUsers((prev) =>
        prev.map((u) =>
          u.tempId === tempId ? { ...u, [field]: value } : u,
        ),
      );
    };

    const handleDeleteNewUser = (tempId: string) => {
      setLocalNewUsers((prev) =>
        prev.filter((u) => u.tempId !== tempId),
      );
    };

    const handleChange = (
      userId: string,
      field: string,
      value: string,
    ) => {
      hasUserInteractedRef.current = true;
      setEditingUsers((prev) => ({
        ...prev,
        [userId]: { ...prev[userId], [field]: value },
      }));
    };

    const handleDelete = (userId: string) => {
      const user = resources.find((r) => r.id === userId);
      if (!user) return;

      if (
        !confirm(
          `Удалить сотрудника "${user.fullName}"?\n\n` +
            `Удаление будет выполнено после нажатия "Сохранить".`,
        )
      ) {
        return;
      }

      setDeletedUserIds((prev) => [...prev, userId]);
      setEditingUsers((prev) => {
        const newState = { ...prev };
        delete newState[userId];
        return newState;
      });
    };

    const handleAvatarUpload = async (
      userId: string,
      file: File,
    ) => {
      try {
        hasUserInteractedRef.current = true;
        setUploadingAvatars((prev) => ({
          ...prev,
          [userId]: true,
        }));

        const resizedFile = await resizeImageOnClient(
          file,
          200,
        );
        const avatarUrl = await onUploadUserAvatar(
          userId,
          resizedFile,
        );

        setEditingUsers((prev) => ({
          ...prev,
          [userId]: { ...prev[userId], avatarUrl },
        }));
      } catch (error) {
        console.error("Error uploading avatar:", error);
        alert("Ошибка загрузки аватара");
      } finally {
        setUploadingAvatars((prev) => ({
          ...prev,
          [userId]: false,
        }));
      }
    };

    const handleNewUserAvatarUpload = async (
      tempId: string,
      file: File,
    ) => {
      try {
        setUploadingAvatars((prev) => ({
          ...prev,
          [tempId]: true,
        }));

        const resizedFile = await resizeImageOnClient(
          file,
          200,
        );

        const avatarUrl = await usersApi.uploadAvatar(
          tempId,
          resizedFile,
        );

        setLocalNewUsers((prev) =>
          prev.map((u) =>
            u.tempId === tempId ? { ...u, avatarUrl } : u,
          ),
        );
      } catch (error) {
        console.error("Error uploading temp avatar:", error);
        alert("Ошибка загрузки аватара");
      } finally {
        setUploadingAvatars((prev) => ({
          ...prev,
          [tempId]: false,
        }));
      }
    };

    const handleAvatarRemove = (userId: string) => {
      hasUserInteractedRef.current = true;
      setEditingUsers((prev) => ({
        ...prev,
        [userId]: { ...prev[userId], avatarUrl: null },
      }));
    };

    const handleNewUserAvatarRemove = (tempId: string) => {
      setLocalNewUsers((prev) =>
        prev.map((u) =>
          u.tempId === tempId
            ? { ...u, avatarUrl: null }
            : u,
        ),
      );
    };

    const handleToggleVisibility = (userId: string) => {
      hasUserInteractedRef.current = true;
      // ✅ ТОЛЬКО обновляем локальный стейт (без немедленного сохранения)
      // Фактическое сохранение произойдет при клике на кнопку "Сохранить"
      setEditingUsers((prev) => {
        const userData = prev[userId];
        if (!userData) return prev;

        return {
          ...prev,
          [userId]: {
            ...userData,
            isVisible: !userData.isVisible,
          },
        };
      });
    };

    const handleSave = async () => {
      if (isSaving) return;
      setIsSaving(true);
      try {
        // Step 1: Delete users
        if (deletedUserIds.length > 0) {
          console.log(
            `🗑️ Удаление ${deletedUserIds.length} сотрудников...`,
          );
          await Promise.all(
            deletedUserIds.map((id) => onDeleteUser(id)),
          );
          console.log(
            `✅ ${deletedUserIds.length} сотрудников удалено`,
          );
        }

        // Helper: конвертируем название грейда в ID
        const getGradeId = (gradeName: string | undefined): string | undefined => {
          if (!gradeName) return undefined;
          const grade = grades.find(g => g.name === gradeName);
          return grade?.id;
        };

        // Step 2: Create new users
        const validNewUsers = localNewUsers.filter(
          (u) => u.fullName.trim() && u.position.trim(),
        );
        if (validNewUsers.length > 0) {
          console.log(
            `💾 Создание ${validNewUsers.length} новых сотрудников...`,
          );
          await Promise.all(
            validNewUsers.map((u) =>
              onCreateUser({
                fullName: u.fullName.trim(),
                position: u.position.trim(),
                departmentId: u.departmentId,
                grade: u.grade || undefined,  // ✅ Название грейда (для отображения)
                gradeId: getGradeId(u.grade),  // ✅ ID грейда (для бэкенда)
                companyId: (u.companyId && companies.some(c => String(c.id) === String(u.companyId))) ? u.companyId : null,
                avatarUrl: u.avatarUrl,
                isVisible: u.isVisible,
              }),
            ),
          );
          console.log(
            `✅ ${validNewUsers.length} новых сотрудников сохранено`,
          );
        }

        // Step 3: Update existing users
        const updatesBatch: any[] = [];
        const updatePromises: Promise<void>[] = []; // Keep for backward compatibility/fallback if needed

        for (const userId in editingUsers) {
          const editedData = editingUsers[userId];
          const originalData = resources.find(
            (r) => r.id === userId,
          );

          // Skip update if name is empty
          if (!editedData.fullName?.trim()) {
            continue;
          }

          if (
            originalData &&
            (editedData.fullName !== originalData.fullName ||
              editedData.position !== originalData.position ||
              editedData.departmentId !==
                originalData.departmentId ||
              editedData.grade !== (originalData.grade || "") ||
              editedData.companyId !==
                (originalData.companyId || "") ||
              editedData.avatarUrl !== originalData.avatarUrl ||
              editedData.isVisible !== originalData.isVisible)
          ) {
            // Validate companyId
            const isValidCompany = editedData.companyId && companies.some(c => String(c.id) === String(editedData.companyId));
            
            updatesBatch.push({
              id: userId,
              name: editedData.fullName.trim(), // API expects 'name'
              position: editedData.position?.trim() || "",
              departmentId: editedData.departmentId,
              grade: editedData.grade || undefined,
              gradeId: getGradeId(editedData.grade),
              companyId: isValidCompany ? editedData.companyId : null,
              avatarUrl: editedData.avatarUrl,
              isVisible: editedData.isVisible,
            });
          }
        }

        if (updatesBatch.length > 0) {
          console.log(
            `💾 Пакетное сохранение ${updatesBatch.length} изменений...`,
          );
          await usersApi.batchUpdate(updatesBatch);
          console.log(
            `✅ Все изменения сохранены`,
          );
        }

        onClose();
      } catch (error) {
        console.error(
          "❌ Ошибка при сохранении сотрудников:",
          error,
        );
        alert("Ошибка при сохранении сотрудников");
        setIsSaving(false);
      }
    };

    const getUserInitials = (fullName: string): string => {
      const parts = fullName.trim().split(/\s+/);
      if (parts.length === 0) return "?";
      if (parts.length === 1)
        return parts[0].charAt(0).toUpperCase();
      return (
        parts[0].charAt(0) + parts[parts.length - 1].charAt(0)
      ).toUpperCase();
    };

    // Filter and sort resources
    const visibleResources = resources
      .filter((r) => {
        if (deletedUserIds.includes(r.id)) return false;

        const matchesSearch =
          searchQuery === "" ||
          r.fullName
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          r.position
            .toLowerCase()
            .includes(searchQuery.toLowerCase());

        // Support filtering by "none" for users without department
        const matchesDepartment =
          selectedDepartment === "all" ||
          (selectedDepartment === "none" && !r.departmentId) ||
          r.departmentId === selectedDepartment;

        return matchesSearch && matchesDepartment;
      })
      .sort((a, b) => {
        // Robustly handle missing fullName to prevent crashes
        const nameA = a.fullName || "";
        const nameB = b.fullName || "";

        if (sortBy === "name") {
          return nameA.localeCompare(nameB);
        } else if (sortBy === "department") {
          const deptA = departments.find(
            (d) => d.id === a.departmentId,
          );
          const deptB = departments.find(
            (d) => d.id === b.departmentId,
          );
          // Users without department go to the bottom
          if (!a.departmentId && b.departmentId) return 1;
          if (a.departmentId && !b.departmentId) return -1;
          if (!a.departmentId && !b.departmentId)
            return nameA.localeCompare(nameB);

          const queueA = deptA?.queue || 999;
          const queueB = deptB?.queue || 999;
          if (queueA !== queueB) return queueA - queueB;
          return nameA.localeCompare(nameB);
        } else if (sortBy === "grade") {
          return sortResourcesByGrade(a, b, grades);
        }
        return 0;
      });

    return (
      <>
        {/* Toolbar */}
        <div className="border-b border-[rgba(0,0,0,0.12)] px-6 py-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 relative">
              <div className="box-border content-stretch flex gap-[6px] items-center relative rounded-[12px] w-full">
                <div
                  aria-hidden="true"
                  className="absolute border-[0.8px] border-[rgba(0,0,0,0.12)] border-solid inset-0 pointer-events-none rounded-[12px]"
                />
                <Search className="ml-3 w-4 h-4 text-gray-400 shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) =>
                    setSearchQuery(e.target.value)
                  }
                  placeholder="Поиск по имени или должности..."
                  className="flex-1 py-2 pr-10 bg-transparent border-none focus:outline-none text-[14px]"
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

            <div className="relative">
              <div className="box-border content-stretch flex gap-[6px] items-center relative rounded-[12px]">
                <div
                  aria-hidden="true"
                  className="absolute border-[0.8px] border-[rgba(0,0,0,0.12)] border-solid inset-0 pointer-events-none rounded-[12px]"
                />
                <select
                  value={selectedDepartment}
                  onChange={(e) =>
                    setSelectedDepartment(e.target.value)
                  }
                  className="px-3 py-2 bg-transparent border-none focus:outline-none text-[14px] min-w-[180px]"
                >
                  <option value="all">Все департаменты</option>
                  <option value="none">Без департамента</option>
                  {sortedDepartments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div
          className="flex-1 overflow-y-auto overflow-x-hidden py-0 px-0"
          ref={contentRef}
        >
          <div className="space-y-0">
            {/* New users section */}
            {localNewUsers.length > 0 && (
              <div>
                <div className="sticky top-0 z-10 bg-gray-100 px-6 py-3 border-b border-gray-200">
                  <h3 className="font-medium text-gray-700">
                    Новые сотрудники
                  </h3>
                </div>
                {localNewUsers.map((newUser) => (
                  <UserRow
                    key={newUser.tempId}
                    isNew
                    user={{
                      id: newUser.tempId,
                      fullName: newUser.fullName,
                      position: newUser.position,
                      departmentId: newUser.departmentId,
                      grade: newUser.grade,
                      companyId: newUser.companyId,
                      avatarUrl: newUser.avatarUrl,
                      isVisible: newUser.isVisible,
                    }}
                    departments={sortedDepartments}
                    grades={grades}
                    companies={companies}
                    uploadingAvatar={
                      uploadingAvatars[newUser.tempId]
                    }
                    onChange={(field, value) =>
                      handleNewUserChange(
                        newUser.tempId,
                        field,
                        value,
                      )
                    }
                    onDelete={() =>
                      handleDeleteNewUser(newUser.tempId)
                    }
                    onToggleUserVisibility={
                      handleToggleVisibility
                    }
                    onAvatarUpload={(file) =>
                      handleNewUserAvatarUpload(
                        newUser.tempId,
                        file,
                      )
                    }
                    onAvatarRemove={() =>
                      handleNewUserAvatarRemove(newUser.tempId)
                    }
                    getUserInitials={getUserInitials}
                    fileInputRef={(el) =>
                      (fileInputRefs.current[newUser.tempId] =
                        el)
                    }
                  />
                ))}
              </div>
            )}

            {/* Existing users grouped by department */}
            {(() => {
              // Group resources by department
              const groupedByDepartment = new Map<
                string,
                Resource[]
              >();
              visibleResources.forEach((resource) => {
                // Use 'NO_DEPT' as key for users without department (null, undefined, or empty string)
                const deptId =
                  resource.departmentId || "NO_DEPT";
                if (!groupedByDepartment.has(deptId)) {
                  groupedByDepartment.set(deptId, []);
                }
                groupedByDepartment.get(deptId)!.push(resource);
              });

              // Sort departments by queue
              const sortedDepartments = Array.from(
                groupedByDepartment.keys(),
              )
                .map((deptId) =>
                  departments.find((d) => d.id === deptId),
                )
                .filter(
                  (dept): dept is Department =>
                    dept !== undefined,
                )
                .sort(
                  (a, b) => (a.queue || 999) - (b.queue || 999),
                );

              // Users without department (using 'NO_DEPT' key)
              const usersWithoutDept =
                groupedByDepartment.get("NO_DEPT") || [];
              const hasUsersWithoutDept =
                usersWithoutDept.length > 0;

              return (
                <>
                  {/* Users with department sections */}
                  {sortedDepartments.map((dept) => {
                    const deptResources =
                      groupedByDepartment.get(dept.id) || [];
                    // Sort resources within department by grade (Lead → Senior → Middle → Junior)
                    // AND by visibility (Visible first, Hidden last)
                    // Note: We use persisted state (resource.isVisible) rather than editing state
                    // to prevent rows from jumping around while the user is toggling visibility.
                    // The re-sorting happens only after saving.
                    const sortedDeptResources = sortResourcesByGrade(deptResources).sort((a, b) => {
                      const isVisibleA = a.isVisible !== false;
                      const isVisibleB = b.isVisible !== false;
                      
                      if (isVisibleA === isVisibleB) return 0;
                      return isVisibleA ? -1 : 1;
                    });

                    return (
                      <div key={dept.id}>
                        <div className="sticky top-0 z-10 bg-gray-100 px-6 py-3 border-b border-gray-200 flex items-center justify-between">
                          <h3 className="font-medium text-gray-700">
                            {dept.name}
                          </h3>
                          <span className="text-sm text-gray-500">
                            {(() => {
                              const deptUsers = groupedByDepartment.get(dept.id) || [];
                              const visibleCount = deptUsers.filter((u) => editingUsers[u.id]?.isVisible !== false).length;
                              const hiddenCount = deptUsers.length - visibleCount;

                              const plural = (n: number, forms: string[]) => 
                                forms[(n % 100 > 4 && n % 100 < 20) ? 2 : [2, 0, 1, 1, 1, 2][(n % 10 < 5) ? n % 10 : 5]];

                              if (hiddenCount > 0) {
                                return `${visibleCount} ${plural(visibleCount, ['человек', 'человека', 'человек'])} (${hiddenCount} ${plural(hiddenCount, ['скрыт', 'скрыто', 'скрыто'])})`;
                              }
                              return `${visibleCount} ${plural(visibleCount, ['человек', 'человека', 'человек'])}`;
                            })()}
                          </span>
                        </div>
                        {sortedDeptResources.map((resource) => {
                          // Fallback to resource data if editing state isn't ready yet (prevents flash)
                          const userData = editingUsers[resource.id] || {
                            fullName: resource.fullName,
                            position: resource.position,
                            departmentId: resource.departmentId,
                            grade: resource.grade || "",
                            companyId: resource.companyId || "",
                            avatarUrl: resource.avatarUrl,
                            isVisible: resource.isVisible ?? true,
                          };

                          return (
                            <UserRow
                              key={resource.id}
                              isHighlighted={
                                resource.id === animatedUserId
                              }
                              user={{
                                id: resource.id,
                                fullName:
                                  userData.fullName || "",
                                position:
                                  userData.position || "",
                                departmentId:
                                  userData.departmentId || "",
                                grade: userData.grade || "",
                                companyId:
                                  userData.companyId || "",
                                avatarUrl: userData.avatarUrl,
                                isVisible: userData.isVisible,
                              }}
                              departments={sortedDepartments}
                              grades={grades}
                              companies={companies}
                              uploadingAvatar={
                                uploadingAvatars[resource.id]
                              }
                              onChange={(field, value) =>
                                handleChange(
                                  resource.id,
                                  field,
                                  value,
                                )
                              }
                              onDelete={() =>
                                handleDelete(resource.id)
                              }
                              onToggleUserVisibility={
                                handleToggleVisibility
                              }
                              onAvatarUpload={(file) =>
                                handleAvatarUpload(
                                  resource.id,
                                  file,
                                )
                              }
                              onAvatarRemove={() =>
                                handleAvatarRemove(resource.id)
                              }
                              getUserInitials={getUserInitials}
                              fileInputRef={(el) =>
                                (fileInputRefs.current[
                                  resource.id
                                ] = el)
                              }
                              ref={(el) =>
                                (userRowRefs.current[
                                  resource.id
                                ] = el)
                              }
                            />
                          );
                        })}
                      </div>
                    );
                  })}

                  {/* Users without department section (render last) */}
                  {hasUsersWithoutDept && (
                    <div>
                      <div className="sticky top-0 z-10 bg-gray-100 px-6 py-3 border-b border-gray-200">
                        <h3 className="font-medium text-gray-500 italic">
                          Без департамента
                        </h3>
                      </div>
                      {sortResourcesByGrade(
                        usersWithoutDept,
                      ).map((resource) => {
                        // Fallback to resource data if editing state isn't ready yet (prevents flash)
                        const userData = editingUsers[resource.id] || {
                          fullName: resource.fullName,
                          position: resource.position,
                          departmentId: resource.departmentId,
                          grade: resource.grade || "",
                          companyId: resource.companyId || "",
                          avatarUrl: resource.avatarUrl,
                          isVisible: resource.isVisible ?? true,
                        };

                        return (
                          <UserRow
                            key={resource.id}
                            isHighlighted={
                              resource.id === animatedUserId
                            }
                            user={{
                              id: resource.id,
                              fullName: userData.fullName || "",
                              position: userData.position || "",
                              departmentId:
                                userData.departmentId || "",
                              grade: userData.grade || "",
                              companyId:
                                userData.companyId || "",
                              avatarUrl: userData.avatarUrl,
                              isVisible: userData.isVisible,
                            }}
                            departments={sortedDepartments}
                            grades={grades}
                            companies={companies}
                            uploadingAvatar={
                              uploadingAvatars[resource.id]
                            }
                            onChange={(field, value) =>
                              handleChange(
                                resource.id,
                                field,
                                value,
                              )
                            }
                            onDelete={() =>
                              handleDelete(resource.id)
                            }
                            onToggleUserVisibility={
                              handleToggleVisibility
                            }
                            onAvatarUpload={(file) =>
                              handleAvatarUpload(
                                resource.id,
                                file,
                              )
                            }
                            onAvatarRemove={() =>
                              handleAvatarRemove(resource.id)
                            }
                            getUserInitials={getUserInitials}
                            fileInputRef={(el) =>
                              (fileInputRefs.current[
                                resource.id
                              ] = el)
                            }
                            ref={(el) =>
                              (userRowRefs.current[
                                resource.id
                              ] = el)
                            }
                          />
                        );
                      })}
                    </div>
                  )}
                </>
              );
            })()}

            {visibleResources.length === 0 &&
              localNewUsers.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <p>Нет сотрудников</p>
                  <p className="text-sm mt-2">
                    {searchQuery || selectedDepartment !== "all"
                      ? "Попробуйте изменить фильтры поиска"
                      : 'Нажмите "Сотрудник" для создания'}
                  </p>
                </div>
              )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t bg-gray-50 px-6 py-4 flex items-center justify-end gap-3">
          <button
            onClick={handleSave}
            disabled={isSaving || isUploading}
            className={`px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2 ${
              isSaving || isUploading ? "opacity-70 cursor-not-allowed" : ""
            }`}
          >
            {isSaving && (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            {isUploading ? "Загрузка фото..." : isSaving ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </>
    );
  },
);

UsersManagementContent.displayName = "UsersManagementContent";

// UserRow component
interface UserRowProps {
  isNew?: boolean;
  isHighlighted?: boolean;
  user: {
    id: string;
    fullName: string;
    position: string;
    departmentId: string;
    grade: string;
    companyId: string;
    avatarUrl?: string | null;
    isVisible?: boolean;
  };
  departments: Department[];
  grades: Grade[];
  companies: Company[];
  uploadingAvatar?: boolean;
  onChange: (field: string, value: string) => void;
  onDelete: () => void;
  onToggleUserVisibility?: (userId: string) => void; // ✅ Убрали Promise<void> (теперь синхронная)
  onAvatarUpload: (file: File) => void;
  onAvatarRemove: () => void;
  getUserInitials: (fullName: string) => string;
  fileInputRef: (el: HTMLInputElement | null) => void;
}

const UserRow = forwardRef<HTMLDivElement, UserRowProps>(
  (
    {
      isNew,
      isHighlighted,
      user,
      departments,
      grades,
      companies,
      uploadingAvatar,
      onChange,
      onDelete,
      onToggleUserVisibility,
      onAvatarUpload,
      onAvatarRemove,
      getUserInitials,
      fileInputRef,
    },
    ref,
  ) => {
    // Removed manual dropdown state logic
    
    return (
      <div
        ref={ref}
        className={`
    px-6 py-3 border-b border-gray-100 transition-all duration-200 group
    ${isNew ? "bg-blue-50/50" : isHighlighted ? "bg-blue-50/30" : "bg-white hover:bg-gray-50/50"}
  `}
      >
        <div className="flex items-center gap-3">
          {/* Полупрозрачная группа: аватар + поля */}
          <div
            className={`flex items-center gap-3 flex-1 transition-opacity min-w-0 ${!user.isVisible ? "opacity-40" : ""}`}
          >
            {/* Avatar */}
            <div className="flex-shrink-0">
              <div className="relative group/avatar">
                {uploadingAvatar ? (
                  <div className="w-9 h-9 rounded-[12px] bg-[#F6F6F6] flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : user.avatarUrl ? (
                  <div className="relative w-9 h-9">
                    <img
                      src={user.avatarUrl}
                      alt={user.fullName}
                      className="w-9 h-9 rounded-[12px] object-cover"
                    />
                    <button
                      onClick={onAvatarRemove}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-white shadow-sm border border-gray-100 text-red-500 rounded-full opacity-0 group-hover/avatar:opacity-100 transition-all flex items-center justify-center hover:bg-red-50"
                      title="Удалить аватар"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      const input =
                        document.createElement("input");
                      input.type = "file";
                      input.accept = "image/*";
                      input.onchange = (e) => {
                        const file = (
                          e.target as HTMLInputElement
                        ).files?.[0];
                        if (file) onAvatarUpload(file);
                      };
                      input.click();
                    }}
                    className="w-9 h-9 flex items-center justify-center hover:opacity-80 transition-all cursor-pointer"
                  >
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
                      <p className="text-sm font-medium text-[#868789]">
                        {getUserInitials(user.fullName)}
                      </p>
                    </div>
                  </button>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onAvatarUpload(file);
                  }}
                  className="hidden"
                />
              </div>
            </div>

            {/* Внешний grid: 1 гибкая колонка (в ней ФИО + Должность) + 3 фиксированные по 100px */}
            <div className="grid grid-cols-[minmax(0,1fr)_repeat(3,100px)] gap-3 items-center min-w-0 w-full">
              {/* Левая гр��ппа: ФИО + Должность (вложенный grid) */}
              <div className="grid grid-cols-2 gap-3 items-center min-w-0 w-full">
                <TextInput
                  value={user.fullName}
                  onChange={(e) =>
                    onChange("fullName", e.target.value)
                  }
                  placeholder="Имя Фамилия"
                  className="min-w-0 w-full box-border h-9 px-3 bg-white border border-gray-200 rounded-lg text-[14px] leading-none outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />

                <TextInput
                  value={user.position}
                  onChange={(e) =>
                    onChange("position", e.target.value)
                  }
                  placeholder="Должность"
                  className="min-w-0 w-full box-border h-9 px-3 bg-white border border-gray-200 rounded-lg text-[14px] leading-none outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              {/* Department - фиксированная колонка */}
              <SelectInput
                value={user.departmentId}
                onChange={(e) =>
                  onChange("departmentId", e.target.value)
                }
                className="h-9 w-full pl-3 pr-8 bg-white border border-gray-200 rounded-lg text-[14px] leading-none transition-all outline-none cursor-pointer text-gray-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="">Без департамента</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </SelectInput>

              {/* Grade - фиксированная колонка */}
              <SelectInput
                value={user.grade}
                onChange={(e) =>
                  onChange("grade", e.target.value)
                }
                className="h-9 w-full pl-3 pr-8 bg-white border border-gray-200 rounded-lg text-[14px] leading-none transition-all outline-none cursor-pointer text-gray-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="">Грейд</option>
                {grades.map((grade) => (
                  <option key={grade.id} value={grade.name}>
                    {grade.name}
                  </option>
                ))}
              </SelectInput>

              {/* Company - фиксированная колонка */}
              <SelectInput
                value={user.companyId}
                onChange={(e) =>
                  onChange("companyId", e.target.value)
                }
                className="h-9 w-full pl-3 pr-8 bg-white border border-gray-200 rounded-lg text-[14px] leading-none transition-all outline-none cursor-pointer text-gray-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </SelectInput>
            </div>
          </div>

          {/* Кнопка меню (не полупрозрачная) */}
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
                {onToggleUserVisibility && (
                  <DropdownMenuItem
                    onClick={() => onToggleUserVisibility(user.id)}
                    className="cursor-pointer"
                  >
                    {user.isVisible ? (
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
                        <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                        <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                        <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                        <line x1="2" x2="22" y1="2" y2="22" />
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
                    {user.isVisible ? "Скрыть" : "Показать"}
                  </DropdownMenuItem>
                )}
                
                <DropdownMenuItem
                  onClick={onDelete}
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
  },
);

UserRow.displayName = "UserRow";