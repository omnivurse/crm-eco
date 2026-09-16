'use client';

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
        className={cn(
          'absolute inset-0 rounded-full',
          'bg-[radial-gradient(circle_at_35%_30%,rgba(255,255,255,0.55),transparent_42%),radial-gradient(circle_at_50%_55%,#14b8a6_0%,#0f766e_70%,#115e59_100%)]',
          'shadow-[inset_0_1px_1px_rgba(255,255,255,0.45),0_8px_20px_rgba(13,148,136,0.35)]',
          'ring-1 ring-white/30',
          thinking && 'brightness-125',
        )}
      />
      <span className="absolute inset-0 rounded-full bg-white/10 backdrop-blur-[1px]" />
      <span className="absolute left-[13px] top-[15px] h-[5px] w-[5px] rounded-full bg-[#042f2e]" />
      <span className="absolute right-[13px] top-[15px] h-[5px] w-[5px] rounded-full bg-[#042f2e]" />
      <span className="absolute bottom-[13px] left-1/2 h-[7px] w-[14px] -translate-x-1/2 rounded-full border-[1.5px] border-[#042f2e] border-t-0 bg-transparent" />
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
        'relative flex h-11 w-11 items-center justify-center rounded-full outline-none',
        'focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2',
        'gizmo-orb-breathe motion-safe:[animation:gizmo-breathe_4s_ease-in-out_infinite]',
        className,
      )}
    >
      <GizmoOrbFace thinking={thinking} />
      {hasUnread && !open ? (
        <span className="absolute right-0 top-0 h-2 w-2 rounded-full bg-teal-300 ring-2 ring-background" />
      ) : null}
    </button>
  );
}
