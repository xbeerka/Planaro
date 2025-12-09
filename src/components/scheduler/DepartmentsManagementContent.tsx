import { useState, useEffect, useRef, useMemo } from 'react';
import { Department } from '../../types/scheduler';
import { Search } from 'lucide-react';

interface DepartmentsManagementContentProps {
  departments: Department[];
  onRenameDepartment: (deptId: string, newName: string) => void;
  onReorderDepartments: (newOrder: Department[]) => Promise<void>;
  onToggleDepartmentVisibility: (deptId: string) => void;
  onCreateDepartment: (name: string) => Promise<void>;
  onDeleteDepartment: (deptId: string) => Promise<void>;
  onGetDepartmentUsersCount: (deptId: string) => Promise<number>;
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

export function DepartmentsManagementContent({
  departments,
  onRenameDepartment,
  onReorderDepartments,
  onToggleDepartmentVisibility,
  onCreateDepartment,
  onDeleteDepartment,
  onGetDepartmentUsersCount,
  onHasChanges,
  onClose
}: DepartmentsManagementContentProps) {
  const [localDepartments, setLocalDepartments] = useState<LocalDepartment[]>([]);
  const [localNewDepartments, setLocalNewDepartments] = useState<LocalNewDepartment[]>([]);
  const [deletedDeptIds, setDeletedDeptIds] = useState<string[]>([]);
  const [isLoadingCounts, setIsLoadingCounts] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const contentRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Initialize local state
  useEffect(() => {
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
    
    loadUsersCounts(sortedDepartments);
  }, [departments]);

  // Track changes
  useEffect(() => {
    const hasNewDepts = localNewDepartments.length > 0;
    const hasDeletedDepts = deletedDeptIds.length > 0;

    let hasExistingChanges = false;
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

    onHasChanges(hasNewDepts || hasDeletedDepts || hasExistingChanges);
  }, [localNewDepartments, deletedDeptIds, localDepartments, departments, onHasChanges]);

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
    
    setTimeout(() => {
      if (contentRef.current) {
        contentRef.current.scrollTop = 0;
      }
    }, 50);
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
    
    const itemTopBefore = itemElement?.offsetTop || 0;
    const scrollTopBefore = scrollContainer?.scrollTop || 0;
    
    const newDepartments = [...localDepartments];
    [newDepartments[index], newDepartments[index - 1]] = [newDepartments[index - 1], newDepartments[index]];
    setLocalDepartments(newDepartments);
    
    requestAnimationFrame(() => {
      if (!itemElement || !scrollContainer) return;
      
      const itemTopAfter = itemElement.offsetTop;
      const scrollDelta = itemTopAfter - itemTopBefore;
      
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
    
    const itemTopBefore = itemElement?.offsetTop || 0;
    const scrollTopBefore = scrollContainer?.scrollTop || 0;
    
    const newDepartments = [...localDepartments];
    [newDepartments[index], newDepartments[index + 1]] = [newDepartments[index + 1], newDepartments[index]];
    setLocalDepartments(newDepartments);
    
    requestAnimationFrame(() => {
      if (!itemElement || !scrollContainer) return;
      
      const itemTopAfter = itemElement.offsetTop;
      const scrollDelta = itemTopAfter - itemTopBefore;
      
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
    
    setDeletedDeptIds(prev => [...prev, deptId]);
    setLocalDepartments(prev => prev.filter(d => d.id !== deptId));
  };

  // Filter departments by search query
  const visibleDepartments = useMemo(() => {
    if (!searchQuery.trim()) return localDepartments;
    
    const query = searchQuery.toLowerCase().trim();
    return localDepartments.filter(dept =>
      dept.displayName.toLowerCase().includes(query)
    );
  }, [localDepartments, searchQuery]);

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

      // Step 2: Create new departments
      const validNewDepartments = localNewDepartments.filter(d => d.name.trim());
      if (validNewDepartments.length > 0) {
        console.log(`💾 Создание ${validNewDepartments.length} новых департаментов...`);
        await Promise.all(
          validNewDepartments.map(d => onCreateDepartment(d.name.trim()))
        );
        console.log(`✅ ${validNewDepartments.length} новых департаментов сохранено`);
      }

      // Step 3: Update existing departments
      const updatePromises: Promise<void>[] = [];
      
      localDepartments.forEach((localDept) => {
        const originalDept = departments.find(d => d.id === localDept.id);
        
        if (originalDept && localDept.displayName !== originalDept.name) {
          updatePromises.push(
            Promise.resolve(onRenameDepartment(localDept.id, localDept.displayName))
          );
        }
        
        if (originalDept && localDept.visible !== originalDept.visible) {
          updatePromises.push(
            Promise.resolve(onToggleDepartmentVisibility(localDept.id))
          );
        }
      });
      
      if (updatePromises.length > 0) {
        console.log(`💾 Сохранение ${updatePromises.length} изменений департаментов параллельно...`);
        await Promise.all(updatePromises);
        console.log(`✅ Все ${updatePromises.length} изменений сохранены`);
      }
      
      // Step 4: Apply reorder
      const reorderedDepartments: Department[] = localDepartments.map(({ displayName, usersCount, ...dept }) => ({
        ...dept,
        name: displayName
      }));
      await onReorderDepartments(reorderedDepartments);
      
      onClose();
    } catch (error) {
      console.error('❌ Ошибка при сохранении департаментов:', error);
      alert('Ошибка при сохранении департаментов');
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
              <div aria-hidden="true" className="absolute border-[0.8px] border-[rgba(0,0,0,0.12)] border-solid inset-0 pointer-events-none rounded-[12px]" />
              <Search className="ml-3 w-4 h-4 text-gray-400 shrink-0" />
              <input
                type="text"
                placeholder="Поиск департаментов..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 py-2 pr-3 bg-transparent border-none focus:outline-none text-[14px]"
              />
            </div>
          </div>
          
          <button
            onClick={handleAddNewDepartment}
            className="px-4 py-2 bg-blue-600 text-white rounded-[12px] hover:bg-blue-700 transition-colors font-medium text-[14px]"
          >
            Департамент
          </button>
        </div>
      </div>

      {/* Content */}
      <div 
        ref={contentRef}
        className="flex-1 overflow-y-auto px-0 py-4"
      >
        <div className="space-y-0">
          {/* New departments */}
          {localNewDepartments.map(newDept => (
            <div key={newDept.tempId} className="px-6 py-4 border-b border-gray-200 bg-blue-50">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <input
                    type="text"
                    value={newDept.name}
                    onChange={e => handleNewDepartmentChange(newDept.tempId, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-[14px]"
                    placeholder="Название департамента"
                    autoFocus
                  />
                </div>
                <button
                  onClick={() => handleDeleteNewDepartment(newDept.tempId)}
                  className="flex-shrink-0 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
          ))}

          {/* Existing departments */}
          {visibleDepartments.map((dept, index) => {
            const originalIndex = localDepartments.findIndex(d => d.id === dept.id);
            return (
            <div 
              key={dept.id}
              ref={(el) => {
                if (el) itemRefs.current.set(dept.id, el);
                else itemRefs.current.delete(dept.id);
              }}
              className="px-6 py-4 border-b border-gray-200 bg-white hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                {/* Move buttons */}
                <div className="flex flex-col gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleMoveUp(originalIndex)}
                    disabled={originalIndex === 0}
                    className={`p-1 rounded transition-colors ${
                      originalIndex === 0 
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
                    onClick={() => handleMoveDown(originalIndex)}
                    disabled={originalIndex === localDepartments.length - 1}
                    className={`p-1 rounded transition-colors ${
                      originalIndex === localDepartments.length - 1
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-[14px]"
                    placeholder="Название департамента"
                  />
                </div>

                {/* Users count */}
                <div className="text-sm text-gray-500 min-w-[80px] text-right flex-shrink-0">
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
                  className={`flex-shrink-0 p-2 rounded-lg transition-colors ${
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
                  className="flex-shrink-0 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
            </div>
          );
          })}

          {visibleDepartments.length === 0 && localNewDepartments.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <p>Нет департаментов</p>
              <p className="text-sm mt-2">
                {searchQuery 
                  ? 'Попробуйте изменить поисковый запрос'
                  : 'Нажмите "+ Департамент" для создания'
                }
              </p>
            </div>
          )}
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
}