import { apiRequest } from './base';
import { supabaseClient } from '../../utils/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface NotificationItem {
  id: number;
  organization_id: number | null;
  workspace_id: number | null;
  actor_auth_user_id: string | null;
  type: 'org_invite' | 'workspace_invite' | 'comment' | 'event' | 'mention' | 'system';
  title: string;
  body: string | null;
  data: Record<string, any>;
  created_at: string;
  is_read: boolean;
  read_at: string | null;
  actor_name: string | null;
  actor_avatar: string | null;
}

/**
 * Загрузить уведомления напрямую через Supabase Client (без Edge Function).
 * Требует RLS политики на таблицах notifications и notification_recipients.
 */
async function fetchNotificationsDirect(userId: string): Promise<NotificationItem[]> {
  // 1. Получаем записи recipient для текущего пользователя
  const { data: recipients, error: recErr } = await supabaseClient
    .from('notification_recipients')
    .select('notification_id, is_read, read_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (recErr) {
    console.error('❌ notification_recipients query error:', recErr);
    throw new Error(recErr.message);
  }
  if (!recipients || recipients.length === 0) return [];

  // 2. Получаем сами уведомления
  const notifIds = recipients.map(r => r.notification_id);
  const { data: notifications, error: notifErr } = await supabaseClient
    .from('notifications')
    .select('id, organization_id, workspace_id, actor_auth_user_id, type, title, body, data, created_at')
    .in('id', notifIds);

  if (notifErr) {
    console.error('❌ notifications query error:', notifErr);
    throw new Error(notifErr.message);
  }

  // 3. Получаем профили акторов
  const actorIds = [...new Set((notifications || []).map(n => n.actor_auth_user_id).filter(Boolean))];
  const actorProfiles = new Map<string, any>();
  if (actorIds.length > 0) {
    const { data: profiles } = await supabaseClient
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', actorIds);
    for (const p of (profiles || [])) actorProfiles.set(p.id, p);
  }

  // 5. Собираем результат (без Edge Function fallback, чтобы не блокировать UI таймаутами)
  const result = (notifications || []).map(n => {
    const recipient = recipients.find(r => r.notification_id === n.id);
    const actor = n.actor_auth_user_id ? actorProfiles.get(n.actor_auth_user_id) : null;
    return {
      ...n,
      is_read: recipient?.is_read || false,
      read_at: recipient?.read_at || null,
      actor_name: actor?.full_name || n.data?.actor_name || null,
      actor_avatar: actor?.avatar_url || n.data?.actor_avatar || null,
    };
  }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return result;
}

/**
 * Пометить уведомление как прочитанное — напрямую через Supabase
 */
async function markReadDirect(notificationId: number, userId: string): Promise<void> {
  const { error } = await supabaseClient
    .from('notification_recipients')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('notification_id', notificationId)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
}

/**
 * Пометить все уведомления как прочитанные — напрямую через Supabase
 */
async function markAllReadDirect(userId: string): Promise<void> {
  const { error } = await supabaseClient
    .from('notification_recipients')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('is_read', false);
  if (error) throw new Error(error.message);
}

/**
 * Удалить уведомление (удаляем запись recipient) — напрямую через Supabase
 */
async function dismissNotificationDirect(notificationId: number, userId: string): Promise<void> {
  // 1. Удаляем recipient
  const { error } = await supabaseClient
    .from('notification_recipients')
    .delete()
    .eq('notification_id', notificationId)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);

  // 2. Проверяем, остались ли другие recipients
  const { data: remaining, error: checkErr } = await supabaseClient
    .from('notification_recipients')
    .select('id')
    .eq('notification_id', notificationId)
    .limit(1);

  if (!checkErr && (!remaining || remaining.length === 0)) {
    // Нет получателей — удаляем саму notification
    const { error: delErr } = await supabaseClient
      .from('notifications')
      .delete()
      .eq('id', notificationId);
    if (delErr) {
      console.warn(`⚠️ Не удалось удалить notification ${notificationId}:`, delErr.message);
    } else {
      console.log(`🗑️ Notification ${notificationId} удалена из БД (нет получателей)`);
    }
  }

  console.log(`🔔 Уведомление ${notificationId} удалено для ${userId}`);
}

/**
 * Подписка на Realtime уведомления через Broadcast канал.
 * Edge Function отправляет broadcast после создания notification_recipient.
 * Это обходит все проблемы с RLS и SECURITY DEFINER.
 */
function subscribeToNotifications(
  userId: string,
  onNewNotification: () => void,
  onAccessChanged?: (payload: { action: string; scope: string; workspace_id?: string; organization_id?: string; new_role?: string }) => void,
): RealtimeChannel {
  // Канал уникален для пользователя, БЕЗ Date.now() — чтобы сервер мог адресовать!
  const channelName = `notifications:user:${userId}`;

  const channel = supabaseClient
    .channel(channelName)
    .on('broadcast', { event: 'new_notification' }, (payload) => {
      console.log('🔔 Broadcast: new_notification');
      onNewNotification();
    })
    .on('broadcast', { event: 'notification_updated' }, (payload) => {
      console.log('🔔 Broadcast: notification_updated');
      onNewNotification();
    })
    .on('broadcast', { event: 'access_changed' }, (payload) => {
      console.log('🔐 Broadcast: access_changed', payload.payload);
      if (onAccessChanged && payload.payload) {
        onAccessChanged(payload.payload as any);
      }
    })
    .subscribe();

  return channel;
}

function unsubscribeFromNotifications(channel: RealtimeChannel): void {
  supabaseClient.removeChannel(channel);
}

export const notificationsApi = {
  // Прямые запросы через Supabase Client (без Edge Function)
  getAll: fetchNotificationsDirect,
  markRead: markReadDirect,
  markAllRead: markAllReadDirect,
  dismiss: dismissNotificationDirect,

  // Realtime
  subscribe: subscribeToNotifications,
  unsubscribe: unsubscribeFromNotifications,

  // Действия через Edge Function (требуют серверной логики)
  acceptInvite: async (id: number, token?: string) => {
    console.log(`🔔 Accept invite: notification ${id}`);
    try {
      const result = await apiRequest<{ success: boolean; workspace_id?: number }>(
        `/notifications/${id}/accept`,
        { method: 'POST', token, retries: 0, timeout: 15000 }
      );
      console.log(`✅ Accept invite result:`, result);
      return result;
    } catch (err: any) {
      console.error(`❌ Accept invite FAILED for notification ${id}:`, err.message);
      throw err;
    }
  },

  declineInvite: async (id: number, token?: string) => {
    console.log(`🔔 Decline invite: notification ${id}`);
    try {
      const result = await apiRequest<{ success: boolean }>(
        `/notifications/${id}/decline`,
        { method: 'POST', token, retries: 0, timeout: 15000 }
      );
      console.log(`✅ Decline invite result:`, result);
      return result;
    } catch (err: any) {
      console.error(`❌ Decline invite FAILED for notification ${id}:`, err.message);
      throw err;
    }
  },
};