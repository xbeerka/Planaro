import { useState, useEffect } from 'react';
import { Resource, Department, Grade, Company } from '../../types/scheduler';
import { ManagementModalHeader } from './ManagementModalHeader';

interface UsersManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  resources: Resource[];
  departments: Department[];
  grades: Grade[];
  companies: Company[];
  onCreateUser: (userData: { fullName: string; position: string; departmentId: string; grade?: string; companyId?: string }) => Promise<void>;
  onUpdateUser: (userId: string, userData: { fullName: string; position: string; departmentId: string; grade?: string; companyId?: string }) => Promise<void>;
  onDeleteUser: (userId: string) => Promise<void>;
  onResetHistory?: () => void; // Сброс истории после изменений
}

interface LocalNewUser {
  tempId: string;
  fullName: string;
  position: string;
  departmentId: string;
  grade: string;
  companyId: string;
}

export function UsersManagementModal({
  isOpen,
  onClose,
  resources,
  departments,
  grades,
  companies,
  onCreateUser,
  onUpdateUser,
  onDeleteUser,
  onResetHistory
}: UsersManagementModalProps) {
  const [editingUsers, setEditingUsers] = useState<Record<string, { fullName: string; position: string; departmentId: string; grade?: string; companyId?: string }>>({});
  const [localNewUsers, setLocalNewUsers] = useState<LocalNewUser[]>([]);
  const [deletedUserIds, setDeletedUserIds] = useState<string[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Initialize editing state with current resources
      const initialState: Record<string, { fullName: string; position: string; departmentId: string; grade?: string; companyId?: string }> = {};
      resources.forEach(r => {
        initialState[r.id] = {
          fullName: r.fullName,
          position: r.position,
          departmentId: r.departmentId,
          grade: r.grade || '',
          companyId: r.companyId || '1'
        };
      });
      setEditingUsers(initialState);
      setLocalNewUsers([]);
      setDeletedUserIds([]);
      setHasChanges(false);
    }
  }, [isOpen, resources, departments]);

  // Check if there are unsaved changes
  useEffect(() => {
    if (!isOpen) return;

    // Check if there are new users
    const hasNewUsers = localNewUsers.length > 0;

    // Check if there are deleted users
    const hasDeletedUsers = deletedUserIds.length > 0;

    // Check if existing users have changes
    let hasExistingChanges = false;
    for (const userId in editingUsers) {
      const editedData = editingUsers[userId];
      const originalData = resources.find(r => r.id === userId);
      
      if (originalData && (
        editedData.fullName !== originalData.fullName ||
        editedData.position !== originalData.position ||
        editedData.departmentId !== originalData.departmentId ||
        editedData.grade !== (originalData.grade || '') ||
        editedData.companyId !== (originalData.companyId || '1')
      )) {
        hasExistingChanges = true;
        break;
      }
    }

    setHasChanges(hasNewUsers || hasDeletedUsers || hasExistingChanges);
  }, [isOpen, localNewUsers, deletedUserIds, editingUsers, resources]);

  if (!isOpen) return null;

  const handleAddNewUser = () => {
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    setLocalNewUsers(prev => [...prev, {
      tempId,
      fullName: '',
      position: '',
      departmentId: departments[0]?.id || '',
      grade: '',
      companyId: '1'
    }]);
  };

  const handleNewUserChange = (tempId: string, field: string, value: string) => {
    setLocalNewUsers(prev => prev.map(u =>
      u.tempId === tempId ? { ...u, [field]: value } : u
    ));
  };

  const handleDeleteNewUser = (tempId: string) => {
    setLocalNewUsers(prev => prev.filter(u => u.tempId !== tempId));
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      // Step 1: Delete users
      if (deletedUserIds.length > 0) {
        console.log(`🗑️ Удаление ${deletedUserIds.length} сотрудников...`);
        await Promise.all(
          deletedUserIds.map(id => onDeleteUser(id))
        );
        console.log(`✅ ${deletedUserIds.length} сотрудников удалено`);
      }

      // Step 2: Create new users (only those with valid names)
      const validNewUsers = localNewUsers.filter(u => u.fullName.trim());
      if (validNewUsers.length > 0) {
        console.log(`💾 Создание ${validNewUsers.length} новых сотрудников...`);
        await Promise.all(
          validNewUsers.map(u => 
            onCreateUser({
              fullName: u.fullName,
              position: u.position,
              departmentId: u.departmentId,
              grade: u.grade || undefined,
              companyId: u.companyId || '1'
            })
          )
        );
        console.log(`✅ ${validNewUsers.length} новых сотрудников сохранено`);
      }

      // Step 3: Update existing users
      const updatePromises: Promise<void>[] = [];
      
      for (const userId in editingUsers) {
        // Skip if user is marked for deletion
        if (deletedUserIds.includes(userId)) continue;

        const editedData = editingUsers[userId];
        const originalData = resources.find(r => r.id === userId);
        
        const dataToSave = {
          ...editedData,
          companyId: editedData.companyId || '1'
        };
        
        if (originalData && (
          editedData.fullName !== originalData.fullName ||
          editedData.position !== originalData.position ||
          editedData.departmentId !== originalData.departmentId ||
          editedData.grade !== (originalData.grade || '') ||
          editedData.companyId !== (originalData.companyId || '1')
        )) {
          updatePromises.push(onUpdateUser(userId, dataToSave));
        }
      }
      
      if (updatePromises.length > 0) {
        console.log(`💾 Сохранение ${updatePromises.length} изменений параллельно...`);
        await Promise.all(updatePromises);
        console.log(`✅ Все ${updatePromises.length} изменений сохранены`);
      }
      
      setHasChanges(false);
      setLocalNewUsers([]);
      setDeletedUserIds([]);
      onClose();
      if (onResetHistory) onResetHistory(); // Сброс истории после изменений
    } catch (error) {
      console.error('Error saving changes:', error);
      alert('Ошибка при сохранении изменений');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (userId: string) => {
    const resource = resources.find(r => r.id === userId);
    if (!resource) return;

    const confirmed = window.confirm(
      `Вы уверены, что хотите удалить сотрудника "${resource.fullName}"?\n\n` +
      `⚠️ ВНИМАНИЕ: Все события этого сотрудника также будут удалены!\n\n` +
      `Удаление будет выполнено после нажатия "Сохранить".`
    );
    if (!confirmed) return;

    // Mark for deletion (remove from local state and add to deletion list)
    setDeletedUserIds(prev => [...prev, userId]);
    setEditingUsers(prev => {
      const newState = { ...prev };
      delete newState[userId];
      return newState;
    });
  };

  const handleChange = (userId: string, field: string, value: string) => {
    setEditingUsers(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        [field]: value
      }
    }));
  };

  const handleCancel = () => {
    if (hasChanges) {
      const confirmed = window.confirm('У вас есть несохраненные изменения. Вы уверены, что хотите закрыть?');
      if (!confirmed) return;
    }
    onClose();
  };

  // Filter out deleted users
  const visibleResources = resources.filter(r => !deletedUserIds.includes(r.id));

  return (
    <div 
      className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50"
      onClick={handleCancel}
    >
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <ManagementModalHeader
          title="Управление сотрудниками"
          onAdd={handleAddNewUser}
          addButtonLabel="Добавить сотрудника"
          onClose={handleCancel}
        />

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-3">
            {/* New users */}
            {localNewUsers.map(newUser => (
              <div key={newUser.tempId} className="gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-[0.7fr_2fr_1.5fr_1.3fr_1.3fr_auto] gap-3 items-center">
                  <div>
                    
                    <select
                      value={newUser.grade}
                      onChange={e => handleNewUserChange(newUser.tempId, 'grade', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Не указан</option>
                      {grades.map(grade => (
                        <option key={grade.id} value={grade.id}>
                          {grade.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    
                    <input
                      type="text"
                      value={newUser.fullName}
                      onChange={e => handleNewUserChange(newUser.tempId, 'fullName', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Иван Иванов"
                      autoFocus
                    />
                  </div>
                  <div>
                    
                    <input
                      type="text"
                      value={newUser.position}
                      onChange={e => handleNewUserChange(newUser.tempId, 'position', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Разработчик"
                    />
                  </div>
                  <div>
                   
                    <select
                      value={newUser.departmentId}
                      onChange={e => handleNewUserChange(newUser.tempId, 'departmentId', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {departments.map(dept => (
                        <option key={dept.id} value={dept.id}>
                          {dept.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    
                    <select
                      value={newUser.companyId}
                      onChange={e => handleNewUserChange(newUser.tempId, 'companyId', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Не указана</option>
                      {companies.map(company => (
                        <option key={company.id} value={company.id}>
                          {company.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="">
                    <button
                      onClick={() => handleDeleteNewUser(newUser.tempId)}
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
            
            {/* Existing users - sorted by department queue, then by grade */}
            <div className="flex flex-col gap-2 p-3 bg-gray-50 rounded-lg">
            {visibleResources
              .sort((a, b) => {
                const deptA = departments.find(d => d.id === a.departmentId);
                const deptB = departments.find(d => d.id === b.departmentId);
                const queueA = deptA?.queue || 999;
                const queueB = deptB?.queue || 999;
                if (queueA !== queueB) return queueA - queueB;
                
                if (!a.grade && !b.grade) return 0;
                if (!a.grade) return 1;
                if (!b.grade) return -1;
                return Number(b.grade) - Number(a.grade);
              })
              .map(resource => {
              const userData = editingUsers[resource.id];
              if (!userData) return null;

              return (
                <div key={resource.id} className="">
                  <div className="grid grid-cols-[0.7fr_2fr_1.5fr_1.3fr_1.3fr_auto] gap-3 items-center">
                    <div>
                      <select
                        value={userData.grade || ''}
                        onChange={e => handleChange(resource.id, 'grade', e.target.value)}
                        className="w-full px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Не указан</option>
                        {grades.map(grade => (
                          <option key={grade.id} value={grade.id}>
                            {grade.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <input
                        type="text"
                        value={userData.fullName}
                        onChange={e => handleChange(resource.id, 'fullName', e.target.value)}
                        className="w-full px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Имя сотрудника"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        value={userData.position}
                        onChange={e => handleChange(resource.id, 'position', e.target.value)}
                        className="w-full px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Должность"
                      />
                    </div>
                    <div>
                      <select
                        value={userData.departmentId}
                        onChange={e => handleChange(resource.id, 'departmentId', e.target.value)}
                        className="w-full px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {departments.map(dept => (
                          <option key={dept.id} value={dept.id}>
                            {dept.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <select
                        value={userData.companyId || ''}
                        onChange={e => handleChange(resource.id, 'companyId', e.target.value)}
                        className="w-full px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Не указана</option>
                        {companies.map(company => (
                          <option key={company.id} value={company.id}>
                            {company.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="pt-0">
                      <button
                        onClick={() => handleDelete(resource.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Удалить сотрудника"
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
              );
            })}
            </div>

            {visibleResources.length === 0 && localNewUsers.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <p>Нет сотрудников</p>
                <p className="text-sm mt-2">Нажмите "Добавить сотрудника" для создания</p>
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
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleCancel}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              disabled={isSaving}
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={!hasChanges || isSaving}
              className={`px-6 py-2 rounded-lg transition-colors ${
                hasChanges && !isSaving
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isSaving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}