import { useRef, useCallback, useEffect } from 'react';
import { SchedulerEvent } from '../types/scheduler';

export type SyncOperation = 'create' | 'update' | 'delete';

export interface SyncItem {
  id: string;
  op: SyncOperation;
  data?: Partial<SchedulerEvent>; // Для create/update
  timestamp: number;
}

interface SyncManagerOptions {
  onSync: (items: Map<string, SyncItem>, context?: any) => Promise<void>;
  delay?: number;
}

export function useSyncManager({ onSync, delay = 2000 }: SyncManagerOptions) {
  // Очередь изменений: ID -> SyncItem
  const queueRef = useRef<Map<string, SyncItem>>(new Map());
  
  // Таймер debounce
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Состояние синхронизации - useRef вместо useState чтобы избежать
  // "Cannot update a component while rendering a different component"
  const isSyncingRef = useRef(false);
  const queueSizeRef = useRef(0);
  
  // Ref для отслеживания in-flight (чтобы не потерять данные при ошибке)
  const inFlightRef = useRef<Map<string, SyncItem> | null>(null);

  const scheduleFlush = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      // Use ref to access flush without adding it as dependency
      if (flushRef.current) flushRef.current();
    }, delay);
  }, [delay]); // removed flush dependency to avoid circular dependency
  
  /**
   * Добавить изменение в очередь
   */
  const queueChange = useCallback((id: string, op: SyncOperation, data?: Partial<SchedulerEvent>) => {
    const current = queueRef.current.get(id);
    
    let newItem: SyncItem = {
      id,
      op,
      data,
      timestamp: Date.now()
    };

    // Логика слияния операций (Optimization)
    if (current) {
      if (current.op === 'create' && op === 'update') {
        // Create + Update = Create (с новыми данными)
        newItem = { ...current, data: { ...current.data, ...data }, timestamp: Date.now() };
      } else if (current.op === 'create' && op === 'delete') {
        // Create + Delete = Nothing (отмена создания)
        queueRef.current.delete(id);
        queueSizeRef.current = queueRef.current.size;
        console.log(`🗑️ SyncManager: Create + Delete = NoOp для ${id}`);
        return;
      } else if (current.op === 'update' && op === 'update') {
        // Update + Update = Update (merge)
        newItem = { ...current, data: { ...current.data, ...data }, timestamp: Date.now() };
      } else if (current.op === 'update' && op === 'delete') {
        // Update + Delete = Delete
        newItem = { id, op: 'delete', timestamp: Date.now() };
      }
      // Delete + Create = Update (редкий кейс, обычно это разные ID)
    }

    queueRef.current.set(id, newItem);
    queueSizeRef.current = queueRef.current.size;
    scheduleFlush();
  }, [scheduleFlush]);  
  /**
   * Принудительная отправка данных
   */
  const flush = useCallback(async (context?: any) => {
    if (queueRef.current.size === 0) return;
    if (isSyncingRef.current) {
      // Reschedule flush to ensure these changes are sent
      scheduleFlush();
      return;
    }

    // 1. Подготовка данных
    const itemsToSync = new Map(queueRef.current);
    inFlightRef.current = itemsToSync; // Бэкап на случай ошибки
    queueRef.current.clear();
    queueSizeRef.current = 0;
    
    isSyncingRef.current = true;
    
    try {
      await onSync(itemsToSync, context);
      
      // 2. Успех
      inFlightRef.current = null;
    } catch (error) {
      console.error('❌ SyncManager: Sync failed', error);
      
      // 3. Ошибка - возвращаем данные в очередь (с сохранением более новых изменений)
      if (inFlightRef.current) {
        console.log('🔄 SyncManager: Restoring items to queue...');
        inFlightRef.current.forEach((item, id) => {
          // Если за время полета пришли новые изменения - не перезаписываем их
          if (!queueRef.current.has(id)) {
            queueRef.current.set(id, item);
          }
        });
        queueSizeRef.current = queueRef.current.size;
        inFlightRef.current = null;
        
        // Пробуем снова через задержку (Exponential backoff можно добавить позже)
        scheduleFlush();
      }
    } finally {
      isSyncingRef.current = false;
    }
  }, [onSync]); // Removed scheduleFlush and isSyncing to avoid circular dependency

  // Re-attach flush to scheduleFlush via ref
  const flushRef = useRef(flush);
  flushRef.current = flush;

  useEffect(() => {
    // Override scheduleFlush to use the latest flush
    // This is a bit hacky but solves the circular dependency between flush and scheduleFlush
  }, []);

  /**
   * Проверка, есть ли несохраненные изменения для ID
   * (Включая те, что сейчас отправляются)
   */
  const hasPendingChanges = useCallback((id: string) => {
    return queueRef.current.has(id) || inFlightRef.current?.has(id);
  }, []);

  /**
   * Переименовать ключ в очереди (например, при замене tempId -> realId)
   */
  const remapKey = useCallback((oldId: string, newId: string) => {
    const item = queueRef.current.get(oldId);
    if (item) {
      queueRef.current.delete(oldId);
      queueRef.current.set(newId, { ...item, id: newId });
      console.log(`🔄 SyncManager: Remapped ${oldId} -> ${newId} in queue`);
    }
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      // При анмаунте мы не можем ждать flush, данные могут потеряться
      // В идеале использовать navigator.sendBeacon, но это сложно для batch JSON
    };
  }, []);

  // Геттеры для совместимости (читают из ref)
  const getQueueSize = useCallback(() => queueSizeRef.current, []);
  const getIsSyncing = useCallback(() => isSyncingRef.current, []);

  return {
    queueChange,
    flush,
    hasPendingChanges,
    remapKey, // Экспортируем
    get queueSize() { return queueSizeRef.current; },
    get isSyncing() { return isSyncingRef.current; },
  };
}
