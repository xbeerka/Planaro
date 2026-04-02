/**
 * useRealtimeEvents — Realtime подписка на изменения событий
 * 
 * v2.4.0: Простой и надёжный подход
 * - LOCAL_CHANGE_COOLDOWN = 1000ms (глобальный, блокирует echo после любого нашего изменения)
 * - PER_EVENT_COOLDOWN = 2000ms (per-event, блокирует echo конкретного события)
 * - hasPendingChanges (SyncManager ещё не синхронизировал)
 * - Shallow comparison (данные идентичны текущему стейту → no-op)
 * - Queue во время drag/resize (не теряем события)
 */
import { useEffect, useRef, useCallback } from 'react';
import { supabaseClient } from '../utils/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { SchedulerEvent } from '../types/scheduler';

function mapDbRowToEvent(row: any): SchedulerEvent {
  return {
    id: `e${row.id}`,
    resourceId: `r${row.resource_id}`,
    projectId: `p${row.project_id}`,
    startWeek: (row.start_week || 1) - 1,
    weeksSpan: row.weeks_span || 1,
    unitStart: row.unit_start || 0,
    unitsTall: row.units_tall || 1,
    patternId: row.pattern_id ? `ep${row.pattern_id}` : undefined,
  };
}

interface QueuedChange {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  event: SchedulerEvent;
}

interface UseRealtimeEventsProps {
  workspaceId: string;
  enabled: boolean;
  setEvents: (fn: (prev: SchedulerEvent[]) => SchedulerEvent[]) => void;
  hasPendingChanges: (id: string) => boolean;
  isUserInteractingRef: React.MutableRefObject<boolean>;
  lastLocalChangeRef: React.MutableRefObject<number>;
  deletedEventIdsRef: React.MutableRefObject<Set<string>>;
  historyRebasersRef: React.MutableRefObject<{
    rebaseEvent: (eventId: string, newData: Partial<SchedulerEvent>) => void;
    rebaseDeleteEvent: (eventId: string) => void;
    rebaseInsertEvent: (event: SchedulerEvent) => void;
  } | null>;
  localEventModTimesRef: React.MutableRefObject<Map<string, number>>;
}

const LOCAL_CHANGE_COOLDOWN = 1000;
const PER_EVENT_COOLDOWN = 2000;
const QUEUE_DRAIN_INTERVAL = 100;

export function useRealtimeEvents({
  workspaceId,
  enabled,
  setEvents,
  hasPendingChanges,
  isUserInteractingRef,
  lastLocalChangeRef,
  deletedEventIdsRef,
  historyRebasersRef,
  localEventModTimesRef,
}: UseRealtimeEventsProps) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const queueRef = useRef<Map<string, QueuedChange>>(new Map());

  const canApplyForEvent = useCallback((eventId: string): boolean => {
    // 1. Глобальный cooldown
    if (Date.now() - lastLocalChangeRef.current < LOCAL_CHANGE_COOLDOWN) {
      return false;
    }
    // 2. Pending в SyncManager
    if (hasPendingChanges(eventId)) {
      return false;
    }
    // 3. Per-event cooldown
    const modTime = localEventModTimesRef.current.get(eventId);
    if (modTime && Date.now() - modTime < PER_EVENT_COOLDOWN) {
      return false;
    }
    return true;
  }, [hasPendingChanges, lastLocalChangeRef, localEventModTimesRef]);

  const applyChange = useCallback((change: QueuedChange) => {
    const { type, event: mapped } = change;

    if (type === 'INSERT') {
      if (deletedEventIdsRef.current.has(mapped.id)) return;
      if (!canApplyForEvent(mapped.id)) return;
      
      setEvents(prev => {
        if (prev.some(e => e.id === mapped.id)) return prev;
        return [...prev, mapped];
      });
      historyRebasersRef.current?.rebaseInsertEvent(mapped);

    } else if (type === 'UPDATE') {
      if (!canApplyForEvent(mapped.id)) return;

      setEvents(prev => {
        const idx = prev.findIndex(e => e.id === mapped.id);
        if (idx === -1) return [...prev, mapped];

        const existing = prev[idx];
        // Shallow comparison — если данные идентичны → no-op (echo)
        if (
          existing.resourceId === mapped.resourceId &&
          existing.projectId === mapped.projectId &&
          existing.startWeek === mapped.startWeek &&
          existing.weeksSpan === mapped.weeksSpan &&
          existing.unitStart === mapped.unitStart &&
          existing.unitsTall === mapped.unitsTall &&
          existing.patternId === mapped.patternId
        ) {
          return prev;
        }

        console.log(`📡 Realtime UPDATE applied: ${mapped.id} (from another user)`);
        const updated = [...prev];
        updated[idx] = mapped;
        return updated;
      });
      historyRebasersRef.current?.rebaseEvent(mapped.id, mapped);

    } else if (type === 'DELETE') {
      setEvents(prev => {
        const filtered = prev.filter(e => e.id !== mapped.id);
        return filtered.length === prev.length ? prev : filtered;
      });
      historyRebasersRef.current?.rebaseDeleteEvent(mapped.id);
    }
  }, [canApplyForEvent, setEvents, deletedEventIdsRef, historyRebasersRef]);

  const handleRealtimeChange = useCallback((type: 'INSERT' | 'UPDATE' | 'DELETE', mapped: SchedulerEvent) => {
    // Во время drag/resize → в очередь
    if (isUserInteractingRef.current) {
      if (type === 'DELETE') {
        // Удаляем предыдущие записи для этого ID
        for (const key of queueRef.current.keys()) {
          if (key.endsWith(`:${mapped.id}`)) queueRef.current.delete(key);
        }
      }
      queueRef.current.set(`${type}:${mapped.id}`, { type, event: mapped });
      return;
    }

    applyChange({ type, event: mapped });
  }, [isUserInteractingRef, applyChange]);

  // Периодический drain очереди
  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      if (isUserInteractingRef.current) return;
      const queue = queueRef.current;
      if (queue.size === 0) return;

      console.log(`📦 Queue drain: ${queue.size} items`);
      const changes = Array.from(queue.values());
      queue.clear();

      // DELETE приоритет
      const deletedIds = new Set(changes.filter(c => c.type === 'DELETE').map(c => c.event.id));
      
      for (const change of changes) {
        if (change.type !== 'DELETE' && deletedIds.has(change.event.id)) continue;
        applyChange(change);
      }
    }, QUEUE_DRAIN_INTERVAL);

    return () => clearInterval(interval);
  }, [enabled, isUserInteractingRef, applyChange]);

  // Подписка на канал
  useEffect(() => {
    if (!enabled || !workspaceId) return;



    const channel = supabaseClient
      .channel(`events-ws-${workspaceId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'events', filter: `workspace_id=eq.${workspaceId}` },
        (payload) => handleRealtimeChange('INSERT', mapDbRowToEvent(payload.new))
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'events', filter: `workspace_id=eq.${workspaceId}` },
        (payload) => handleRealtimeChange('UPDATE', mapDbRowToEvent(payload.new))
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'events' },
        (payload) => {
          const deletedId = `e${(payload.old as any).id}`;
          handleRealtimeChange('DELETE', {
            id: deletedId, resourceId: '', projectId: '',
            startWeek: 0, weeksSpan: 0, unitStart: 0, unitsTall: 0,
          });
        }
      )
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('❌ Realtime Events: ошибка канала', err);
        }
      });

    channelRef.current = channel;

    return () => {
      supabaseClient.removeChannel(channel);
      channelRef.current = null;
      queueRef.current.clear();
    };
  }, [workspaceId, enabled, handleRealtimeChange]);
}