import { useState, useCallback } from "react";
import { SchedulerEvent } from "../types/scheduler";
import { TabType } from "../components/scheduler/UnifiedManagementModal";

export interface UseSchedulerUIReturn {
  // Modes
  scissorsMode: boolean;
  commentMode: boolean;
  handleToggleScissors: () => void;
  handleToggleComment: () => void;
  setScissorsMode: (value: boolean) => void;
  setCommentMode: (value: boolean) => void;

  // Pending States
  pendingEventIds: Set<string>;
  setPendingEventIds: React.Dispatch<React.SetStateAction<Set<string>>>;

  // Clipboard
  copiedEvent: SchedulerEvent | null;
  setCopiedEvent: (event: SchedulerEvent | null) => void;

  // Modals State
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

  // Unified Management Modal (replaces 3 separate modals)
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

  // Context Menus State
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

  // Hover State
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

  // Ghost State
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

  // Actions
  closeAllModals: () => void;
}

export function useSchedulerUI(): UseSchedulerUIReturn {
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

  // Unified Management Modal (replaces 3 separate modals)
  const [managementModalOpen, setManagementModalOpen] = useState(false);
  const [managementModalTab, setManagementModalTab] = useState<TabType>("users");

  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

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
      contextMenu.isVisible ||
      emptyCellContextMenu.isVisible;
    const hasActiveMode = scissorsMode || commentMode;

    if (hasOpenModal) {
      setModalOpen(false);
      setManagementModalOpen(false);
      setShortcutsModalOpen(false);
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
    contextMenu.isVisible,
    emptyCellContextMenu.isVisible,
    scissorsMode,
    commentMode,
  ]);

  return {
    scissorsMode,
    commentMode,
    handleToggleScissors,
    handleToggleComment,
    setScissorsMode,
    setCommentMode,

    pendingEventIds,
    setPendingEventIds,

    copiedEvent,
    setCopiedEvent,

    modalOpen,
    setModalOpen,
    modalMode,
    setModalMode,
    modalInitialData,
    setModalInitialData,
    pendingEvent,
    setPendingEvent,

    commentModalOpen,
    setCommentModalOpen,
    pendingComment,
    setPendingComment,

    // Unified Management Modal (replaces 3 separate modals)
    managementModalOpen,
    setManagementModalOpen,
    managementModalTab,
    setManagementModalTab,
    
    shortcutsModalOpen,
    setShortcutsModalOpen,
    profileModalOpen,
    setProfileModalOpen,
    settingsModalOpen,
    setSettingsModalOpen,

    contextMenu,
    setContextMenu,
    emptyCellContextMenu,
    setEmptyCellContextMenu,

    hoverHighlight,
    setHoverHighlight,
    ghost,
    setGhost,

    closeAllModals,
  };
}