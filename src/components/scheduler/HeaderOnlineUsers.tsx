import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import { decodeSupabaseJWT, getEmailFromToken, getDisplayNameFromToken } from '../../utils/jwt';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import { usePresenceOptional } from '../../contexts/PresenceContext';

interface OnlineUser {
  userId: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  lastSeen: string;
  color?: string; // Цвет курсора
}

interface HeaderOnlineUsersProps {
  workspaceId: string;
  accessToken: string | null;
  className?: string;
}

const MAX_VISIBLE = 3;

// Helper hook для безопасного доступа к Presence (может быть недоступен)
function useSafePresence() {
  const context = usePresenceOptional();
  
  if (!context) {
    return {
      onlineUsers: [],
      isAvailable: false,
      myColor: '#e5e5e5',
      scrollToUser: (_: string) => {},
      cursors: [],
    };
  }
  return context;
}

export function HeaderOnlineUsers({ workspaceId, accessToken, className }: HeaderOnlineUsersProps) {
  const [overflowOpen, setOverflowOpen] = useState(false);
  const overflowRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 📡 Realtime Presence — единственный источник данных (без KV Store polling)
  const { onlineUsers: realtimeUsers, isAvailable: realtimeAvailable, myColor, scrollToUser, cursors } = useSafePresence();
  
  // Текущий пользователь из токена
  const currentUser = useMemo(() => {
    if (!accessToken) return null;
    
    const payload = decodeSupabaseJWT(accessToken);
    return {
      userId: payload?.sub || '',
      email: getEmailFromToken(accessToken) || '',
      displayName: getDisplayNameFromToken(accessToken),
      avatarUrl: payload?.user_metadata?.avatar_url as string | undefined,
      lastSeen: new Date().toISOString(),
      color: myColor,
    };
  }, [accessToken, myColor]);
  
  const currentUserEmail = currentUser?.email;

  // Realtime пользователи
  const onlineUsers: OnlineUser[] = useMemo(() => {
    if (realtimeAvailable && realtimeUsers.length > 0) {
      return realtimeUsers.map(u => ({
        userId: u.userId,
        email: u.email,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        lastSeen: new Date().toISOString(),
        color: u.color,
      }));
    }
    return [];
  }, [realtimeAvailable, realtimeUsers]);

  // Объединяем текущего пользователя + онлайн пользователей
  const allUsers = useMemo(() => {
    if (!currentUser) return onlineUsers;
    
    const otherUsers = onlineUsers.filter(u => 
      u.email?.toLowerCase() !== currentUser.email?.toLowerCase()
    );
    
    return [currentUser, ...otherUsers];
  }, [onlineUsers, currentUser]);

  // Close overflow dropdown on outside click
  useEffect(() => {
    if (!overflowOpen) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) return;
      setOverflowOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [overflowOpen]);

  // Dropdown position
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 });
  useEffect(() => {
    if (!overflowOpen || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setDropdownPos({
      top: rect.bottom + 6,
      right: window.innerWidth - rect.right,
    });
  }, [overflowOpen]);

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

  const visibleUsers = sortedUsers.slice(0, MAX_VISIBLE);
  const overflowUsers = sortedUsers.slice(MAX_VISIBLE);
  const overflowCount = overflowUsers.length;

  if (sortedUsers.length === 0) return null;

  // Check if a user has an active cursor
  const userHasCursor = useCallback((userId: string): boolean => {
    return cursors.some(c => c.userId === userId && c.contentX > 0 && c.contentY > 0);
  }, [cursors]);

  const handleUserClick = useCallback((user: OnlineUser, isCurrent: boolean) => {
    if (isCurrent) return; // Не скроллим к себе
    if (!userHasCursor(user.userId)) return;
    console.log(`🔍 Scroll to user: ${user.displayName || user.email} (${user.userId})`);
    scrollToUser(user.userId);
  }, [scrollToUser, userHasCursor]);

  const renderAvatar = (user: OnlineUser, isCurrent: boolean, index: number, isLast: boolean) => {
    const borderColor = user.color || (isCurrent ? myColor : '#e5e5e5');
    const hasCursor = !isCurrent && userHasCursor(user.userId);
    
    return (
      <TooltipProvider key={user.userId} delayDuration={300}>
        <div 
          className={`shrink-0 flex items-center justify-center transition-all duration-200 ${isCurrent ? 'z-10' : 'z-0'} hover:z-[100]`}
          style={{
            marginRight: !isLast || overflowCount > 0 ? '-8px' : '0',
          }}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <div 
                className={`relative rounded-[12px] size-[32px] flex items-center justify-center overflow-hidden transition-colors ${hasCursor ? 'cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-blue-400' : ''}`}
                style={{
                  backgroundColor: user.avatarUrl ? 'transparent' : '#f6f6f6',
                  border: `2px solid ${borderColor}`,
                }}
                onClick={() => handleUserClick(user, isCurrent)}
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
                <div className="font-semibold text-[13px] flex items-center gap-1.5">
                  {user.color && (
                    <span
                      className="inline-block w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: user.color }}
                    />
                  )}
                  {getDisplayName(user)}
                  {isCurrent && (
                    <span className="text-green-400 ml-1">
                      (вы)
                    </span>
                  )}
                </div>
                {user.email && (
                  <div className="text-xs text-gray-400 mt-0.5">
                    {user.email}
                  </div>
                )}
                {!isCurrent && hasCursor && (
                  <div className="text-xs text-blue-300 mt-1">
                    Нажмите, чтобы перейти к курсору
                  </div>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    );
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className={`flex items-center ${className || ''}`}>
        {visibleUsers.map((user, index) => {
          const isCurrent = user.email?.toLowerCase().trim() === currentUserEmail?.toLowerCase().trim();
          return renderAvatar(user, isCurrent, index, index === visibleUsers.length - 1);
        })}

        {overflowCount > 0 && (
          <div className="relative">
            <button
              ref={buttonRef}
              onClick={() => setOverflowOpen(prev => !prev)}
              className="relative rounded-[12px] size-[32px] flex items-center justify-center border-2 border-white bg-[#e8e8e8] hover:bg-[#d8d8d8] transition-colors z-[5] cursor-pointer"
              title={`Ещё ${overflowCount}`}
            >
              <span className="text-[#555] text-[12px] font-medium">
                +{overflowCount}
              </span>
            </button>

            {overflowOpen && createPortal(
              <div
                ref={dropdownRef}
                className="fixed bg-white rounded-xl shadow-lg border border-gray-200 py-2 min-w-[220px] z-[502] overflow-hidden"
                style={{ top: dropdownPos.top, right: dropdownPos.right }}
              >
                {overflowUsers.map((user) => {
                  const isCurrent = user.email?.toLowerCase().trim() === currentUserEmail?.toLowerCase().trim();
                  const hasCursor = !isCurrent && userHasCursor(user.userId);
                  return (
                    <div
                      key={user.userId}
                      className={`flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 transition-colors ${hasCursor ? 'cursor-pointer' : ''}`}
                      onClick={() => {
                        if (hasCursor) {
                          handleUserClick(user, isCurrent);
                          setOverflowOpen(false);
                        }
                      }}
                    >
                      <div 
                        className="relative rounded-[10px] size-[28px] flex items-center justify-center overflow-hidden shrink-0"
                        style={{
                          backgroundColor: user.avatarUrl ? 'transparent' : '#f6f6f6',
                          border: `2px solid ${user.color || '#e5e5e5'}`,
                        }}
                      >
                        {user.avatarUrl ? (
                          <ImageWithFallback 
                            src={user.avatarUrl} 
                            alt={getDisplayName(user)}
                            className="absolute inset-0 size-full object-cover"
                          />
                        ) : (
                          <span className="text-[#868789] text-[11px] font-normal">
                            {getInitials(user)}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[13px] text-gray-800 truncate flex items-center gap-1.5">
                          {user.color && (
                            <span
                              className="inline-block w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: user.color }}
                            />
                          )}
                          {getDisplayName(user)}
                          {isCurrent && (
                            <span className="text-green-600 ml-1 text-[12px]">(вы)</span>
                          )}
                        </div>
                        {user.email && (
                          <div className="text-[11px] text-gray-400 truncate">
                            {user.email}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>,
              document.body
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}