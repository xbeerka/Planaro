import React, { createContext, useContext, useState, useCallback, ReactNode, useMemo } from 'react';
import { SchedulerEvent } from '../types/scheduler';
import { TabType } from '../components/scheduler/UnifiedManagementModal';

interface UIContextType {
  // --- Loading States ---
  isLoadingDepartments: boolean;
  setIsLoadingDepartments: (value: boolean) => void;
  isLoadingResources: boolean;
  setIsLoadingResources: (value: boolean) => void;
  isLoadingProjects: boolean;
  setIsLoadingProjects: (value: boolean) => void;
  isLoadingGrades: boolean;
  setIsLoadingGrades: (value: boolean) => void;
  isLoadingEventPatterns: boolean;
  setIsLoadingEventPatterns: (value: boolean) => void;
  isLoadingCompanies: boolean;
  setIsLoadingCompanies: (value: boolean) => void;
  isLoadingEvents: boolean;
  setIsLoadingEvents: (value: boolean) => void;
  isLoadingComments: boolean;
  setIsLoadingComments: (value: boolean) => void;
  
  // Computed global loading state
  isLoading: boolean;

  // --- Modes ---
  scissorsMode: boolean;
  commentMode: boolean;
  handleToggleScissors: () => void;
  handleToggleComment: () => void;
  setScissorsMode: (value: boolean) => void;
  setCommentMode: (value: boolean) => void;

  // --- Pending States ---
  pendingEventIds: Set<string>;
  setPendingEventIds: React.Dispatch<React.SetStateAction<Set<string>>>;

  // --- Clipboard ---
  copiedEvent: SchedulerEvent | null;
  setCopiedEvent: (event: SchedulerEvent | null) => void;

  // --- Modals ---
  modalOpen: boolean;
  setModalOpen: (open: boolean) => void;
  modalMode: "create" | "edit";
  setModalMode: (mode: "create" | "edit") => void;
  modalInitialData: any;
  setModalInitialData: (data: any) => void;
  pendingEvent: any;
  setPendingEvent: (event: any) => void;

  commentModalOpen: boolean;
  setCommentModalOpen: (open: boolean) => void;
  pendingComment: { resourceId: string; week: number } | null;
  setPendingComment: (comment: { resourceId: string; week: number } | null) => void;

  // Unified Management Modal
  managementModalOpen: boolean;
  setManagementModalOpen: (open: boolean) => void;
  managementModalTab: TabType;
  setManagementModalTab: (tab: TabType) => void;
  
  shortcutsModalOpen: boolean;
  setShortcutsModalOpen: (open: boolean) => void;
  profileModalOpen: boolean;
  setProfileModalOpen: (open: boolean) => void;
  settingsModalOpen: boolean;
  setSettingsModalOpen: (open: boolean) => void;
  workspaceManagementModalOpen: boolean;
  setWorkspaceManagementModalOpen: (open: boolean) => void;

  // --- Context Menus ---
  contextMenu: {
    isVisible: boolean;
    x: number;
    y: number;
    event: SchedulerEvent | null;
  };
  setContextMenu: React.Dispatch<React.SetStateAction<{
    isVisible: boolean;
    x: number;
    y: number;
    event: SchedulerEvent | null;
  }>>;

  emptyCellContextMenu: {
    isVisible: boolean;
    x: number;
    y: number;
    resourceId: string | null;
    week: number | null;
    unitIndex: number | null;
  };
  setEmptyCellContextMenu: React.Dispatch<React.SetStateAction<{
    isVisible: boolean;
    x: number;
    y: number;
    resourceId: string | null;
    week: number | null;
    unitIndex: number | null;
  }>>;

  // --- Hover & Ghost ---
  hoverHighlight: {
    visible: boolean;
    left: number;
    top: number;
    width: number;
    height: number;
  };
  setHoverHighlight: React.Dispatch<React.SetStateAction<{
    visible: boolean;
    left: number;
    top: number;
    width: number;
    height: number;
  }>>;

  ghost: {
    visible: boolean;
    left: number;
    top: number;
    width: number;
    height: number;
  };
  setGhost: React.Dispatch<React.SetStateAction<{
    visible: boolean;
    left: number;
    top: number;
    width: number;
    height: number;
  }>>;

  // --- Actions ---
  closeAllModals: () => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export function UIProvider({ children }: { children: ReactNode }) {
  // --- Loading States ---
  const [isLoadingDepartments, setIsLoadingDepartments] = useState(true);
  const [isLoadingResources, setIsLoadingResources] = useState(true);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [isLoadingGrades, setIsLoadingGrades] = useState(true);
  const [isLoadingEventPatterns, setIsLoadingEventPatterns] = useState(true);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(true);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [isLoadingComments, setIsLoadingComments] = useState(true);

  const isLoading = useMemo(() => {
    return isLoadingDepartments || isLoadingResources || isLoadingProjects || 
           isLoadingGrades || isLoadingEventPatterns || isLoadingCompanies || isLoadingEvents || isLoadingComments;
  }, [isLoadingDepartments, isLoadingResources, isLoadingProjects, isLoadingGrades, isLoadingEventPatterns, isLoadingCompanies, isLoadingEvents, isLoadingComments]);

  // --- Modes ---
  const [scissorsMode, setScissorsMode] = useState(false);
  const [commentMode, setCommentMode] = useState(false);

  const handleToggleScissors = useCallback(() => {
    setScissorsMode((prev) => !prev);
    setCommentMode(false);
  }, []);

  const handleToggleComment = useCallback(() => {
    setCommentMode((prev) => !prev);
    setScissorsMode(false);
  }, []);

  // --- Pending States ---
  const [pendingEventIds, setPendingEventIds] = useState<Set<string>>(new Set());

  // --- Clipboard ---
  const [copiedEvent, setCopiedEvent] = useState<SchedulerEvent | null>(null);

  // --- Modals ---
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [modalInitialData, setModalInitialData] = useState<any>({});
  const [pendingEvent, setPendingEvent] = useState<any>(null);

  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [pendingComment, setPendingComment] = useState<{
    resourceId: string;
    week: number;
  } | null>(null);

  // Unified Management Modal
  const [managementModalOpen, setManagementModalOpen] = useState(false);
  const [managementModalTab, setManagementModalTab] = useState<TabType>("users");

  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [workspaceManagementModalOpen, setWorkspaceManagementModalOpen] = useState(false);

  // --- Context Menus ---
  const [contextMenu, setContextMenu] = useState<{
    isVisible: boolean;
    x: number;
    y: number;
    event: SchedulerEvent | null;
  }>({ isVisible: false, x: 0, y: 0, event: null });

  const [emptyCellContextMenu, setEmptyCellContextMenu] = useState<{
    isVisible: boolean;
    x: number;
    y: number;
    resourceId: string | null;
    week: number | null;
    unitIndex: number | null;
  }>({ isVisible: false, x: 0, y: 0, resourceId: null, week: null, unitIndex: null });

  // --- Hover & Ghost ---
  const [hoverHighlight, setHoverHighlight] = useState<{
    visible: boolean;
    left: number;
    top: number;
    width: number;
    height: number;
  }>({ visible: false, left: 0, top: 0, width: 0, height: 0 });

  const [ghost, setGhost] = useState<{
    visible: boolean;
    left: number;
    top: number;
    width: number;
    height: number;
  }>({ visible: false, left: 0, top: 0, width: 0, height: 0 });

  // --- Actions ---
  const closeAllModals = useCallback(() => {
    const hasOpenModal =
      modalOpen ||
      managementModalOpen ||
      shortcutsModalOpen ||
      workspaceManagementModalOpen ||
      contextMenu.isVisible ||
      emptyCellContextMenu.isVisible;
    const hasActiveMode = scissorsMode || commentMode;

    if (hasOpenModal) {
      setModalOpen(false);
      setManagementModalOpen(false);
      setShortcutsModalOpen(false);
      setWorkspaceManagementModalOpen(false);
      setContextMenu((prev) => ({ ...prev, isVisible: false, event: null }));
      setEmptyCellContextMenu((prev) => ({
        ...prev,
        isVisible: false,
        resourceId: null,
        week: null,
        unitIndex: null,
      }));
      setHoverHighlight((prev) => ({ ...prev, visible: false }));
    }

    if (hasActiveMode) {
      setScissorsMode(false);
      setCommentMode(false);
    }
  }, [
    modalOpen,
    managementModalOpen,
    shortcutsModalOpen,
    workspaceManagementModalOpen,
    contextMenu.isVisible,
    emptyCellContextMenu.isVisible,
    scissorsMode,
    commentMode,
  ]);

  return (
    <UIContext.Provider value={{
      // Loading
      isLoadingDepartments, setIsLoadingDepartments,
      isLoadingResources, setIsLoadingResources,
      isLoadingProjects, setIsLoadingProjects,
      isLoadingGrades, setIsLoadingGrades,
      isLoadingEventPatterns, setIsLoadingEventPatterns,
      isLoadingCompanies, setIsLoadingCompanies,
      isLoadingEvents, setIsLoadingEvents,
      isLoadingComments, setIsLoadingComments,
      isLoading,

      // Modes
      scissorsMode,
      commentMode,
      handleToggleScissors,
      handleToggleComment,
      setScissorsMode,
      setCommentMode,

      // Pending
      pendingEventIds,
      setPendingEventIds,

      // Clipboard
      copiedEvent,
      setCopiedEvent,

      // Modals
      modalOpen, setModalOpen,
      modalMode, setModalMode,
      modalInitialData, setModalInitialData,
      pendingEvent, setPendingEvent,

      commentModalOpen, setCommentModalOpen,
      pendingComment, setPendingComment,

      managementModalOpen, setManagementModalOpen,
      managementModalTab, setManagementModalTab,
      
      shortcutsModalOpen, setShortcutsModalOpen,
      profileModalOpen, setProfileModalOpen,
      settingsModalOpen, setSettingsModalOpen,
      workspaceManagementModalOpen, setWorkspaceManagementModalOpen,

      // Menus
      contextMenu, setContextMenu,
      emptyCellContextMenu, setEmptyCellContextMenu,

      // Visuals
      hoverHighlight, setHoverHighlight,
      ghost, setGhost,

      // Actions
      closeAllModals,
    }}>
      {children}
    </UIContext.Provider>
  );
}

export function useUI() {
  const context = useContext(UIContext);
  if (context === undefined) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
}
