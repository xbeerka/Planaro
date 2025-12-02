import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Workspace, WorkspaceSummary } from '../../types/scheduler';
import { getWorkspaces, getWorkspaceSummary, deleteWorkspace } from '../../services/api/workspaces';
import { Plus, Calendar, Users, LogOut, ChevronDown, MoreVertical, Pencil, Trash2, Folder, Layers, User } from 'lucide-react';
import { CreateWorkspaceModal } from './CreateWorkspaceModal';
import { EditWorkspaceModal } from './EditWorkspaceModal';
import { getStorageJSON, setStorageJSON } from '../../utils/storage';
import { decodeSupabaseJWT, getDisplayNameFromToken, getEmailFromToken } from '../../utils/jwt';
import { toast } from 'sonner@2.0.3';
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
import { projectId } from '../../utils/supabase/info';
import { Button } from '../ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '../ui/card';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';

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

  const [onlineUsersMap, setOnlineUsersMap] = useState<Map<string, OnlineUser[]>>(new Map());
  const [showProfileModal, setShowProfileModal] = useState(false);
  
  // Извлекаем данные текущего пользователя из accessToken (мемоизировано)
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
  }, [accessToken]);

  // Fetch online users for all workspaces - используем батч-запрос для оптимизации + кэширование
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
        let workspacesData = await presenceApi.getOnlineUsersBatch(workspaceIds);
        
        // 🔒 Проверяем блокировку текущего пользователя (предотвращение "мигания")
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
  }, [accessToken, workspaces]);

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
      
      // Load summaries for each workspace
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
    
    // Оптимистичное удаление
    const workspaceToDelete = workspaces.find(w => w.id === workspaceId);
    const updatedWorkspaces = workspaces.filter(w => w.id !== workspaceId);
    setWorkspaces(updatedWorkspaces);
    
    // Обновляем кэш
    const cacheKey = 'cache_workspaces_list';
    await setStorageJSON(cacheKey, updatedWorkspaces).catch(() => {});
    
    try {
      await deleteWorkspace(workspaceId);
      console.log('✅ Воркспейс успешно удален из БД');
      toast.success("Пространство удалено", {
        description: "Рабочее пространство успешно удалено",
      });
    } catch (error) {
      console.error('Failed to delete workspace from DB:', error);
      
      if (workspaceToDelete) {
        const restoredWorkspaces = [...workspaces];
        setWorkspaces(restoredWorkspaces);
        await setStorageJSON(cacheKey, restoredWorkspaces).catch(() => {});
      }
      
      toast.error("Ошибка удаления", {
        description: "Не удалось удалить рабочее пространство",
      });
    }
  };

  const formatRelativeDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / 3600000);
    
    if (diffHours < 24) {
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'только что';
      if (diffMins < 60) return `${diffMins} мин. назад`;
      if (diffHours === 1) return '1 час назад';
      return `${diffHours} часа назад`;
    }
    
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear()
    ) {
      return 'вчера';
    }
    
    return date.toLocaleDateString('ru-RU', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
  };

  const wasUpdated = (workspace: WorkspaceWithSummary) => {
    if (workspace.summary?.last_updated) {
      const created = new Date(workspace.created_at).getTime();
      const lastUpdated = new Date(workspace.summary.last_updated).getTime();
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
    <div className="min-h-screen bg-[#f0f4f8]">
      {/* Header - Removed shadow-sm, using border only */}
      <header className="sticky top-0 z-10 bg-[#f0f4f8]/95 backdrop-blur-sm pt-4 pb-2">
        <div className="max-w-7xl mx-auto px-6 py-3 bg-white rounded-full border border-border/50 flex items-center justify-between mx-4 md:mx-auto">
          <div className="flex items-center gap-4 pl-2">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary/5">
              <svg width="24" height="24" viewBox="0 0 310 310" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-primary">
                <g clipPath="url(#clip0_7774_71753)">
                <path d="M245.732 225.863H267.872L267.392 165.327C264.438 158.235 261.189 151.061 257.937 144.087C248.871 124.654 240.379 104.964 231.552 85.4318L176.344 85.4698C157.43 127.128 140.373 169.865 121.304 211.483C119.165 216.152 117.097 220.891 115.133 225.638L162.931 225.819C164.899 221.181 167.104 215.585 169.199 211.085C188.844 210.352 211.144 210.851 230.982 210.845C226.293 200.107 220.618 186.796 215.416 176.393C205.085 176.403 193.931 176.6 183.657 176.385C189.681 161.054 196.399 145.732 202.644 130.429C213.917 154.227 224.353 178.639 235.575 202.487C239.186 210.161 242.608 217.975 245.732 225.863Z" fill="currentColor"/>
                <path d="M246.073 225.819C244.105 221.181 241.9 215.585 239.805 211.085L224.633 95.4316V85.4698H232.66C251.574 127.128 268.631 169.865 287.7 211.483C289.839 216.152 291.907 220.891 293.871 225.638L246.073 225.819Z" fill="currentColor" opacity="0.8"/>
                <path d="M214.133 0.5L78.1328 311.5H-1.36719V-6H217.133L214.133 0.5Z" fill="currentColor" opacity="0.2"/>
                <path fillRule="evenodd" clipRule="evenodd" d="M89.5634 85.4772C116.314 85.4453 151.887 83.5109 166.768 108.811L131.09 190.398C116.395 192.487 100.159 191.781 85.5039 191.78L85.5166 225.606L39.5185 225.592C39.3794 179.39 38.8382 131.695 39.3457 85.5827L89.5634 85.4772ZM113.296 122.019C104.079 120.941 94.7669 121.447 85.4922 121.58L85.3867 156.198C97.1124 156.272 115.241 158.339 124.12 151.212C133.316 140.046 128.347 123.779 113.296 122.019Z" fill="currentColor"/>
                </g>
                <defs>
                <clipPath id="clip0_7774_71753">
                <rect width="310" height="310" rx="72" fill="white"/>
                </clipPath>
                </defs>
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-medium tracking-tight text-foreground">Planaro</h1>
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-3 h-12 pl-2 pr-4 rounded-full hover:bg-secondary/50 transition-colors">
                <Avatar className="w-9 h-9 border border-border/50">
                  <AvatarImage src={currentUserAvatarUrl} alt={currentUserDisplayName || 'User'} />
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    {getUserInitials(currentUserDisplayName, currentUserEmail)}
                  </AvatarFallback>
                </Avatar>
                
                <div className="hidden sm:flex flex-col items-start text-sm">
                  <span className="max-w-[120px] truncate font-medium leading-none">
                    {currentUserDisplayName || currentUserEmail?.split('@')[0] || 'Пользователь'}
                  </span>
                </div>
                
                <ChevronDown className="w-4 h-4 text-muted-foreground opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            
            <DropdownMenuContent align="end" className="w-64 rounded-2xl p-2 border-border">
              <div className="flex items-center justify-start gap-3 p-3 bg-muted/30 rounded-xl mb-2">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={currentUserAvatarUrl} />
                  <AvatarFallback>{getUserInitials(currentUserDisplayName, currentUserEmail)}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col space-y-1 leading-none overflow-hidden">
                  {currentUserDisplayName && (
                    <p className="font-medium truncate">{currentUserDisplayName}</p>
                  )}
                  {currentUserEmail && (
                    <p className="truncate text-xs text-muted-foreground">
                      {currentUserEmail}
                    </p>
                  )}
                </div>
              </div>
              
              <DropdownMenuItem onClick={() => setShowProfileModal(true)} className="cursor-pointer rounded-lg py-2.5">
                <User className="w-4 h-4 mr-3 opacity-70" />
                Редактировать профиль
              </DropdownMenuItem>
              
              <DropdownMenuSeparator className="my-1" />
              
              <DropdownMenuItem onClick={onSignOut} className="text-red-600 cursor-pointer focus:text-red-600 focus:bg-red-50 rounded-lg py-2.5">
                <Trash2 className="w-4 h-4 mr-3 opacity-70" />
                Выйти
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6">
          <div>
            <h2 className="text-4xl font-normal tracking-tight mb-2 text-foreground">Мои пространства</h2>
            <p className="text-lg text-muted-foreground font-light">
              {workspaces.length === 0 
                ? 'Добро пожаловать! Создайте свое первое пространство.' 
                : `Управляйте ${workspaces.length} ${workspaces.length === 1 ? 'активным пространством' : 'активными пространствами'}`}
            </p>
          </div>
          
          {/* Updated Button - no shadow */}
          <Button size="lg" onClick={() => setShowCreateModal(true)} className="active:scale-95 transition-all">
            <Plus className="w-5 h-5 mr-2" />
            Новое пространство
          </Button>
        </div>

        {/* Workspaces Grid */}
        {workspaces.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-24 text-center border-dashed border-2 bg-transparent">
            <div className="w-24 h-24 rounded-3xl bg-primary/5 flex items-center justify-center mb-6 animate-in zoom-in-50 duration-500">
              <Calendar className="w-10 h-10 text-primary/40" />
            </div>
            <h3 className="text-2xl font-medium mb-3">Здесь пока пусто</h3>
            <p className="text-muted-foreground mb-8 max-w-md text-lg">
              Рабочие пространства помогают организовать проекты и сотрудников. Создайте первое пространство прямо сейчас.
            </p>
            <Button size="lg" onClick={() => setShowCreateModal(true)} className="px-8">
              <Plus className="w-5 h-5 mr-2" />
              Создать пространство
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {workspaces.map((workspace) => {
              const workspaceIdStr = String(workspace.id);
              const users = onlineUsersMap.get(workspaceIdStr) || [];
              
              return (
              <Card 
                key={workspace.id}
                // Removed shadow-md, hover:shadow-xl, hover:-translate-y-1. Added hover:bg-muted/10 and border-transparent -> border-border for interaction or similar
                className="group overflow-hidden cursor-pointer bg-card transition-all duration-300 border-0 shadow-none"
                onClick={() => onSelectWorkspace(workspace)}
              >
                {/* Preview Image */}
                <div className="relative h-40 bg-gradient-to-br from-sky-50 via-indigo-50 to-purple-50 overflow-hidden">
                  <div className="absolute inset-0 flex items-center justify-center opacity-60 group-hover:opacity-80 transition-opacity duration-500 group-hover:scale-110">
                    <Calendar className="w-16 h-16 text-indigo-200" />
                  </div>
                  
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-300" />
                  
                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-200" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="secondary" size="icon" className="h-10 w-10 bg-white/90 backdrop-blur-sm rounded-full hover:bg-white">
                          <MoreVertical className="w-5 h-5 text-muted-foreground" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 rounded-xl">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          setEditingWorkspace(workspace);
                        }} className="py-2.5">
                          <Pencil className="w-4 h-4 mr-2 opacity-70" />
                          Переименовать
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteWorkspace(workspace.id);
                        }} className="text-red-600 focus:text-red-600 focus:bg-red-50 py-2.5">
                          <Trash2 className="w-4 h-4 mr-2 opacity-70" />
                          Удалить
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Content */}
                <div className="h-fit px-6 py-0 flex flex-col gap-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-semibold truncate mb-1.5 tracking-tight text-foreground/90">{workspace.name}</h3>
                      <Badge variant="secondary" className="font-medium bg-secondary/60 hover:bg-secondary/80">
                        {workspace.timeline_year}
                      </Badge>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2 py-4 bg-muted/30 rounded-2xl">
                    <div className="text-center">
                      <div className="text-xl font-bold text-foreground/80 leading-none mb-1.5">
                        {workspace.summary?.project_count ?? (workspace.summary as any)?.projects_count ?? 0}
                      </div>
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">проектов</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-foreground/80 leading-none mb-1.5">
                        {workspace.summary?.member_count ?? (workspace.summary as any)?.users_count ?? 0}
                      </div>
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">человек</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-foreground/80 leading-none mb-1.5">
                        {workspace.summary?.department_count ?? 0}
                      </div>
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">отделов</div>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-row items-center justify-between bg-muted/10 px-6 h-10">
                  <span className="text-xs font-medium text-muted-foreground/80">
                    {wasUpdated(workspace) 
                      ? `Изменено: ${formatRelativeDate(workspace.summary!.last_updated!)}`
                      : `Создано: ${formatRelativeDate(workspace.created_at)}`
                    }
                  </span>
                  <div className="flex items-center">
                    <WorkspaceUsers 
                      users={users}
                      currentUserEmail={currentUserEmail}
                    />
                  </div>
                </div>
              </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* Modals */}
      {showCreateModal && (
        <CreateWorkspaceModal
          existingWorkspaces={workspaces}
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateWorkspace}
        />
      )}

      {editingWorkspace && (
        <EditWorkspaceModal
          workspace={editingWorkspace}
          onClose={() => setEditingWorkspace(null)}
          onUpdate={handleUpdateWorkspace}
        />
      )}
      
      {showProfileModal && (
        <ProfileModal 
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
          accessToken={accessToken}
          currentEmail={currentUserEmail}
          currentDisplayName={currentUserDisplayName}
          currentAvatarUrl={currentUserAvatarUrl}
          onTokenRefresh={onTokenRefresh}
          onProfileUpdated={() => {
            // Optional: reload logic is handled in ProfileModal
          }}
        />
      )}
    </div>
  );
}
