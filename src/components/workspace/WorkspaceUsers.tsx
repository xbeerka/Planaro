import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";

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

const MAX_VISIBLE = 3;

export function WorkspaceUsers({
  users,
  currentUserEmail,
}: WorkspaceUsersProps) {
  // Get initials from display name (first letter of first name + first letter of last name)
  const getInitials = (user: WorkspaceUser): string => {
    if (user.displayName) {
      const parts = user.displayName
        .trim()
        .split(/\s+/)
        .filter((p) => p.length > 0);
      if (parts.length >= 2) {
        // Имя и Фамилия - берем первую букву имени + первую букву фамилии
        return (
          parts[0][0] + parts[parts.length - 1][0]
        ).toUpperCase();
      }
      // Если только одно слово - берем первые 2 буквы
      return user.displayName.substring(0, 2).toUpperCase();
    }

    // Fallback на email
    const emailName = user.email.split("@")[0];
    return emailName.substring(0, 2).toUpperCase();
  };

  // Get full display name
  const getDisplayName = (user: WorkspaceUser): string => {
    return user.displayName || user.email.split("@")[0];
  };

  // Сортировка: текущий пользователь показывается последним (справа)
  // Остальные в алфавитном порядке (A → Z)
  const sortedUsers = [...users].sort((a, b) => {
    const aIsCurrent =
      a.email?.toLowerCase().trim() ===
      currentUserEmail?.toLowerCase().trim();
    const bIsCurrent =
      b.email?.toLowerCase().trim() ===
      currentUserEmail?.toLowerCase().trim();

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

  const visibleUsers = sortedUsers.slice(0, MAX_VISIBLE);
  const overflowUsers = sortedUsers.slice(MAX_VISIBLE);
  const overflowCount = overflowUsers.length;

  return (
    <TooltipProvider delayDuration={300}>
      {/* User avatars */}
      <div className="flex items-center">
        {visibleUsers.map((user, index) => {
          const isCurrentUser =
            user.email?.toLowerCase().trim() ===
            currentUserEmail?.toLowerCase().trim();
          return (
            <Tooltip key={user.userId}>
              <TooltipTrigger asChild>
                <div
                  className="w-6 h-6 rounded-[8px] flex items-center justify-center cursor-pointer hover:scale-110 transition-transform duration-200 overflow-hidden bg-[#f6f6f6]"
                  style={{
                    border: "1.5px solid #fff",
                    marginLeft: index > 0 ? "-8px" : "0",
                    zIndex: index,
                    position: "relative",
                  }}
                >
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={getDisplayName(user)}
                      className="w-full h-full object-cover rounded-[0px]"
                    />
                  ) : (
                    <span
                      className="text-[#868789]"
                      style={{
                        fontSize: "9px",
                        fontWeight: 600,
                      }}
                    >
                      {getInitials(user)}
                    </span>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                align="end"
                className="bg-gray-900 text-white border-gray-700 px-3 py-2 animate-none data-[state=closed]:animate-none"
              >
                <div className="whitespace-nowrap">
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: "13px",
                    }}
                  >
                    {getDisplayName(user)}
                    {isCurrentUser && (
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
          );
        })}

        {overflowCount > 0 && (
          <OverflowBadge
            count={overflowCount}
            users={overflowUsers}
            currentUserEmail={currentUserEmail}
            getDisplayName={getDisplayName}
            getInitials={getInitials}
            offset={visibleUsers.length}
          />
        )}
      </div>
    </TooltipProvider>
  );
}

function OverflowBadge({
  count,
  users,
  currentUserEmail,
  getDisplayName,
  getInitials,
  offset,
}: {
  count: number;
  users: WorkspaceUser[];
  currentUserEmail?: string;
  getDisplayName: (u: WorkspaceUser) => string;
  getInitials: (u: WorkspaceUser) => string;
  offset: number;
}) {
  const [open, setOpen] = useState(false);
  const badgeRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pos, setPos] = useState({ top: 0, right: 0 });

  const handleEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    if (!badgeRef.current) return;
    const rect = badgeRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + 6,
      right: window.innerWidth - rect.right,
    });
    setOpen(true);
  };

  const handleLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => setOpen(false), 150);
  };

  const handleDropdownEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
  };

  const handleDropdownLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => setOpen(false), 150);
  };

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  return (
    <>
      <div
        ref={badgeRef}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        className="w-6 h-6 rounded-[8px] flex items-center justify-center cursor-pointer bg-[#e8e8e8] hover:bg-[#d8d8d8] transition-colors"
        style={{
          border: "1.5px solid #fff",
          marginLeft: "-8px",
          zIndex: offset,
          position: "relative",
        }}
      >
        <span className="text-[#555] text-[9px]" style={{ fontWeight: 600 }}>
          +{count}
        </span>
      </div>

      {open &&
        createPortal(
          <div
            ref={dropdownRef}
            onMouseEnter={handleDropdownEnter}
            onMouseLeave={handleDropdownLeave}
            className="fixed bg-white rounded-xl shadow-lg border border-gray-200 py-2 min-w-[220px] z-[502] overflow-hidden"
            style={{ top: pos.top, right: pos.right }}
          >
            {users.map((user) => {
              const isCurrent =
                user.email?.toLowerCase().trim() ===
                currentUserEmail?.toLowerCase().trim();
              return (
                <div
                  key={user.userId}
                  className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 transition-colors"
                >
                  <div
                    className="relative rounded-[8px] w-6 h-6 flex items-center justify-center overflow-hidden shrink-0 bg-[#f6f6f6]"
                  >
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt={getDisplayName(user)}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span
                        className="text-[#868789]"
                        style={{ fontSize: "9px", fontWeight: 600 }}
                      >
                        {getInitials(user)}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] text-gray-800 truncate">
                      {getDisplayName(user)}
                      {isCurrent && (
                        <span className="text-green-600 ml-1 text-[12px]">
                          (вы)
                        </span>
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
    </>
  );
}