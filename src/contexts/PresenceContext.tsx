import React, { createContext, useContext, useCallback, ReactNode } from 'react';

interface CursorPosition {
  x: number;
  y: number;
  email: string;
  timestamp: number;
}

interface PresenceContextType {
  cursors: CursorPosition[];
  updateCursor: (x: number, y: number) => void;
  isAvailable: boolean;
}

const PresenceContext = createContext<PresenceContextType | undefined>(undefined);

interface PresenceProviderProps {
  children: ReactNode;
  workspaceId: string;
  accessToken?: string;
}

/**
 * PresenceProvider - управление Realtime Presence для курсоров
 * 
 * СТАТУС: Gracefully disabled (пакет @supabase/supabase-js недоступен в Figma Make)
 * 
 * Этот компонент готов к будущей интеграции с Supabase Realtime,
 * но сейчас просто предоставляет заглушку чтобы приложение не ломалось.
 * 
 * См. документацию: /FINAL_STATUS_v3.4.0.md
 */
export function PresenceProvider({ children, workspaceId, accessToken }: PresenceProviderProps) {
  // Заглушка - курсоры всегда пустые
  const cursors: CursorPosition[] = [];

  // Заглушка - ничего не делает
  const updateCursor = useCallback((x: number, y: number) => {
    // Realtime недоступен - ничего не делаем
  }, []);

  const value: PresenceContextType = {
    cursors,
    updateCursor,
    isAvailable: false, // Realtime НЕ доступен
  };

  return (
    <PresenceContext.Provider value={value}>
      {children}
    </PresenceContext.Provider>
  );
}

export function usePresence() {
  const context = useContext(PresenceContext);
  if (!context) {
    throw new Error('usePresence must be used within PresenceProvider');
  }
  return context;
}
