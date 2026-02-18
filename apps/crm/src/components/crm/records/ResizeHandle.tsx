'use client';

import { useCallback } from 'react';

interface ResizeHandleProps {
  /** Column key being resized */
  columnKey: string;
  /** Called with (columnKey, mouseX) on drag start */
  onResizeStart: (col: string, startX: number) => void;
  /** Called on double-click to reset to default width */
  onResetWidth: (col: string) => void;
}

/**
 * Thin draggable handle rendered at the right edge of a table header cell.
 * Shows a teal highlight line on hover and sets col-resize cursor.
 */
export function ResizeHandle({ columnKey, onResizeStart, onResetWidth }: ResizeHandleProps) {
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onResizeStart(columnKey, e.clientX);
    },
    [columnKey, onResizeStart],
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onResetWidth(columnKey);
    },
    [columnKey, onResetWidth],
  );

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      onClick={(e) => e.stopPropagation()}
      className="absolute right-0 top-0 bottom-0 w-[7px] -mr-[3px] cursor-col-resize z-30 group/resize select-none"
    >
      {/* Subtle divider visible at rest, teal on hover */}
      <div className="absolute left-1/2 -translate-x-1/2 top-2 bottom-2 w-[2px] rounded-full bg-slate-200 dark:bg-white/10 transition-colors group-hover/resize:bg-teal-400 dark:group-hover/resize:bg-teal-500" />
    </div>
  );
}
