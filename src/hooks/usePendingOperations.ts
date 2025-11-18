import { useRef, useCallback } from 'react';
import { SchedulerEvent } from '../types/scheduler';

/**
 * Типы операций с событиями
 */
export type OperationType = 'create' | 'update' | 'delete';

/**
 * Pending операция над событием
 */
export interface PendingOperation {
  id: string;                    // ID события
  type: OperationType;           // Тип операции
  timestamp: number;             // Когда создана
  originalData?: SchedulerEvent; // Данные до изменения (для rollback)
  newData?: SchedulerEvent;      // Новые данные (для update/create)
}

/**
 * Hook для управления очередью pending операций
 * 
 * Защищает от race conditions между локальными изменениями и polling/server responses
 */
export function usePendingOperations() {
  // Map<eventId, PendingOperation>
  const pendingOpsRef = useRef<Map<string, PendingOperation>>(new Map());

  /**
   * Добавляет операцию в очередь
   */
  const addPending = useCallback((
    eventId: string,
    type: OperationType,
    originalData?: SchedulerEvent,
    newData?: SchedulerEvent
  ) => {
    // ✅ ИСПРАВЛЕНИЕ: Сохраняем ОРИГИНАЛЬНЫЕ данные из первой операции
    // Если уже есть pending операция для этого события, берём originalData из неё
    const existingOp = pendingOpsRef.current.get(eventId);
    
    const operation: PendingOperation = {
      id: eventId,
      type,
      timestamp: Date.now(),
      // Используем originalData из ПЕРВОЙ операции или из текущей
      originalData: existingOp?.originalData || originalData,
      // Обновляем newData на ПОСЛЕДНИЕ данные
      newData,
    };
    
    pendingOpsRef.current.set(eventId, operation);
    
    console.log(`⏳ ${existingOp ? 'Обновлена' : 'Добавлена'} pending операция: ${type} для события ${eventId}`, {
      totalPending: pendingOpsRef.current.size,
      isUpdate: !!existingOp
    });
  }, []);

  /**
   * Удаляет операцию из очереди (после успешного сохранения на сервере)
   */
  const removePending = useCallback((eventId: string) => {
    const hadOperation = pendingOpsRef.current.has(eventId);
    pendingOpsRef.current.delete(eventId);
    
    if (hadOperation) {
      console.log(`✅ Удалена pending операция для события ${eventId}`, {
        totalPending: pendingOpsRef.current.size
      });
    }
  }, []);

  /**
   * Проверяет, есть ли pending операция для события
   */
  const hasPending = useCallback((eventId: string): boolean => {
    return pendingOpsRef.current.has(eventId);
  }, []);

  /**
   * Получает pending операцию для события
   */
  const getPending = useCallback((eventId: string): PendingOperation | undefined => {
    return pendingOpsRef.current.get(eventId);
  }, []);

  /**
   * Получает все pending операции
   */
  const getAllPending = useCallback((): PendingOperation[] => {
    return Array.from(pendingOpsRef.current.values());
  }, []);

  /**
   * Очищает все pending операции (например, при выходе из воркспейса)
   */
  const clearAllPending = useCallback(() => {
    const count = pendingOpsRef.current.size;
    pendingOpsRef.current.clear();
    
    if (count > 0) {
      console.log(`🧹 Очищены все pending операции (${count})`);
    }
  }, []);

  /**
   * Очищает устаревшие pending операции (старше maxAge мс)
   */
  const clearStale = useCallback((maxAge: number = 30000) => {
    const now = Date.now();
    let clearedCount = 0;
    
    pendingOpsRef.current.forEach((op, eventId) => {
      if (now - op.timestamp > maxAge) {
        pendingOpsRef.current.delete(eventId);
        clearedCount++;
      }
    });
    
    if (clearedCount > 0) {
      console.log(`🧹 Очищены устаревшие pending операции (${clearedCount})`, {
        totalPending: pendingOpsRef.current.size
      });
    }
  }, []);

  /**
   * Откатывает pending операцию (при ошибке сервера)
   */
  const rollback = useCallback((eventId: string): SchedulerEvent | null => {
    const op = pendingOpsRef.current.get(eventId);
    
    if (!op) {
      console.warn(`⚠️ Попытка rollback для события ${eventId}, но pending операция не найдена`);
      return null;
    }
    
    console.log(`↩️ Rollback операции ${op.type} для события ${eventId}`);
    
    // Удаляем операцию из очереди
    pendingOpsRef.current.delete(eventId);
    
    // Возвращаем оригинальные данные (для восстановления в UI)
    return op.originalData || null;
  }, []);

  /**
   * Мерджит данные с сервера с pending операциями
   * Используется при polling для избежания перезаписи локальных изменений
   */
  const mergeWithServer = useCallback((
    serverEvents: SchedulerEvent[],
    localEvents: SchedulerEvent[]
  ): SchedulerEvent[] => {
    if (pendingOpsRef.current.size === 0) {
      // Нет pending операций - просто возвращаем данные с сервера
      return serverEvents;
    }

    console.log(`🔀 Merge данных: сервер (${serverEvents.length}), pending (${pendingOpsRef.current.size})`);

    // Создаём Map для быстрого поиска
    const serverMap = new Map(serverEvents.map(e => [e.id, e]));
    const localMap = new Map(localEvents.map(e => [e.id, e]));
    const result: SchedulerEvent[] = [];

    // 1. Добавляем все события с сервера
    for (const serverEvent of serverEvents) {
      const pendingOp = pendingOpsRef.current.get(serverEvent.id);
      
      if (pendingOp) {
        // Есть pending операция - используем локальные данные
        if (pendingOp.type === 'delete') {
          // Событие удалено локально - пропускаем
          console.log(`🔀 Skip deleted: ${serverEvent.id}`);
          continue;
        } else if (pendingOp.type === 'update' && pendingOp.newData) {
          // Событие обновлено локально - используем локальные данные
          console.log(`🔀 Use local update: ${serverEvent.id}`);
          result.push(pendingOp.newData);
        } else {
          // Fallback - используем данные с сервера
          result.push(serverEvent);
        }
      } else {
        // Нет pending операции - используем данные с сервера
        result.push(serverEvent);
      }
    }

    // 2. Добавляем новые события (pending create), которых нет на сервере
    pendingOpsRef.current.forEach((op, eventId) => {
      if (op.type === 'create' && op.newData && !serverMap.has(eventId)) {
        console.log(`🔀 Add pending create: ${eventId}`);
        result.push(op.newData);
      }
    });

    console.log(`🔀 Merge результат: ${result.length} событий`);
    return result;
  }, []);

  return {
    addPending,
    removePending,
    hasPending,
    getPending,
    getAllPending,
    clearAllPending,
    clearStale,
    rollback,
    mergeWithServer,
  };
}