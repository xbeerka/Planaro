import { useState, useEffect, useRef } from 'react';
import { Department } from '../../types/scheduler';
import { ManagementModalHeader } from './ManagementModalHeader';

interface DepartmentsManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  departments: Department[];
  onRenameDepartment: (deptId: string, newName: string) => void;
  onReorderDepartments: (newOrder: Department[]) => void;
  onToggleDepartmentVisibility: (deptId: string) => void;
  onCreateDepartment: (name: string) => Promise<void>;
  onDeleteDepartment: (deptId: string) => Promise<void>;
  onGetDepartmentUsersCount: (deptId: string) => Promise<number>;
}

interface LocalDepartment extends Department {
  displayName: string;
  usersCount?: number;
}

interface LocalNewDepartment {
  tempId: string;
  name: string;
}

export function DepartmentsManagementModal({
  isOpen,
  onClose,
  departments,
  onRenameDepartment,
  onReorderDepartments,
  onToggleDepartmentVisibility,
  onCreateDepartment,
  onDeleteDepartment,
  onGetDepartmentUsersCount
}: DepartmentsManagementModalProps) {
  // Local state for all changes (only applied on Save)
  const [localDepartments, setLocalDepartments] = useState<LocalDepartment[]>([]);
  const [localNewDepartments, setLocalNewDepartments] = useState<LocalNewDepartment[]>([]);
  const [deletedDeptIds, setDeletedDeptIds] = useState<string[]>([]);
  const [isLoadingCounts, setIsLoadingCounts] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Initialize local state when modal opens or departments change
  useEffect(() => {
    if (isOpen) {
      // Sort departments by queue (same as in calendar)
      const sortedDepartments = [...departments].sort((a, b) => {
        const queueA = a.queue || 999;
        const queueB = b.queue || 999;
        return queueA - queueB;
      });
      
      setLocalDepartments(
        sortedDepartments.map(dept => ({
          ...dept,
          displayName: dept.name,
          usersCount: undefined
        }))
      );
      
      setLocalNewDepartments([]);
      setDeletedDeptIds([]);
      setHasChanges(false);
      
      // Load users count for all departments
      loadUsersCounts(sortedDepartments);
    }
  }, [isOpen, departments]);

  // Check if there are unsaved changes
  useEffect(() => {
    if (!isOpen) return;

    // Check if there are new departments
    const hasNewDepts = localNewDepartments.length > 0;

    // Check if there are deleted departments
    const hasDeletedDepts = deletedDeptIds.length > 0;

    // Check if existing departments have changes
    let hasExistingChanges = false;
    
    // Check for renames or visibility changes
    for (const localDept of localDepartments) {
      const originalDept = departments.find(d => d.id === localDept.id);
      if (originalDept && (
        localDept.displayName !== originalDept.name ||
        localDept.visible !== originalDept.visible
      )) {
        hasExistingChanges = true;
        break;
      }
    }

    // Check for reorder
    if (!hasExistingChanges) {
      const originalOrder = [...departments]
        .filter(d => !deletedDeptIds.includes(d.id))
        .sort((a, b) => {
          const queueA = a.queue || 999;
          const queueB = b.queue || 999;
          return queueA - queueB;
        }).map(d => d.id);
      
      const currentOrder = localDepartments.map(d => d.id);
      
      if (JSON.stringify(originalOrder) !== JSON.stringify(currentOrder)) {
        hasExistingChanges = true;
      }
    }

    setHasChanges(hasNewDepts || hasDeletedDepts || hasExistingChanges);
  }, [isOpen, localNewDepartments, deletedDeptIds, localDepartments, departments]);

  if (!isOpen) return null;

  const loadUsersCounts = async (depts: Department[]) => {
    setIsLoadingCounts(true);
    try {
      const counts = await Promise.all(
        depts.map(dept => onGetDepartmentUsersCount(dept.id))
      );
      
      setLocalDepartments(prev => prev.map((dept, idx) => ({
        ...dept,
        usersCount: counts[idx]
      })));
    } catch (error) {
      console.error('Ошибка загрузки количества сотрудников:', error);
    } finally {
      setIsLoadingCounts(false);
    }
  };

  const handleAddNewDepartment = () => {
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    setLocalNewDepartments(prev => [...prev, {
      tempId,
      name: ''
    }]);
  };

  const handleNewDepartmentChange = (tempId: string, value: string) => {
    setLocalNewDepartments(prev => prev.map(d =>
      d.tempId === tempId ? { ...d, name: value } : d
    ));
  };

  const handleDeleteNewDepartment = (tempId: string) => {
    setLocalNewDepartments(prev => prev.filter(d => d.tempId !== tempId));
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    
    const deptId = localDepartments[index].id;
    const itemElement = itemRefs.current.get(deptId);
    const scrollContainer = contentRef.current;
    
    // Capture current position before reorder
    const itemTopBefore = itemElement?.offsetTop || 0;
    const scrollTopBefore = scrollContainer?.scrollTop || 0;
    
    const newDepartments = [...localDepartments];
    [newDepartments[index], newDepartments[index - 1]] = [newDepartments[index - 1], newDepartments[index]];
    setLocalDepartments(newDepartments);
    
    // After state update, calculate new scroll position
    requestAnimationFrame(() => {
      if (!itemElement || !scrollContainer) return;
      
      const itemTopAfter = itemElement.offsetTop;
      const scrollDelta = itemTopAfter - itemTopBefore;
      
      // Scroll to keep item in same visual position
      scrollContainer.scrollTo({
        top: scrollTopBefore + scrollDelta,
        behavior: 'smooth'
      });
    });
  };

  const handleMoveDown = (index: number) => {
    if (index === localDepartments.length - 1) return;
    
    const deptId = localDepartments[index].id;
    const itemElement = itemRefs.current.get(deptId);
    const scrollContainer = contentRef.current;
    
    // Capture current position before reorder
    const itemTopBefore = itemElement?.offsetTop || 0;
    const scrollTopBefore = scrollContainer?.scrollTop || 0;
    
    const newDepartments = [...localDepartments];
    [newDepartments[index], newDepartments[index + 1]] = [newDepartments[index + 1], newDepartments[index]];
    setLocalDepartments(newDepartments);
    
    // After state update, calculate new scroll position
    requestAnimationFrame(() => {
      if (!itemElement || !scrollContainer) return;
      
      const itemTopAfter = itemElement.offsetTop;
      const scrollDelta = itemTopAfter - itemTopBefore;
      
      // Scroll to keep item in same visual position
      scrollContainer.scrollTo({
        top: scrollTopBefore + scrollDelta,
        behavior: 'smooth'
      });
    });
  };

  const handleDeleteDepartment = (deptId: string) => {
    const dept = localDepartments.find(d => d.id === deptId);
    if (!dept) return;
    
    if (!confirm(
      `Удалить департамент "${dept.displayName}"?\n\n` +
      `Удаление будет выполнено после нажатия "Сохранить".`
    )) {
      return;
    }
    
    // Mark for deletion (remove from local state and add to deletion list)
    setDeletedDeptIds(prev => [...prev, deptId]);
    setLocalDepartments(prev => prev.filter(d => d.id !== deptId));
  };

  const handleSave = async () => {
    try {
      // Step 1: Delete departments
      if (deletedDeptIds.length > 0) {
        console.log(`🗑️ Удаление ${deletedDeptIds.length} департаментов...`);
        await Promise.all(
          deletedDeptIds.map(id => onDeleteDepartment(id))
        );
        console.log(`✅ ${deletedDeptIds.length} департаментов удалено`);
      }

      // Step 2: Create new departments (only those with valid names)
      const validNewDepartments = localNewDepartments.filter(d => d.name.trim());
      if (validNewDepartments.length > 0) {
        console.log(`💾 Создание ${validNewDepartments.length} новых департаментов...`);
        await Promise.all(
          validNewDepartments.map(d => onCreateDepartment(d.name.trim()))
        );
        console.log(`✅ ${validNewDepartments.length} новых департаментов сохранено`);
      }

      // Step 3: Collect all update operations to execute in parallel
      const updatePromises: Promise<void>[] = [];
      
      localDepartments.forEach((localDept) => {
        const originalDept = departments.find(d => d.id === localDept.id);
        
        // Apply rename if changed
        if (originalDept && localDept.displayName !== originalDept.name) {
          updatePromises.push(
            Promise.resolve(onRenameDepartment(localDept.id, localDept.displayName))
          );
        }
        
        // Apply visibility toggle if changed
        if (originalDept && localDept.visible !== originalDept.visible) {
          updatePromises.push(
            Promise.resolve(onToggleDepartmentVisibility(localDept.id))
          );
        }
      });
      
      // Execute all updates in parallel
      if (updatePromises.length > 0) {
        console.log(`💾 Сохранение ${updatePromises.length} изменений департаментов параллельно...`);
        await Promise.all(updatePromises);
        console.log(`✅ Все ${updatePromises.length} изменений сохранены`);
      }
      
      // Step 4: Apply reorder - convert local departments back to regular departments
      const reorderedDepartments: Department[] = localDepartments.map(({ displayName, usersCount, ...dept }) => ({
        ...dept,
        name: displayName
      }));
      onReorderDepartments(reorderedDepartments);
      
      onClose();
    } catch (error) {
      console.error('❌ Ошибка при сохранении департаментов:', error);
      alert('Ошибка при сохранении департаментов');
    }
  };

  const handleCancel = () => {
    if (hasChanges) {
      const confirmed = window.confirm('У вас есть несохраненные изменения. Вы уверены, что хотите закрыть?');
      if (!confirmed) return;
    }

    // Reset local state
    setLocalDepartments(
      departments.map(dept => ({
        ...dept,
        displayName: dept.name,
        usersCount: undefined
      }))
    );
    setLocalNewDepartments([]);
    setDeletedDeptIds([]);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/50"
      onClick={handleCancel}
    >
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <ManagementModalHeader
          title="Управление департаментами"
          onAdd={handleAddNewDepartment}
          addButtonLabel="Добавить департамент"
          onClose={handleCancel}
        />

        {/* Content */}
        <div 
          ref={contentRef}
          className="flex-1 overflow-y-auto p-6"
        >
          <div className="space-y-3">
            {/* New departments */}
            {localNewDepartments.map(newDept => (
              <div key={newDept.tempId} className="gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    
                    <input
                      type="text"
                      value={newDept.name}
                      onChange={e => handleNewDepartmentChange(newDept.tempId, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Разработка"
                      autoFocus
                    />
                  </div>
                  <div className="">
                    <button
                      onClick={() => handleDeleteNewDepartment(newDept.tempId)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Удалить строку"
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
                        <path d="M3 6h18" />
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* Existing departments */}
            {localDepartments.map((dept, index) => (
              <div 
                key={dept.id}
                ref={(el) => {
                  if (el) itemRefs.current.set(dept.id, el);
                  else itemRefs.current.delete(dept.id);
                }}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
              >
                {/* Move buttons */}
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0}
                    className={`p-1 rounded transition-colors ${
                      index === 0 
                        ? 'text-gray-300 cursor-not-allowed' 
                        : 'text-gray-600 hover:bg-gray-200'
                    }`}
                    title="Переместить вверх"
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
                    >
                      <path d="m18 15-6-6-6 6" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleMoveDown(index)}
                    disabled={index === localDepartments.length - 1}
                    className={`p-1 rounded transition-colors ${
                      index === localDepartments.length - 1
                        ? 'text-gray-300 cursor-not-allowed'
                        : 'text-gray-600 hover:bg-gray-200'
                    }`}
                    title="Переместить вниз"
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
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>
                </div>

                {/* Department name input */}
                <div className="flex-1">
                  <input
                    type="text"
                    value={dept.displayName}
                    onChange={e => {
                      const newName = e.target.value;
                      setLocalDepartments(prev => prev.map(d => 
                        d.id === dept.id ? { ...d, displayName: newName } : d
                      ));
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Название департамента"
                  />
                </div>

                {/* Users count */}
                <div className="text-sm text-gray-500 min-w-[80px] text-right">
                  {isLoadingCounts ? (
                    <span className="text-gray-400">...</span>
                  ) : (
                    <span>
                      {dept.usersCount ?? '?'} сотр.
                    </span>
                  )}
                </div>

                {/* Visibility toggle */}
                <button
                  onClick={() => {
                    setLocalDepartments(prev => prev.map(d =>
                      d.id === dept.id ? { ...d, visible: !d.visible } : d
                    ));
                  }}
                  className={`p-2 rounded-lg transition-colors ${
                    dept.visible
                      ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                      : 'text-gray-400 bg-gray-100 hover:bg-gray-200'
                  }`}
                  title={dept.visible ? 'Скрыть департамент' : 'Показать департамент'}
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
                    {dept.visible ? (
                      <>
                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                        <circle cx="12" cy="12" r="3" />
                      </>
                    ) : (
                      <>
                        <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                        <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                        <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                        <line x1="2" x2="22" y1="2" y2="22" />
                      </>
                    )}
                  </svg>
                </button>

                {/* Delete button */}
                <button
                  onClick={() => handleDeleteDepartment(dept.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Удалить департамент"
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
                    <path d="M3 6h18" />
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                  </svg>
                </button>
              </div>
            ))}

            {localDepartments.length === 0 && localNewDepartments.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <p>Нет департаментов</p>
                <p className="text-sm mt-2">Нажмите "Добавить департамент" для создания</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t bg-gray-50">
          <div className="text-sm text-gray-600">
            {hasChanges && (
              <span className="flex items-center gap-2 text-orange-600">
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
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4" />
                  <path d="M12 8h.01" />
                </svg>
                Есть несохраненные изменения
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors font-medium"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!hasChanges}
              className={`px-4 py-2 rounded-lg transition-colors font-medium ${
                hasChanges
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              Сохранить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}