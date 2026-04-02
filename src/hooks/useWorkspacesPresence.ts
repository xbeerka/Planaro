/**
 * Hook для подписки на Supabase Realtime Presence по нескольким воркспейсам.
 * Используется на экране списка воркспейсов — показывает кто онлайн в каждом.
 * 
 * Подписывается на те же каналы `presence:workspace:${id}`, что и PresenceContext,
 * но только слушает (без track) — не отправляет своё присутствие.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabaseClient, setSupabaseAuth } from '../utils/supabase/client';
import { getEmailFromToken } from '../utils/jwt';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface OnlineUser {
  userId: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  lastSeen: string;
}

/**
 * Подписывается на Realtime Presence каналы для списка воркспейсов.
 * Возвращает Map<workspaceId, OnlineUser[]>.
 */
export function useWorkspacesPresence(
  workspaceIds: string[],
  accessToken: string | null
): Map<string, OnlineUser[]> {
  const [onlineMap, setOnlineMap] = useState<Map<string, OnlineUser[]>>(new Map());
  const channelsRef = useRef<Map<string, RealtimeChannel>>(new Map());
  const mountedRef = useRef(true);

  const currentEmail = accessToken ? getEmailFromToken(accessToken) : null;

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!accessToken || workspaceIds.length === 0) {
      // Cleanup if no workspaces
      channelsRef.current.forEach(ch => supabaseClient.removeChannel(ch));
      channelsRef.current.clear();
      setOnlineMap(new Map());
      return;
    }

    const setup = async () => {
      await setSupabaseAuth(accessToken);

      const currentChannelIds = new Set(channelsRef.current.keys());
      const desiredIds = new Set(workspaceIds.map(String));

      // Remove channels for workspaces no longer in the list
      for (const [wsId, channel] of channelsRef.current.entries()) {
        if (!desiredIds.has(wsId)) {
          supabaseClient.removeChannel(channel);
          channelsRef.current.delete(wsId);
        }
      }

      // Subscribe to new workspaces
      for (const wsId of workspaceIds) {
        const wsIdStr = String(wsId);
        if (channelsRef.current.has(wsIdStr)) continue; // already subscribed

        const channelName = `presence:workspace:${wsIdStr}`;

        const channel = supabaseClient.channel(channelName, {
          config: { presence: { key: `list-listener-${Date.now()}` } },
        });

        channel.on('presence', { event: 'sync' }, () => {
          if (!mountedRef.current) return;
          const state = channel.presenceState();
          const users: OnlineUser[] = [];

          Object.entries(state).forEach(([key, presences]) => {
            // Skip our list-listener keys
            if (key.startsWith('list-listener-')) return;

            const latest = (presences as any[])?.[0];
            if (!latest) return;

            // Filter out current user
            if (currentEmail && latest.email?.toLowerCase() === currentEmail.toLowerCase()) return;

            users.push({
              userId: key,
              email: latest.email || '',
              displayName: latest.displayName,
              avatarUrl: latest.avatarUrl,
              lastSeen: latest.online_at || new Date().toISOString(),
            });
          });

          setOnlineMap(prev => {
            const next = new Map(prev);
            next.set(wsIdStr, users);
            return next;
          });
        });

        channel.subscribe();

        channelsRef.current.set(wsIdStr, channel);
      }
    };

    setup();

    return () => {
      channelsRef.current.forEach(ch => supabaseClient.removeChannel(ch));
      channelsRef.current.clear();
    };
  }, [accessToken, workspaceIds.join(',')]); // join to avoid reference changes

  return onlineMap;
}