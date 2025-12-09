import { useState, useEffect, useRef, forwardRef } from 'react';
import { Resource, Department, Grade, Company } from '../../types/scheduler';
import { ManagementModalHeader } from './ManagementModalHeader';
import { usersApi } from '../../services/api/users';
import { resizeImageOnClient } from '../../utils/imageResize';
import { Search, X } from 'lucide-react';

interface UsersManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  resources: Resource[];
  departments: Department[];
  grades: Grade[];
  companies: Company[];
  onCreateUser: (userData: { fullName: string; position: string; departmentId: string; grade?: string; companyId?: string; avatarUrl?: string }) => Promise<void>;
  onUpdateUser: (userId: string, userData: { fullName: string; position: string; departmentId: string; grade?: string; companyId?: string; avatarUrl?: string }) => Promise<void>;
  onDeleteUser: (userId: string) => Promise<void>;
  onResetHistory?: () => void;
  highlightUserId?: string; // ID пользователя для подсветки и скролла
}

interface LocalNewUser {
  tempId: string;
  fullName: string;
  position: string;
  departmentId: string;
  grade: string;
  companyId: string;
  avatarUrl?: string;
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
  onResetHistory,
  highlightUserId
}: UsersManagementModalProps) {
  const [editingUsers, setEditingUsers] = useState<Record<string, { fullName: string; position: string; departmentId: string; grade?: string; companyId?: string; avatarUrl?: string }>>({});
  const [localNewUsers, setLocalNewUsers] = useState<LocalNewUser[]>([]);
  const [deletedUserIds, setDeletedUserIds] = useState<string[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingAvatars, setUploadingAvatars] = useState<Record<string, boolean>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // NEW: Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'department' | 'grade'>('department');

  // Ref for scrolling to highlighted user
  const contentRef = useRef<HTMLDivElement>(null);
  const userRowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // State for highlight animation
  const [highlightedUserId, setHighlightedUserId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const initialState: Record<string, { fullName: string; position: string; departmentId: string; grade?: string; companyId?: string; avatarUrl?: string }> = {};
      resources.forEach(r => {
        initialState[r.id] = {
          fullName: r.fullName,
          position: r.position,
          departmentId: r.departmentId,
          grade: r.grade || '',
          companyId: r.companyId || '1',
          avatarUrl: r.avatarUrl
        };
      });
      setEditingUsers(initialState);
      setLocalNewUsers([]);
      setDeletedUserIds([]);
      setHasChanges(false);
      setUploadingAvatars({});
      // Reset search/filters when opening
      setSearchQuery('');
      setSelectedDepartment('all');
      setSortBy('department');
    }
  }, [isOpen, resources, departments]);

  useEffect(() => {
    if (!isOpen) return;

    const hasNewUsers = localNewUsers.length > 0;
    const hasDeletedUsers = deletedUserIds.length > 0;

    let hasExistingChanges = false;
    for (const userId in editingUsers) {
      const editedData = editingUsers[userId];
      const originalData = resources.find(r => r.id === userId);
      
      if (originalData && (
        editedData.fullName !== originalData.fullName ||
        editedData.position !== originalData.position ||
        editedData.departmentId !== originalData.departmentId ||
        editedData.grade !== (originalData.grade || '') ||
        editedData.companyId !== (originalData.companyId || '1') ||
        editedData.avatarUrl !== originalData.avatarUrl
      )) {
        hasExistingChanges = true;
        break;
      }
    }

    setHasChanges(hasNewUsers || hasDeletedUsers || hasExistingChanges);
  }, [isOpen, localNewUsers, deletedUserIds, editingUsers, resources]);

  // Auto-scroll to highlighted user when modal opens
  useEffect(() => {
    if (isOpen && highlightUserId && contentRef.current) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        const userRow = userRowRefs.current[highlightUserId];
        if (userRow) {
          userRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setHighlightedUserId(highlightUserId);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, highlightUserId]);

  if (!isOpen) return null;

  const handleAddNewUser = () => {
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    setLocalNewUsers(prev => [...prev, {
      tempId,
      fullName: '',
      position: '',
      departmentId: departments[0]?.id || '',
      grade: '',
      companyId: '1',
      avatarUrl: undefined
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
      if (deletedUserIds.length > 0) {
        console.log(`🗑️ Удаление ${deletedUserIds.length} сотрудников...`);
        await Promise.all(deletedUserIds.map(id => onDeleteUser(id)));
        console.log(`✅ ${deletedUserIds.length} сотрудников удалено`);
      }

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
              companyId: u.companyId || '1',
              avatarUrl: u.avatarUrl
            })
          )
        );
        console.log(`✅ ${validNewUsers.length} новых сотрудников сохранено`);
      }

      const updatePromises: Promise<void>[] = [];
      
      for (const userId in editingUsers) {
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
          editedData.companyId !== (originalData.companyId || '1') ||
          editedData.avatarUrl !== originalData.avatarUrl
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
      if (onResetHistory) onResetHistory();
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

  const handleAvatarUpload = async (userId: string, file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Пожалуйста, выберите изображение');
      return;
    }

    setUploadingAvatars(prev => ({ ...prev, [userId]: true }));
    try {
      const resizedFile = await resizeImageOnClient(file);
      const avatarUrl = await usersApi.uploadAvatar(userId, resizedFile);
      handleChange(userId, 'avatarUrl', avatarUrl);
      console.log('✅ Аватар загружен:', avatarUrl);
    } catch (error: any) {
      console.error('❌ Ошибка загрузки аватара:', error);
      const message = error?.message || 'Неизвестная ошибка';
      alert(`Ошибка при загрузке аватара: ${message}`);
    } finally {
      setUploadingAvatars(prev => ({ ...prev, [userId]: false }));
    }
  };

  const handleAvatarRemove = (userId: string) => {
    handleChange(userId, 'avatarUrl', '');
  };

  const handleNewUserAvatarUpload = async (tempId: string, file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Пожалуйста, выберите изображение');
      return;
    }

    setUploadingAvatars(prev => ({ ...prev, [tempId]: true }));
    try {
      const resizedFile = await resizeImageOnClient(file);
      const avatarUrl = await usersApi.uploadAvatar(tempId, resizedFile);
      handleNewUserChange(tempId, 'avatarUrl', avatarUrl);
      console.log('✅ Аватар загружен:', avatarUrl);
    } catch (error: any) {
      console.error('❌ Ошибка загрузки аватара:', error);
      const message = error?.message || 'Неизвестная ошибка';
      alert(`Ошибка при загрузке аватара: ${message}`);
    } finally {
      setUploadingAvatars(prev => ({ ...prev, [tempId]: false }));
    }
  };

  const handleNewUserAvatarRemove = (tempId: string) => {
    handleNewUserChange(tempId, 'avatarUrl', '');
  };

  const getUserInitials = (fullName: string) => {
    if (!fullName) return '??';
    const parts = fullName.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return fullName.substring(0, 2).toUpperCase();
  };

  const handleCancel = () => {
    if (hasChanges) {
      const confirmed = window.confirm('У вас есть несохраненные изменения. Вы уверены, что хотите закрыть?');
      if (!confirmed) return;
    }
    onClose();
  };

  // Filter and sort logic
  const visibleResources = resources
    .filter(r => !deletedUserIds.includes(r.id))
    .filter(r => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = r.fullName.toLowerCase().includes(query);
        const matchesPosition = r.position.toLowerCase().includes(query);
        if (!matchesName && !matchesPosition) return false;
      }

      // Department filter
      if (selectedDepartment !== 'all' && r.departmentId !== selectedDepartment) {
        return false;
      }

      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'name') {
        return a.fullName.localeCompare(b.fullName, 'ru');
      } else if (sortBy === 'grade') {
        if (!a.grade && !b.grade) return 0;
        if (!a.grade) return 1;
        if (!b.grade) return -1;
        return Number(b.grade) - Number(a.grade);
      } else {
        // department sorting (default)
        const deptA = departments.find(d => d.id === a.departmentId);
        const deptB = departments.find(d => d.id === b.departmentId);
        const queueA = deptA?.queue || 999;
        const queueB = deptB?.queue || 999;
        if (queueA !== queueB) return queueA - queueB;
        
        if (!a.grade && !b.grade) return 0;
        if (!a.grade) return 1;
        if (!b.grade) return -1;
        return Number(b.grade) - Number(a.grade);
      }
    });

  return (
    <div 
      className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50"
      onClick={handleCancel}
    >
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <ManagementModalHeader
          title="Управление сотрудниками"
          onAdd={handleAddNewUser}
          addButtonLabel="Добавить сотрудника"
          onClose={handleCancel}
        />

        {/* Search and Filter Bar */}
        <div className="px-6 pt-4 pb-3 border-b border-gray-200 bg-gray-50">
          <div className="flex gap-3 items-center">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Поиск по имени или должности..."
                className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Department filter */}
            <select
              value={selectedDepartment}
              onChange={e => setSelectedDepartment(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm min-w-[180px]"
            >
              <option value="all">Все департаменты</option>
              {departments.map(dept => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as 'name' | 'department' | 'grade')}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm min-w-[150px]"
            >
              <option value="department">По департаменту</option>
              <option value="name">По имени</option>
              <option value="grade">По грейду</option>
            </select>
          </div>

          {/* Active filters summary */}
          {(searchQuery || selectedDepartment !== 'all') && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-gray-500">Активные фильтры:</span>
              {searchQuery && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                  Поиск: "{searchQuery}"
                  <button onClick={() => setSearchQuery('')} className="hover:text-blue-900">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {selectedDepartment !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                  {departments.find(d => d.id === selectedDepartment)?.name}
                  <button onClick={() => setSelectedDepartment('all')} className="hover:text-blue-900">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto py-6 px-0" ref={contentRef}>
          <div className="space-y-0">
            {/* New users */}
            {localNewUsers.map(newUser => (
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
                  avatarUrl: newUser.avatarUrl
                }}
                departments={departments}
                grades={grades}
                companies={companies}
                uploadingAvatar={uploadingAvatars[newUser.tempId]}
                onChange={(field, value) => handleNewUserChange(newUser.tempId, field, value)}
                onDelete={() => handleDeleteNewUser(newUser.tempId)}
                onAvatarUpload={file => handleNewUserAvatarUpload(newUser.tempId, file)}
                onAvatarRemove={() => handleNewUserAvatarRemove(newUser.tempId)}
                getUserInitials={getUserInitials}
                fileInputRef={el => fileInputRefs.current[newUser.tempId] = el}
              />
            ))}
            
            {/* Existing users */}
            {visibleResources.map(resource => {
              const userData = editingUsers[resource.id];
              if (!userData) return null;

              return (
                <UserRow
                  key={resource.id}
                  isHighlighted={resource.id === highlightedUserId}
                  user={{
                    id: resource.id,
                    fullName: userData.fullName,
                    position: userData.position,
                    departmentId: userData.departmentId,
                    grade: userData.grade || '',
                    companyId: userData.companyId || '',
                    avatarUrl: userData.avatarUrl
                  }}
                  departments={departments}
                  grades={grades}
                  companies={companies}
                  uploadingAvatar={uploadingAvatars[resource.id]}
                  onChange={(field, value) => handleChange(resource.id, field, value)}
                  onDelete={() => handleDelete(resource.id)}
                  onAvatarUpload={file => handleAvatarUpload(resource.id, file)}
                  onAvatarRemove={() => handleAvatarRemove(resource.id)}
                  getUserInitials={getUserInitials}
                  fileInputRef={el => fileInputRefs.current[resource.id] = el}
                  ref={el => userRowRefs.current[resource.id] = el}
                />
              );
            })}

            {visibleResources.length === 0 && localNewUsers.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <p>Нет сотрудников</p>
                <p className="text-sm mt-2">
                  {searchQuery || selectedDepartment !== 'all' 
                    ? 'Попробуйте изменить фильтры поиска'
                    : 'Нажмите "Добавить сотрудника" для создания'
                  }
                </p>
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
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Separate UserRow component for cleaner code
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
    avatarUrl?: string;
  };
  departments: Department[];
  grades: Grade[];
  companies: Company[];
  uploadingAvatar?: boolean;
  onChange: (field: string, value: string) => void;
  onDelete: () => void;
  onAvatarUpload: (file: File) => void;
  onAvatarRemove: () => void;
  getUserInitials: (name: string) => string;
  fileInputRef: (el: HTMLInputElement | null) => void;
}

const UserRow = forwardRef<HTMLDivElement, UserRowProps>(({
  isNew,
  isHighlighted,
  user,
  departments,
  grades,
  companies,
  uploadingAvatar,
  onChange,
  onDelete,
  onAvatarUpload,
  onAvatarRemove,
  getUserInitials,
  fileInputRef
}, ref) => {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isHighlighted) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 2000); // 2 секунды анимация
      return () => clearTimeout(timer);
    }
  }, [isHighlighted]);

  return (
    <div 
      ref={ref}
      className={`relative transition-all duration-300 ${isNew ? 'bg-blue-50' : ''} ${isAnimating ? 'animate-highlight' : ''}`}
      style={{
        paddingLeft: '16px',
        paddingRight: '16px',
        paddingTop: '16px',
        paddingBottom: '16px',
      }}
    >
      {/* Дивайдер снизу (как в календаре) */}
      {!isNew && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            bottom: 0,
            left: '16px',
            right: 0,
            borderBottom: '1px solid #f0f0f0',
            pointerEvents: 'none',
          }}
        />
      )}

      <div className="grid grid-cols-[56px_1fr_2fr_1.5fr_1.3fr_1.3fr_auto] gap-4 items-center">
        {/* Avatar */}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) onAvatarUpload(file);
            }}
          />
          <div
            onClick={() => document.querySelector<HTMLInputElement>(`input[type="file"]`)?.click()}
            className="relative w-[48px] h-[48px] rounded-xl cursor-pointer hover:opacity-80 transition-opacity group"
          >
            {uploadingAvatar ? (
              <div className="w-full h-full bg-gray-100 rounded-xl flex items-center justify-center">
                <div className="animate-spin w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full" />
              </div>
            ) : user.avatarUrl ? (
              <>
                <img
                  src={user.avatarUrl}
                  alt=""
                  className="w-full h-full object-cover rounded-xl"
                />
                <button
                  onClick={e => {
                    e.stopPropagation();
                    onAvatarRemove();
                  }}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors text-sm opacity-0 group-hover:opacity-100"
                  title="Удалить фото"
                >
                  ×
                </button>
              </>
            ) : (
              <div className="w-full h-full bg-gray-100 rounded-xl flex items-center justify-center">
                <p className="text-sm text-gray-500 font-medium">
                  {getUserInitials(user.fullName)}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Grade */}
        <div>
          <select
            value={user.grade}
            onChange={e => onChange('grade', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="">Грейд</option>
            {grades.map(grade => (
              <option key={grade.id} value={grade.id}>
                {grade.name}
              </option>
            ))}
          </select>
        </div>

        {/* Full Name */}
        <div>
          <input
            type="text"
            value={user.fullName}
            onChange={e => onChange('fullName', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            placeholder="Иван Иванов"
            autoFocus={isNew}
          />
        </div>

        {/* Position */}
        <div>
          <input
            type="text"
            value={user.position}
            onChange={e => onChange('position', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            placeholder="Должность"
          />
        </div>

        {/* Department */}
        <div>
          <select
            value={user.departmentId}
            onChange={e => onChange('departmentId', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            {departments.map(dept => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
        </div>

        {/* Company */}
        <div>
          <select
            value={user.companyId}
            onChange={e => onChange('companyId', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="">Компания</option>
            {companies.map(company => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </div>

        {/* Delete button */}
        <div>
          <button
            onClick={onDelete}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title={isNew ? "Удалить строку" : "Удалить сотрудника"}
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

      {/* CSS Animation */}
      <style>{`
        @keyframes highlight {
          0% {
            background-color: rgba(59, 130, 246, 0.2);
          }
          100% {
            background-color: transparent;
          }
        }

        .animate-highlight {
          animation: highlight 2s ease-out;
        }
      `}</style>
    </div>
  );
});

UserRow.displayName = 'UserRow';