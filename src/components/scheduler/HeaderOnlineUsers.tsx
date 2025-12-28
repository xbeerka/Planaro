import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import { decodeSupabaseJWT, getEmailFromToken, getDisplayNameFromToken } from '../../utils/jwt';
import { getStorageJSON } from '../../utils/storage';
import { presenceApi } from '../../services/api/presence';
import { ImageWithFallback } from '../figma/ImageWithFallback';

interface OnlineUser {
  userId: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  lastSeen: string;
}

interface HeaderOnlineUsersProps {
  workspaceId: string;
  accessToken: string | null;
  className?: string;
}

export function HeaderOnlineUsers({ workspaceId, accessToken, className }: HeaderOnlineUsersProps) {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const hasLoadedCache = useRef(false);
  const heartbeatFailureCount = useRef(0);

  // Текущий пользователь из токена
  const currentUser = useMemo(() => {
    if (!accessToken) return null;
    
    const payload = decodeSupabaseJWT(accessToken);
    return {
      userId: payload?.sub || '',
      email: getEmailFromToken(accessToken) || '',
      displayName: getDisplayNameFromToken(accessToken),
      avatarUrl: payload?.user_metadata?.avatar_url as string | undefined,
      lastSeen: new Date().toISOString()
    };
  }, [accessToken]);
  
  const currentUserEmail = currentUser?.email;

  // Объединяем текущего пользователя + онлайн пользователей
  const allUsers = useMemo(() => {
    if (!currentUser) return onlineUsers;
    
    const otherUsers = onlineUsers.filter(u => 
      u.email?.toLowerCase() !== currentUser.email?.toLowerCase()
    );
    
    return [currentUser, ...otherUsers];
  }, [onlineUsers, currentUser]);

  // Загрузка из кэша
  const loadFromCache = useCallback(async () => {
    if (hasLoadedCache.current) return false;
    
    try {
      const CACHE_KEY = 'cache_online_users_batch';
      const CACHE_TTL_MS = 45000;
      
      const cached = await getStorageJSON<{ data: Record<string, OnlineUser[]>, timestamp: number }>(CACHE_KEY);
      
      if (cached && cached.data && cached.timestamp) {
        const age = Date.now() - cached.timestamp;
        if (age < CACHE_TTL_MS) {
          const cachedUsers = cached.data[workspaceId] || [];
          if (cachedUsers.length > 0) {
            setOnlineUsers(cachedUsers);
            hasLoadedCache.current = true;
            return true;
          }
        }
      }
    } catch (err) {
      console.warn('⚠️ HeaderOnlineUsers: оши��ка чтения кэша:', err);
    }
    
    return false;
  }, [workspaceId]);

  // Send leave - явное удаление presence при уходе из календаря
  const sendLeave = useCallback(async () => {
    if (!accessToken) return;
    try {
      await presenceApi.leaveWorkspace(workspaceId);
    } catch (error: any) {
      console.warn('⚠️ Leave: ошибка', error.message || error);
    }
  }, [workspaceId, accessToken]);

  // Send heartbeat
  const sendHeartbeat = useCallback(async () => {
    if (!accessToken) return;
    try {
      await presenceApi.sendHeartbeat(workspaceId);
      heartbeatFailureCount.current = 0;
    } catch (error: any) {
      heartbeatFailureCount.current++;
      
      // Если ошибка авторизации (401) - автоматически перезагружаем страницу
      // Это запустит checkAuth() в App.tsx который обновит токен
      if (error.message?.includes('Unauthorized') || error.message?.includes('invalid JWT')) {
        console.warn(`⚠️ Heartbeat: ошибка авторизации, перезагрузка для обновления токена...`);
        window.location.reload();
        return;
      }
      
      if (heartbeatFailureCount.current >= 3) {
        console.error(`❌ Heartbeat: ошибка (п��пытка ${heartbeatFailureCount.current})`);
      }
    }
  }, [workspaceId, accessToken]);

  useEffect(() => {
    sendHeartbeat();
    const heartbeatInterval = setInterval(sendHeartbeat, 30000);
    return () => {
      clearInterval(heartbeatInterval);
      sendLeave();
    };
  }, [sendHeartbeat, sendLeave]);

  // Fetch users
  const fetchOnlineUsers = useCallback(async (isInitial: boolean = false) => {
    if (!accessToken) return;

    if (isInitial) {
      await loadFromCache();
    }

    try {
      const newUsers = await presenceApi.getOnlineUsers(workspaceId);
      setOnlineUsers(prev => {
        if (JSON.stringify(prev) !== JSON.stringify(newUsers)) {
          return newUsers;
        }
        return prev;
      });
    } catch (error: any) {
      // Silently fail or log warning
      if (!error.message?.includes('Failed to fetch')) {
         console.warn('⚠️ HeaderOnlineUsers: fetch error', error);
      }
    }
  }, [workspaceId, accessToken, loadFromCache]);

  useEffect(() => {
    fetchOnlineUsers(true);
    const fetchInterval = setInterval(() => fetchOnlineUsers(false), 30000);
    return () => clearInterval(fetchInterval);
  }, [fetchOnlineUsers]);

  // Helpers
  const getInitials = (user: OnlineUser): string => {
    if (user.displayName) {
      const parts = user.displayName.trim().split(/\s+/).filter(p => p.length > 0);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return user.displayName.substring(0, 2).toUpperCase();
    }
    const emailName = user.email.split('@')[0];
    return emailName.substring(0, 2).toUpperCase();
  };

  const getDisplayName = (user: OnlineUser): string => {
    return user.displayName || user.email.split('@')[0];
  };

  // Сортировка: текущий справа, остальные слева
  const sortedUsers = useMemo(() => {
      return [...allUsers].sort((a, b) => {
        const aIsCurrent = a.email?.toLowerCase().trim() === currentUserEmail?.toLowerCase().trim();
        const bIsCurrent = b.email?.toLowerCase().trim() === currentUserEmail?.toLowerCase().trim();
        
        if (aIsCurrent) return 1; // Текущий в конец (справа)
        if (bIsCurrent) return -1;
        
        return getDisplayName(a).localeCompare(getDisplayName(b));
      });
  }, [allUsers, currentUserEmail]);

  if (sortedUsers.length === 0) return null;

  return (
    <TooltipProvider delayDuration={300}>
      <div className={`flex items-center ${className || ''}`}>
        {sortedUsers.map((user, index) => {
             const isCurrent = user.email?.toLowerCase().trim() === currentUserEmail?.toLowerCase().trim();
             return (
                <TooltipProvider key={user.userId} delayDuration={300}>
                  <div 
                    className={`shrink-0 flex items-center justify-center transition-all duration-200 ${isCurrent ? 'z-10' : 'z-0'} hover:z-[100]`}
                    style={{
                      marginRight: index < sortedUsers.length - 1 ? '-8px' : '0',
                    }}
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div 
                          className={`relative rounded-[12px] size-[32px] flex items-center justify-center overflow-hidden border-2 border-white`}
                          style={{
                            backgroundColor: user.avatarUrl ? 'transparent' : '#f6f6f6',
                          }}
                        >
                          {user.avatarUrl ? (
                        <ImageWithFallback 
                          src={user.avatarUrl} 
                          alt={getDisplayName(user)}
                          className="absolute inset-0 size-full object-cover"
                        />
                      ) : (
                        <span className="text-[#868789] text-[14px] font-normal">
                          {getInitials(user)}
                        </span>
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent 
                    side="bottom" 
                    align="end" 
                    className="z-[1000] bg-gray-900 text-white border-gray-700 px-3 py-2 animate-none data-[state=closed]:animate-none"
                  >
                    <div className="whitespace-nowrap">
                      <div className="font-semibold text-[13px]">
                        {getDisplayName(user)}
                        {isCurrent && (
                          <span className="text-green-400 ml-1.5">
                            (вы)
                          </span>
                        )}
                      </div>
                      {user.email && (
                        <div className="text-xs text-gray-400 mt-0.5">
                          {user.email}
                        </div>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
                  </div>
                </TooltipProvider>
             );
        })}
      </div>
    </TooltipProvider>
  );
}