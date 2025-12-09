import { useState, useEffect, useRef, forwardRef } from 'react';
import { Resource, Department, Grade, Company } from '../../types/scheduler';
import { usersApi } from '../../services/api/users';
import { resizeImageOnClient } from '../../utils/imageResize';
import { Search, X } from 'lucide-react';
import { sortResourcesByGrade } from '../../utils/scheduler';

interface UsersManagementContentProps {
  resources: Resource[];
  departments: Department[];
  grades: Grade[];
  companies: Company[];
  onCreateUser: (userData: Omit<Resource, 'id'>) => Promise<void>;
  onUpdateUser: (userId: string, updates: Partial<Resource>) => Promise<void>;
  onDeleteUser: (userId: string) => Promise<void>;
  onUploadUserAvatar: (userId: string, file: File) => Promise<string>;
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
  avatarUrl?: string;
}

export function UsersManagementContent({
  resources,
  departments,
  grades,
  companies,
  onCreateUser,
  onUpdateUser,
  onDeleteUser,
  onUploadUserAvatar,
  onHasChanges,
  onClose,
  highlightedUserId
}: UsersManagementContentProps) {
  const [editingUsers, setEditingUsers] = useState<Record<string, Partial<Resource>>>({});
  const [localNewUsers, setLocalNewUsers] = useState<LocalNewUser[]>([]);
  const [deletedUserIds, setDeletedUserIds] = useState<string[]>([]);
  const [uploadingAvatars, setUploadingAvatars] = useState<Record<string, boolean>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'department' | 'grade'>('department');

  const contentRef = useRef<HTMLDivElement>(null);
  const userRowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [animatedUserId, setAnimatedUserId] = useState<string | null>(null);

  // Initialize editing state
  useEffect(() => {
    const initialState: Record<string, Partial<Resource>> = {};
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
    setUploadingAvatars({});
    setSearchQuery('');
    setSelectedDepartment('all');
    setSortBy('department');
  }, [resources]);

  // Auto-scroll to highlighted user
  useEffect(() => {
    if (highlightedUserId && contentRef.current) {
      const timer = setTimeout(() => {
        const userRow = userRowRefs.current[highlightedUserId];
        if (userRow) {
          userRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setAnimatedUserId(highlightedUserId);
          setTimeout(() => setAnimatedUserId(null), 2000);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [highlightedUserId]);

  // Track changes
  useEffect(() => {
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

    onHasChanges(hasNewUsers || hasDeletedUsers || hasExistingChanges);
  }, [localNewUsers, deletedUserIds, editingUsers, resources, onHasChanges]);

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
    
    setTimeout(() => {
      if (contentRef.current) {
        contentRef.current.scrollTop = 0;
      }
    }, 50);
  };

  const handleNewUserChange = (tempId: string, field: string, value: string) => {
    setLocalNewUsers(prev => prev.map(u =>
      u.tempId === tempId ? { ...u, [field]: value } : u
    ));
  };

  const handleDeleteNewUser = (tempId: string) => {
    setLocalNewUsers(prev => prev.filter(u => u.tempId !== tempId));
  };

  const handleChange = (userId: string, field: string, value: string) => {
    setEditingUsers(prev => ({
      ...prev,
      [userId]: { ...prev[userId], [field]: value }
    }));
  };

  const handleDelete = (userId: string) => {
    const user = resources.find(r => r.id === userId);
    if (!user) return;
    
    if (!confirm(
      `Удалить сотрудника "${user.fullName}"?\n\n` +
      `Удаление будет выполнено после нажатия "Сохранить".`
    )) {
      return;
    }
    
    setDeletedUserIds(prev => [...prev, userId]);
    setEditingUsers(prev => {
      const newState = { ...prev };
      delete newState[userId];
      return newState;
    });
  };

  const handleAvatarUpload = async (userId: string, file: File) => {
    try {
      setUploadingAvatars(prev => ({ ...prev, [userId]: true }));
      
      const resizedFile = await resizeImageOnClient(file, 200);
      const avatarUrl = await onUploadUserAvatar(userId, resizedFile);
      
      setEditingUsers(prev => ({
        ...prev,
        [userId]: { ...prev[userId], avatarUrl }
      }));
    } catch (error) {
      console.error('Error uploading avatar:', error);
      alert('Ошибка загрузки аватара');
    } finally {
      setUploadingAvatars(prev => ({ ...prev, [userId]: false }));
    }
  };

  const handleNewUserAvatarUpload = async (tempId: string, file: File) => {
    try {
      setUploadingAvatars(prev => ({ ...prev, [tempId]: true }));
      
      const resizedFile = await resizeImageOnClient(file, 200);
      const formData = new FormData();
      formData.append('avatar', resizedFile);
      
      const response = await usersApi.uploadAvatarTemp(formData);
      const avatarUrl = response.avatarUrl;
      
      setLocalNewUsers(prev => prev.map(u =>
        u.tempId === tempId ? { ...u, avatarUrl } : u
      ));
    } catch (error) {
      console.error('Error uploading temp avatar:', error);
      alert('Ошибка загрузки аватара');
    } finally {
      setUploadingAvatars(prev => ({ ...prev, [tempId]: false }));
    }
  };

  const handleAvatarRemove = (userId: string) => {
    setEditingUsers(prev => ({
      ...prev,
      [userId]: { ...prev[userId], avatarUrl: undefined }
    }));
  };

  const handleNewUserAvatarRemove = (tempId: string) => {
    setLocalNewUsers(prev => prev.map(u =>
      u.tempId === tempId ? { ...u, avatarUrl: undefined } : u
    ));
  };

  const handleSave = async () => {
    try {
      // Step 1: Delete users
      if (deletedUserIds.length > 0) {
        console.log(`🗑️ Удаление ${deletedUserIds.length} сотрудников...`);
        await Promise.all(deletedUserIds.map(id => onDeleteUser(id)));
        console.log(`✅ ${deletedUserIds.length} сотрудников удалено`);
      }

      // Step 2: Create new users
      const validNewUsers = localNewUsers.filter(u => u.fullName.trim() && u.position.trim());
      if (validNewUsers.length > 0) {
        console.log(`💾 Создание ${validNewUsers.length} новых сотрудников...`);
        await Promise.all(
          validNewUsers.map(u => onCreateUser({
            fullName: u.fullName.trim(),
            position: u.position.trim(),
            departmentId: u.departmentId,
            grade: u.grade || undefined,
            companyId: u.companyId || '1',
            avatarUrl: u.avatarUrl
          }))
        );
        console.log(`✅ ${validNewUsers.length} новых сотрудников сохранено`);
      }

      // Step 3: Update existing users
      const updatePromises: Promise<void>[] = [];
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
          updatePromises.push(
            onUpdateUser(userId, {
              fullName: editedData.fullName,
              position: editedData.position,
              departmentId: editedData.departmentId,
              grade: editedData.grade || undefined,
              companyId: editedData.companyId || '1',
              avatarUrl: editedData.avatarUrl
            })
          );
        }
      }
      
      if (updatePromises.length > 0) {
        console.log(`💾 Сохранение ${updatePromises.length} изменений параллельно...`);
        await Promise.all(updatePromises);
        console.log(`✅ Все ${updatePromises.length} изменений сохранены`);
      }
      
      onClose();
    } catch (error) {
      console.error('❌ Ошибка при сохранении сотрудников:', error);
      alert('Ошибка при сохранении сотрудников');
    }
  };

  const getUserInitials = (fullName: string): string => {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  // Filter and sort resources
  const visibleResources = resources
    .filter(r => {
      if (deletedUserIds.includes(r.id)) return false;
      
      const matchesSearch = searchQuery === '' || 
        r.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.position.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesDepartment = selectedDepartment === 'all' || r.departmentId === selectedDepartment;
      
      return matchesSearch && matchesDepartment;
    })
    .sort((a, b) => {
      if (sortBy === 'name') {
        return a.fullName.localeCompare(b.fullName);
      } else if (sortBy === 'department') {
        const deptA = departments.find(d => d.id === a.departmentId);
        const deptB = departments.find(d => d.id === b.departmentId);
        const queueA = deptA?.queue || 999;
        const queueB = deptB?.queue || 999;
        if (queueA !== queueB) return queueA - queueB;
        return a.fullName.localeCompare(b.fullName);
      } else if (sortBy === 'grade') {
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
              <div aria-hidden="true" className="absolute border-[0.8px] border-[rgba(0,0,0,0.12)] border-solid inset-0 pointer-events-none rounded-[12px]" />
              <Search className="ml-3 w-4 h-4 text-gray-400 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Поиск по имени или должности..."
                className="flex-1 py-2 pr-10 bg-transparent border-none focus:outline-none text-[14px]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="mr-3 p-0.5 hover:bg-gray-100 rounded shrink-0"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              )}
            </div>
          </div>
          
          <div className="relative">
            <div className="box-border content-stretch flex gap-[6px] items-center relative rounded-[12px]">
              <div aria-hidden="true" className="absolute border-[0.8px] border-[rgba(0,0,0,0.12)] border-solid inset-0 pointer-events-none rounded-[12px]" />
              <select
                value={selectedDepartment}
                onChange={e => setSelectedDepartment(e.target.value)}
                className="px-3 py-2 bg-transparent border-none focus:outline-none text-[14px] min-w-[180px]"
              >
                <option value="all">Все департаменты</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>
          </div>
          
          <button
            onClick={handleAddNewUser}
            className="px-4 py-2 bg-blue-600 text-white rounded-[12px] hover:bg-blue-700 transition-colors font-medium whitespace-nowrap text-[14px]"
          >
            Сотрудник
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-0 px-0" ref={contentRef}>
        <div className="space-y-0">
          {/* New users section */}
          {localNewUsers.length > 0 && (
            <div>
              <div className="sticky top-0 z-10 bg-gray-100 px-6 py-3 border-b border-gray-200">
                <h3 className="font-medium text-gray-700">Новые сотрудники</h3>
              </div>
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
            </div>
          )}
          
          {/* Existing users grouped by department */}
          {(() => {
            // Group resources by department
            const groupedByDepartment = new Map<string, Resource[]>();
            visibleResources.forEach(resource => {
              const deptId = resource.departmentId;
              if (!groupedByDepartment.has(deptId)) {
                groupedByDepartment.set(deptId, []);
              }
              groupedByDepartment.get(deptId)!.push(resource);
            });

            // Sort departments by queue
            const sortedDepartments = Array.from(groupedByDepartment.keys())
              .map(deptId => departments.find(d => d.id === deptId))
              .filter((dept): dept is Department => dept !== undefined)
              .sort((a, b) => (a.queue || 999) - (b.queue || 999));

            return sortedDepartments.map(dept => {
              const deptResources = groupedByDepartment.get(dept.id) || [];
              // Sort resources within department by grade (Lead → Senior → Middle → Junior)
              const sortedDeptResources = sortResourcesByGrade(deptResources);
              
              return (
                <div key={dept.id}>
                  <div className="sticky top-0 z-10 bg-gray-100 px-6 py-3 border-b border-gray-200">
                    <h3 className="font-medium text-gray-700">{dept.name}</h3>
                  </div>
                  {sortedDeptResources.map(resource => {
                    const userData = editingUsers[resource.id];
                    if (!userData) return null;

                    return (
                      <UserRow
                        key={resource.id}
                        isHighlighted={resource.id === animatedUserId}
                        user={{
                          id: resource.id,
                          fullName: userData.fullName || '',
                          position: userData.position || '',
                          departmentId: userData.departmentId || '',
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
                </div>
              );
            });
          })()}

          {visibleResources.length === 0 && localNewUsers.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <p>Нет сотрудников</p>
              <p className="text-sm mt-2">
                {searchQuery || selectedDepartment !== 'all' 
                  ? 'Попробуйте изменить фильтры поиска'
                  : 'Нажмите "Сотрудник" для создания'
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
  getUserInitials: (fullName: string) => string;
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
  return (
    <div 
      ref={ref}
      className={`
        px-6 py-4 border-b border-gray-200 transition-all duration-300
        ${isNew ? 'bg-blue-50' : isHighlighted ? 'bg-blue-50' : 'bg-white hover:bg-gray-50'}
      `}
    >
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="flex-shrink-0">
          <div className="relative group">
            {uploadingAvatar ? (
              <div className="w-9 h-9 rounded-xl bg-gray-200 flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : user.avatarUrl ? (
              <div className="relative w-9 h-9">
                <img
                  src={user.avatarUrl}
                  alt={user.fullName}
                  className="w-9 h-9 rounded-xl object-cover"
                />
                <button
                  onClick={onAvatarRemove}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  title="Удалить аватар"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'image/*';
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) onAvatarUpload(file);
                  };
                  input.click();
                }}
                className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-200 transition-all cursor-pointer"
                style={{
                  background: '#f6f6f6'
                }}
              >
                <span className="text-sm font-normal" style={{ color: '#868789' }}>
                  {getUserInitials(user.fullName)}
                </span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) onAvatarUpload(file);
              }}
              className="hidden"
            />
          </div>
        </div>

        {/* Fields */}
        <input
          type="text"
          value={user.fullName}
          onChange={e => onChange('fullName', e.target.value)}
          placeholder="Имя Фамилия"
          className="flex-1 min-w-[120px] px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-[14px]"
        />
        
        <input
          type="text"
          value={user.position}
          onChange={e => onChange('position', e.target.value)}
          placeholder="Должность"
          className="flex-1 min-w-[120px] px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-[14px]"
        />
        
        <select
          value={user.departmentId}
          onChange={e => onChange('departmentId', e.target.value)}
          className="flex-shrink-0 min-w-0 w-[140px] pl-3 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-[14px]"
          style={{ 
            appearance: 'none',
            WebkitAppearance: 'none',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M10.293 3.293L6 7.586 1.707 3.293A1 1 0 00.293 4.707l5 5a1 1 0 001.414 0l5-5a1 1 0 10-1.414-1.414z'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 0.75rem center'
          }}
        >
          {departments.map(dept => (
            <option key={dept.id} value={dept.id}>{dept.name}</option>
          ))}
        </select>
        
        <select
          value={user.grade}
          onChange={e => onChange('grade', e.target.value)}
          className="flex-shrink-0 min-w-0 w-[100px] pl-3 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-[14px]"
          style={{ 
            appearance: 'none',
            WebkitAppearance: 'none',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M10.293 3.293L6 7.586 1.707 3.293A1 1 0 00.293 4.707l5 5a1 1 0 001.414 0l5-5a1 1 0 10-1.414-1.414z'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 0.75rem center'
          }}
        >
          <option value="">Грейд</option>
          {grades.map(grade => (
            <option key={grade.id} value={grade.id}>{grade.name}</option>
          ))}
        </select>
        
        <select
          value={user.companyId}
          onChange={e => onChange('companyId', e.target.value)}
          className="flex-shrink-0 min-w-0 w-[100px] pl-3 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-[14px]"
          style={{ 
            appearance: 'none',
            WebkitAppearance: 'none',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M10.293 3.293L6 7.586 1.707 3.293A1 1 0 00.293 4.707l5 5a1 1 0 001.414 0l5-5a1 1 0 10-1.414-1.414z'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 0.75rem center'
          }}
        >
          {companies.map(company => (
            <option key={company.id} value={company.id}>{company.name}</option>
          ))}
        </select>

        {/* Delete */}
        <button
          onClick={onDelete}
          className="flex-shrink-0 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          title="Удалить"
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
});

UserRow.displayName = 'UserRow';