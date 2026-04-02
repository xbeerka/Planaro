import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Bell, Check, X, CheckCheck, Mail, Clock, MessageSquare } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { notificationsApi, NotificationItem } from '../../services/api/notifications';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { getUserIdFromToken } from '../../utils/jwt';
import { supabaseClient, setSupabaseAuth } from '../../utils/supabase/client';

interface NotificationCenterProps {
  accessToken: string | null;
  onInviteAccepted?: (context: { workspace_id?: number; organization_id?: number }) => void;
  onAccessChanged?: (payload: { action: string; scope: string; workspace_id?: string; organization_id?: string; new_role?: string }) => void;
}

type TabType = 'all' | 'invites' | 'unread';

function getInitials(name?: string | null): string {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'только что';
  if (mins < 60) return `${mins} мин назад`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'вчера';
  if (days < 7) return `${days} д назад`;
  return new Date(dateStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function getDateGroup(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const itemDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (itemDay.getTime() === today.getTime()) return 'Сегодня';
  if (itemDay.getTime() === yesterday.getTime()) return 'Вчера';
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

export function NotificationCenter({ accessToken, onInviteAccepted, onAccessChanged }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [actionInProgress, setActionInProgress] = useState<Set<number>>(new Set());
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const channelRef = useRef<ReturnType<typeof notificationsApi.subscribe> | null>(null);
  
  // Stable refs for callbacks to avoid re-subscribing on every render
  const onAccessChangedRef = useRef(onAccessChanged);
  onAccessChangedRef.current = onAccessChanged;

  const userId = accessToken ? getUserIdFromToken(accessToken) : null;
  const unreadCount = notifications.filter(n => !n.is_read).length;

  const isInvite = (n: NotificationItem) => n.type === 'workspace_invite' || n.type === 'org_invite';

  const inviteCount = notifications.filter(n => isInvite(n)).length;

  const filteredNotifications = useMemo(() => {
    switch (activeTab) {
      case 'invites':
        return notifications.filter(n => isInvite(n));
      case 'unread':
        return notifications.filter(n => !n.is_read);
      default:
        return notifications;
    }
  }, [notifications, activeTab]);

  // Group by date
  const groupedNotifications = useMemo(() => {
    const groups: { label: string; items: NotificationItem[] }[] = [];
    let currentGroup: string | null = null;

    for (const notif of filteredNotifications) {
      const group = getDateGroup(notif.created_at);
      if (group !== currentGroup) {
        currentGroup = group;
        groups.push({ label: group, items: [] });
      }
      groups[groups.length - 1].items.push(notif);
    }
    return groups;
  }, [filteredNotifications]);

  const loadNotifications = useCallback(async () => {
    if (!userId) return;
    try {
      setIsLoading(true);
      const data = await notificationsApi.getAll(userId);
      setNotifications(data);
    } catch (err) {
      console.error('❌ Failed to load notifications:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!accessToken || !userId) return;
    
    let cancelled = false;
    
    const init = async () => {
      await setSupabaseAuth(accessToken);
      if (cancelled) return;
      
      loadNotifications();
      
      channelRef.current = notificationsApi.subscribe(userId, () => {
        loadNotifications();
      }, (payload) => {
        if (onAccessChangedRef.current) {
          onAccessChangedRef.current(payload);
        }
      });
    };
    
    init();

    return () => {
      cancelled = true;
      if (channelRef.current) {
        notificationsApi.unsubscribe(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [accessToken, userId, loadNotifications]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  const handleAccept = async (notif: NotificationItem) => {
    setActionInProgress(prev => new Set(prev).add(notif.id));
    try {
      const result = await notificationsApi.acceptInvite(notif.id, accessToken || undefined);
      toast.success('Приглашение принято', { description: notif.title });
      // Optimistic: remove the invite notification immediately
      setNotifications(prev => prev.filter(n => n.id !== notif.id));
      if (onInviteAccepted) {
        onInviteAccepted({ workspace_id: result.workspace_id, organization_id: result.organization_id });
      }
      // Reload to get the new system notification
      await loadNotifications();
    } catch (err: any) {
      console.error('❌ Accept invite error:', err);
      toast.error('Ошибка', { description: err.message });
    } finally {
      setActionInProgress(prev => { const s = new Set(prev); s.delete(notif.id); return s; });
    }
  };

  const handleDecline = async (notif: NotificationItem) => {
    setActionInProgress(prev => new Set(prev).add(notif.id));
    try {
      await notificationsApi.declineInvite(notif.id, accessToken || undefined);
      toast.success('Приглашение отклонено');
      // Optimistic: remove the notification immediately
      setNotifications(prev => prev.filter(n => n.id !== notif.id));
      // No need to reload — notification is deleted on server
    } catch (err: any) {
      console.error('❌ Decline invite error:', err);
      toast.error('Ошибка', { description: err.message });
    } finally {
      setActionInProgress(prev => { const s = new Set(prev); s.delete(notif.id); return s; });
    }
  };

  const handleMarkAllRead = async () => {
    if (!userId) return;
    try {
      await notificationsApi.markAllRead(userId);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (err: any) {
      console.error('❌ Mark all read error:', err);
    }
  };

  const handleDismiss = async (notifId: number) => {
    if (!userId) return;
    try {
      // 1. Optimistic removal
      setNotifications(prev => prev.filter(n => n.id !== notifId));
      
      // Добавляем ID в actionInProgress чтобы блокировать клики
      setActionInProgress(prev => {
        const next = new Set(prev);
        next.add(notifId);
        return next;
      });

      // 2. Network request
      await notificationsApi.dismiss(notifId, userId);
      
      // Убираем из InProgress после успешного удаления
      setActionInProgress(prev => {
        const next = new Set(prev);
        next.delete(notifId);
        return next;
      });
    } catch (err: any) {
      console.error('❌ Dismiss notification error:', err);
      toast.error('Не удалось удалить уведомление');
      // В случае ошибки возвращаем обратно через перезагрузку
      await loadNotifications();
      
      setActionInProgress(prev => {
        const next = new Set(prev);
        next.delete(notifId);
        return next;
      });
    }
  };

  const tabs: { key: TabType; label: string; count?: number }[] = [
    { key: 'all', label: 'Все' },
    { key: 'invites', label: 'Инвайты', count: inviteCount },
    { key: 'unread', label: 'Непрочитанные', count: unreadCount },
  ];

  return (
    <div className="relative z-[9999]">
      {/* Bell Button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex items-center justify-center w-8 h-8 rounded-[10px] hover:bg-[#f6f6f6] transition-colors cursor-pointer"
      >
        <Bell className="w-[18px] h-[18px] text-[#868789]" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] flex items-center justify-center bg-[#FF3B30] text-white text-[9px] font-medium rounded-full px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          ref={panelRef}
          className="absolute right-0 top-[calc(100%+6px)] w-[420px] max-h-[520px] bg-white rounded-[14px] shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-[#f0f0f0] z-[200] flex flex-col overflow-hidden"
        >
          {/* Tabs + Mark all read */}
          <div className="flex items-center justify-between px-4 pt-3 pb-0 border-b border-[#f0f0f0]">
            <div className="flex items-center gap-0">
              {tabs.map(tab => {
                const isActive = activeTab === tab.key;
                const showCount = tab.count !== undefined && tab.count > 0;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`relative px-3 pb-2.5 text-[13px] font-medium transition-colors cursor-pointer ${
                      isActive ? 'text-[#1a1a1a]' : 'text-[#868789] hover:text-[#555]'
                    }`}
                  >
                    {tab.label}
                    {showCount && (
                      <span className={`ml-1 text-[11px] ${isActive ? 'text-[#1a1a1a]' : 'text-[#868789]'}`}>
                        ({tab.count})
                      </span>
                    )}
                    {isActive && (
                      <div className="absolute bottom-0 left-3 right-3 h-[2px] bg-[#1a1a1a] rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-[12px] text-[#0062FF] hover:text-[#0052D9] transition-colors cursor-pointer pb-2.5 font-medium whitespace-nowrap"
              >
                Прочитать все
              </button>
            )}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            {isLoading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-[13px] text-[#999]">
                Загрузка...
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <Bell className="w-8 h-8 text-[#ddd]" />
                <span className="text-[13px] text-[#999]">
                  {activeTab === 'invites' ? 'Нет приглашений' :
                   activeTab === 'unread' ? 'Нет непрочитанных' : 'Нет уведомлений'}
                </span>
              </div>
            ) : (
              groupedNotifications.map(group => (
                <div key={group.label}>
                  {/* Date group header */}
                  <div className="px-4 pt-3 pb-1.5">
                    <span className="text-[11px] font-medium text-[#868789] uppercase tracking-wider">
                      {group.label}
                    </span>
                  </div>
                  {group.items.map(notif => (
                    <NotificationRow
                      key={notif.id}
                      notif={notif}
                      isInvite={isInvite(notif)}
                      showActions={isInvite(notif)}
                      isActioning={actionInProgress.has(notif.id)}
                      onAccept={() => handleAccept(notif)}
                      onDecline={() => handleDecline(notif)}
                      onDismiss={() => handleDismiss(notif.id)}
                    />
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationRow({
  notif,
  isInvite,
  showActions,
  isActioning,
  onAccept,
  onDecline,
  onDismiss,
}: {
  notif: NotificationItem;
  isInvite: boolean;
  showActions: boolean;
  isActioning: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="relative w-full group">
      <div className="flex gap-[12px] items-start pt-[8px] pb-[16px] px-[16px]">
        {/* Avatar 40x40 */}
        {notif.type === 'system' ? (
          <div className="w-[40px] h-[40px] rounded-[6px] shrink-0 bg-[#f0f0f0] flex items-center justify-center">
            {notif.data?.subtype === 'invite_accepted' ? (
              <Check className="w-[18px] h-[18px] text-[#34A853]" />
            ) : (
              <MessageSquare className="w-[18px] h-[18px] text-[#868789]" />
            )}
          </div>
        ) : (
          <Avatar className="w-[40px] h-[40px] rounded-[6px] shrink-0">
            {notif.actor_avatar && <AvatarImage src={notif.actor_avatar} alt={notif.actor_name || ''} className="rounded-[6px]" />}
            <AvatarFallback className="text-[12px] font-medium rounded-[6px] bg-[#ececf0] text-[#868789]">
              {getInitials(notif.actor_name)}
            </AvatarFallback>
          </Avatar>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0 flex flex-col gap-[10px]">
          {/* Text block */}
          <div className="flex flex-col gap-[3px] w-full">
            {/* Title row: title + time + unread dot */}
            <div className="flex items-center justify-between w-full">
              <p className="flex-1 min-w-0 text-[12px] text-[#1a1a1a] truncate" style={{ fontFamily: "'Onest', sans-serif" }}>
                {notif.title}
              </p>
              <div className="flex items-center gap-[6px] shrink-0 ml-[8px]">
                <span className="text-[12px] text-[#b0b0b0] whitespace-nowrap" style={{ fontFamily: "'Onest', sans-serif" }}>
                  {timeAgo(notif.created_at)}
                </span>
                {!notif.is_read && (
                  <div className="w-[7px] h-[7px] rounded-full bg-[#0062ff] shrink-0" />
                )}
              </div>
            </div>
            {/* Body */}
            {notif.body && (
              <p className="text-[11px] text-[#b0b0b0] w-full" style={{ fontFamily: "'Onest', sans-serif", lineHeight: 'normal' }}>
                {notif.body}
              </p>
            )}
          </div>

          {/* Invite action buttons */}
          {showActions && (
            <div className="flex gap-[8px] h-[34px] w-full">
              <button
                onClick={(e) => { e.stopPropagation(); onDecline(); }}
                disabled={isActioning}
                className="flex-1 h-[34px] flex items-center justify-center bg-white border border-[#e0e0e0] text-[#333] rounded-[10px] text-[12px] font-medium hover:bg-[#f6f6f6] disabled:opacity-50 transition-colors cursor-pointer"
                style={{ fontFamily: "'Onest', sans-serif" }}
              >
                Отклонить
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onAccept(); }}
                disabled={isActioning}
                className="flex-1 h-[34px] flex items-center justify-center bg-[#0062ff] text-white rounded-[10px] text-[12px] font-medium hover:bg-[#0052D9] disabled:opacity-50 transition-colors cursor-pointer"
                style={{ fontFamily: "'Onest', sans-serif" }}
              >
                Принять
              </button>
            </div>
          )}
        </div>

        {/* Dismiss button — only for non-invite or acted invites */}
        {(!isInvite || !showActions) && (
          <button
            onClick={(e) => { e.stopPropagation(); onDismiss(); }}
            className="w-6 h-6 flex items-center justify-center rounded-[6px] opacity-0 group-hover:opacity-100 hover:bg-[#f0f0f0] transition-all shrink-0 mt-0.5 cursor-pointer"
            title="Удалить"
          >
            <X className="w-3.5 h-3.5 text-[#999]" />
          </button>
        )}
      </div>
    </div>
  );
}