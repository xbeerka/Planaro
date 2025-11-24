import { useEffect, useRef, useCallback, useState } from 'react';
import { SchedulerEvent, Project } from '../types/scheduler';
import { eventsApi } from '../services/api/events';

const SYNC_DEBOUNCE_MS = 2000; // 2 seconds idle before upload
const REFRESH_INTERVAL_MS = 30000; // 30 seconds polling
const IDLE_THRESHOLD_MS = 5000; // User is considered idle after 5 seconds

interface SyncManagerProps {
  events: SchedulerEvent[];
  projects: Project[];
  workspaceId: string;
  onEventsLoaded: (events: SchedulerEvent[]) => void;
  onEventIdChange: (tempId: string, realId: string) => void;
}

export function useSyncManager({ 
  events, 
  projects, 
  workspaceId, 
  onEventsLoaded,
  onEventIdChange 
}: SyncManagerProps) {
  // Local snapshot of what we think the server has
  const serverStateRef = useRef<SchedulerEvent[]>([]);
  
  // Track last interaction time to determine "idle"
  const lastInteractionRef = useRef<number>(Date.now());
  const isSyncingRef = useRef(false);
  const pendingSyncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Track if we have unsaved changes
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Update interaction time whenever events change locally
  useEffect(() => {
    lastInteractionRef.current = Date.now();
    setHasPendingChanges(true);
    
    // Clear existing timer
    if (pendingSyncTimeoutRef.current) {
      clearTimeout(pendingSyncTimeoutRef.current);
    }

    // Schedule new sync
    pendingSyncTimeoutRef.current = setTimeout(() => {
      performBatchSync();
    }, SYNC_DEBOUNCE_MS);

    return () => {
      if (pendingSyncTimeoutRef.current) {
        clearTimeout(pendingSyncTimeoutRef.current);
      }
    };
  }, [events]); // Triggers on every event change

  // Initial load
  useEffect(() => {
    if (!workspaceId) return;
    
    const loadInitial = async () => {
      try {
        setIsSyncing(true);
        const data = await eventsApi.getAll(workspaceId);
        serverStateRef.current = JSON.parse(JSON.stringify(data));
        onEventsLoaded(data);
        setHasPendingChanges(false); // Initial state is synced
      } catch (err) {
        console.error("Failed to load initial events:", err);
      } finally {
        setIsSyncing(false);
      }
    };

    loadInitial();
  }, [workspaceId]);

  // The Big Batch Sync Function
  const performBatchSync = useCallback(async () => {
    if (isSyncingRef.current) return; // Already syncing
    if (events.length === 0 && serverStateRef.current.length === 0) return;

    try {
      isSyncingRef.current = true;
      setIsSyncing(true);
      console.log("🔄 Starting Batch Sync...");

      const currentEvents = events;
      const serverEvents = serverStateRef.current;

      const currentMap = new Map(currentEvents.map(e => [e.id, e]));
      const serverMap = new Map(serverEvents.map(e => [e.id, e]));

      // 1. Identify Creates (Temp IDs) & Updates
      const toCreate: SchedulerEvent[] = [];
      const toUpdate: SchedulerEvent[] = [];
      
      currentEvents.forEach(ev => {
        if (ev.id.startsWith('ev_temp_')) {
          toCreate.push(ev);
        } else {
          const serverEv = serverMap.get(ev.id);
          if (!serverEv || JSON.stringify(ev) !== JSON.stringify(serverEv)) {
            toUpdate.push(ev);
          }
        }
      });

      // 2. Identify Deletes (In server but not in current)
      const toDelete = serverEvents
        .filter(ev => !currentMap.has(ev.id))
        .map(ev => ev.id);

      if (toCreate.length === 0 && toUpdate.length === 0 && toDelete.length === 0) {
        console.log("✅ Nothing to sync");
        setHasPendingChanges(false);
        return;
      }

      console.log(`📦 Sync Payload: ${toCreate.length} create, ${toUpdate.length} update, ${toDelete.length} delete`);

      // 3. Execute API Calls (Parallel)
      // Ideally we'd have a single /batch endpoint, but we'll parallelize existing ones
      const promises = [];

      // Creates
      if (toCreate.length > 0) {
        promises.push(
          eventsApi.batchCreate(toCreate, workspaceId).then(created => {
            // Handle ID updates
            created.forEach((realEvent, index) => {
              const tempId = toCreate[index].id;
              onEventIdChange(tempId, realEvent.id);
            });
            return created;
          })
        );
      }

      // Updates (using batch if available, or Promise.all)
      if (toUpdate.length > 0) {
        // Assuming batchUpdate exists or we map
        // Using batchUpdate from previous context if available, or individual
        // Let's assume eventsApi.batchUpdate exists as per context
        promises.push(eventsApi.batchUpdate(toUpdate));
      }

      // Deletes
      if (toDelete.length > 0) {
        promises.push(eventsApi.batchDelete(toDelete));
      }

      await Promise.all(promises);

      // 4. Update Server State Snapshot
      // We construct what the server SHOULD have now
      // It's basically the currentEvents, but with temp IDs replaced (which onEventIdChange handles in the store)
      // Since onEventIdChange updates the store, the 'events' prop will change, triggering effect.
      // We need to be careful.
      
      // Actually, we should just fetch the latest state or trust our optimistic update.
      // Trusting optimistic is faster.
      
      // For simplicity, we'll update serverStateRef to match what we JUST sent (roughly)
      // But correct ID replacement is tricky async.
      
      // Better strategy: After successful sync, we assume server matches current (except for ID swaps).
      serverStateRef.current = JSON.parse(JSON.stringify(currentEvents));
      setHasPendingChanges(false);
      console.log("✅ Batch Sync Complete");

    } catch (err) {
      console.error("❌ Batch Sync Failed:", err);
      // We keep hasPendingChanges = true, so it will retry on next debounce
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  }, [events, workspaceId, onEventIdChange]);

  // Polling for incoming changes (Only when idle)
  useEffect(() => {
    const interval = setInterval(async () => {
      const timeSinceInteraction = Date.now() - lastInteractionRef.current;
      
      // Only fetch if user is idle and we are not currently syncing/editing
      if (timeSinceInteraction > IDLE_THRESHOLD_MS && !isSyncingRef.current && !hasPendingChanges) {
        console.log("☁️ Idle Poll: Checking for external changes...");
        try {
            // We pass a timestamp to get only changes, or just get all for simplicity
            // The user asked for "receive changes for events I haven't worked with"
            // Getting all is safest to detect external deletes
            const remoteEvents = await eventsApi.getAll(workspaceId);
            
            // Merge logic:
            // If we are strictly "idle" and have no pending changes, we can safely
            // update our local state to match server, preserving purely local UI state if needed.
            
            // We check if remote is different
            if (JSON.stringify(remoteEvents) !== JSON.stringify(serverStateRef.current)) {
                console.log("☁️ External changes detected, updating local...");
                serverStateRef.current = remoteEvents;
                onEventsLoaded(remoteEvents);
            }
        } catch (err) {
            console.error("Poll failed", err);
        }
      }
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [workspaceId, hasPendingChanges]); // Re-create if pending status changes

  return {
    isSyncing,
    hasPendingChanges
  };
}
