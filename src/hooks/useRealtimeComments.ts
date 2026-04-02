/**
 * useRealtimeComments — Realtime подписка на изменения комментариев
 * 
 * Подписывается на postgres_changes для таблицы comments.
 * Маппит DB row → Comment.
 * Защита от собственных изменений через lastLocalChange cooldown.
 * 
 * Аватарки: НЕ резолвятся из ресурсов — authorAvatarUrl приходит с сервера
 * при начальной загрузке. При Realtime UPDATE сохраняется существующая аватарка.
 * DELETE: подписка БЕЗ фильтра workspace_id (Supabase Realtime
 * при DELETE отправляет только PK в payload.old, фильтр не сработает
 * без REPLICA IDENTITY FULL). Фильтрация — клиентская по existing comments.
 */
import { useEffect, useRef, useCallback } from 'react';
import { supabaseClient } from '../utils/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Comment } from '../types/scheduler';

function mapDbRowToComment(row: any): Comment {
  const currentYear = new Date().getFullYear();
  const d = new Date(currentYear, 0, 1 + ((row.week_number || 0) * 7));
  const weekDate = d.toISOString().split('T')[0];
  
  const resourceId = `r${row.resource_id}`;

  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    resourceId,
    authorAuthUserId: row.author_auth_user_id || null,
    authorAvatarUrl: undefined,
    comment: row.comment || '',
    weekDate,
    weekIndex: row.week_number,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface UseRealtimeCommentsProps {
  workspaceId: string;
  enabled: boolean;
  setComments: (fn: (prev: Comment[]) => Comment[]) => void;
  lastLocalChangeRef: React.MutableRefObject<number>;
}

const LOCAL_CHANGE_COOLDOWN = 3000; // ms

export function useRealtimeComments({
  workspaceId,
  enabled,
  setComments,
  lastLocalChangeRef,
}: UseRealtimeCommentsProps) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  const canApplyChange = useCallback((): boolean => {
    const timeSinceLocal = Date.now() - lastLocalChangeRef.current;
    return timeSinceLocal >= LOCAL_CHANGE_COOLDOWN;
  }, [lastLocalChangeRef]);

  useEffect(() => {
    if (!enabled || !workspaceId) return;

    const channel = supabaseClient
      .channel(`comments-ws-${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comments',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          const mapped = mapDbRowToComment(payload.new);

          if (!canApplyChange()) return;

          setComments(prev => {
            if (prev.some(c => c.id === mapped.id)) return prev;
            return [...prev, mapped];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'comments',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          const mapped = mapDbRowToComment(payload.new);

          if (!canApplyChange()) return;

          setComments(prev => {
            const idx = prev.findIndex(c => c.id === mapped.id);
            if (idx === -1) return [...prev, mapped];

            const existing = prev[idx];
            if (
              existing.comment === mapped.comment &&
              existing.weekIndex === mapped.weekIndex &&
              existing.resourceId === mapped.resourceId
            ) {
              return prev;
            }

            const updated = [...prev];
            // Сохраняем authorAvatarUrl от ОРИГИНАЛЬНОГО комментария
            // (аватарка автора не меняется при перемещении коммента на другой ресурс)
            updated[idx] = { ...mapped, authorAvatarUrl: existing.authorAvatarUrl };
            return updated;
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'comments',
        },
        (payload) => {
          const deletedId = String((payload.old as any).id);

          if (!canApplyChange()) return;

          setComments(prev => {
            const filtered = prev.filter(c => c.id !== deletedId);
            if (filtered.length === prev.length) return prev;
            return filtered;
          });
        }
      )
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('❌ Realtime Comments: ошибка канала', err);
        }
      });

    channelRef.current = channel;

    return () => {
      supabaseClient.removeChannel(channel);
      channelRef.current = null;
    };
  }, [workspaceId, enabled, canApplyChange, setComments]);
}