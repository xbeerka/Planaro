import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';

// Онлайн пользователь (из presence системы)
interface WorkspaceUser {
  userId: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  lastSeen: string;
}

interface WorkspaceUsersProps {
  users: WorkspaceUser[];
  currentUserEmail?: string;
}

export function WorkspaceUsers({ users, currentUserEmail }: WorkspaceUsersProps) {
  // Get initials from display name (first letter of first name + first letter of last name)
  const getInitials = (user: WorkspaceUser): string => {
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
  const getDisplayName = (user: WorkspaceUser): string => {
    return user.displayName || user.email.split('@')[0];
  };

  // Сортировка: текущий пользователь показывается последним (справа)
  // Остальные в алфавитном порядке (A → Z)
  const sortedUsers = [...users].sort((a, b) => {
    const aIsCurrent = a.email?.toLowerCase().trim() === currentUserEmail?.toLowerCase().trim();
    const bIsCurrent = b.email?.toLowerCase().trim() === currentUserEmail?.toLowerCase().trim();
    
    // Текущий пользователь всегда последним в массиве (справа)
    if (aIsCurrent) return 1;
    if (bIsCurrent) return -1;
    
    // Остальные в алфавитном порядке (A → Z)
    return getDisplayName(a).localeCompare(getDisplayName(b));
  });

  // Скрываем только если вообще нет пользователей
  if (sortedUsers.length === 0) {
    return null;
  }

  return (
    <TooltipProvider delayDuration={300}>
      {/* User avatars */}
      <div className="flex items-center">
        {sortedUsers.map((user, index) => {
          const isCurrentUser = user.email?.toLowerCase().trim() === currentUserEmail?.toLowerCase().trim();
          return (
            <Tooltip key={user.userId}>
              <TooltipTrigger asChild>
                <div 
                  className={`w-6 h-6 rounded-full flex items-center justify-center cursor-pointer hover:scale-110 transition-transform duration-200 overflow-hidden ${
                    isCurrentUser 
                      ? 'bg-gradient-to-br from-green-500 to-green-700' 
                      : 'bg-gradient-to-br from-blue-500 to-blue-700'
                  }`}
                  style={{
                    border: '1.5px solid #fff',
                    marginRight: index > 0 ? '-8px' : '0'
                  }}
                >
                  {/* Аватарка приходит из presence данных (для всех пользователей включая текущего) */}
                  {user.avatarUrl ? (
                    <img 
                      src={user.avatarUrl} 
                      alt={getDisplayName(user)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-white" style={{ fontSize: '9px', fontWeight: 600 }}>
                      {getInitials(user)}
                    </span>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent 
                side="top" 
                className="bg-gray-900 text-white border-gray-700 px-3 py-2"
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '13px' }}>
                    {getDisplayName(user)}
                    {isCurrentUser && (
                      <span className="text-green-400 ml-1.5">(вы)</span>
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
          );
        })}
      </div>
    </TooltipProvider>
  );
}
