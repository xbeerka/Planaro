import { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { getStorageItem, setStorageItem } from '../utils/storage';

interface SettingsContextType {
  weekPx: number;
  eventRowH: number;
  showGaps: boolean;
  showPatterns: boolean;
  showProjectWeight: boolean;
  showSeparators: boolean;
  showDeptColors: boolean;
  tableView: boolean;
  setWeekPx: (value: number) => void;
  setEventRowH: (value: number) => void;
  setShowGaps: (value: boolean) => void;
  setShowPatterns: (value: boolean) => void;
  setShowProjectWeight: (value: boolean) => void;
  setShowSeparators: (value: boolean) => void;
  setShowDeptColors: (value: boolean) => void;
  setTableView: (value: boolean) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [weekPx, setWeekPxState] = useState(120); // Default L (120px)
  const [eventRowH, setEventRowHState] = useState(144); // Default L
  const [showGaps, setShowGapsState] = useState(true);
  const [showPatterns, setShowPatternsState] = useState(true);
  const [showProjectWeight, setShowProjectWeightState] = useState(true);
  const [showSeparators, setShowSeparatorsState] = useState(true);
  const [showDeptColors, setShowDeptColorsState] = useState(false);
  const [tableView, setTableViewState] = useState(false);
  
  const isLoaded = useRef(false);

  // Load settings from IndexedDB on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedWeekPx = await getStorageItem('scheduler_weekPx');
        const savedEventRowH = await getStorageItem('scheduler_eventRowH');
        // Migration from displayMode to split settings
        const savedDisplayMode = await getStorageItem('scheduler_displayMode');
        const savedShowGaps = await getStorageItem('scheduler_showGaps');
        const savedShowPatterns = await getStorageItem('scheduler_showPatterns');
        const savedShowProjectWeight = await getStorageItem('scheduler_showProjectWeight');
        const savedShowSeparators = await getStorageItem('scheduler_showSeparators');
        const savedShowDeptColors = await getStorageItem('scheduler_showDeptColors');
        const savedTableView = await getStorageItem('scheduler_tableView');
        
        if (savedWeekPx) {
          const px = Number(savedWeekPx);
          // Validate preset values: XS=48, S=72, M=96, L=120
          // (Updated to match Header.tsx presets)
          if ([48, 72, 96, 120].includes(px)) {
            setWeekPxState(px);
          } else {
            setWeekPxState(120); // Reset to Default L (120) if invalid/custom
          }
        }
        
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
        }
        
        // Overwrite with new explicit settings if they exist
        if (savedShowGaps !== null) setShowGapsState(savedShowGaps === 'true');
        if (savedShowPatterns !== null) setShowPatternsState(savedShowPatterns === 'true');
        if (savedShowProjectWeight !== null) setShowProjectWeightState(savedShowProjectWeight === 'true');
        if (savedShowSeparators !== null) setShowSeparatorsState(savedShowSeparators === 'true');
        if (savedShowDeptColors !== null) setShowDeptColorsState(savedShowDeptColors === 'true');
        if (savedTableView !== null) setTableViewState(savedTableView === 'true');
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        isLoaded.current = true;
      }
    };
    
    loadSettings();
  }, []);

  // Save weekPx to IndexedDB when it changes
  useEffect(() => {
    if (!isLoaded.current) return;
    setStorageItem('scheduler_weekPx', String(weekPx));
  }, [weekPx]);

  // Save eventRowH to IndexedDB when it changes
  useEffect(() => {
    if (!isLoaded.current) return;
    setStorageItem('scheduler_eventRowH', String(eventRowH));
  }, [eventRowH]);

  // Save showGaps to IndexedDB when it changes
  useEffect(() => {
    if (!isLoaded.current) return;
    setStorageItem('scheduler_showGaps', String(showGaps));
  }, [showGaps]);

  // Save showPatterns to IndexedDB when it changes
  useEffect(() => {
    if (!isLoaded.current) return;
    setStorageItem('scheduler_showPatterns', String(showPatterns));
  }, [showPatterns]);

  // Save showProjectWeight to IndexedDB when it changes
  useEffect(() => {
    if (!isLoaded.current) return;
    setStorageItem('scheduler_showProjectWeight', String(showProjectWeight));
  }, [showProjectWeight]);

  // Save showSeparators to IndexedDB when it changes
  useEffect(() => {
    if (!isLoaded.current) return;
    setStorageItem('scheduler_showSeparators', String(showSeparators));
  }, [showSeparators]);

  // Save showDeptColors to IndexedDB when it changes
  useEffect(() => {
    if (!isLoaded.current) return;
    setStorageItem('scheduler_showDeptColors', String(showDeptColors));
  }, [showDeptColors]);

  // Save tableView to IndexedDB when it changes
  useEffect(() => {
    if (!isLoaded.current) return;
    setStorageItem('scheduler_tableView', String(tableView));
  }, [tableView]);

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

  const setShowSeparators = (value: boolean) => {
    setShowSeparatorsState(value);
  };

  const setShowDeptColors = (value: boolean) => {
    setShowDeptColorsState(value);
  };

  const setTableView = (value: boolean) => {
    setTableViewState(value);
  };

  return (
    <SettingsContext.Provider
      value={{
        weekPx,
        eventRowH,
        showGaps,
        showPatterns,
        showProjectWeight,
        showSeparators,
        showDeptColors,
        tableView,
        setWeekPx,
        setEventRowH,
        setShowGaps,
        setShowPatterns,
        setShowProjectWeight,
        setShowSeparators,
        setShowDeptColors,
        setTableView
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