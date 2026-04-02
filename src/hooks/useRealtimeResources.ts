/**
 * useRealtimeResources — Realtime подписка на изменения ресурсов (resources table)
 * 
 * Подписывается на postgres_changes для таблицы resources.
 * Маппит DB row → Resource (с префиксом r для id, d для departmentId).
 * Защита от собственных изменений через lastLocalChange cooldown.
 * 
 * DELETE: подписка БЕЗ фильтра (Supabase при DELETE отправляет только PK).
 */
import { useEffect, useRef, useCallback } from 'react';
import { supabaseClient } from '../utils/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Resource } from '../types/scheduler';

// Маппинг строки БД → Resource (аналогично server_snapshot.tsx:116-136)
function mapDbRowToResource(row: any): Resource {
  const fullName = row.fullName || row['fullName'] || '';

  return {
    id: `r${row.id}`,
    fullName,
    position: row.position || '',
    departmentId: row.department_id ? `d${row.department_id}` : undefined,
    gradeId: row.grade_id ? String(row.grade_id) : undefined,
    companyId: row.company_id ? String(row.company_id) : undefined,
    avatarUrl: row.avatar_url || null,
    isVisible: row.is_visible !== undefined ? row.is_visible : true,
    size: row.size || null,
    sortOrder: row.sort_order ?? 0,
    authUserId: row.auth_user_id || null,
  };
}

interface UseRealtimeResourcesProps {
  workspaceId: string;
  enabled: boolean;
  setResources: (fn: (prev: Resource[]) => Resource[]) => void;
  lastLocalChangeRef: React.MutableRefObject<number>;
}

const LOCAL_CHANGE_COOLDOWN = 5000; // 5 секунд (ресурсы меняются через модалку)

export function useRealtimeResources({
  workspaceId,
  enabled,
  setResources,
  lastLocalChangeRef,
}: UseRealtimeResourcesProps) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  const canApplyChange = useCallback((): boolean => {
    const timeSinceLocal = Date.now() - lastLocalChangeRef.current;
    return timeSinceLocal >= LOCAL_CHANGE_COOLDOWN;
  }, [lastLocalChangeRef]);

  useEffect(() => {
    if (!enabled || !workspaceId) return;



    const channel = supabaseClient
      .channel(`resources-ws-${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'resources',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          const mapped = mapDbRowToResource(payload.new);

          if (!canApplyChange()) {
            return;
          }

          setResources(prev => {
            if (prev.some(r => r.id === mapped.id)) return prev;
            return [...prev, mapped];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'resources',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          const mapped = mapDbRowToResource(payload.new);

          if (!canApplyChange()) {
            return;
          }

          setResources(prev => {
            const idx = prev.findIndex(r => r.id === mapped.id);
            if (idx === -1) return [...prev, mapped];

            const existing = prev[idx];
            if (
              existing.fullName === mapped.fullName &&
              existing.position === mapped.position &&
              existing.departmentId === mapped.departmentId &&
              existing.gradeId === mapped.gradeId &&
              existing.companyId === mapped.companyId &&
              existing.avatarUrl === mapped.avatarUrl &&
              existing.isVisible === mapped.isVisible &&
              existing.size === mapped.size &&
              existing.sortOrder === mapped.sortOrder
            ) {
              return prev;
            }

            const updated = [...prev];
            updated[idx] = { ...existing, ...mapped };
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
          table: 'resources',
        },
        (payload) => {
          const deletedId = `r${(payload.old as any).id}`;

          if (!canApplyChange()) {
            return;
          }

          setResources(prev => {
            const filtered = prev.filter(r => r.id !== deletedId);
            if (filtered.length === prev.length) return prev;
            return filtered;
          });
        }
      )
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('❌ Realtime Resources: ошибка канала', err);
        }
      });

    channelRef.current = channel;

    return () => {
      supabaseClient.removeChannel(channel);
      channelRef.current = null;
    };
  }, [workspaceId, enabled, canApplyChange, setResources]);
}