import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Workspace } from '../../types/scheduler';
import { workspaceMembersApi, WorkspaceAccessEntry } from '../../services/api/workspaceMembers';
import { toast } from 'sonner@2.0.3';
import {
  X,
  Pencil,
  Eye,
  Loader2,
  UserPlus,
  Mail,
  Trash2,
  Clock,
  Check,
  ChevronDown,
} from 'lucide-react';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '../ui/avatar';
import { supabaseClient } from '../../utils/supabase/client';

interface ShareWorkspaceModalProps {
  workspace: Workspace;
  onClose: () => void;
  accessToken?: string | null;
  onSharedCountChange?: (workspaceId: string | number, newCount: number) => void;
  isViewer?: boolean;
  /** If true, subtitle says "Организация" instead of "Пространство" */
  isOrganization?: boolean;
}

export function ShareWorkspaceModal({ workspace, onClose, accessToken, onSharedCountChange, isViewer = false, isOrganization = false }: ShareWorkspaceModalProps) {
  const [entries, setEntries] = useState<WorkspaceAccessEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [emailInput, setEmailInput] = useState('');
  const [selectedRole, setSelectedRole] = useState<'editor' | 'viewer'>('viewer');
  const [isInviting, setIsInviting] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [showRoleSelector, setShowRoleSelector] = useState(false);
  const roleSelectorRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadEntries(); }, [workspace.id]);

  // Realtime: подписка на изменения workspace_members и workspace_invites
  useEffect(() => {
    const wsId = String(workspace.id);
    console.log(`🔌 ShareModal: подписка на Realtime для workspace ${wsId}`);

    const channel = supabaseClient
      .channel(`share-ws-${wsId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'workspace_members',
        filter: `workspace_id=eq.${wsId}`,
      }, (payload) => {
        console.log('🔌 ShareModal Realtime: workspace_members changed', payload.eventType);
        loadEntries();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'workspace_invites',
        filter: `workspace_id=eq.${wsId}`,
      }, (payload) => {
        console.log('🔌 ShareModal Realtime: workspace_invites changed', payload.eventType);
        loadEntries();
      })
      .subscribe((status) => {
        console.log(`🔌 ShareModal Realtime status: ${status}`);
      });

    return () => {
      console.log(`🔌 ShareModal: отписка от Realtime для workspace ${wsId}`);
      supabaseClient.removeChannel(channel);
    };
  }, [workspace.id]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-role-dropdown]')) {
        setOpenDropdownId(null);
      }
      if (roleSelectorRef.current && !roleSelectorRef.current.contains(target)) {
        setShowRoleSelector(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const loadEntries = async () => {
    setIsLoading(true);
    try {
      const data = await workspaceMembersApi.getMembers(workspace.id, accessToken || undefined);
      setEntries(data);
      console.log(`👥 Loaded ${data.length} entries for workspace ${workspace.id}`);
    } catch (err: any) {
      console.error('❌ Error loading members:', err);
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInvite = async () => {
    const email = emailInput.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      toast.error('Введите корректный email');
      return;
    }

    const existingEmails = new Set(entries.filter(e => e.role !== 'owner').map(e => e.email.toLowerCase()));
    if (existingEmails.has(email)) {
      toast.warning(`Уже добавлен: ${email}`);
      setEmailInput('');
      return;
    }

    setIsInviting(true);
    try {
      const result = await workspaceMembersApi.inviteMembers(
        workspace.id, [email], selectedRole, accessToken || undefined
      );

      const parts: string[] = [];
      if (result.added_members > 0) parts.push(`${result.added_members} добавлено`);
      if (result.created_invites > 0) parts.push(`${result.created_invites} приглашено`);
      
      toast.success(parts.length > 0 ? parts.join(', ') : 'Приглашение отправлено', {
        description: 'Пользователь получит уведомление'
      });

      setEmailInput('');
      setSelectedRole('viewer');
      const freshData = await workspaceMembersApi.getMembers(workspace.id, accessToken || undefined);
      setEntries(freshData);
      const nonOwnerCount = freshData.filter((e: WorkspaceAccessEntry) => e.role !== 'owner').length;
      onSharedCountChange?.(workspace.id, nonOwnerCount);
    } catch (err: any) {
      console.error('❌ Invite error:', err);
      toast.error('Ошибка приглашения', { description: err.message });
    } finally {
      setIsInviting(false);
    }
  };

  const handleUpdateRole = async (entry: WorkspaceAccessEntry, newRole: 'editor' | 'viewer') => {
    if (entry.role === newRole) { setOpenDropdownId(null); return; }

    const prevEntries = entries;
    setEntries(prev => prev.map(e => {
      if (entry.type === 'member' && e.user_id === entry.user_id) return { ...e, role: newRole };
      if (entry.type === 'invite' && e.invite_id === entry.invite_id) return { ...e, role: newRole };
      return e;
    }));
    setOpenDropdownId(null);

    try {
      if (entry.type === 'member' && entry.user_id) {
        await workspaceMembersApi.updateMemberRole(workspace.id, entry.user_id, newRole, accessToken || undefined);
      } else if (entry.type === 'invite' && entry.invite_id) {
        await workspaceMembersApi.updateInviteRole(workspace.id, entry.invite_id, newRole, accessToken || undefined);
      }
      toast.success(newRole === 'editor' ? 'Теперь редактор' : 'Теперь только просмотр');
    } catch (err: any) {
      setEntries(prevEntries);
      toast.error('Ошибка', { description: err.message });
    }
  };

  const handleRemove = async (entry: WorkspaceAccessEntry) => {
    const prevEntries = entries;
    setEntries(prev => prev.filter(e => {
      if (entry.type === 'member') return e.user_id !== entry.user_id;
      if (entry.type === 'invite') return e.invite_id !== entry.invite_id;
      return true;
    }));
    setOpenDropdownId(null);

    try {
      if (entry.type === 'member' && entry.user_id) {
        await workspaceMembersApi.removeMember(workspace.id, entry.user_id, accessToken || undefined);
      } else if (entry.type === 'invite' && entry.invite_id) {
        await workspaceMembersApi.revokeInvite(workspace.id, entry.invite_id, accessToken || undefined);
      }
      toast.success(
        entry.type === 'invite' ? 'Приглашение отозвано' : 'Доступ отозван',
        { description: entry.email }
      );
      const newNonOwnerCount = prevEntries.filter(e => e.role !== 'owner').length - 1;
      onSharedCountChange?.(workspace.id, Math.max(0, newNonOwnerCount));
    } catch (err: any) {
      setEntries(prevEntries);
      toast.error('Ошибка', { description: err.message });
    }
  };

  const getEntryKey = (entry: WorkspaceAccessEntry): string => {
    if (entry.type === 'member' && entry.user_id) return `m_${entry.user_id}`;
    if (entry.type === 'invite' && entry.invite_id) return `i_${entry.invite_id}`;
    return `e_${entry.email}`;
  };

  const getInitials = (name: string, email: string) => {
    if (name) {
      const parts = name.trim().split(' ');
      if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      return name.substring(0, 2).toUpperCase();
    }
    return email ? email.substring(0, 2).toUpperCase() : 'U';
  };

  const hasEmailInput = emailInput.trim().length > 0;
  const owner = entries.find(e => e.role === 'owner');
  const others = entries.filter(e => e.role !== 'owner');

  const roleLabel = selectedRole === 'editor' ? 'Изменение' : 'Просмотр';
  const subtitlePrefix = isOrganization ? 'Организация' : 'Пространство';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />

      <div
        className="relative bg-white rounded-[16px] w-[440px] max-h-[80vh] flex flex-col shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] overflow-hidden"
        style={{ animation: 'fadeInScale 0.15s ease-out' }}
      >
        {/* Header */}
        <div className="p-[20px]">
          <div className="flex items-start justify-between mb-[16px]">
            <div className="flex flex-col gap-[2px]">
              <h2 className="text-[15px] font-semibold text-[#1a1a1a] leading-normal">Поделиться</h2>
              <p className="text-[12px] text-[#868789] leading-normal">{subtitlePrefix} «{workspace.name}»</p>
            </div>
            <button
              onClick={onClose}
              className="w-[28px] h-[28px] flex items-center justify-center rounded-[8px] hover:bg-[#f6f6f6] transition-colors shrink-0"
            >
              <X className="w-4 h-4 text-[#868789]" />
            </button>
          </div>

          {/* Invite row */}
          <div className="flex gap-[8px] h-[36px] items-center">
            {/* Input with inline role selector */}
            <div className="flex-1 h-[36px] bg-[#f6f6f6] rounded-[10px] flex items-center">
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleInvite(); } }}
                placeholder="Введите email"
                disabled={isViewer}
                className="flex-1 h-full pl-[12px] pr-[4px] text-[13px] bg-transparent border-none outline-none placeholder:text-[#999] text-[#333] disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ minWidth: 0 }}
              />
              {/* Inline role selector - only when typing */}
              {hasEmailInput && !isViewer && (
                <div className="relative shrink-0 mr-[4px]" ref={roleSelectorRef}>
                  <button
                    onClick={() => setShowRoleSelector(!showRoleSelector)}
                    className="flex items-center gap-[4px] h-[28px] px-[8px] py-[4px] bg-white rounded-[6px] text-[12px] text-[#1a1a1a] whitespace-nowrap hover:text-[#666] transition-colors"
                  >
                    {roleLabel}
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ opacity: 0.5 }}>
                      <path d="M3 4.5L6 7.5L9 4.5" stroke="#1a1a1a" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  {showRoleSelector && (
                    <div className="absolute top-[32px] right-0 bg-white rounded-[10px] shadow-lg border border-[#f0f0f0] py-1 z-[10000] min-w-[150px]">
                      <button
                        onClick={() => { setSelectedRole('viewer'); setShowRoleSelector(false); }}
                        className="w-full px-3 py-1.5 flex items-center gap-2 text-[11px] hover:bg-[#f6f6f6] text-left transition-colors"
                      >
                        <span>Просмотр</span>
                        {selectedRole === 'viewer' && <Check className="w-3 h-3 ml-auto text-[#0062FF]" />}
                      </button>
                      <button
                        onClick={() => { setSelectedRole('editor'); setShowRoleSelector(false); }}
                        className="w-full px-3 py-1.5 flex items-center gap-2 text-[11px] hover:bg-[#f6f6f6] text-left transition-colors"
                      >
                        <span>Изменение</span>
                        {selectedRole === 'editor' && <Check className="w-3 h-3 ml-auto text-[#0062FF]" />}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Invite button */}
            <button
              onClick={handleInvite}
              disabled={isInviting || !hasEmailInput || isViewer}
              className={`h-[36px] px-[16px] shrink-0 flex items-center justify-center rounded-[10px] text-[13px] font-medium text-white whitespace-nowrap transition-colors ${
                hasEmailInput && !isViewer
                  ? 'bg-[#0062FF] hover:bg-[#0052D9]'
                  : 'bg-[#d6d6d6] cursor-not-allowed'
              }`}
            >
              {isInviting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Пригласить'}
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-[#f0f0f0] mx-0" />

        {/* List */}
        <div className="flex-1 overflow-y-auto px-[20px] py-[12px]" style={{ maxHeight: '380px' }}>
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-[#ccc]" />
            </div>
          ) : (
            <div className="flex flex-col gap-[8px]">
              {/* Owner */}
              {owner && (
                <MemberRow
                  entry={owner}
                  isOwner
                  getInitials={getInitials}
                />
              )}

              {/* Others */}
              {others.map(entry => {
                const key = getEntryKey(entry);
                return (
                  <MemberRow
                    key={key}
                    entry={entry}
                    entryKey={key}
                    getInitials={getInitials}
                    openDropdownId={openDropdownId}
                    setOpenDropdownId={setOpenDropdownId}
                    onUpdateRole={handleUpdateRole}
                    onRemove={handleRemove}
                    isRemoving={removingId === key}
                    isViewer={isViewer}
                  />
                );
              })}

              {entries.length === 0 && !isLoading && (
                <div className="text-center py-10 text-[#B0B0B0]">
                  <UserPlus className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-[12px]">Пока нет участников</p>
                  <p className="text-[11px] mt-1 text-[#ccc]">Пригласите коллег по email</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

// ---- MemberRow ----

interface MemberRowProps {
  entry: WorkspaceAccessEntry;
  isOwner?: boolean;
  entryKey?: string;
  getInitials: (name: string, email: string) => string;
  openDropdownId?: string | null;
  setOpenDropdownId?: (id: string | null) => void;
  onUpdateRole?: (entry: WorkspaceAccessEntry, role: 'editor' | 'viewer') => void;
  onRemove?: (entry: WorkspaceAccessEntry) => void;
  isRemoving?: boolean;
  isViewer?: boolean;
  /** Current user's ID to show "(Вы)" */
  currentUserId?: string;
}

function MemberRow({
  entry, isOwner, entryKey, getInitials,
  openDropdownId, setOpenDropdownId,
  onUpdateRole, onRemove, isRemoving,
  isViewer, currentUserId,
}: MemberRowProps) {
  const isInvite = entry.type === 'invite';
  const isDropdownOpen = openDropdownId === entryKey;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; right: number } | null>(null);

  useEffect(() => {
    if (isDropdownOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
    } else {
      setDropdownPos(null);
    }
  }, [isDropdownOpen]);

  const roleLabel = entry.role === 'editor' ? 'Изменение' : 'Просмотр';

  return (
    <div className={`flex items-center justify-between py-[7px]`}>
      {/* Left: avatar + info */}
      <div className="flex flex-1 gap-[8px] items-center min-w-0">
        {/* Avatar 28x28 */}
        {isInvite ? (
          /* Pending invite: dashed border + person icon */
          <div className="w-[28px] h-[28px] rounded-[6px] shrink-0 relative flex items-center justify-center"
               style={{ border: '1px dashed #999' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8.0002 1.39852C8.96559 1.39856 9.90651 1.70224 10.6897 2.26668C11.4728 2.83119 12.0582 3.62818 12.3635 4.54402C12.6687 5.45983 12.6787 6.44876 12.3908 7.3702C12.103 8.29139 11.532 9.09864 10.76 9.67781L10.5471 9.83699L10.7932 9.9366C12.2654 10.5343 13.5096 11.58 14.3518 12.921L14.5148 13.1925L14.5158 13.1954C14.5893 13.3327 14.6064 13.4939 14.5637 13.6436C14.521 13.793 14.4222 13.9212 14.2873 13.9991C14.1525 14.0768 13.9927 14.0983 13.842 14.0606C13.7288 14.0323 13.6266 13.9722 13.5481 13.8878L13.5412 13.8809L13.5422 13.88L13.4836 13.8038L13.4758 13.794C12.3164 11.7963 10.2703 10.5998 8.0002 10.5997C5.86931 10.5997 3.93545 11.6528 2.74727 13.4346L2.51973 13.7999L2.51583 13.8067L2.51485 13.8057C2.47703 13.8757 2.42647 13.9384 2.36446 13.9884C2.30207 14.0386 2.22991 14.0757 2.15254 14.0977C2.07556 14.1197 1.99423 14.1271 1.91426 14.1173C1.83447 14.1074 1.75773 14.0809 1.68868 14.0411C1.61935 14.001 1.55751 13.9471 1.50899 13.8829C1.46068 13.8188 1.42601 13.745 1.40645 13.6671C1.38688 13.5889 1.38327 13.5071 1.39571 13.4278C1.40819 13.3485 1.43629 13.2724 1.47872 13.2042L1.4836 13.1964C2.32385 11.7234 3.63495 10.5746 5.20626 9.9366L5.45137 9.83699L5.23946 9.67781C4.46749 9.09867 3.89646 8.29144 3.6086 7.3702C3.32081 6.44884 3.33082 5.45975 3.63594 4.54402C3.94126 3.62809 4.5276 2.83116 5.31075 2.26668C6.0939 1.70228 7.0348 1.39852 8.0002 1.39852ZM8.66329 2.66512C8.00377 2.53394 7.31969 2.60212 6.69844 2.85945C6.07744 3.11682 5.54654 3.55245 5.17305 4.11141C4.79954 4.67049 4.59981 5.32772 4.59981 6.00008L4.60372 6.16902L4.63399 6.48152C4.7383 7.20484 5.07403 7.88055 5.59688 8.4034C6.23423 9.04068 7.09892 9.39942 8.0002 9.40047L8.25118 9.3907C8.83512 9.34744 9.39964 9.15409 9.88887 8.82723C10.4479 8.4537 10.8835 7.92205 11.1408 7.30086C11.398 6.67975 11.4653 5.99631 11.3342 5.33699C11.203 4.67757 10.8799 4.07126 10.4045 3.59578C9.92899 3.12027 9.32281 2.7963 8.66329 2.66512Z" fill="#999" />
            </svg>
          </div>
        ) : (
          <Avatar className="w-[28px] h-[28px] rounded-[6px] shrink-0">
            {entry.avatar_url && <AvatarImage src={entry.avatar_url} alt={entry.display_name || entry.email} className="rounded-[6px]" />}
            <AvatarFallback className="text-[10px] font-medium rounded-[6px] bg-[#ececf0] text-[#868789]">
              {getInitials(entry.display_name, entry.email)}
            </AvatarFallback>
          </Avatar>
        )}

        {/* Name & email */}
        <div className="flex flex-col min-w-0">
          {isInvite ? (
            <p className="text-[12px] text-[#1a1a1a] leading-normal truncate">
              {entry.email}
              <span className="text-[#999]"> (Отправлено)</span>
            </p>
          ) : (
            <>
              <p className="text-[12px] text-[#1a1a1a] leading-normal truncate">
                {entry.display_name || entry.email.split('@')[0]}
                {currentUserId && entry.user_id === currentUserId && <span className="text-[#999]"> (Вы)</span>}
              </p>
              <p className="text-[11px] text-[#b0b0b0] leading-normal truncate">{entry.email}</p>
            </>
          )}
        </div>
      </div>

      {/* Right: role */}
      {isOwner ? (
        <span className="text-[12px] text-[#999] leading-[18px] whitespace-nowrap shrink-0">owner</span>
      ) : (
        <div className="relative shrink-0" data-role-dropdown>
          <button
            ref={buttonRef}
            onClick={() => !isViewer && setOpenDropdownId?.(isDropdownOpen ? null : (entryKey || null))}
            disabled={isRemoving || isViewer}
            className={`flex items-center gap-[4px] text-[12px] text-[#999] leading-normal whitespace-nowrap transition-colors hover:text-[#666] ${isViewer ? 'cursor-default' : ''}`}
          >
            {isRemoving ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <>
                {roleLabel}
                {!isViewer && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ opacity: 0.5 }}>
                    <path d="M3 4.5L6 7.5L9 4.5" stroke="#999" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </>
            )}
          </button>

          {/* Dropdown */}
          {isDropdownOpen && dropdownPos && !isViewer && (
            <div
              className="fixed bg-white rounded-[10px] shadow-lg border border-[#f0f0f0] py-1 z-[10000] min-w-[170px]"
              style={{ top: dropdownPos.top, right: dropdownPos.right }}
              data-role-dropdown
            >
              {(['editor', 'viewer'] as const).map(r => (
                <button
                  key={r}
                  onClick={() => onUpdateRole?.(entry, r)}
                  className="w-full px-3 py-1.5 flex items-center gap-2 text-[11px] hover:bg-[#f6f6f6] text-left transition-colors"
                >
                  <span>{r === 'editor' ? 'Изменение' : 'Просмотр'}</span>
                  {entry.role === r && <Check className="w-3 h-3 ml-auto text-[#0062FF]" />}
                </button>
              ))}
              
              <div className="h-px bg-[#f0f0f0] my-1" />
              
              <button
                onClick={() => onRemove?.(entry)}
                className="w-full px-3 py-1.5 flex items-center gap-2 text-[11px] text-red-500 hover:bg-red-50 text-left transition-colors"
              >
                <span>{isInvite ? 'Отозвать приглашение' : 'Удалить доступ'}</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}