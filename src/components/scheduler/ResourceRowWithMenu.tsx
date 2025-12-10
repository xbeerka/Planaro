import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Resource } from '../../types/scheduler';
import { MoreVertical, Edit, Trash2 } from 'lucide-react';

interface ResourceRowWithMenuProps {
  resource: Resource;
  searchQuery?: string;
  getUserInitials: (fullName: string, grade?: string) => string;
  onEdit?: (resourceId: string) => void;
  onDelete?: (resourceId: string) => void;
}

export function ResourceRowWithMenu({
  resource,
  searchQuery,
  getUserInitials,
  onEdit,
  onDelete,
}: ResourceRowWithMenuProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Calculate menu position when it opens
  useEffect(() => {
    if (showMenu && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 4, // 4px gap below button
        left: rect.right - 140, // align right edge of menu with button (140px = min-width)
      });
    }
  }, [showMenu]);

  // Highlight search matches
  const highlightMatch = (text: string, query: string) => {
    if (!query) return text;
    
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return (
      <>
        {parts.map((part, i) => 
          part.toLowerCase() === query.toLowerCase() ? (
            <span key={i} style={{ backgroundColor: '#FFD700' }}>
              {part}
            </span>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </>
    );
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu]);

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        gap: '12px',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        if (!showMenu) setShowMenu(false);
      }}
    >
      {/* Avatar */}
      <div
        style={{
          position: 'relative',
          borderRadius: '12px',
          flexShrink: 0,
          width: '36px',
          height: '36px',
          overflow: 'hidden',
        }}
      >
        {resource.avatarUrl ? (
          <img
            src={resource.avatarUrl}
            alt={resource.fullName || `User ${resource.id}`}
            style={{
              position: 'absolute',
              inset: 0,
              maxWidth: 'none',
              objectFit: 'cover',
              pointerEvents: 'none',
              borderRadius: '12px',
              width: '100%',
              height: '100%',
            }}
          />
        ) : (
          <div
            style={{
              background: '#f6f6f6',
              borderRadius: '12px',
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <p className="text-sm text-[#868789]">
              {getUserInitials(resource.fullName, undefined)}
            </p>
          </div>
        )}
      </div>

      {/* Info (Name + Position) */}
      <div
        style={{
          flex: 1,
          minWidth: '1px',
          minHeight: '1px',
          display: 'flex',
          flexDirection: 'column',
          gap: '0px',
          alignItems: 'flex-start',
          justifyContent: 'flex-start',
          whiteSpace: 'nowrap',
        }}
      >
        <p
          className="font-medium text-sm text-black w-full"
          style={{
            lineHeight: '20px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flexShrink: 1,
          }}
        >
          {searchQuery
            ? highlightMatch(
                resource.fullName || `User ${resource.id}`,
                searchQuery
              )
            : resource.fullName || `User ${resource.id}`}
        </p>
        <p
          className="text-xs text-[#868789] w-full"
          style={{
            lineHeight: '16px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flexShrink: 1,
          }}
        >
          {searchQuery
            ? highlightMatch(
                resource.position || 'No position',
                searchQuery
              )
            : resource.position || 'No position'}
        </p>
      </div>

      {/* Menu Button */}
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation();
          setShowMenu(!showMenu);
        }}
        className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all"
        title="Действия"
        style={{
          position: 'relative',
          boxSizing: 'border-box',
          display: 'flex',
          gap: '6px',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8px',
          borderRadius: '12px',
          flexShrink: 0,
          cursor: 'pointer',
          background: 'transparent',
          border: 'none',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.03)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <div 
          aria-hidden="true" 
          style={{
            position: 'absolute',
            border: '0.8px solid rgba(0, 0, 0, 0.12)',
            borderRadius: '12px',
            inset: 0,
            pointerEvents: 'none',
          }}
        />
        <MoreVertical className="w-4 h-4 text-gray-600" />
      </button>

      {/* Dropdown Menu */}
      {showMenu && (
        createPortal(
          <div
            ref={menuRef}
            className="bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[140px]"
            style={{
              position: 'fixed',
              top: `${menuPosition.top}px`,
              left: `${menuPosition.left}px`,
              zIndex: 9999,
            }}
          >
            {onEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(resource.id);
                  setShowMenu(false);
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 text-gray-700 transition-colors"
              >
                <Edit className="w-4 h-4" />
                Изменить
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(resource.id);
                  setShowMenu(false);
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 flex items-center gap-2 text-red-600 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Удалить
              </button>
            )}
          </div>,
          document.body
        )
      )}
    </div>
  );
}