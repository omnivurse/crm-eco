'use client';

import React from 'react';
import { cn } from '../lib/utils';

export function GizmoOrbFace({
  thinking = false,
  className,
}: {
  thinking?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn('relative block h-11 w-11', className)}
      aria-hidden
    >
      <span
        className={cn('gizmo-orb-fill absolute inset-0 rounded-full', thinking && 'is-thinking')}
      />
      <span className="gizmo-orb-gloss absolute inset-0 rounded-full" />
      <span className="gizmo-orb-eye absolute left-[13px] top-[15px] h-[5px] w-[5px] rounded-full" />
      <span className="gizmo-orb-eye absolute right-[13px] top-[15px] h-[5px] w-[5px] rounded-full" />
      <span className="gizmo-orb-smile absolute bottom-[13px] left-1/2 h-[7px] w-[14px] -translate-x-1/2 rounded-full" />
    </span>
  );
}

export function GizmoOrbButton({
  open,
  thinking,
  hasUnread,
  onClick,
  className,
}: {
  open: boolean;
  thinking?: boolean;
  hasUnread?: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      aria-haspopup="dialog"
      aria-label={open ? 'Close Gizmo' : 'Open Gizmo'}
      className={cn(
        'gizmo-orb-btn gizmo-orb-breathe relative flex h-11 w-11 items-center justify-center rounded-full',
        className,
      )}
    >
      <GizmoOrbFace thinking={thinking} />
      {hasUnread && !open ? (
        <span className="gizmo-orb-pip absolute right-0 top-0 h-2 w-2 rounded-full" />
      ) : null}
    </button>
  );
}
