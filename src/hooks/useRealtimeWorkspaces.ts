/**
 * useRealtimeWorkspaces — Realtime подписка на изменения воркспейсов
 * 
 * Подписывается на Broadcast каналы `workspaces:org:{orgId}` для каждой организации пользователя.
 * Обновляет список воркспейсов в реальном времени (переименование, удаление).
 * Защита от собственных изменений через lastLocalChange cooldown.
 */
import { useEffect, useRef, useCallback } from 'react';
import { supabaseClient } from '../utils/supabase/client';
import { setSupabaseAuth } from '../utils/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Workspace } from '../types/scheduler';

interface UseRealtimeWorkspacesProps {
  enabled: boolean;
  accessToken?: string | null;
  setWorkspaces: (fn: (prev: Workspace[]) => Workspace[]) => void;
  lastLocalChangeRef: React.MutableRefObject<number>;
  knownOrgIds?: Set<string>;
  orgMetadata?: Map<string, { orgName?: string; orgRole?: string }>;
}

const LOCAL_CHANGE_COOLDOWN = 3000;

export function useRealtimeWorkspaces({
  enabled,
  accessToken,
  setWorkspaces,
  lastLocalChangeRef,
  knownOrgIds,
}: UseRealtimeWorkspacesProps) {
  const channelsRef = useRef<RealtimeChannel[]>([]);
  const knownOrgIdsRef = useRef(knownOrgIds);
  knownOrgIdsRef.current = knownOrgIds;

  const canApplyChange = useCallback((): boolean => {
    const timeSinceLocal = Date.now() - lastLocalChangeRef.current;
    return timeSinceLocal >= LOCAL_CHANGE_COOLDOWN;
  }, [lastLocalChangeRef]);

  const setWorkspacesRef = useRef(setWorkspaces);
  setWorkspacesRef.current = setWorkspaces;
  const canApplyChangeRef = useRef(canApplyChange);
  canApplyChangeRef.current = canApplyChange;

  useEffect(() => {
    if (!enabled || !accessToken || !knownOrgIds || knownOrgIds.size === 0) return;

    let cancelled = false;

    const init = async () => {
      await setSupabaseAuth(accessToken);
      if (cancelled) return;

      // Subscribe to each org channel
      const orgIdArray = Array.from(knownOrgIds);
      const channels: RealtimeChannel[] = [];

      for (const orgId of orgIdArray) {
        const channelName = `workspaces:org:${orgId}`;
        const channel = supabaseClient
          .channel(channelName)
          .on('broadcast', { event: 'workspace_updated' }, (msg) => {
            if (!canApplyChangeRef.current()) return;
            const payload = msg.payload as any;
            const wsId = String(payload.workspace_id);

            setWorkspacesRef.current(prev => {
              const idx = prev.findIndex(w => String(w.id) === wsId);
              if (idx === -1) return prev;

              const existing = prev[idx];
              if (
                existing.name === payload.name &&
                existing.timeline_year === payload.timeline_year
              ) {
                return prev;
              }

              const updated = [...prev];
              updated[idx] = {
                ...existing,
                ...(payload.name !== undefined ? { name: payload.name } : {}),
                ...(payload.timeline_year !== undefined ? { timeline_year: payload.timeline_year } : {}),
              };
              return updated;
            });
          })
          .on('broadcast', { event: 'workspace_deleted' }, (msg) => {
            if (!canApplyChangeRef.current()) return;
            const payload = msg.payload as any;
            const wsId = String(payload.workspace_id);

            setWorkspacesRef.current(prev => {
              const filtered = prev.filter(w => String(w.id) !== wsId);
              if (filtered.length === prev.length) return prev;
              return filtered;
            });
          })
          .subscribe();

        channels.push(channel);
      }

      channelsRef.current = channels;
    };

    init();

    return () => {
      cancelled = true;
      for (const ch of channelsRef.current) {
        supabaseClient.removeChannel(ch);
      }
      channelsRef.current = [];
    };
  }, [enabled, accessToken, knownOrgIds]);
}
