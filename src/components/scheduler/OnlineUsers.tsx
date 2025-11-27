import { useState, useEffect, useCallback, memo, useMemo, useRef } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { decodeSupabaseJWT, getEmailFromToken, getDisplayNameFromToken } from '../../utils/jwt';
import { getStorageJSON } from '../../utils/storage';
import { presenceApi } from '../../services/api/presence';

interface OnlineUser {
  userId: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  lastSeen: string;
}

interface OnlineUsersProps {
  workspaceId: string;
  accessToken: string | null;
  currentUserEmail?: string;
}

function OnlineUsersComponent({ workspaceId, accessToken, currentUserEmail }: OnlineUsersProps) {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const hasLoadedCache = useRef(false); // Флаг для однократной загрузки из кэша
  const heartbeatFailureCount = useRef(0); // Счетчик последовательных ошибок heartbeat
  
  // Текущий пользователь - сразу доступен (априори онлайн)
  // Используем decodeSupabaseJWT для правильной обработки кириллицы в именах
  const currentUser = useMemo(() => {
    if (!accessToken) return null;
    
    const payload = decodeSupabaseJWT(accessToken);
    const user = {
      userId: payload?.sub || '',
      email: getEmailFromToken(accessToken) || '',
      displayName: getDisplayNameFromToken(accessToken),
      avatarUrl: payload?.user_metadata?.avatar_url as string | undefined,
      lastSeen: new Date().toISOString()
    };
    
    return user;
  }, [accessToken]);
  
  // Объединяем текущего пользователя + онлайн пользователей с сервера
  const allUsers = useMemo(() => {
    if (!currentUser) return onlineUsers;
    
    // ВАЖНО: Текущий пользователь ВСЕГДА берется из токена (с актуальной avatarUrl)
    // Удаляем текущего из списка с сервера и добавляем из токена
    const otherUsers = onlineUsers.filter(u => 
      u.email?.toLowerCase() !== currentUser.email?.toLowerCase()
    );
    
    return [currentUser, ...otherUsers];
  }, [onlineUsers, currentUser]);

  // Загрузка из кэша (один раз при монтировании)
  const loadFromCache = useCallback(async () => {
    if (hasLoadedCache.current) return false;
    
    try {
      const CACHE_KEY = 'cache_online_users_batch';
      const CACHE_TTL_MS = 45000; // 45 секунд TTL
      
      const cached = await getStorageJSON<{ data: Record<string, OnlineUser[]>, timestamp: number }>(CACHE_KEY);
      
      if (cached && cached.data && cached.timestamp) {
        const age = Date.now() - cached.timestamp;
        if (age < CACHE_TTL_MS) {
          const cachedUsers = cached.data[workspaceId] || [];
          if (cachedUsers.length > 0) {
            setOnlineUsers(cachedUsers);
            hasLoadedCache.current = true;
            return true; // Кэш валиден
          }
        }
      }
    } catch (err) {
      console.warn('⚠️ OnlineUsers: ошибка чтения кэша:', err);
    }
    
    return false; // Кэш невалиден
  }, [workspaceId]);

  // Fetch online users
  const fetchOnlineUsers = useCallback(async (isInitial: boolean = false) => {
    if (!accessToken) {
      return;
    }

    // При первой загрузке - сначала пробуем кэш
    if (isInitial) {
      await loadFromCache();
    }

    try {
      // Используем presenceApi с автоматическими ретраями
      const newUsers = await presenceApi.getOnlineUsers(workspaceId);
      
      // Обновляем только если изменился состав пользователей
      setOnlineUsers(prev => {
        if (JSON.stringify(prev) !== JSON.stringify(newUsers)) {
          return newUsers;
        }
        return prev;
      });
    } catch (error: any) {
      // Gracefully handle network errors
      if (error.message?.includes('Failed to fetch')) {
        console.warn('⚠️ OnlineUsers: Временная сетевая ошибка (retry через 30 сек)');
      } else if (error.message?.includes('Cloudflare')) {
        console.warn('⚠️ OnlineUsers: База данных временно недоступна (retry через 30 сек)');
      } else {
        console.warn('⚠️ OnlineUsers: ошибка загрузки', error.message?.substring(0, 100) || error);
      }
      // Keep showing last known online users (graceful degradation)
    }
  }, [workspaceId, accessToken, loadFromCache]);

  // Send leave - явное удаление presence при уходе из календаря
  const sendLeave = useCallback(async () => {
    if (!accessToken) {
      return;
    }

    try {
      await presenceApi.leaveWorkspace(workspaceId);
    } catch (error: any) {
      // Не критично если leave не дошел - через 60 секунд presence истечет автоматически
      console.warn('⚠️ Leave: ошибка', error.message || error);
    }
  }, [workspaceId, accessToken]);

  // Send heartbeat
  const sendHeartbeat = useCallback(async () => {
    if (!accessToken) {
      return;
    }

    try {
      await presenceApi.sendHeartbeat(workspaceId);
      // Сброс счетчика ошибок при успешной отправке
      heartbeatFailureCount.current = 0;
    } catch (error: any) {
      heartbeatFailureCount.current++;
      
      // Показываем предупреждение только после 3 неудачных попыток подряд
      if (heartbeatFailureCount.current >= 3) {
        console.error(`❌ Heartbeat: ошибка (попытка ${heartbeatFailureCount.current})`);
        console.error('💡 Убедитесь что Edge Function задеплоена: supabase functions deploy make-server-73d66528');
      }
      
      // Не выбрасываем ошибку - heartbeat продолжит попытки через 30 секунд
    }
  }, [workspaceId, accessToken]);

  // Send heartbeat on mount and every 30 seconds
  // При размонтировании - отправляем leave для мгновенного удаления из онлайн списка
  useEffect(() => {
    sendHeartbeat();
    const heartbeatInterval = setInterval(sendHeartbeat, 30000); // 30 seconds

    return () => {
      clearInterval(heartbeatInterval);
      // Отправляем leave при закрытии календаря (размонтирование компонента)
      sendLeave();
    };
  }, [sendHeartbeat, sendLeave]);

  // Fetch online users: первый раз с кэшем, затем каждые 30 секунд обновление (оптимизировано)
  useEffect(() => {
    // Первая загрузка - проверяем кэш, затем запрос к серверу
    fetchOnlineUsers(true);
    
    // Периодическое обновление каждые 30 секунд (снижена частота для оптимизации)
    const fetchInterval = setInterval(() => fetchOnlineUsers(false), 30000);

    return () => {
      clearInterval(fetchInterval);
      hasLoadedCache.current = false; // Сброс флага при размонтировании
    };
  }, [fetchOnlineUsers]);

  // Get initials from display name (first letter of first name + first letter of last name)
  const getInitials = (user: OnlineUser): string => {
    if (user.displayName) {
      const parts = user.displayName.trim().split(/\s+/).filter(p => p.length > 0);
      if (parts.length >= 2) {
        // Имя и Фамилия - берем первую букву имени + первую букву фамилии
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      // Если только одно слово - берем первые 2 буквы
      return user.displayName.substring(0, 2).toUpperCase();
    }
    
    // Fallback на email
    const emailName = user.email.split('@')[0];
    return emailName.substring(0, 2).toUpperCase();
  };

  // Get full display name
  const getDisplayName = (user: OnlineUser): string => {
    return user.displayName || user.email.split('@')[0];
  };

  // Сортировка: текущий пользователь последний (справа после rotate-180)
  // Остальные в прямом алфавитном порядке (A → Z), визуально Z → A после поворота
  const sortedUsers = [...allUsers].sort((a, b) => {
    const aIsCurrent = a.email?.toLowerCase().trim() === currentUserEmail?.toLowerCase().trim();
    const bIsCurrent = b.email?.toLowerCase().trim() === currentUserEmail?.toLowerCase().trim();
    
    // Текущий пользователь всегда последним в массиве (справа после поворота)
    if (aIsCurrent) return 1;
    if (bIsCurrent) return -1;
    
    // Остальные в прямом алфавитном порядке (A → Z)
    return getDisplayName(a).localeCompare(getDisplayName(b));
  });

  // Показываем только если есть пользователи (как минимум текущий)
  if (sortedUsers.length === 0) {
    return null;
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="fixed left-[18px] bottom-[18px] flex items-center gap-2 p-3 rounded-xl shadow-[0_6px_20px_rgba(6,18,36,0.08)] bg-[rgba(0,0,0,0.75)] backdrop-blur-md z-[600]">
        {/* User avatars */}
        <div className="flex items-center">
          {sortedUsers.map((user, index) => (
            <Tooltip key={user.userId}>
              <TooltipTrigger asChild>
                <div 
                  className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg cursor-pointer hover:scale-110 transition-transform duration-200 overflow-hidden"
                  style={{
                    marginRight: index > 0 ? '-8px' : '0'
                  }}
                >
                  {user.avatarUrl ? (
                    <img 
                      src={user.avatarUrl} 
                      alt={getDisplayName(user)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-white text-xs" style={{ fontWeight: 600 }}>
                      {getInitials(user)}
                    </span>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent 
                side="top" 
                align="start"
                className="bg-gray-900 text-white border-gray-700 px-3 py-2"
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '13px' }}>
                    {getDisplayName(user)}
                    {user.email?.toLowerCase().trim() === currentUserEmail?.toLowerCase().trim() && (
                      <span className="text-green-400 ml-1.5">(вы)</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {user.email}
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}

// Мемоизация для предотвращения лишних ре-рендеров при hover на ячейках
export const OnlineUsers = memo(OnlineUsersComponent);

// Вспомогательные функции для извлечения данных из токена
function getEmailFromToken(token: string): string | null {
  const payload = decodeSupabaseJWT(token);
  return payload?.email || null;
}

function getDisplayNameFromToken(token: string): string | null {
  const payload = decodeSupabaseJWT(token);
  return payload?.user_metadata?.name || payload?.user_metadata?.display_name || null;
}