import { useState, useEffect } from "react";
import {
  Grade,
  Company,
  Resource,
} from "../../types/scheduler";
import {
  Trash2,
  Loader2,
  GripVertical,
  RotateCcw,
  FileText,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { backupsApi, Backup } from "../../services/api/backups";
import { offWeeksApi, OffWeek } from "../../services/api/offWeeks";
import { CalendarOff } from "lucide-react";

interface WorkspaceManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLoading?: boolean;

  resources: Resource[];

  workspaceId: string;
  workspaceName: string;
  workspaceYear: number;
  onUpdateWorkspaceName: (name: string) => Promise<void>;
  onUpdateWorkspaceYear: (year: number) => Promise<void>;

  grades: Grade[];
  onCreateGrade: (name: string) => Promise<void>;
  onUpdateGrade: (
    gradeId: string,
    name: string,
  ) => Promise<void>;
  onDeleteGrade: (gradeId: string) => Promise<void>;
  onUpdateGradesSortOrder?: (
    updates: Array<{ id: string; sortOrder: number }>,
  ) => Promise<void>;
  onGradesUpdated?: () => Promise<void>;

  companies: Company[];
  onCreateCompany: (name: string) => Promise<void>;
  onUpdateCompany: (
    companyId: string,
    name: string,
  ) => Promise<void>;
  onDeleteCompany: (companyId: string) => Promise<void>;
  onUpdateCompaniesSortOrder?: (
    updates: Array<{ id: string; sortOrder: number }>,
  ) => Promise<void>;
  onCompaniesUpdated?: () => Promise<void>;
  onResourcesUpdated?: () => Promise<void>;
  onOffWeeksUpdated?: () => void;
}

interface LocalNewGrade {
  tempId: string;
  name: string;
}

interface LocalNewCompany {
  tempId: string;
  name: string;
}

export function WorkspaceManagementModal({
  isOpen,
  onClose,
  isLoading = false,
  workspaceId,
  workspaceName,
  workspaceYear,
  onUpdateWorkspaceName,
  onUpdateWorkspaceYear,
  grades,
  onCreateGrade,
  onUpdateGrade,
  onDeleteGrade,
  onUpdateGradesSortOrder,
  onGradesUpdated,
  companies,
  onCreateCompany,
  onUpdateCompany,
  onDeleteCompany,
  onUpdateCompaniesSortOrder,
  onCompaniesUpdated,
  onResourcesUpdated,
  onOffWeeksUpdated,
  resources,
}: WorkspaceManagementModalProps) {
  const [localName, setLocalName] = useState(workspaceName);
  const [localYear, setLocalYear] = useState(workspaceYear);
  const [isSaving, setIsSaving] = useState(false);

  const [editingGrades, setEditingGrades] = useState<
    Record<string, string>
  >({});
  const [localNewGrades, setLocalNewGrades] = useState<
    LocalNewGrade[]
  >([]);
  const [deletedGradeIds, setDeletedGradeIds] = useState<
    string[]
  >([]);
  const [sortedGrades, setSortedGrades] = useState<Grade[]>([]);
  const [draggedGradeIndex, setDraggedGradeIndex] = useState<
    number | null
  >(null);
  const [dragOverGradeIndex, setDragOverGradeIndex] = useState<
    number | null
  >(null);

  const [editingCompanies, setEditingCompanies] = useState<
    Record<string, string>
  >({});
  const [localNewCompanies, setLocalNewCompanies] = useState<
    LocalNewCompany[]
  >([]);
  const [deletedCompanyIds, setDeletedCompanyIds] = useState<
    string[]
  >([]);
  const [sortedCompanies, setSortedCompanies] = useState<
    Company[]
  >([]);
  const [draggedCompanyIndex, setDraggedCompanyIndex] =
    useState<number | null>(null);
  const [dragOverCompanyIndex, setDragOverCompanyIndex] =
    useState<number | null>(null);

  // Backups state
  const [backups, setBackups] = useState<Backup[]>([]);
  const [isBackupsLoading, setIsBackupsLoading] =
    useState(false);
  const [backupToRestore, setBackupToRestore] = useState<
    string | null
  >(null);

  // Off weeks state
  const [offWeeks, setOffWeeks] = useState<OffWeek[]>([]);
  const [isOffWeeksLoading, setIsOffWeeksLoading] = useState(false);
  const [localNewOffWeeks, setLocalNewOffWeeks] = useState<number[]>([]);
  const [deletedOffWeekIds, setDeletedOffWeekIds] = useState<number[]>([]);

  // Initialize editing state
  useEffect(() => {
    if (isOpen) {
      if (isSaving) {
        return;
      }

      setLocalName(workspaceName);
      setLocalYear(workspaceYear);

      const gradesState: Record<string, string> = {};
      grades.forEach((g) => {
        gradesState[String(g.id)] = g.name;
      });
      setEditingGrades(gradesState);
      setLocalNewGrades([]);
      setDeletedGradeIds([]);
      setSortedGrades([...grades]);

      const companiesState: Record<string, string> = {};
      companies.forEach((c) => {
        companiesState[String(c.id)] = c.name;
      });
      setEditingCompanies(companiesState);
      setLocalNewCompanies([]);
      setDeletedCompanyIds([]);
      setSortedCompanies([...companies]);

      // Reset off weeks state
      setLocalNewOffWeeks([]);
      setDeletedOffWeekIds([]);

      // Load backups & off weeks
      if (workspaceId && workspaceId !== "loading") {
        setIsBackupsLoading(true);
        backupsApi
          .list(workspaceId)
          .then((data) => setBackups(data.backups))
          .catch((err) =>
            console.error("Failed to load backups:", err),
          )
          .finally(() => setIsBackupsLoading(false));

        setIsOffWeeksLoading(true);
        offWeeksApi
          .list(workspaceId)
          .then((data) => setOffWeeks(data))
          .catch((err) =>
            console.error("Failed to load off weeks:", err),
          )
          .finally(() => setIsOffWeeksLoading(false));
      }
    }
  }, [
    isOpen,
    workspaceName,
    workspaceYear,
    grades,
    companies,
    isSaving,
    workspaceId,
  ]);

  if (!isOpen) return null;

  const handleAddGrade = () => {
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    setLocalNewGrades((prev) => [
      ...prev,
      { tempId, name: "" },
    ]);
  };

  const handleAddCompany = () => {
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    setLocalNewCompanies((prev) => [
      ...prev,
      { tempId, name: "" },
    ]);
  };

  // Drag and Drop handlers for Grades
  const handleGradeDragStart = (index: number) => {
    setDraggedGradeIndex(index);
  };

  const handleGradeDragOver = (
    e: React.DragEvent,
    index: number,
  ) => {
    e.preventDefault();
    if (draggedGradeIndex === null) return;

    setDragOverGradeIndex(index);

    if (draggedGradeIndex === index) return;

    const newSorted = [...sortedGrades];
    const draggedItem = newSorted[draggedGradeIndex];
    newSorted.splice(draggedGradeIndex, 1);
    newSorted.splice(index, 0, draggedItem);

    setSortedGrades(newSorted);
    setDraggedGradeIndex(index);
  };

  const handleGradeDragEnd = () => {
    setDraggedGradeIndex(null);
    setDragOverGradeIndex(null);
  };

  // Drag and Drop handlers for Companies
  const handleCompanyDragStart = (index: number) => {
    setDraggedCompanyIndex(index);
  };

  const handleCompanyDragOver = (
    e: React.DragEvent,
    index: number,
  ) => {
    e.preventDefault();
    if (draggedCompanyIndex === null) return;

    setDragOverCompanyIndex(index);

    if (draggedCompanyIndex === index) return;

    const newSorted = [...sortedCompanies];
    const draggedItem = newSorted[draggedCompanyIndex];
    newSorted.splice(draggedCompanyIndex, 1);
    newSorted.splice(index, 0, draggedItem);

    setSortedCompanies(newSorted);
    setDraggedCompanyIndex(index);
  };

  const handleCompanyDragEnd = () => {
    setDraggedCompanyIndex(null);
    setDragOverCompanyIndex(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Restore backup if selected
      if (backupToRestore && workspaceId) {
        console.log(
          `♻️ Restoring backup version: ${backupToRestore}`,
        );
        const response = await backupsApi.restore(
          workspaceId,
          backupToRestore,
        );
        if (response.success) {
          alert(
            `Воркспейс успешно восстановлен (восстановлено ${response.restoredCount} событий). Страница будет перезагружена.`,
          );
          window.location.reload();
          return;
        }
      }

      // Update workspace name
      if (localName !== workspaceName) {
        await onUpdateWorkspaceName(localName);
      }

      // Update workspace year
      if (localYear !== workspaceYear) {
        await onUpdateWorkspaceYear(localYear);
      }

      // Delete grades
      if (deletedGradeIds.length > 0) {
        await Promise.all(
          deletedGradeIds.map((id) => onDeleteGrade(id)),
        );
      }

      // Create new grades
      const validNewGrades = localNewGrades.filter((g) =>
        g.name.trim(),
      );
      if (validNewGrades.length > 0) {
        await Promise.all(
          validNewGrades.map((g) =>
            onCreateGrade(g.name.trim()),
          ),
        );
      }

      // Update existing grades
      const gradeUpdatePromises: Promise<void>[] = [];
      for (const gradeId in editingGrades) {
        const original = grades.find(
          (g) => String(g.id) === gradeId,
        );
        if (
          original &&
          editingGrades[gradeId] !== original.name
        ) {
          gradeUpdatePromises.push(
            onUpdateGrade(gradeId, editingGrades[gradeId]),
          );
        }
      }
      if (gradeUpdatePromises.length > 0) {
        await Promise.all(gradeUpdatePromises);
      }

      // 1. Detect sort order changes for Grades
      const remainingOriginalGradeIds = grades
        .filter((g) => !deletedGradeIds.includes(String(g.id)))
        .map((g) => String(g.id));
      const currentGradeIds = sortedGrades.map((g) =>
        String(g.id),
      );
      const hasGradeOrderChanged =
        JSON.stringify(remainingOriginalGradeIds) !==
        JSON.stringify(currentGradeIds);

      // Update grades sort order (batch update)
      if (onUpdateGradesSortOrder && hasGradeOrderChanged) {
        const sortOrderUpdates = sortedGrades.map(
          (grade, index) => ({
            id: String(grade.id),
            sortOrder: index,
          }),
        );
        try {
          await onUpdateGradesSortOrder(sortOrderUpdates);
        } catch (e) {
          console.error(
            "[SORT_GRADE] Error updating sort order:",
            e,
          );
        }
      }

      // Delete companies
      if (deletedCompanyIds.length > 0) {
        await Promise.all(
          deletedCompanyIds.map((id) => onDeleteCompany(id)),
        );
      }

      // Create new companies
      const validNewCompanies = localNewCompanies.filter((c) =>
        c.name.trim(),
      );
      if (validNewCompanies.length > 0) {
        await Promise.all(
          validNewCompanies.map((c) =>
            onCreateCompany(c.name.trim()),
          ),
        );
      }

      // Update existing companies
      const companyUpdatePromises: Promise<void>[] = [];
      for (const companyId in editingCompanies) {
        const original = companies.find(
          (c) => String(c.id) === companyId,
        );
        if (
          original &&
          editingCompanies[companyId] !== original.name
        ) {
          companyUpdatePromises.push(
            onUpdateCompany(
              companyId,
              editingCompanies[companyId],
            ),
          );
        }
      }
      if (companyUpdatePromises.length > 0) {
        await Promise.all(companyUpdatePromises);
      }

      // 2. Detect sort order changes for Companies
      const remainingOriginalCompanyIds = companies
        .filter(
          (c) => !deletedCompanyIds.includes(String(c.id)),
        )
        .map((c) => String(c.id));
      const currentCompanyIds = sortedCompanies.map((c) =>
        String(c.id),
      );
      const hasCompanyOrderChanged =
        JSON.stringify(remainingOriginalCompanyIds) !==
        JSON.stringify(currentCompanyIds);

      // Update companies sort order (batch update)
      if (
        onUpdateCompaniesSortOrder &&
        hasCompanyOrderChanged
      ) {
        const sortOrderUpdates = sortedCompanies.map(
          (company, index) => ({
            id: String(company.id),
            sortOrder: index,
          }),
        );
        try {
          await onUpdateCompaniesSortOrder(sortOrderUpdates);
        } catch (e) {
          console.error(
            "[SORT_COMPANY] Error updating sort order:",
            e,
          );
        }
      }

      // Save off weeks changes
      if (deletedOffWeekIds.length > 0) {
        console.log(`🗑️ Удаление ${deletedOffWeekIds.length} выходных недель...`);
        await offWeeksApi.bulkDelete(deletedOffWeekIds);
      }
      if (localNewOffWeeks.length > 0) {
        const validNewOffWeeks = localNewOffWeeks.filter((wn) => wn >= 1 && wn <= 53);
        if (validNewOffWeeks.length > 0) {
          console.log(`📅 Создание ${validNewOffWeeks.length} выходных недель...`);
          await offWeeksApi.bulkCreate(workspaceId, validNewOffWeeks);
        }
      }

      onClose();

      const hasGradeChanges =
        deletedGradeIds.length > 0 ||
        validNewGrades.length > 0 ||
        gradeUpdatePromises.length > 0 ||
        hasGradeOrderChanged;

      const hasCompanyChanges =
        deletedCompanyIds.length > 0 ||
        validNewCompanies.length > 0 ||
        companyUpdatePromises.length > 0 ||
        hasCompanyOrderChanged;

      if (
        (validNewGrades.length > 0 ||
          gradeUpdatePromises.length > 0 ||
          hasGradeOrderChanged) &&
        onGradesUpdated
      ) {
        await onGradesUpdated();
      }

      if (
        (validNewCompanies.length > 0 ||
          companyUpdatePromises.length > 0 ||
          hasCompanyOrderChanged) &&
        onCompaniesUpdated
      ) {
        await onCompaniesUpdated();
      }

      if (hasCompanyChanges && onResourcesUpdated) {
        await onResourcesUpdated();
      }

      // Reload off-weeks on calendar
      const hasOffWeekChanges = deletedOffWeekIds.length > 0 || localNewOffWeeks.length > 0;
      if (hasOffWeekChanges && onOffWeeksUpdated) {
        onOffWeeksUpdated();
      }
    } catch (error) {
      console.error(
        "❌ Ошибка при сохранении настроек:",
        error,
      );
      alert("Ошибка при сохранении настроек");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    const hasChanges =
      localName !== workspaceName ||
      localYear !== workspaceYear ||
      localNewGrades.length > 0 ||
      deletedGradeIds.length > 0 ||
      localNewCompanies.length > 0 ||
      deletedCompanyIds.length > 0 ||
      localNewOffWeeks.length > 0 ||
      deletedOffWeekIds.length > 0;

    if (hasChanges) {
      const confirmed = window.confirm(
        "У вас есть несохраненные изменения. Вы уверены, что хотите закрыть?",
      );
      if (!confirmed) return;
    }

    onClose();
  };

  const visibleGrades = sortedGrades.filter(
    (g) => !deletedGradeIds.includes(g.id),
  );
  const visibleCompanies = sortedCompanies.filter(
    (c) => !deletedCompanyIds.includes(c.id),
  );

  return (
    <div
      className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/40 backdrop-blur-sm transition-all"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl h-[80vh] flex flex-col border border-gray-100/20"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-gray-100 bg-white rounded-t-xl px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              Настройки
            </h2>
            <button
              onClick={handleClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
              title="Закрыть"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
              <p className="text-sm text-gray-500">
                Загрузка данных...
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-6">
              <div className="space-y-6">
                {/* Workspace Settings */}
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-3">
                    Настройки воркспейса
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1.5">
                        Название
                      </label>
                      {isLoading ? (
                        <div className="h-[38px] w-full bg-gray-100 rounded-lg animate-pulse" />
                      ) : (
                        <input
                          type="text"
                          value={localName}
                          onChange={(e) =>
                            setLocalName(e.target.value)
                          }
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          placeholder="Планирование 2024"
                        />
                      )}
                    </div>

                    <div>
                      <label className="block text-xs text-gray-600 mb-1.5">
                        Год
                      </label>
                      {isLoading ? (
                        <div className="h-[38px] w-full bg-gray-100 rounded-lg animate-pulse" />
                      ) : (
                        <select
                          value={localYear}
                          onChange={(e) =>
                            setLocalYear(
                              parseInt(e.target.value),
                            )
                          }
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        >
                          {Array.from(
                            { length: 11 },
                            (_, i) => 2020 + i,
                          ).map((year) => (
                            <option key={year} value={year}>
                              {year}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                </div>

                {/* Grades */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-gray-900">
                      Грейды
                    </h3>
                    <button
                      onClick={handleAddGrade}
                      disabled={isLoading}
                      className={`px-2.5 py-1 text-xs bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors font-medium ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      + Добавить
                    </button>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
                    {isLoading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 p-3"
                        >
                          <div className="w-4 h-4 bg-gray-100 rounded animate-pulse" />
                          <div className="h-8 flex-1 bg-gray-100 rounded-md animate-pulse" />
                          <div className="w-6 h-6 bg-gray-100 rounded animate-pulse" />
                        </div>
                      ))
                    ) : (
                      <>
                        {/* New grades */}
                        {localNewGrades.map((grade) => (
                          <div
                            key={grade.tempId}
                            className="flex items-center gap-2 p-3 bg-blue-50/30"
                          >
                            <input
                              type="text"
                              value={grade.name}
                              onChange={(e) => {
                                setLocalNewGrades((prev) =>
                                  prev.map((g) =>
                                    g.tempId === grade.tempId
                                      ? {
                                          ...g,
                                          name: e.target.value,
                                        }
                                      : g,
                                  ),
                                );
                              }}
                              placeholder="Название грейда"
                              className="flex-1 px-3 py-1.5 bg-transparent border-none text-sm focus:outline-none placeholder:text-gray-400"
                            />
                            <button
                              onClick={() => {
                                setLocalNewGrades((prev) =>
                                  prev.filter(
                                    (g) =>
                                      g.tempId !== grade.tempId,
                                  ),
                                );
                              }}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                              title="Удалить"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}

                        {/* Existing grades */}
                        {visibleGrades.map((grade, index) => (
                          <div
                            key={grade.id}
                            draggable
                            onDragStart={() =>
                              handleGradeDragStart(index)
                            }
                            onDragOver={(e) =>
                              handleGradeDragOver(e, index)
                            }
                            onDragEnd={handleGradeDragEnd}
                            className={`flex items-center gap-2 p-3 transition-all duration-200 cursor-move group relative ${
                              draggedGradeIndex === index
                                ? "bg-blue-100/80 border border-blue-400 opacity-50 scale-[0.98] shadow-lg"
                                : dragOverGradeIndex ===
                                      index &&
                                    draggedGradeIndex !== null
                                  ? "bg-blue-50/70 border-t-2 border-t-blue-500"
                                  : "hover:bg-gray-50/80 border-t border-t-transparent"
                            }`}
                          >
                            <GripVertical
                              className={`w-4 h-4 flex-shrink-0 transition-colors ${
                                draggedGradeIndex === index
                                  ? "text-blue-600"
                                  : "text-gray-400 group-hover:text-gray-600"
                              }`}
                            />
                            <input
                              type="text"
                              value={
                                editingGrades[grade.id] || ""
                              }
                              onChange={(e) => {
                                setEditingGrades((prev) => ({
                                  ...prev,
                                  [grade.id]: e.target.value,
                                }));
                              }}
                              placeholder="Название грейда"
                              className="flex-1 px-3 py-1.5 bg-transparent border-none text-sm focus:outline-none placeholder:text-gray-400"
                            />
                            <button
                              onClick={() => {
                                if (
                                  confirm(
                                    `Удалить грейд "${grade.name}"?\n\nУдаление будет выполнено после нажатия "Сохранить".`,
                                  )
                                ) {
                                  setDeletedGradeIds((prev) => [
                                    ...prev,
                                    grade.id,
                                  ]);
                                  setSortedGrades((prev) =>
                                    prev.filter(
                                      (g) => g.id !== grade.id,
                                    ),
                                  );
                                }
                              }}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                              title="Удалить"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}

                        {visibleGrades.length === 0 &&
                          localNewGrades.length === 0 && (
                            <p className="text-xs text-gray-500 text-center py-4">
                              Нет грейдов
                            </p>
                          )}
                      </>
                    )}
                  </div>
                </div>

                {/* Companies */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-gray-900">
                      Компании
                    </h3>
                    <button
                      onClick={handleAddCompany}
                      disabled={isLoading}
                      className={`px-2.5 py-1 text-xs bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors font-medium ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      + Добавить
                    </button>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
                    {isLoading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 p-3"
                        >
                          <div className="w-4 h-4 bg-gray-100 rounded animate-pulse" />
                          <div className="h-8 flex-1 bg-gray-100 rounded-md animate-pulse" />
                          <div className="w-6 h-6 bg-gray-100 rounded animate-pulse" />
                        </div>
                      ))
                    ) : (
                      <>
                        {/* New companies */}
                        {localNewCompanies.map((company) => (
                          <div
                            key={company.tempId}
                            className="flex items-center gap-2 p-3 bg-blue-50/30"
                          >
                            <input
                              type="text"
                              value={company.name}
                              onChange={(e) => {
                                setLocalNewCompanies((prev) =>
                                  prev.map((c) =>
                                    c.tempId === company.tempId
                                      ? {
                                          ...c,
                                          name: e.target.value,
                                        }
                                      : c,
                                  ),
                                );
                              }}
                              placeholder="Название компании"
                              className="flex-1 px-3 py-1.5 bg-transparent border-none text-sm focus:outline-none placeholder:text-gray-400"
                            />
                            <button
                              onClick={() => {
                                setLocalNewCompanies((prev) =>
                                  prev.filter(
                                    (c) =>
                                      c.tempId !==
                                      company.tempId,
                                  ),
                                );
                              }}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                              title="Удалить"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}

                        {/* Existing companies */}
                        {visibleCompanies.map(
                          (company, index) => (
                            <div
                              key={company.id}
                              draggable
                              onDragStart={() =>
                                handleCompanyDragStart(index)
                              }
                              onDragOver={(e) =>
                                handleCompanyDragOver(e, index)
                              }
                              onDragEnd={handleCompanyDragEnd}
                              className={`flex items-center gap-2 p-3 transition-all duration-200 cursor-move group relative ${
                                draggedCompanyIndex === index
                                  ? "bg-blue-100/80 border border-blue-400 opacity-50 scale-[0.98] shadow-lg"
                                  : dragOverCompanyIndex ===
                                        index &&
                                      draggedCompanyIndex !==
                                        null
                                    ? "bg-blue-50/70 border-t-2 border-t-blue-500"
                                    : "hover:bg-gray-50/80 border-t border-t-transparent"
                              }`}
                            >
                              <GripVertical
                                className={`w-4 h-4 flex-shrink-0 transition-colors ${
                                  draggedCompanyIndex === index
                                    ? "text-blue-600"
                                    : "text-gray-400 group-hover:text-gray-600"
                                }`}
                              />
                              <input
                                type="text"
                                value={
                                  editingCompanies[
                                    company.id
                                  ] || ""
                                }
                                onChange={(e) => {
                                  setEditingCompanies(
                                    (prev) => ({
                                      ...prev,
                                      [company.id]:
                                        e.target.value,
                                    }),
                                  );
                                }}
                                placeholder="Название компании"
                                className="flex-1 px-3 py-1.5 bg-transparent border-none text-sm focus:outline-none placeholder:text-gray-400"
                              />
                              <button
                                onClick={() => {
                                  if (
                                    confirm(
                                      `Удалить компанию "${company.name}"?\n\nУдаление будет выполнено после нажатия "Сохранить".`,
                                    )
                                  ) {
                                    setDeletedCompanyIds(
                                      (prev) => [
                                        ...prev,
                                        company.id,
                                      ],
                                    );
                                    setSortedCompanies((prev) =>
                                      prev.filter(
                                        (c) =>
                                          c.id !== company.id,
                                      ),
                                    );
                                  }
                                }}
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                                title="Удалить"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ),
                        )}

                        {visibleCompanies.length === 0 &&
                          localNewCompanies.length === 0 && (
                            <p className="text-xs text-gray-500 text-center py-4">
                              Нет компаний
                            </p>
                          )}
                      </>
                    )}
                  </div>
                </div>

                {/* Off Weeks */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                      <CalendarOff className="w-4 h-4 text-gray-400" />
                      Выходные недели
                    </h3>
                    <button
                      onClick={() => {
                        setLocalNewOffWeeks((prev) => [...prev, 0]);
                      }}
                      disabled={isOffWeeksLoading}
                      className={`px-2.5 py-1 text-xs bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors font-medium ${isOffWeeksLoading ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      + Добавить
                    </button>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
                    {isOffWeeksLoading ? (
                      Array.from({ length: 2 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-2 p-3">
                          <div className="h-8 flex-1 bg-gray-100 rounded-md animate-pulse" />
                          <div className="w-6 h-6 bg-gray-100 rounded animate-pulse" />
                        </div>
                      ))
                    ) : (
                      <>
                        {/* New off-week rows */}
                        {localNewOffWeeks.map((wn, idx) => (
                          <div
                            key={`new-offweek-${idx}`}
                            className="flex items-center gap-2 p-3 bg-blue-50/30"
                          >
                            <input
                              type="number"
                              min={1}
                              max={53}
                              value={wn || ""}
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                setLocalNewOffWeeks((prev) => {
                                  const next = [...prev];
                                  next[idx] = isNaN(val) ? 0 : Math.max(0, Math.min(53, val));
                                  return next;
                                });
                              }}
                              placeholder="№"
                              className="w-16 px-3 py-1.5 bg-transparent border-none text-sm focus:outline-none placeholder:text-gray-400 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <span className="flex-1 text-sm text-gray-500 truncate">
                              {wn >= 1 && wn <= 53 ? (() => {
                                const year = workspaceYear || new Date().getFullYear();
                                const jan4 = new Date(year, 0, 4);
                                const dayOfWeek = (jan4.getDay() + 6) % 7;
                                const monday = new Date(jan4);
                                monday.setDate(jan4.getDate() - dayOfWeek + (wn - 1) * 7);
                                const sunday = new Date(monday);
                                sunday.setDate(monday.getDate() + 6);
                                const months = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
                                const startStr = `${monday.getDate()} ${months[monday.getMonth()]}`;
                                const endStr = `${sunday.getDate()} ${months[sunday.getMonth()]}`;
                                return `${wn} неделя, ${startStr} – ${endStr}`;
                              })() : "Введите номер недели"}
                            </span>
                            <button
                              onClick={() => {
                                setLocalNewOffWeeks((prev) => prev.filter((_, i) => i !== idx));
                              }}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                              title="Удалить"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}

                        {/* Existing off-weeks */}
                        {offWeeks
                          .filter((ow) => !deletedOffWeekIds.includes(ow.id))
                          .sort((a, b) => a.week_number - b.week_number)
                          .map((ow) => (
                            <div
                              key={ow.id}
                              className="flex items-center gap-2 p-3 group"
                            >
                              <span className="w-16 text-sm text-gray-700 text-center">{ow.week_number}</span>
                              <span className="flex-1 text-sm text-gray-500 truncate">
                                {(() => {
                                  const year = workspaceYear || new Date().getFullYear();
                                  const jan4 = new Date(year, 0, 4);
                                  const dayOfWeek = (jan4.getDay() + 6) % 7;
                                  const monday = new Date(jan4);
                                  monday.setDate(jan4.getDate() - dayOfWeek + (ow.week_number - 1) * 7);
                                  const sunday = new Date(monday);
                                  sunday.setDate(monday.getDate() + 6);
                                  const months = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
                                  const startStr = `${monday.getDate()} ${months[monday.getMonth()]}`;
                                  const endStr = `${sunday.getDate()} ${months[sunday.getMonth()]}`;
                                  return `${ow.week_number} неделя, ${startStr} – ${endStr}`;
                                })()}
                              </span>
                              <button
                                onClick={() => {
                                  setDeletedOffWeekIds((prev) => [...prev, ow.id]);
                                }}
                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                                title="Удалить"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}

                        {/* Empty state */}
                        {offWeeks.filter((ow) => !deletedOffWeekIds.includes(ow.id)).length === 0 && localNewOffWeeks.length === 0 && (
                          <div className="p-4 text-center">
                            <p className="text-xs text-gray-500">Нет выходных недель</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Backups */}
                <div className="pt-4 border-t border-gray-100 mt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                      Резервные копии проектов
                    </h3>
                    {isBackupsLoading ? (
                      <span className="h-3 w-48 bg-gray-100 rounded animate-pulse" />
                    ) : (
                      <span className="text-xs text-gray-400">
                        Последняя синхронизация:{" "}
                        {backups.length > 0
                          ? new Date(
                              backups[0].timestamp,
                            ).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </span>
                    )}
                  </div>

                  <div className="border border-gray-200 rounded-lg divide-y divide-gray-200/50">
                    {isBackupsLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between p-3 first:rounded-t-lg last:rounded-b-lg"
                        >
                          <div className="space-y-2">
                            <div className="h-4 w-48 bg-gray-100 rounded animate-pulse" />
                            <div className="h-3 w-32 bg-gray-100 rounded animate-pulse" />
                          </div>
                          <div className="h-[26px] w-[100px] bg-gray-100 rounded-md animate-pulse" />
                        </div>
                      ))
                    ) : backups.length > 0 ? (
                      backups.map((backup) => (
                        <div
                          key={backup.id}
                          className={`flex items-center justify-between p-3 transition-colors first:rounded-t-lg last:rounded-b-lg ${
                            backupToRestore === backup.id
                              ? "bg-blue-50"
                              : ""
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div>
                              <div className="text-sm font-normal text-gray-900 flex items-center gap-2">
                                {backup.label} (v
                                {backup.version})
                                {backupToRestore ===
                                  backup.id && (
                                  <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">
                                    Выбрано
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5">
                                {new Date(
                                  backup.timestamp,
                                ).toLocaleString()}{" "}
                                •{" "}
                                {Math.round(backup.size / 1024)}{" "}
                                KB
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() =>
                              setBackupToRestore((prev) =>
                                prev === backup.id
                                  ? null
                                  : backup.id,
                              )
                            }
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                              backupToRestore === backup.id
                                ? "bg-blue-600 text-white"
                                : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300"
                            }`}
                          >
                            {backupToRestore === backup.id
                              ? "Отменить"
                              : "Восстаноить"}
                          </button>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-gray-500 text-center py-4">
                        Нет доступных копий
                      </p>
                    )}
                  </div>

                  {backupToRestore && (
                    <div className="mt-3 flex items-start gap-2 p-3 bg-amber-50 text-amber-800 rounded-lg text-xs border border-amber-100">
                      <CheckCircle2 className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      <p>
                        Выбрана версия для восстановления.
                        Текущие события воркспейса будут{" "}
                        <strong>полностью заменены</strong>{" "}
                        данными из этой резервной копии после
                        нажатия кнопки "Сохранить".
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 bg-white rounded-b-xl">
          <button
            onClick={handleSave}
            disabled={isSaving || isLoading}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 min-w-[110px] justify-center"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>
                  {backupToRestore
                    ? "Восстановление..."
                    : "Сохранить"}
                </span>
              </>
            ) : (
              "Сохранить"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}