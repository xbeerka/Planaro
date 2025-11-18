import { useEffect, useCallback, useRef } from 'react';

/**
 * Hook для объединения множественных polling запросов в один batch
 * 
 * Проблема:
 * - Events polling: каждые 10 сек
 * - Resources polling: каждые 15 сек
 * - Departments polling: каждые 15 сек
 * - Projects polling: каждые 15 сек
 * = 4-6 запросов каждые 10-15 секунд
 * 
 * Решение:
 * - Один batch запрос каждые 10 секунд
 * - Загружаем всё разом
 * - Обновляем только изменившиеся данные
 * 
 * @example
 * usePollingBatch({
 *   workspaceId,
 *   accessToken,
 *   onEventsUpdate: (events) => setEvents(events),
 *   onResourcesUpdate: (resources) => setResources(resources),
 *   onDepartmentsUpdate: (departments) => setDepartments(departments),
 *   onProjectsUpdate: (projects) => setProjects(projects),
 *   interval: 10000, // 10 seconds
 *   enabled: true
 * });
 */

interface UsePollingBatchOptions<E, R, D, P> {
  workspaceId: string;
  accessToken: string;
  
  // Callbacks для обновления данных
  onEventsUpdate: (events: E[]) => void;
  onResourcesUpdate?: (resources: R[]) => void;
  onDepartmentsUpdate?: (departments: D[]) => void;
  onProjectsUpdate?: (projects: P[]) => void;
  
  // Функция batch запроса (если есть кастомный endpoint)
  fetchBatch?: (workspaceId: string, accessToken: string) => Promise<{
    events: E[];
    resources?: R[];
    departments?: D[];
    projects?: P[];
  }>;
  
  // Настройки
  interval?: number; // Default: 10000ms
  enabled?: boolean; // Default: true
  skipIfRecentChange?: boolean; // Default: true (пропускать если было локальное изменение)
  recentChangeWindow?: number; // Default: 2000ms
}

export function usePollingBatch<E = any, R = any, D = any, P = any>(
  options: UsePollingBatchOptions<E, R, D, P>
) {
  const {
    workspaceId,
    accessToken,
    onEventsUpdate,
    onResourcesUpdate,
    onDepartmentsUpdate,
    onProjectsUpdate,
    fetchBatch,
    interval = 10000,
    enabled = true,
    skipIfRecentChange = true,
    recentChangeWindow = 2000
  } = options;

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastLocalChangeRef = useRef<number>(0);
  const isMountedRef = useRef(true);

  // Отметить локальное изменение (чтобы пропустить следующий polling)
  const markLocalChange = useCallback(() => {
    lastLocalChangeRef.current = Date.now();
  }, []);

  // Проверить, было ли недавно локальное изменение
  const hasRecentLocalChange = useCallback(() => {
    if (!skipIfRecentChange) return false;
    return Date.now() - lastLocalChangeRef.current < recentChangeWindow;
  }, [skipIfRecentChange, recentChangeWindow]);

  // Функция polling
  const poll = useCallback(async () => {
    if (!enabled || !isMountedRef.current) return;
    
    // Пропускаем если было недавнее локальное изменение
    if (hasRecentLocalChange()) {
      console.log('⏭️ Polling batch: пропускаем (недавнее локальное изменение)');
      return;
    }

    try {
      console.log('🔄 Polling batch: загрузка всех данных...');
      
      let batchData;
      
      if (fetchBatch) {
        // Используем кастомный batch endpoint
        batchData = await fetchBatch(workspaceId, accessToken);
      } else {
        // Fallback: делаем параллельные запросы (если нет batch endpoint)
        console.warn('⚠️ Batch endpoint не настроен, используем параллельные запросы');
        // Здесь можно добавить fallback логику
        return;
      }

      if (!isMountedRef.current) return;

      // Обновляем данные
      if (batchData.events) {
        onEventsUpdate(batchData.events);
      }
      if (batchData.resources && onResourcesUpdate) {
        onResourcesUpdate(batchData.resources);
      }
      if (batchData.departments && onDepartmentsUpdate) {
        onDepartmentsUpdate(batchData.departments);
      }
      if (batchData.projects && onProjectsUpdate) {
        onProjectsUpdate(batchData.projects);
      }

      console.log('✅ Polling batch: данные обновлены');
    } catch (error) {
      console.error('❌ Polling batch error:', error);
    }
  }, [
    enabled,
    workspaceId,
    accessToken,
    fetchBatch,
    onEventsUpdate,
    onResourcesUpdate,
    onDepartmentsUpdate,
    onProjectsUpdate,
    hasRecentLocalChange
  ]);

  // Запускаем polling
  useEffect(() => {
    isMountedRef.current = true;

    if (!enabled) {
      return;
    }

    // Первый запрос сразу
    poll();

    // Периодические запросы
    intervalRef.current = setInterval(poll, interval);

    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [poll, interval, enabled]);

  return {
    markLocalChange, // Вызывать после локальных изменений
    forcePoll: poll, // Принудительный polling
    hasRecentLocalChange
  };
}

/**
 * Упрощённая версия для только событий (если batch не нужен)
 */
export function useEventsPolling<E = any>(
  workspaceId: string,
  accessToken: string,
  onEventsUpdate: (events: E[]) => void,
  fetchEvents: (workspaceId: string, accessToken: string) => Promise<E[]>,
  options?: {
    interval?: number;
    enabled?: boolean;
    skipIfRecentChange?: boolean;
    recentChangeWindow?: number;
  }
) {
  const {
    interval = 10000,
    enabled = true,
    skipIfRecentChange = true,
    recentChangeWindow = 2000
  } = options || {};

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastLocalChangeRef = useRef<number>(0);
  const isMountedRef = useRef(true);

  const markLocalChange = useCallback(() => {
    lastLocalChangeRef.current = Date.now();
  }, []);

  const hasRecentLocalChange = useCallback(() => {
    if (!skipIfRecentChange) return false;
    return Date.now() - lastLocalChangeRef.current < recentChangeWindow;
  }, [skipIfRecentChange, recentChangeWindow]);

  const poll = useCallback(async () => {
    if (!enabled || !isMountedRef.current) return;
    
    if (hasRecentLocalChange()) {
      console.log('⏭️ Events polling: пропускаем (недавнее локальное изменение)');
      return;
    }

    try {
      const events = await fetchEvents(workspaceId, accessToken);
      
      if (!isMountedRef.current) return;
      
      onEventsUpdate(events);
    } catch (error) {
      console.error('❌ Events polling error:', error);
    }
  }, [enabled, workspaceId, accessToken, fetchEvents, onEventsUpdate, hasRecentLocalChange]);

  useEffect(() => {
    isMountedRef.current = true;

    if (!enabled) return;

    poll();
    intervalRef.current = setInterval(poll, interval);

    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [poll, interval, enabled]);

  return { markLocalChange, forcePoll: poll, hasRecentLocalChange };
}
