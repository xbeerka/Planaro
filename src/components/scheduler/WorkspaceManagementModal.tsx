import { useState, useEffect } from 'react';
import { Grade, Company, Resource } from '../../types/scheduler';
import { Trash2, Loader2, GripVertical } from 'lucide-react';

interface WorkspaceManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLoading?: boolean;
  
  // Resources for validation
  resources: Resource[];
  
  // Workspace props
  workspaceName: string;
  workspaceYear: number;
  onUpdateWorkspaceName: (name: string) => Promise<void>;
  onUpdateWorkspaceYear: (year: number) => Promise<void>;
  
  // Grades props
  grades: Grade[];
  onCreateGrade: (name: string) => Promise<void>;
  onUpdateGrade: (gradeId: string, name: string) => Promise<void>;
  onDeleteGrade: (gradeId: string) => Promise<void>;
  onUpdateGradesSortOrder?: (updates: Array<{ id: string; sortOrder: number }>) => Promise<void>;
  onGradesUpdated?: () => Promise<void>;
  
  // Companies props
  companies: Company[];
  onCreateCompany: (name: string) => Promise<void>;
  onUpdateCompany: (companyId: string, name: string) => Promise<void>;
  onDeleteCompany: (companyId: string) => Promise<void>;
  onUpdateCompaniesSortOrder?: (updates: Array<{ id: string; sortOrder: number }>) => Promise<void>;
  onCompaniesUpdated?: () => Promise<void>;
  onResourcesUpdated?: () => Promise<void>; // ✅ Reload resources after company operations
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
  onResourcesUpdated, // ✅ Reload resources after company operations
  resources,
}: WorkspaceManagementModalProps) {
  const [localName, setLocalName] = useState(workspaceName);
  const [localYear, setLocalYear] = useState(workspaceYear);
  const [isSaving, setIsSaving] = useState(false);
  
  const [editingGrades, setEditingGrades] = useState<Record<string, string>>({});
  const [localNewGrades, setLocalNewGrades] = useState<LocalNewGrade[]>([]);
  const [deletedGradeIds, setDeletedGradeIds] = useState<string[]>([]);
  const [sortedGrades, setSortedGrades] = useState<Grade[]>([]);
  const [draggedGradeIndex, setDraggedGradeIndex] = useState<number | null>(null);
  const [dragOverGradeIndex, setDragOverGradeIndex] = useState<number | null>(null);
  
  const [editingCompanies, setEditingCompanies] = useState<Record<string, string>>({});
  const [localNewCompanies, setLocalNewCompanies] = useState<LocalNewCompany[]>([]);
  const [deletedCompanyIds, setDeletedCompanyIds] = useState<string[]>([]);
  const [sortedCompanies, setSortedCompanies] = useState<Company[]>([]);
  const [draggedCompanyIndex, setDraggedCompanyIndex] = useState<number | null>(null);
  const [dragOverCompanyIndex, setDragOverCompanyIndex] = useState<number | null>(null);

  // Initialize editing state
  useEffect(() => {
    if (isOpen) {
      // ✅ НЕ сбрасываем локальное состояние во время сохранения!
      // Это предотвращает "возврат" удаленных элементов из-за обновления пропсов
      if (isSaving) {
        return;
      }
      
      console.log('[SORT_GRADE] Modal Open, grades:', grades.map(g => `${g.name} (${g.id}) [order:${g.sort_order}]`).join(', '));
      
      setLocalName(workspaceName);
      setLocalYear(workspaceYear);
      
      const gradesState: Record<string, string> = {};
      grades.forEach(g => {
        gradesState[g.id] = g.name;
      });
      setEditingGrades(gradesState);
      setLocalNewGrades([]);
      setDeletedGradeIds([]);
      setSortedGrades([...grades]);
      
      const companiesState: Record<string, string> = {};
      companies.forEach(c => {
        companiesState[c.id] = c.name;
      });
      setEditingCompanies(companiesState);
      setLocalNewCompanies([]);
      setDeletedCompanyIds([]);
      setSortedCompanies([...companies]);
    }
  }, [isOpen, workspaceName, workspaceYear, grades, companies, isSaving]);

  if (!isOpen) return null;

  const handleAddGrade = () => {
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    setLocalNewGrades(prev => [...prev, { tempId, name: '' }]);
  };

  const handleAddCompany = () => {
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    setLocalNewCompanies(prev => [...prev, { tempId, name: '' }]);
  };

  // Drag and Drop handlers for Grades
  const handleGradeDragStart = (index: number) => {
    setDraggedGradeIndex(index);
  };

  const handleGradeDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedGradeIndex === null) return;
    
    // Устанавливаем drop зону
    setDragOverGradeIndex(index);
    
    // Переставляем только если это другой индекс
    if (draggedGradeIndex === index) return;
    
    const newSorted = [...sortedGrades];
    const draggedItem = newSorted[draggedGradeIndex];
    newSorted.splice(draggedGradeIndex, 1);
    newSorted.splice(index, 0, draggedItem);
    
    console.log('[SORT_GRADE] DragOver, new order:', newSorted.map(g => `${g.name} (${g.id})`).join(', '));
    
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

  const handleCompanyDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedCompanyIndex === null) return;
    
    // Устанавливаем drop зону
    setDragOverCompanyIndex(index);
    
    // Переставляем только если это другой индекс
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
        await Promise.all(deletedGradeIds.map(id => onDeleteGrade(id)));
        // ✅ Перезагрузка грейдов перенесена в конец (после всех операций)
      }
      
      // Create new grades
      const validNewGrades = localNewGrades.filter(g => g.name.trim());
      if (validNewGrades.length > 0) {
        await Promise.all(validNewGrades.map(g => onCreateGrade(g.name.trim())));
        // ✅ Перезагрузка грейдов перенесена в конец (после всех операций)
      }
      
      // Update existing grades
      const gradeUpdatePromises: Promise<void>[] = [];
      for (const gradeId in editingGrades) {
        const original = grades.find(g => g.id === gradeId);
        if (original && editingGrades[gradeId] !== original.name) {
          gradeUpdatePromises.push(onUpdateGrade(gradeId, editingGrades[gradeId]));
        }
      }
      if (gradeUpdatePromises.length > 0) {
        await Promise.all(gradeUpdatePromises);
        // ✅ Перезагрузка грейдов перенесена в конец (после всех операций)
      }
      
      // 1. Detect sort order changes for Grades
      const remainingOriginalGradeIds = grades
        .filter(g => !deletedGradeIds.includes(g.id))
        .map(g => g.id);
      const currentGradeIds = sortedGrades.map(g => g.id);
      const hasGradeOrderChanged = JSON.stringify(remainingOriginalGradeIds) !== JSON.stringify(currentGradeIds);

      console.log('[SORT_GRADE] Saving check:', {
        remainingOriginalGradeIds,
        currentGradeIds,
        hasGradeOrderChanged
      });

      // Update grades sort order (batch update)
      if (onUpdateGradesSortOrder && hasGradeOrderChanged) {
        const sortOrderUpdates = sortedGrades.map((grade, index) => ({
          id: grade.id,
          sortOrder: index
        }));
        console.log('[SORT_GRADE] Saving updates payload:', JSON.stringify(sortOrderUpdates, null, 2));
        try {
          await onUpdateGradesSortOrder(sortOrderUpdates);
        } catch (e) {
          console.error('[SORT_GRADE] Error updating sort order:', e);
          // Don't block other saves
        }
      }
      
      // Delete companies (сотрудники автоматически переназначаются на сервере)
      if (deletedCompanyIds.length > 0) {
        await Promise.all(deletedCompanyIds.map(id => onDeleteCompany(id)));
        // ✅ Перезагрузка компаний и ресурсов перенесена в конец (после всех операций)
      }
      
      // Create new companies
      const validNewCompanies = localNewCompanies.filter(c => c.name.trim());
      if (validNewCompanies.length > 0) {
        await Promise.all(validNewCompanies.map(c => onCreateCompany(c.name.trim())));
        // ✅ Перезагрузка компаний перенесена в конец (после всех операций)
      }
      
      // Update existing companies
      const companyUpdatePromises: Promise<void>[] = [];
      for (const companyId in editingCompanies) {
        const original = companies.find(c => c.id === companyId);
        if (original && editingCompanies[companyId] !== original.name) {
          companyUpdatePromises.push(onUpdateCompany(companyId, editingCompanies[companyId]));
        }
      }
      if (companyUpdatePromises.length > 0) {
        await Promise.all(companyUpdatePromises);
        // ✅ Перезагрузка компаний перенесена в конец (после всех операций)
      }
      
      // 2. Detect sort order changes for Companies
      const remainingOriginalCompanyIds = companies
        .filter(c => !deletedCompanyIds.includes(c.id))
        .map(c => c.id);
      const currentCompanyIds = sortedCompanies.map(c => c.id);
      const hasCompanyOrderChanged = JSON.stringify(remainingOriginalCompanyIds) !== JSON.stringify(currentCompanyIds);

      // Update companies sort order (batch update)
      if (onUpdateCompaniesSortOrder && hasCompanyOrderChanged) {
        const sortOrderUpdates = sortedCompanies.map((company, index) => ({
          id: company.id,
          sortOrder: index
        }));
        try {
          await onUpdateCompaniesSortOrder(sortOrderUpdates);
        } catch (e) {
          console.error('[SORT_COMPANY] Error updating sort order:', e);
          // Don't block other saves
        }
      }
      
      // ✅ Сначала закрываем модалку
      onClose();
      
      // ✅ ПОТОМ перезагружаем данные (модалка уже закрыта, useEffect не сработает)
      const hasGradeChanges = deletedGradeIds.length > 0 || 
                              validNewGrades.length > 0 || 
                              gradeUpdatePromises.length > 0 ||
                              hasGradeOrderChanged;
      
      const hasCompanyChanges = deletedCompanyIds.length > 0 || 
                                validNewCompanies.length > 0 || 
                                companyUpdatePromises.length > 0 ||
                                hasCompanyOrderChanged;
      
      // ✅ Перезагружаем грейды только при изменениях (НЕ при удалении)
      // Удаление грейдов уже обновляет локальный стейт в deleteGrade()
      if ((validNewGrades.length > 0 || gradeUpdatePromises.length > 0 || hasGradeOrderChanged) && onGradesUpdated) {
        await onGradesUpdated();
      }
      
      // ✅ Перезагружаем компании только при создании/обновлении (НЕ при удалении)
      // Удаление компаний уже обновляет локальный стейт в deleteCompany()
      if ((validNewCompanies.length > 0 || companyUpdatePromises.length > 0 || hasCompanyOrderChanged) && onCompaniesUpdated) {
        await onCompaniesUpdated();
      }
      
      // ✅ Перезагружаем ресурсы ВСЕГДА когда были изменения компаний (для переназначения)
      if (hasCompanyChanges && onResourcesUpdated) {
        await onResourcesUpdated();
      }
      
    } catch (error) {
      console.error('❌ Ошибка при сохранении настроек:', error);
      alert('Ошибка при сохранении настроек');
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
      deletedCompanyIds.length > 0;
    
    if (hasChanges) {
      const confirmed = window.confirm('У вас есть несохраненные изменения. Вы уверены, что хотите закрыть?');
      if (!confirmed) return;
    }
    
    onClose();
  };

  const visibleGrades = sortedGrades.filter(g => !deletedGradeIds.includes(g.id));
  const visibleCompanies = sortedCompanies.filter(c => !deletedCompanyIds.includes(c.id));

  return (
    <div 
      className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/40 backdrop-blur-sm transition-all"
      onClick={handleClose}
    >
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl h-[80vh] flex flex-col border border-gray-100/20"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-gray-100 bg-white rounded-t-xl px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Настройки</h2>
            <button
              onClick={handleClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
              title="Закрыть"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
              <p className="text-sm text-gray-500">Загрузка данных...</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-6">
              <div className="space-y-6">
                {/* Workspace Settings */}
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Настройки воркспейса</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1.5">Название</label>
                      <input
                        type="text"
                        value={localName}
                        onChange={e => setLocalName(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        placeholder="Планирование 2024"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs text-gray-600 mb-1.5">Год</label>
                      <select
                        value={localYear}
                        onChange={e => setLocalYear(parseInt(e.target.value))}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      >
                        {Array.from({ length: 11 }, (_, i) => 2020 + i).map(year => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Grades */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-gray-900">Грейды</h3>
                    <button
                      onClick={handleAddGrade}
                      className="px-2.5 py-1 text-xs bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors font-medium"
                    >
                      + Добавить
                    </button>
                  </div>
                  
                  <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
                    {/* New grades */}
                    {localNewGrades.map(grade => (
                      <div key={grade.tempId} className="flex items-center gap-2 p-3 bg-blue-50/30">
                        <input
                          type="text"
                          value={grade.name}
                          onChange={e => {
                            setLocalNewGrades(prev => prev.map(g =>
                              g.tempId === grade.tempId ? { ...g, name: e.target.value } : g
                            ));
                          }}
                          placeholder="Название грейда"
                          className="flex-1 px-3 py-1.5 bg-transparent border-none text-sm focus:outline-none placeholder:text-gray-400"
                        />
                        <button
                          onClick={() => {
                            setLocalNewGrades(prev => prev.filter(g => g.tempId !== grade.tempId));
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
                        onDragStart={() => handleGradeDragStart(index)}
                        onDragOver={(e) => handleGradeDragOver(e, index)}
                        onDragEnd={handleGradeDragEnd}
                        className={`flex items-center gap-2 p-3 transition-all duration-200 cursor-move group relative ${
                          draggedGradeIndex === index 
                            ? 'bg-blue-100/80 border border-blue-400 opacity-50 scale-[0.98] shadow-lg' 
                            : dragOverGradeIndex === index && draggedGradeIndex !== null
                            ? 'bg-blue-50/70 border-t-2 border-t-blue-500' 
                            : 'hover:bg-gray-50/80 border-t border-t-transparent'
                        }`}
                      >
                        <GripVertical className={`w-4 h-4 flex-shrink-0 transition-colors ${
                          draggedGradeIndex === index ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'
                        }`} />
                        <input
                          type="text"
                          value={editingGrades[grade.id] || ''}
                          onChange={e => {
                            setEditingGrades(prev => ({
                              ...prev,
                              [grade.id]: e.target.value
                            }));
                          }}
                          placeholder="Название грейда"
                          className="flex-1 px-3 py-1.5 bg-transparent border-none text-sm focus:outline-none placeholder:text-gray-400"
                        />
                        <button
                          onClick={() => {
                            if (confirm(`Удалить грейд "${grade.name}"?\n\nУдаление будет выполнено после нажатия "Сохранить".`)) {
                              setDeletedGradeIds(prev => [...prev, grade.id]);
                              setSortedGrades(prev => prev.filter(g => g.id !== grade.id));
                            }
                          }}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                          title="Удалить"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    
                    {visibleGrades.length === 0 && localNewGrades.length === 0 && (
                      <p className="text-xs text-gray-500 text-center py-4">
                        Нет грейдов
                      </p>
                    )}
                  </div>
                </div>

                {/* Companies */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-gray-900">Компании</h3>
                    <button
                      onClick={handleAddCompany}
                      className="px-2.5 py-1 text-xs bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors font-medium"
                    >
                      + Добавить
                    </button>
                  </div>
                  
                  <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
                    {/* New companies */}
                    {localNewCompanies.map(company => (
                      <div key={company.tempId} className="flex items-center gap-2 p-3 bg-blue-50/30">
                        <input
                          type="text"
                          value={company.name}
                          onChange={e => {
                            setLocalNewCompanies(prev => prev.map(c =>
                              c.tempId === company.tempId ? { ...c, name: e.target.value } : c
                            ));
                          }}
                          placeholder="Название компании"
                          className="flex-1 px-3 py-1.5 bg-transparent border-none text-sm focus:outline-none placeholder:text-gray-400"
                        />
                        <button
                          onClick={() => {
                            setLocalNewCompanies(prev => prev.filter(c => c.tempId !== company.tempId));
                          }}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                          title="Удалить"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    
                    {/* Existing companies */}
                    {visibleCompanies.map((company, index) => (
                      <div 
                        key={company.id} 
                        draggable
                        onDragStart={() => handleCompanyDragStart(index)}
                        onDragOver={(e) => handleCompanyDragOver(e, index)}
                        onDragEnd={handleCompanyDragEnd}
                        className={`flex items-center gap-2 p-3 transition-all duration-200 cursor-move group relative ${
                          draggedCompanyIndex === index 
                            ? 'bg-blue-100/80 border border-blue-400 opacity-50 scale-[0.98] shadow-lg' 
                            : dragOverCompanyIndex === index && draggedCompanyIndex !== null
                            ? 'bg-blue-50/70 border-t-2 border-t-blue-500' 
                            : 'hover:bg-gray-50/80 border-t border-t-transparent'
                        }`}
                      >
                        <GripVertical className={`w-4 h-4 flex-shrink-0 transition-colors ${
                          draggedCompanyIndex === index ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'
                        }`} />
                        <input
                          type="text"
                          value={editingCompanies[company.id] || ''}
                          onChange={e => {
                            setEditingCompanies(prev => ({
                              ...prev,
                              [company.id]: e.target.value
                            }));
                          }}
                          placeholder="Название компании"
                          className="flex-1 px-3 py-1.5 bg-transparent border-none text-sm focus:outline-none placeholder:text-gray-400"
                        />
                        <button
                          onClick={() => {
                            if (confirm(`Удалить компанию "${company.name}"?\n\nУдаление будет выполнено после нажатия "Сохранить".`)) {
                              setDeletedCompanyIds(prev => [...prev, company.id]);
                              setSortedCompanies(prev => prev.filter(c => c.id !== company.id));
                            }
                          }}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                          title="Удалить"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    
                    {visibleCompanies.length === 0 && localNewCompanies.length === 0 && (
                      <p className="text-xs text-gray-500 text-center py-4">
                        Нет компаний
                      </p>
                    )}
                  </div>
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
                <span>Сохранение...</span>
              </>
            ) : (
              'Сохранить'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}