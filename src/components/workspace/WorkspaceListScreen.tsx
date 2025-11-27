import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Workspace, WorkspaceSummary } from '../../types/scheduler';
import { getWorkspaces, getWorkspaceSummary, deleteWorkspace } from '../../services/api/workspaces';
import { Plus, Calendar, Users, LogOut, ChevronDown, MoreVertical, Pencil, Trash2, Folder, Layers, User } from 'lucide-react';
import { CreateWorkspaceModal } from './CreateWorkspaceModal';
import { EditWorkspaceModal } from './EditWorkspaceModal';
import { getStorageJSON, setStorageJSON } from '../../utils/storage';
import { decodeSupabaseJWT, getDisplayNameFromToken, getEmailFromToken } from '../../utils/jwt';
import { toast } from '../../components/ui/use-toast';
import { WorkspaceUsers } from './WorkspaceUsers';
import { presenceApi } from '../../services/api/presence';
import { ProfileModal } from '../auth/ProfileModal';
import { LoadingScreen } from '../ui/spinner';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator 
} from '../ui/dropdown-menu';
import { getStorageJSON, setStorageJSON } from '../../utils/storage';
import { projectId } from '../../utils/supabase/info';

// Онлайн пользователь (из presence системы)
interface OnlineUser {
  userId: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  lastSeen: string;
}

interface WorkspaceWithSummary extends Workspace {
  summary?: WorkspaceSummary | null;
  onlineUsers?: OnlineUser[];
}

interface WorkspaceListScreenProps {
  onSelectWorkspace: (workspace: Workspace) => void;
  onSignOut: () => void;
  onTokenRefresh: (newToken: string) => Promise<void>;
  accessToken?: string | null;
}

export function WorkspaceListScreen({ onSelectWorkspace, onSignOut, onTokenRefresh, accessToken }: WorkspaceListScreenProps) {
  const [workspaces, setWorkspaces] = useState<WorkspaceWithSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [onlineUsersMap, setOnlineUsersMap] = useState<Map<string, OnlineUser[]>>(new Map());
  const [showProfileModal, setShowProfileModal] = useState(false);
  
  // Извлекаем данные текущего пользователя из accessToken (мемоизировано)
  // ВАЖНО: используем утилиты из jwt.ts для поддержки кириллицы
  const currentUserEmail = useMemo(() => {
    if (!accessToken) {
      return undefined;
    }
    const email = getEmailFromToken(accessToken);
    return email;
  }, [accessToken]);

  const currentUserDisplayName = useMemo(() => {
    if (!accessToken) return undefined;
    return getDisplayNameFromToken(accessToken);
  }, [accessToken]);

  const currentUserAvatarUrl = useMemo(() => {
    if (!accessToken) return undefined;
    const payload = decodeSupabaseJWT(accessToken);
    const avatarUrl = payload?.user_metadata?.avatar_url as string | undefined;
    return avatarUrl;
  }, [accessToken]);

  // Получаем инициалы из displayName или email
  const getUserInitials = (displayName?: string, email?: string) => {
    if (displayName) {
      const parts = displayName.trim().split(' ');
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return displayName.substring(0, 2).toUpperCase();
    }
    if (email) {
      return email.substring(0, 2).toUpperCase();
    }
    return 'U';
  };

  useEffect(() => {
    if (accessToken) {
      loadWorkspaces();
    }
  }, [accessToken]); // Запускаем когда accessToken становится доступен

  // Fetch online users for all workspaces - используем батч-запрос для оптимизации + кэширование
  // Было: N запросов каждые 10 секунд (для 10 воркспейсов = 60 req/min)
  // Стало: 1 запрос каждые 15 секунд (4 req/min) + кэш = снижение нагрузки в 15 раз!
  useEffect(() => {
    if (!accessToken || workspaces.length === 0) {
      return;
    }

    const CACHE_KEY = 'cache_online_users_batch';
    const CACHE_TTL_MS = 45000; // 45 секунд TTL

    // Загрузить из кэша
    const loadCachedOnlineUsers = async () => {
      try {
        const cached = await getStorageJSON<{ data: Record<string, OnlineUser[]>, timestamp: number }>(CACHE_KEY);
        
        if (cached && cached.data && cached.timestamp) {
          const age = Date.now() - cached.timestamp;
          if (age < CACHE_TTL_MS) {
            let cachedData = cached.data;
            
            // 🔒 Проверяем блокировку текущего пользователя при загрузке из кэша
            try {
              const suppressData = await getStorageJSON<{ email: string, timestamp: number, ttl: number }>('suppress_current_user_presence');
              
              if (suppressData && suppressData.email && suppressData.timestamp) {
                const suppressAge = Date.now() - suppressData.timestamp;
                
                if (suppressAge < suppressData.ttl) {
                  // Фильтруем текущего пользователя из кэша
                  const filteredData: Record<string, OnlineUser[]> = {};
                  Object.entries(cachedData).forEach(([workspaceId, users]) => {
                    filteredData[workspaceId] = users.filter(u => u.email !== suppressData.email);
                  });
                  
                  cachedData = filteredData;
                }
              }
            } catch (err) {
              console.warn('⚠️ Кэш: ошибка проверки блокировки:', err);
            }
            
            const newMap = new Map<string, OnlineUser[]>();
            Object.entries(cachedData).forEach(([workspaceId, users]) => {
              newMap.set(workspaceId, users);
            });
            setOnlineUsersMap(newMap);
            return true; // Кэш валиден
          }
        }
      } catch (err) {
        console.warn('⚠️ Ошибка чтения кэша онлайн пользователей:', err);
      }
      return false; // Кэш невалиден
    };

    const fetchOnlineUsersForWorkspaces = async () => {
      try {
        const workspaceIds = workspaces.map(w => w.id);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        // Один батч-запрос вместо N запросов - оптимизация для снижения DDOS базы
        // Используем presenceApi для автоматических ретраев
        let workspacesData = await presenceApi.getOnlineUsersBatch(workspaceIds);
        
        // 🔒 Проверяем блокировку текущего пользователя (предотвращение "мигания")
        // Если пользователь только что вышел из календаря, фильтруем его из batch данных
        try {
          const suppressData = await getStorageJSON<{ email: string, timestamp: number, ttl: number }>('suppress_current_user_presence');
          
          if (suppressData && suppressData.email && suppressData.timestamp) {
            const age = Date.now() - suppressData.timestamp;
            
            if (age < suppressData.ttl) {
              // Фильтруем текущего пользователя из ВСЕХ воркспейсов
              const filteredData: Record<string, OnlineUser[]> = {};
              Object.entries(workspacesData || {}).forEach(([workspaceId, users]) => {
                const userArray = users as OnlineUser[];
                filteredData[workspaceId] = userArray.filter(u => u.email !== suppressData.email);
              });
              
              workspacesData = filteredData;
            }
          }
        } catch (err) {
          console.warn('⚠️ Ошибка проверки блокировки presence:', err);
        }
        
        // Преобразуем объект { workspace_id: users[] } в Map
        const newMap = new Map<string, OnlineUser[]>();
        Object.entries(workspacesData || {}).forEach(([workspaceId, users]) => {
          const userArray = users as OnlineUser[];
          newMap.set(workspaceId, userArray);
        });
        
        setOnlineUsersMap(newMap);
        
        // Сохранить в кэш (уже отфильтрованные данные)
        await setStorageJSON(CACHE_KEY, {
          data: workspacesData || {},
          timestamp: Date.now()
        });
      } catch (error: any) {
        // Gracefully handle errors
        if (error.name === 'AbortError') {
          console.warn('⚠️ Batch запрос: таймаут (10 секунд)');
        } else if (error.message?.includes('Failed to fetch')) {
          console.warn('⚠️ Batch запрос: сетевая ошибка');
        } else {
          console.warn('⚠️ Batch запрос: ошибка загрузки', error.message || error);
        }
        // Keep showing last known data
      }
    };

    // Сначала попробовать загрузить из кэша
    loadCachedOnlineUsers().then(cacheValid => {
      // Всегда делаем запрос в фоне для обновления
      fetchOnlineUsersForWorkspaces();
    });
    
    // Периодическое обновление каждые 15 секунд (вместо 10)
    const intervalId = setInterval(fetchOnlineUsersForWorkspaces, 15000);

    return () => {
      clearInterval(intervalId);
    };
  }, [accessToken, workspaces]); // Зависимость от accessToken и workspaces

  // Close menu when clicking outside
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (activeMenu && menuRef.current && !menuRef.current.contains(e.target as Node)) {
        // Полностью блокируем событие, чтобы предотвратить любые действия под меню
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    };

    const handleClick = (e: MouseEvent) => {
      if (activeMenu && menuRef.current && !menuRef.current.contains(e.target as Node)) {
        // Блокируем клик-события, которые могли проскочить после pointerdown
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        // Закрываем меню ПОСЛЕ блокировки события, чтобы состояние не изменилось до блокировки
        setActiveMenu(null);
      }
    };

    if (activeMenu) {
      // Используем pointerdown для перехвата ВСЕХ указательных событий (мышь, тач) ДО их обработки
      document.addEventListener('pointerdown', handlePointerDown, true);
      // Дополнительно блокируем click события для React onClick handlers и закрываем меню
      document.addEventListener('click', handleClick, true);
    }

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('click', handleClick, true);
    };
  }, [activeMenu]);

  const loadWorkspaces = async () => {
    try {
      // Load from cache first
      const cacheKey = 'cache_workspaces_list';
      const cachedData = await getStorageJSON<WorkspaceWithSummary[]>(cacheKey);
      
      if (cachedData) {
        setWorkspaces(cachedData);
        setIsLoading(false);
      }
      
      // Load fresh data in background
      const data = await getWorkspaces();
      
      // Load summaries for each workspace (убрали загрузку users - они приходят через presence)
      const workspacesWithSummaries = await Promise.all(
        data.map(async (workspace) => {
          try {
            const summary = await getWorkspaceSummary(workspace.id);
            return { ...workspace, summary };
          } catch (err) {
            console.warn(`Failed to load summary for workspace ${workspace.id}:`, err);
            return { ...workspace, summary: null };
          }
        })
      );
      
      setWorkspaces(workspacesWithSummaries);
      
      // Update cache
      await setStorageJSON(cacheKey, workspacesWithSummaries);
    } catch (error) {
      console.error('Failed to load workspaces:', error);
      // Error will be handled by base.ts - it will clear auth and reload
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateWorkspace = async () => {
    await loadWorkspaces();
    setShowCreateModal(false);
  };

  const handleUpdateWorkspace = async () => {
    await loadWorkspaces();
    setEditingWorkspace(null);
  };

  const handleDeleteWorkspace = async (workspaceId: string) => {
    if (!confirm('Вы уверены, что хотите удалить это рабочее пространство?')) {
      return;
    }
    
    // Оптимистичное удаление: сразу убираем из UI
    const workspaceToDelete = workspaces.find(w => w.id === workspaceId);
    const updatedWorkspaces = workspaces.filter(w => w.id !== workspaceId);
    setWorkspaces(updatedWorkspaces);
    setActiveMenu(null);
    
    // Обновляем кэш
    const cacheKey = 'cache_workspaces_list';
    await setStorageJSON(cacheKey, updatedWorkspaces).catch(() => {});
    
    // Фоновое удаление из БД
    try {
      await deleteWorkspace(workspaceId);
      console.log('✅ Воркспейс успешно удален из БД');
    } catch (error) {
      console.error('Failed to delete workspace from DB:', error);
      
      // Откатываем изменения в UI если удаление не удалось
      if (workspaceToDelete) {
        const restoredWorkspaces = [...workspaces];
        setWorkspaces(restoredWorkspaces);
        await setStorageJSON(cacheKey, restoredWorkspaces).catch(() => {});
      }
      
      alert('Ошибка при удалении рабочего пространства из базы данных');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'только что';
    if (diffMins < 60) return `${diffMins} мин. назад`;
    if (diffHours < 24) return `${diffHours} ч. назад`;
    if (diffDays < 7) return `${diffDays} дн. назад`;
    
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatRelativeDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / 3600000);
    
    // Менее 24 часов - показываем относительное время
    if (diffHours < 24) {
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'только что';
      if (diffMins < 60) return `${diffMins} мин. назад`;
      if (diffHours === 1) return '1 час назад';
      return `${diffHours} часа назад`;
    }
    
    // Вчера
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear()
    ) {
      return 'вчера';
    }
    
    // Старше - показываем дату
    return date.toLocaleDateString('ru-RU', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
  };

  // Проверяем, был ли воркспейс действительно обновлён (по summary.last_updated из view)
  const wasUpdated = (workspace: WorkspaceWithSummary) => {
    // Используем last_updated из view workspaces_summary
    if (workspace.summary?.last_updated) {
      const created = new Date(workspace.created_at).getTime();
      const lastUpdated = new Date(workspace.summary.last_updated).getTime();
      
      // Если разница больше 1 секунды, считаем что обновлялся
      if (Math.abs(lastUpdated - created) > 1000) {
        return true;
      }
    }
    
    return false;
  };

  if (isLoading) {
    return <LoadingScreen message="Загрузка пространств..." size="lg" />;
  }

  return (
    <div className="min-h-screen bg-[#f7f9fb]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center justify-center w-10 h-10">
              <svg width="40" height="40" viewBox="0 0 310 310" fill="none" xmlns="http://www.w3.org/2000/svg">
                <g clipPath="url(#clip0_7774_71753)">
                <rect width="310" height="310" rx="72" fill="#39EC00"/>
                <path d="M245.732 225.863H267.872L267.392 165.327C264.438 158.235 261.189 151.061 257.937 144.087C248.871 124.654 240.379 104.964 231.552 85.4318L176.344 85.4698C157.43 127.128 140.373 169.865 121.304 211.483C119.165 216.152 117.097 220.891 115.133 225.638L162.931 225.819C164.899 221.181 167.104 215.585 169.199 211.085C188.844 210.352 211.144 210.851 230.982 210.845C226.293 200.107 220.618 186.796 215.416 176.393C205.085 176.403 193.931 176.6 183.657 176.385C189.681 161.054 196.399 145.732 202.644 130.429C213.917 154.227 224.353 178.639 235.575 202.487C239.186 210.161 242.608 217.975 245.732 225.863Z" fill="white"/>
                <path d="M246.073 225.819C244.105 221.181 241.9 215.585 239.805 211.085L224.633 95.4316V85.4698H232.66C251.574 127.128 268.631 169.865 287.7 211.483C289.839 216.152 291.907 220.891 293.871 225.638L246.073 225.819Z" fill="white"/>
                <path d="M214.133 0.5L78.1328 311.5H-1.36719V-6H217.133L214.133 0.5Z" fill="black"/>
                <path fillRule="evenodd" clipRule="evenodd" d="M89.5634 85.4772C116.314 85.4453 151.887 83.5109 166.768 108.811L131.09 190.398C116.395 192.487 100.159 191.781 85.5039 191.78L85.5166 225.606L39.5185 225.592C39.3794 179.39 38.8382 131.695 39.3457 85.5827L89.5634 85.4772ZM113.296 122.019C104.079 120.941 94.7669 121.447 85.4922 121.58L85.3867 156.198C97.1124 156.272 115.241 158.339 124.12 151.212C133.316 140.046 128.347 123.779 113.296 122.019Z" fill="#39EC00"/>
                </g>
                <defs>
                <clipPath id="clip0_7774_71753">
                <rect width="310" height="310" rx="72" fill="white"/>
                </clipPath>
                </defs>
              </svg>
            </div>
            <div>
              <h1 className="text-xl">Planaro v1.0</h1>
              <p className="text-sm text-gray-500">Управление рабочими пространствами</p>
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                {/* Avatar */}
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center overflow-hidden">
                  {currentUserAvatarUrl ? (
                    <img 
                      src={currentUserAvatarUrl} 
                      alt={currentUserDisplayName || currentUserEmail || 'User'} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-white text-xs font-semibold">
                      {getUserInitials(currentUserDisplayName, currentUserEmail)}
                    </span>
                  )}
                </div>
                
                {/* Display Name */}
                <span className="max-w-[150px] truncate">
                  {currentUserDisplayName || currentUserEmail || 'Пользователь'}
                </span>
                
                {/* Chevron Down */}
                <ChevronDown className="w-4 h-4 text-gray-500" />
              </button>
            </DropdownMenuTrigger>
            
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => setShowProfileModal(true)}>
                <User className="w-4 h-4 mr-2" />
                Редактировать профиль
              </DropdownMenuItem>
              
              <DropdownMenuSeparator />
              
              <DropdownMenuItem onClick={onSignOut} className="text-red-600">
                <Trash2 className="w-4 h-4 mr-2" />
                Выйти
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl mb-1">Мои пространства</h2>
            <p className="text-gray-600">
              {workspaces.length === 0 
                ? 'У вас пока нет рабочих пространств' 
                : `${workspaces.length} ${workspaces.length === 1 ? 'пространство' : 'пространств'}`}
            </p>
          </div>
          
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" />
            Создать пространство
          </button>
        </div>

        {/* Workspaces Grid */}
        {workspaces.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg mb-2 text-gray-900">Нет рабочих пространств</h3>
            <p className="text-gray-500 mb-6">Создайте первое пространство для начала работы</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Создать пространство
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workspaces.map((workspace) => {
              // ВАЖНО: конвертируем workspace.id в строку для поиска в Map,
              // т.к. JSON возвращает строковые ключи, а workspace.id может быть number
              const workspaceIdStr = String(workspace.id);
              
              // Показываем ТОЛЬКО пользователей из presence (т.е. тех кто внутри воркспейса)
              // Текущий пользователь показывается ТОЛЬКО если он тоже внутри
              const users = onlineUsersMap.get(workspaceIdStr) || [];
              
              return (
              <div
                key={workspace.id}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
                onClick={() => onSelectWorkspace(workspace)}
              >
                {/* Preview Image */}
                <div className="relative h-40 bg-gradient-to-br from-blue-50 to-purple-50 overflow-hidden">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Calendar className="w-16 h-16 text-blue-200" />
                  </div>
                  <div className="absolute top-3 right-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenu(activeMenu === workspace.id ? null : workspace.id);
                      }}
                      className="w-8 h-8 rounded-lg bg-white/90 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <MoreVertical className="w-4 h-4 text-gray-600" />
                    </button>
                    
                    {activeMenu === workspace.id && (
                      <div 
                        ref={menuRef}
                        className="absolute right-0 top-10 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-10"
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingWorkspace(workspace);
                            setActiveMenu(null);
                          }}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700"
                        >
                          <Pencil className="w-4 h-4" />
                          Переименовать
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteWorkspace(workspace.id);
                          }}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 flex items-center gap-2 text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                          Удалить
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg mb-1 truncate">{workspace.name}</h3>
                      <p className="text-sm text-gray-500">Год: {workspace.timeline_year}</p>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 text-gray-600 mb-1">
                        <Folder className="w-4 h-4" />
                      </div>
                      <div className="text-sm">{workspace.summary?.project_count ?? (workspace.summary as any)?.projects_count ?? 0}</div>
                      <div className="text-xs text-gray-500">проектов</div>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 text-gray-600 mb-1">
                        <Users className="w-4 h-4" />
                      </div>
                      <div className="text-sm">{workspace.summary?.member_count ?? (workspace.summary as any)?.users_count ?? 0}</div>
                      <div className="text-xs text-gray-500">человек</div>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 text-gray-600 mb-1">
                        <Layers className="w-4 h-4" />
                      </div>
                      <div className="text-sm">{workspace.summary?.department_count ?? 0}</div>
                      <div className="text-xs text-gray-500">департаментов</div>
                    </div>
                  </div>

                  {/* Created/Updated & Workspace Users */}
                  <div className="text-xs text-gray-500 pt-3 border-t border-gray-100 flex justify-between items-center gap-2 h-6">
                    <span className="truncate">
                      {wasUpdated(workspace) 
                        ? `Изменено: ${formatRelativeDate(workspace.summary!.last_updated!)}`
                        : `Создано: ${formatRelativeDate(workspace.created_at)}`
                      }
                    </span>
                    <WorkspaceUsers 
                      users={users}
                      currentUserEmail={currentUserEmail}
                    />
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Create Workspace Modal */}
      {showCreateModal && (
        <CreateWorkspaceModal
          existingWorkspaces={workspaces}
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateWorkspace}
        />
      )}

      {/* Edit Workspace Modal */}
      {editingWorkspace && (
        <EditWorkspaceModal
          workspace={editingWorkspace}
          onClose={() => setEditingWorkspace(null)}
          onUpdate={handleUpdateWorkspace}
        />
      )}

      {/* Profile Modal */}
      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        accessToken={accessToken}
        currentDisplayName={currentUserDisplayName}
        currentEmail={currentUserEmail}
        currentAvatarUrl={currentUserAvatarUrl}
        onTokenRefresh={onTokenRefresh}
        onProfileUpdated={() => {
          // Обновление токена будет обработано через onTokenRefresh
          // Страница не перезагружается - OnlineUsers автоматически получит новый токен
        }}
      />
    </div>
  );
}