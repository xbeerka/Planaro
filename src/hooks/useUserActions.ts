/**
 * Hook для отслеживания действий пользователя (breadcrumbs)
 * Сохраняет последние 100 действий в памяти для контекста ошибок
 */

import { useCallback, useRef } from 'react';
import type { UserAction } from '../utils/errorTracking';

const MAX_ACTIONS = 100;

export function useUserActions() {
  const actionsBuffer = useRef<UserAction[]>([]);

  /**
   * Добавить новое действие в буфер
   */
  const trackAction = useCallback((action: Omit<UserAction, 'time'>) => {
    const fullAction: UserAction = {
      ...action,
      time: new Date().toISOString(),
    };

    actionsBuffer.current.push(fullAction);

    // Циркулярный буфер: удаляем старые если > MAX_ACTIONS
    if (actionsBuffer.current.length > MAX_ACTIONS) {
      actionsBuffer.current.shift();
    }
  }, []);

  /**
   * Получить последние N действий
   */
  const getRecentActions = useCallback((count: number = 20): UserAction[] => {
    return actionsBuffer.current.slice(-count);
  }, []);

  /**
   * Очистить буфер (опционально, если нужно)
   */
  const clearActions = useCallback(() => {
    actionsBuffer.current = [];
  }, []);

  return {
    trackAction,
    getRecentActions,
    clearActions,
  };
}