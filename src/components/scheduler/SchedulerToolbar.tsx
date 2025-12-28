import React, { useState, useRef, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import svgPaths from "../../imports/svg-k0w039fxgr";
import Header from "../../imports/Header"; // The existing Toolbar component
import { Workspace, Project, Department, Company, SchedulerEvent, Grade, EventPattern } from "../../types/scheduler";

// ============================================================
// HELPER COMPONENTS (Copied from SchedulerGrid)
// ============================================================

function ArrowUp1() {
  return (
    <div className="relative size-full">
      <div className="absolute bottom-[-0.01%] left-0 right-0 top-0">
        <svg
          className="block size-full"
          fill="none"
          preserveAspectRatio="none"
          viewBox="0 0 11 11"
        >
          <path
            d={svgPaths.p22ff0c80}
            fill="var(--fill-0, black)"
          />
        </svg>
      </div>
    </div>
  );
}

function IconlyRegularLightArrowUp1() {
  return (
    <div className="relative size-[20px]">
      <div
        className="absolute flex items-center justify-center left-1/2 size-[16px] top-1/2 translate-x-[-50%] translate-y-[-50%]"
        style={
          {
            "--transform-inner-width": "16",
            "--transform-inner-height": "16",
          } as React.CSSProperties
        }
      >
        <div className="flex-none rotate-[270deg] scale-y-[-100%]">
          <div className="relative size-[16px]">
             <div className="absolute bottom-[13.74%] flex items-center justify-center left-1/2 top-[17.92%] translate-x-[-50%] w-[10.933px]">
                <div className="flex-none h-[10.934px] rotate-[180deg] w-[10.933px]">
                  <ArrowUp1 />
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeaderBackButton({ onClick }: { onClick?: () => void }) {
  return (
    <div
      className="rounded-[12px] w-[36px] cursor-pointer hover:bg-gray-100 transition-colors"
      onClick={onClick}
    >
      <div className="px-[12px] py-[8px] flex items-center justify-center">
        <div className="rotate-[180deg] scale-y-[-100%]">
          <IconlyRegularLightArrowUp1 />
        </div>
      </div>
    </div>
  );
}

function ArrowUp2() {
  return (
    <div className="relative size-full">
      <div className="absolute bottom-0 left-0 right-[-0.01%] top-[-0.01%]">
        <svg
          className="block size-full"
          fill="none"
          preserveAspectRatio="none"
          viewBox="0 0 9 6"
        >
          <path
            d={svgPaths.p1c596770}
            fill="var(--fill-0, black)"
          />
        </svg>
      </div>
    </div>
  );
}

function IconlyRegularLightArrowUp() {
  return (
    <div className="relative shrink-0 size-[20px]">
      <div className="absolute flex inset-[37.67%_27.67%_36%_27.67%] items-center justify-center">
        <div className="flex-none h-[5.266px] w-[8.933px]">
          <ArrowUp2 />
        </div>
      </div>
    </div>
  );
}

function HeaderTitle({
  name,
  onRename,
  onOpenSettings,
  onOpenWorkspaceManagement,
  onDelete,
}: {
  name: string;
  onRename?: (newName: string) => void;
  onOpenSettings?: () => void;
  onOpenWorkspaceManagement?: () => void;
  onDelete?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditValue(name);
  }, [name]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleSave = () => {
    const trimmedValue = editValue.trim();
    if (trimmedValue && trimmedValue !== name) {
      onRename?.(trimmedValue);
    } else {
      setEditValue(name);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(name);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className="bg-[#f6f6f6] rounded-[4px] px-[4px] h-[20px] flex items-center w-full">
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="font-semibold text-[14px] text-black bg-transparent border-none outline-none w-full"
        />
      </div>
    );
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <div className="w-full flex gap-[2px] items-center header-title-container">
        <div
          className="px-[4px] h-[20px] rounded-bl-[4px] rounded-tl-[4px] cursor-text transition-colors flex items-center header-title-left flex-1 min-w-0"
          onClick={handleStartEdit}
        >
          <p className="font-semibold text-[14px] text-black whitespace-nowrap truncate w-full">
            {name}
          </p>
        </div>

        <DropdownMenuTrigger asChild>
          <div className="size-[20px] rounded-br-[4px] rounded-tr-[4px] cursor-pointer transition-colors flex items-center justify-center header-title-right shrink-0">
            <div
              className="transition-transform duration-200"
              style={{
                transform: isOpen
                  ? "rotate(180deg)"
                  : "rotate(0deg)",
              }}
            >
              <IconlyRegularLightArrowUp />
            </div>
          </div>
        </DropdownMenuTrigger>
      </div>

      <DropdownMenuContent
        align="start"
        className="w-48 rounded-xl"
      >
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onOpenWorkspaceManagement?.();
            setIsOpen(false);
          }}
          className="py-2.5 cursor-pointer"
        >
          Настройки
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onOpenSettings?.();
            setIsOpen(false);
          }}
          className="py-2.5 cursor-pointer"
        >
          Управление
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.();
            setIsOpen(false);
          }}
          className="text-red-600 focus:text-red-600 focus:bg-red-50 py-2.5 cursor-pointer"
        >
          Удалить
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function YearContainer({ year }: { year: number | string }) {
  return (
    <div className="px-1 w-full">
      <p className="w-full font-normal text-[#868789] text-[12px] whitespace-nowrap">
        {year}
      </p>
    </div>
  );
}

const SidePaddedBox = ({
  children,
  roundedTop = false,
  topBorder = false,
  topPadding = false,
}: {
  children: React.ReactNode;
  roundedTop?: boolean;
  topBorder?: boolean;
  topPadding?: boolean;
}) => {
  return (
    <div
      style={{
        padding: topPadding ? "8px 0 0 8px" : "0 0 0 8px",
        height: "100%",
        width: "100%",
      }}
    >
      <div
        style={{
          height: "100%",
          width: "100%",
          borderLeft: "1px solid #f0f0f0",
          borderRight: "1px solid #f0f0f0",
          ...(topBorder && { borderTop: "1px solid #f0f0f0" }),
          ...(roundedTop && {
            borderTopLeftRadius: "16px",
            borderTopRightRadius: "16px",
            overflow: "hidden",
          }),
          backgroundColor: "#fff",
        }}
      >
        {children}
      </div>
    </div>
  );
};

// ============================================================
// MAIN COMPONENT
// ============================================================

interface SchedulerToolbarProps {
  workspace: Workspace;
  onBackToWorkspaces?: () => void;
  onRenameWorkspace?: (newName: string) => void;
  onOpenSettingsModal?: () => void;
  onOpenWorkspaceManagementModal?: () => void;
  onSignOut?: () => void;
  
  // Header Props
  accessToken: string | null;
  scissorsMode: boolean;
  commentMode: boolean;
  onToggleScissors: () => void;
  onToggleComment: () => void;
  
  // Data for Header (Profile, Filters etc)
  companies: Company[];
  departments: Department[];
  projects: Project[];
  
  // History
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  
  // Sidebar state
  sidebarCollapsed?: boolean;
}

export function SchedulerToolbar({
  workspace,
  onBackToWorkspaces,
  onRenameWorkspace,
  onOpenSettingsModal,
  onOpenWorkspaceManagementModal,
  onSignOut,
  accessToken,
  scissorsMode,
  commentMode,
  onToggleScissors,
  onToggleComment,
  companies,
  departments,
  projects,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  sidebarCollapsed = false,
}: SchedulerToolbarProps) {
  
  return (
    <div className="flex h-[80px] bg-white z-50 relative shrink-0">
      {/* Left Sidebar Header (Title, Back) */}
      <div 
        className="shrink-0 h-full transition-all duration-200"
        style={{ width: sidebarCollapsed ? '60px' : '284px' }}
      >
        <SidePaddedBox roundedTop topBorder topPadding>
          <div className="flex items-center gap-2 pl-[7px] pr-4 py-2 w-full h-full">
            {onBackToWorkspaces && (
              <HeaderBackButton onClick={onBackToWorkspaces} />
            )}
            {!sidebarCollapsed && (
              <div className="flex flex-col flex-1 min-w-0">
                <HeaderTitle
                  name={workspace?.name || "Workspace"}
                  onRename={onRenameWorkspace}
                  onOpenSettings={onOpenSettingsModal}
                  onOpenWorkspaceManagement={onOpenWorkspaceManagementModal}
                  onDelete={onSignOut}
                />
                <YearContainer year={workspace?.timeline_year || new Date().getFullYear()} />
              </div>
            )}
          </div>
        </SidePaddedBox>
      </div>
      
      {/* Spacer between sidebar header and main toolbar */}
      {!sidebarCollapsed && (
        <div className="w-[4px] shrink-0 h-full bg-white" />
      )}

      {/* Main Toolbar (Zoom, Profile, etc.) */}
      <div className="flex-1 min-w-0 h-full">
        <Header
          workspaceId={workspace?.id?.toString()}
          accessToken={accessToken}
          scissorsMode={scissorsMode}
          commentMode={commentMode}
          onToggleScissors={onToggleScissors}
          onToggleComment={onToggleComment}
          companies={companies}
          departments={departments}
          projects={projects}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={onUndo}
          onRedo={onRedo}
          sidebarCollapsed={false} // Always expanded in toolbar for now
        />
      </div>
    </div>
  );
}