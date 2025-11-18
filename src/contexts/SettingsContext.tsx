import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getStorageItem, setStorageItem } from '../utils/storage';

type DisplayMode = 'performance' | 'with-patterns'; // Режим отображения: производительность (без паттернов) или с паттернами

interface SettingsContextType {
  weekPx: number;
  eventRowH: number;
  displayMode: DisplayMode;
  setWeekPx: (value: number) => void;
  setEventRowH: (value: number) => void;
  setDisplayMode: (mode: DisplayMode) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [weekPx, setWeekPxState] = useState(144);
  const [eventRowH, setEventRowHState] = useState(144);
  const [displayMode, setDisplayModeState] = useState<DisplayMode>('with-patterns'); // Дефолт: с паттернами

  // Load settings from IndexedDB on mount
  useEffect(() => {
    const loadSettings = async () => {
      const savedWeekPx = await getStorageItem('scheduler_weekPx');
      const savedEventRowH = await getStorageItem('scheduler_eventRowH');
      const savedDisplayMode = await getStorageItem('scheduler_displayMode');
      
      if (savedWeekPx) setWeekPxState(Number(savedWeekPx));
      if (savedEventRowH) setEventRowHState(Number(savedEventRowH));
      if (savedDisplayMode && (savedDisplayMode === 'performance' || savedDisplayMode === 'with-patterns')) {
        setDisplayModeState(savedDisplayMode as DisplayMode);
      }
    };
    
    loadSettings();
  }, []);

  // Save weekPx to IndexedDB when it changes
  useEffect(() => {
    setStorageItem('scheduler_weekPx', String(weekPx));
  }, [weekPx]);

  // Save eventRowH to IndexedDB when it changes
  useEffect(() => {
    setStorageItem('scheduler_eventRowH', String(eventRowH));
  }, [eventRowH]);

  // Save displayMode to IndexedDB when it changes
  useEffect(() => {
    // console.log('💾 SettingsContext: Сохранение displayMode в IndexedDB:', displayMode);
    setStorageItem('scheduler_displayMode', displayMode);
  }, [displayMode]);

  const setWeekPx = (value: number) => {
    setWeekPxState(value);
  };

  const setEventRowH = (value: number) => {
    setEventRowHState(value);
  };

  const setDisplayMode = (mode: DisplayMode) => {
    console.log('🎨 SettingsContext: setDisplayMode вызван', { old: displayMode, new: mode });
    setDisplayModeState(mode);
  };

  return (
    <SettingsContext.Provider
      value={{
        weekPx,
        eventRowH,
        displayMode,
        setWeekPx,
        setEventRowH,
        setDisplayMode
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}