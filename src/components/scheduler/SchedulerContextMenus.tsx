import React from "react";
import { ContextMenu } from "./ContextMenu";
import { EmptyCellContextMenu } from "./EmptyCellContextMenu";
import { SchedulerEvent } from "../../types/scheduler";

interface SchedulerContextMenusProps {
  // Event Context Menu State
  contextMenu: {
    isVisible: boolean;
    x: number;
    y: number;
    event: SchedulerEvent | null;
  };
  onContextMenuClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCopy: () => void;

  // Empty Cell Context Menu State
  emptyCellContextMenu: {
    isVisible: boolean;
    x: number;
    y: number;
    resourceId: string | null;
    week: number | null;
    unitIndex: number | null;
  };
  onEmptyCellMenuClose: () => void;
  onPaste: () => void;
  hasCopiedEvent: boolean;
}

export const SchedulerContextMenus = React.memo<SchedulerContextMenusProps>(({
  contextMenu,
  onContextMenuClose,
  onEdit,
  onDelete,
  onCopy,
  emptyCellContextMenu,
  onEmptyCellMenuClose,
  onPaste,
  hasCopiedEvent,
}) => {
  return (
    <>
      {/* Event Context Menu */}
      {contextMenu.isVisible && contextMenu.event && (
        <ContextMenu
          isVisible={true}
          event={contextMenu.event}
          x={contextMenu.x}
          y={contextMenu.y}
          onEdit={onEdit}
          onDelete={onDelete}
          onCopy={onCopy}
          onClose={onContextMenuClose}
        />
      )}

      {/* Empty Cell Context Menu */}
      {emptyCellContextMenu.isVisible && (
        <EmptyCellContextMenu
          isVisible={true}
          x={emptyCellContextMenu.x}
          y={emptyCellContextMenu.y}
          onPaste={onPaste}
          hasCopiedEvent={hasCopiedEvent}
          onClose={onEmptyCellMenuClose}
        />
      )}
    </>
  );
});

SchedulerContextMenus.displayName = 'SchedulerContextMenus';
