import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Grade, Company } from '../../types/scheduler';
import { TextInput, SelectInput, FormField } from './management/SharedInputs';
import { Trash2 } from 'lucide-react';

interface WorkspaceSettingsContentProps {
  workspaceName: string;
  workspaceYear: number;
  grades: Grade[];
  companies: Company[];
  onUpdateWorkspaceName: (name: string) => Promise<void>;
  onUpdateWorkspaceYear: (year: number) => Promise<void>;
  onCreateGrade: (name: string) => Promise<void>;
  onUpdateGrade: (gradeId: string, name: string) => Promise<void>;
  onDeleteGrade: (gradeId: string) => Promise<void>;
  onCreateCompany: (name: string) => Promise<void>;
  onUpdateCompany: (companyId: string, name: string) => Promise<void>;
  onDeleteCompany: (companyId: string) => Promise<void>;
  onHasChanges: (hasChanges: boolean) => void;
  onClose: () => void;
}

interface LocalNewGrade {
  tempId: string;
  name: string;
}

interface LocalNewCompany {
  tempId: string;
  name: string;
}

export interface WorkspaceSettingsHandle {
  onAdd: () => void;
}

export const WorkspaceSettingsContent = forwardRef<WorkspaceSettingsHandle, WorkspaceSettingsContentProps>(({
  workspaceName,
  workspaceYear,
  grades,
  companies,
  onUpdateWorkspaceName,
  onUpdateWorkspaceYear,
  onCreateGrade,
  onUpdateGrade,
  onDeleteGrade,
  onCreateCompany,
  onUpdateCompany,
  onDeleteCompany,
  onHasChanges,
  onClose
}, ref) => {
  const [localName, setLocalName] = useState(workspaceName);
  const [localYear, setLocalYear] = useState(workspaceYear);
  
  const [editingGrades, setEditingGrades] = useState<Record<string, string>>({});
  const [localNewGrades, setLocalNewGrades] = useState<LocalNewGrade[]>([]);
  const [deletedGradeIds, setDeletedGradeIds] = useState<string[]>([]);
  
  const [editingCompanies, setEditingCompanies] = useState<Record<string, string>>({});
  const [localNewCompanies, setLocalNewCompanies] = useState<LocalNewCompany[]>([]);
  const [deletedCompanyIds, setDeletedCompanyIds] = useState<string[]>([]);

  useImperativeHandle(ref, () => ({
    onAdd: () => {} // Добавление через кнопку неактуально для этой вкладки
  }));

  // Initialize editing state
  useEffect(() => {
    setLocalName(workspaceName);
    setLocalYear(workspaceYear);
    
    const gradesState: Record<string, string> = {};
    grades.forEach(g => {
      gradesState[g.id] = g.name;
    });
    setEditingGrades(gradesState);
    setLocalNewGrades([]);
    setDeletedGradeIds([]);
    
    const companiesState: Record<string, string> = {};
    companies.forEach(c => {
      companiesState[c.id] = c.name;
    });
    setEditingCompanies(companiesState);
    setLocalNewCompanies([]);
    setDeletedCompanyIds([]);
  }, [workspaceName, workspaceYear, grades, companies]);

  // Track changes
  useEffect(() => {
    const hasNameChange = localName !== workspaceName;
    const hasYearChange = localYear !== workspaceYear;
    
    const hasNewGrades = localNewGrades.length > 0;
    const hasDeletedGrades = deletedGradeIds.length > 0;
    let hasGradeChanges = false;
    for (const gradeId in editingGrades) {
      const original = grades.find(g => g.id === gradeId);
      if (original && editingGrades[gradeId] !== original.name) {
        hasGradeChanges = true;
        break;
      }
    }
    
    const hasNewCompanies = localNewCompanies.length > 0;
    const hasDeletedCompanies = deletedCompanyIds.length > 0;
    let hasCompanyChanges = false;
    for (const companyId in editingCompanies) {
      const original = companies.find(c => c.id === companyId);
      if (original && editingCompanies[companyId] !== original.name) {
        hasCompanyChanges = true;
        break;
      }
    }
    
    onHasChanges(
      hasNameChange || hasYearChange || 
      hasNewGrades || hasDeletedGrades || hasGradeChanges ||
      hasNewCompanies || hasDeletedCompanies || hasCompanyChanges
    );
  }, [localName, localYear, editingGrades, localNewGrades, deletedGradeIds, editingCompanies, localNewCompanies, deletedCompanyIds, workspaceName, workspaceYear, grades, companies, onHasChanges]);

  const handleAddGrade = () => {
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    setLocalNewGrades(prev => [...prev, { tempId, name: '' }]);
  };

  const handleAddCompany = () => {
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    setLocalNewCompanies(prev => [...prev, { tempId, name: '' }]);
  };

  const handleSave = async () => {
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
      }
      
      // Create new grades
      const validNewGrades = localNewGrades.filter(g => g.name.trim());
      if (validNewGrades.length > 0) {
        await Promise.all(validNewGrades.map(g => onCreateGrade(g.name.trim())));
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
      }
      
      // Delete companies
      if (deletedCompanyIds.length > 0) {
        await Promise.all(deletedCompanyIds.map(id => onDeleteCompany(id)));
      }
      
      // Create new companies
      const validNewCompanies = localNewCompanies.filter(c => c.name.trim());
      if (validNewCompanies.length > 0) {
        await Promise.all(validNewCompanies.map(c => onCreateCompany(c.name.trim())));
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
      }
      
      onClose();
    } catch (error) {
      console.error('❌ Ошибка при сохранении настроек:', error);
      alert('Ошибка при сохранении настроек');
    }
  };

  const visibleGrades = grades.filter(g => !deletedGradeIds.includes(g.id));
  const visibleCompanies = companies.filter(c => !deletedCompanyIds.includes(c.id));

  return (
    <>
      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="space-y-6 max-w-2xl">
          {/* Workspace Settings Section */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Настройки воркспейса</h3>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Название" required>
                <TextInput
                  value={localName}
                  onChange={e => setLocalName(e.target.value)}
                  placeholder="Планирование 2024"
                />
              </FormField>
              
              <FormField label="Год" required>
                <SelectInput
                  value={localYear}
                  onChange={e => setLocalYear(parseInt(e.target.value))}
                >
                  {Array.from({ length: 11 }, (_, i) => 2020 + i).map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </SelectInput>
              </FormField>
            </div>
          </div>

          {/* Grades Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Грейды</h3>
              <button
                onClick={handleAddGrade}
                className="px-2.5 py-1 text-xs bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors font-medium"
              >
                + Добавить
              </button>
            </div>
            
            <div className="space-y-1.5">
              {/* New grades */}
              {localNewGrades.map(grade => (
                <div key={grade.tempId} className="flex items-center gap-2 p-2 bg-blue-50/50 rounded-lg border border-blue-200">
                  <TextInput
                    value={grade.name}
                    onChange={e => {
                      setLocalNewGrades(prev => prev.map(g =>
                        g.tempId === grade.tempId ? { ...g, name: e.target.value } : g
                      ));
                    }}
                    placeholder="Название грейда"
                    className="flex-1"
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
              {visibleGrades.map(grade => (
                <div key={grade.id} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-gray-200">
                  <TextInput
                    value={editingGrades[grade.id] || ''}
                    onChange={e => {
                      setEditingGrades(prev => ({
                        ...prev,
                        [grade.id]: e.target.value
                      }));
                    }}
                    placeholder="Название грейда"
                    className="flex-1"
                  />
                  <button
                    onClick={() => {
                      if (confirm(`Удалить грейд "${grade.name}"?\n\nУдаление будет выполнено после нажатия "Сохранить".`)) {
                        setDeletedGradeIds(prev => [...prev, grade.id]);
                      }
                    }}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                    title="Удалить"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              
              {visibleGrades.length === 0 && localNewGrades.length === 0 && (
                <p className="text-xs text-gray-500 text-center py-3">
                  Нет грейдов
                </p>
              )}
            </div>
          </div>

          {/* Companies Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Компании</h3>
              <button
                onClick={handleAddCompany}
                className="px-2.5 py-1 text-xs bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors font-medium"
              >
                + Добавить
              </button>
            </div>
            
            <div className="space-y-1.5">
              {/* New companies */}
              {localNewCompanies.map(company => (
                <div key={company.tempId} className="flex items-center gap-2 p-2 bg-blue-50/50 rounded-lg border border-blue-200">
                  <TextInput
                    value={company.name}
                    onChange={e => {
                      setLocalNewCompanies(prev => prev.map(c =>
                        c.tempId === company.tempId ? { ...c, name: e.target.value } : c
                      ));
                    }}
                    placeholder="Название компании"
                    className="flex-1"
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
              {visibleCompanies.map(company => (
                <div key={company.id} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-gray-200">
                  <TextInput
                    value={editingCompanies[company.id] || ''}
                    onChange={e => {
                      setEditingCompanies(prev => ({
                        ...prev,
                        [company.id]: e.target.value
                      }));
                    }}
                    placeholder="Название компании"
                    className="flex-1"
                  />
                  <button
                    onClick={() => {
                      if (confirm(`Удалить компанию "${company.name}"?\n\nУдаление будет выполнено после нажатия "Сохранить".`)) {
                        setDeletedCompanyIds(prev => [...prev, company.id]);
                      }
                    }}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                    title="Удалить"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              
              {visibleCompanies.length === 0 && localNewCompanies.length === 0 && (
                <p className="text-xs text-gray-500 text-center py-3">
                  Нет компаний
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t bg-gray-50 px-6 py-4 flex items-center justify-end gap-3">
        <button
          onClick={handleSave}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Сохранить
        </button>
      </div>
    </>
  );
});

WorkspaceSettingsContent.displayName = 'WorkspaceSettingsContent';