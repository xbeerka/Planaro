import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getStorageItem, setStorageItem } from '../utils/storage';

interface SettingsContextType {
  weekPx: number;
  eventRowH: number;
  showGaps: boolean;
  showPatterns: boolean;
  showProjectWeight: boolean;
  setWeekPx: (value: number) => void;
  setEventRowH: (value: number) => void;
  setShowGaps: (value: boolean) => void;
  setShowPatterns: (value: boolean) => void;
  setShowProjectWeight: (value: boolean) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [weekPx, setWeekPxState] = useState(144);
  const [eventRowH, setEventRowHState] = useState(144);
  const [showGaps, setShowGapsState] = useState(true);
  const [showPatterns, setShowPatternsState] = useState(true);
  const [showProjectWeight, setShowProjectWeightState] = useState(true);

  // Load settings from IndexedDB on mount
  useEffect(() => {
    const loadSettings = async () => {
      const savedWeekPx = await getStorageItem('scheduler_weekPx');
      const savedEventRowH = await getStorageItem('scheduler_eventRowH');
      // Migration from displayMode to split settings
      const savedDisplayMode = await getStorageItem('scheduler_displayMode');
      const savedShowGaps = await getStorageItem('scheduler_showGaps');
      const savedShowPatterns = await getStorageItem('scheduler_showPatterns');
      const savedShowProjectWeight = await getStorageItem('scheduler_showProjectWeight');
      
      if (savedWeekPx) setWeekPxState(Number(savedWeekPx));
      if (savedEventRowH) setEventRowHState(Number(savedEventRowH));
      
      // Handle migration
      if (savedDisplayMode) {
        if (savedDisplayMode === 'performance') {
          setShowGapsState(false);
          setShowPatternsState(false);
        } else {
          setShowGapsState(true);
          setShowPatternsState(true);
        }
        // Clear old key
        // await setStorageItem('scheduler_displayMode', null); // Optional
      }
      
      // Overwrite with new explicit settings if they exist
      if (savedShowGaps !== null) setShowGapsState(savedShowGaps === 'true');
      if (savedShowPatterns !== null) setShowPatternsState(savedShowPatterns === 'true');
      if (savedShowProjectWeight !== null) setShowProjectWeightState(savedShowProjectWeight === 'true');
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

  // Save showGaps to IndexedDB when it changes
  useEffect(() => {
    setStorageItem('scheduler_showGaps', String(showGaps));
  }, [showGaps]);

  // Save showPatterns to IndexedDB when it changes
  useEffect(() => {
    setStorageItem('scheduler_showPatterns', String(showPatterns));
  }, [showPatterns]);

  // Save showProjectWeight to IndexedDB when it changes
  useEffect(() => {
    setStorageItem('scheduler_showProjectWeight', String(showProjectWeight));
  }, [showProjectWeight]);

  const setWeekPx = (value: number) => {
    setWeekPxState(value);
  };

  const setEventRowH = (value: number) => {
    setEventRowHState(value);
  };

  const setShowGaps = (value: boolean) => {
    setShowGapsState(value);
  };

  const setShowPatterns = (value: boolean) => {
    setShowPatternsState(value);
  };

  const setShowProjectWeight = (value: boolean) => {
    setShowProjectWeightState(value);
  };

  return (
    <SettingsContext.Provider
      value={{
        weekPx,
        eventRowH,
        showGaps,
        showPatterns,
        showProjectWeight,
        setWeekPx,
        setEventRowH,
        setShowGaps,
        setShowPatterns,
        setShowProjectWeight
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