/**
 * Context для хранения user actions (breadcrumbs)
 * Используется для передачи trackAction в любой компонент
 */

import React, { createContext, useContext, ReactNode } from 'react';
import { useUserActions } from '../hooks/useUserActions';
import type { UserAction } from '../utils/errorTracking';

interface ErrorLoggerContextType {
  trackAction: (action: Omit<UserAction, 'time'>) => void;
  getRecentActions: (count?: number) => UserAction[];
}

const ErrorLoggerContext = createContext<ErrorLoggerContextType | null>(null);

export function ErrorLoggerProvider({ children }: { children: ReactNode }) {
  const { trackAction, getRecentActions } = useUserActions();

  return (
    <ErrorLoggerContext.Provider value={{ trackAction, getRecentActions }}>
      {children}
    </ErrorLoggerContext.Provider>
  );
}

export function useErrorLogger() {
  const context = useContext(ErrorLoggerContext);
  if (!context) {
    throw new Error('useErrorLogger must be used within ErrorLoggerProvider');
  }
  return context;
}
