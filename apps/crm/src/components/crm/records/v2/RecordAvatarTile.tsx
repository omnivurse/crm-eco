'use client';

import { memo } from 'react';
import { cn } from '@crm-eco/ui/lib/utils';
import { AVATAR_SIZES, resolveModulePalette, type AvatarSize } from './tokens';

export interface RecordAvatarTileProps {
  name: string;
  moduleKey?: string;
  size?: AvatarSize;
  className?: string;
}

/**
 * Large colored initials tile à la Zoho's record header avatar.
 * Color is derived deterministically (see `resolveModulePalette`) so it
 * stays stable between renders without requiring persistence.
 *
 * Palette + size tokens live in `./tokens` so list rows and other
 * surfaces can match the header without redeclaring colors.
 */
export const RecordAvatarTile = memo(function RecordAvatarTile({
  name,
  moduleKey,
  size = 'lg',
  className,
}: RecordAvatarTileProps) {
  const initials = getInitials(name);
  const palette = resolveModulePalette(moduleKey, name);
  const sizeClasses = AVATAR_SIZES[size];

  return (
    <div
      aria-hidden
      className={cn(
        'flex items-center justify-center rounded-xl font-semibold shrink-0 select-none',
        'ring-1 ring-inset',
        palette.bg,
        palette.text,
        palette.ring,
        sizeClasses,
        className,
      )}
    >
      {initials}
    </div>
  );
});

function getInitials(name: string): string {
  const trimmed = (name || '').trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
