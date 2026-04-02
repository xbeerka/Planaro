/**
 * useRealtimeDepartments — Realtime подписка на изменения департаментов
 * 
 * Подписывается на postgres_changes для таблицы departments.
 * Маппит DB row → Department (с префиксом d для id).
 * Защита от собственных изменений через lastLocalChange cooldown.
 * 
 * DELETE: подписка БЕЗ фильтра (Supabase при DELETE отправляет только PK).
 */
import { useEffect, useRef, useCallback } from 'react';
import { supabaseClient } from '../utils/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Department } from '../types/scheduler';

function mapDbRowToDepartment(row: any): Department {
  return {
    id: `d${row.id}`,
    name: row.name || '',
    queue: row.queue ?? 999,
    visible: row.visible !== undefined ? row.visible : true,
    color: row.color || null,
    usersCount: row.users_count,
    last_activity_at: row.last_activity_at,
  };
}

interface UseRealtimeDepartmentsProps {
  workspaceId: string;
  enabled: boolean;
  setDepartments: (fn: (prev: Department[]) => Department[]) => void;
  lastLocalChangeRef: React.MutableRefObject<number>;
}

const LOCAL_CHANGE_COOLDOWN = 5000;

export function useRealtimeDepartments({
  workspaceId,
  enabled,
  setDepartments,
  lastLocalChangeRef,
}: UseRealtimeDepartmentsProps) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  const canApplyChange = useCallback((): boolean => {
    const timeSinceLocal = Date.now() - lastLocalChangeRef.current;
    return timeSinceLocal >= LOCAL_CHANGE_COOLDOWN;
  }, [lastLocalChangeRef]);

  useEffect(() => {
    if (!enabled || !workspaceId) return;



    const channel = supabaseClient
      .channel(`departments-ws-${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'departments',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          const mapped = mapDbRowToDepartment(payload.new);

          if (!canApplyChange()) return;

          setDepartments(prev => {
            if (prev.some(d => d.id === mapped.id)) return prev;
            return [...prev, mapped].sort((a, b) => (a.queue ?? 999) - (b.queue ?? 999));
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'departments',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          const mapped = mapDbRowToDepartment(payload.new);

          if (!canApplyChange()) return;

          setDepartments(prev => {
            const idx = prev.findIndex(d => d.id === mapped.id);
            if (idx === -1) return [...prev, mapped].sort((a, b) => (a.queue ?? 999) - (b.queue ?? 999));

            const existing = prev[idx];
            if (
              existing.name === mapped.name &&
              existing.queue === mapped.queue &&
              existing.visible === mapped.visible &&
              existing.color === mapped.color &&
              existing.last_activity_at === mapped.last_activity_at
            ) {
              return prev;
            }

            const updated = [...prev];
            updated[idx] = { ...existing, ...mapped };
            return updated.sort((a, b) => (a.queue ?? 999) - (b.queue ?? 999));
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'departments',
        },
        (payload) => {
          const deletedId = `d${(payload.old as any).id}`;

          if (!canApplyChange()) return;

          setDepartments(prev => {
            const filtered = prev.filter(d => d.id !== deletedId);
            if (filtered.length === prev.length) return prev;
            return filtered;
          });
        }
      )
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('❌ Realtime Departments: ошибка канала', err);
        }
      });

    channelRef.current = channel;

    return () => {
      supabaseClient.removeChannel(channel);
      channelRef.current = null;
    };
  }, [workspaceId, enabled, canApplyChange, setDepartments]);
}