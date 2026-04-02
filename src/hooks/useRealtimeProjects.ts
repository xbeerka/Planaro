/**
 * useRealtimeProjects — Realtime подписка на изменения проектов
 * 
 * Подписывается на postgres_changes для таблицы projects.
 * Маппит DB row → Project (с префиксом p для id, ep для patternId).
 * Защита от собственных изменений через lastLocalChange cooldown.
 */
import { useEffect, useRef, useCallback } from 'react';
import { supabaseClient } from '../utils/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Project } from '../types/scheduler';

// Маппинг строки БД → Project (аналогично server_data.tsx:1784-1790)
function mapDbRowToProject(row: any): Project {
  return {
    id: `p${row.id}`,
    name: row.name,
    backgroundColor: row.backgroundColor || row.background_color || '#3B82F6',
    textColor: row.textColor || row.text_color || '#FFFFFF',
    patternId: row.pattern_id ? `ep${row.pattern_id}` : undefined,
    workspaceId: row.workspace_id ? String(row.workspace_id) : undefined,
  };
}

interface UseRealtimeProjectsProps {
  workspaceId: string;
  enabled: boolean;
  setProjects: (fn: (prev: Project[]) => Project[]) => void;
  lastLocalChangeRef: React.MutableRefObject<number>;
}

const LOCAL_CHANGE_COOLDOWN = 5000; // 5 секунд (проекты сохраняются через модалку, cooldown побольше)

export function useRealtimeProjects({
  workspaceId,
  enabled,
  setProjects,
  lastLocalChangeRef,
}: UseRealtimeProjectsProps) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  const canApplyChange = useCallback((): boolean => {
    const timeSinceLocal = Date.now() - lastLocalChangeRef.current;
    if (timeSinceLocal < LOCAL_CHANGE_COOLDOWN) {
      return false;
    }
    return true;
  }, [lastLocalChangeRef]);

  useEffect(() => {
    if (!enabled || !workspaceId) {
      return;
    }



    const channel = supabaseClient
      .channel(`projects-ws-${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'projects',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          const mapped = mapDbRowToProject(payload.new);

          if (!canApplyChange()) {
            return;
          }

          setProjects(prev => {
            if (prev.some(p => p.id === mapped.id)) {
              return prev;
            }
            return [...prev, mapped];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'projects',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          const mapped = mapDbRowToProject(payload.new);

          if (!canApplyChange()) {
            return;
          }

          setProjects(prev => {
            const idx = prev.findIndex(p => p.id === mapped.id);
            if (idx === -1) {
              return [...prev, mapped];
            }

            const existing = prev[idx];
            if (
              existing.name === mapped.name &&
              existing.backgroundColor === mapped.backgroundColor &&
              existing.textColor === mapped.textColor &&
              existing.patternId === mapped.patternId
            ) {
              return prev;
            }

            const updated = [...prev];
            updated[idx] = mapped;
            return updated;
          });
        }
      )
      .on(
        'postgres_changes',
        {
          // DELETE БЕЗ фильтра — Supabase при DELETE отправляет только PK
          event: 'DELETE',
          schema: 'public',
          table: 'projects',
        },
        (payload) => {
          const deletedId = `p${(payload.old as any).id}`;

          if (!canApplyChange()) {
            return;
          }

          setProjects(prev => {
            const filtered = prev.filter(p => p.id !== deletedId);
            if (filtered.length === prev.length) {
              return prev;
            }
            return filtered;
          });
        }
      )
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('❌ Realtime Projects: ошибка канала', err);
        }
      });

    channelRef.current = channel;

    return () => {
      supabaseClient.removeChannel(channel);
      channelRef.current = null;
    };
  }, [workspaceId, enabled, canApplyChange, setProjects]);
}