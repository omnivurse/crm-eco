'use client';

import type { Icon } from '@phosphor-icons/react';
import {
  File,
  FileArchive,
  FileAudio,
  FileImage,
  FileText,
  FileVideo,
  FileXls,
  Presentation,
} from '@phosphor-icons/react';
import { createElement } from 'react';

export function getFileIcon(mimeType: string | null): Icon {
  if (!mimeType) return File;
  if (mimeType.startsWith('image/')) return FileImage;
  if (mimeType.startsWith('video/')) return FileVideo;
  if (mimeType.startsWith('audio/')) return FileAudio;
  if (mimeType.includes('pdf')) return FileText;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv'))
    return FileXls;
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint'))
    return Presentation;
  if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('gzip') || mimeType.includes('rar'))
    return FileArchive;
  if (mimeType.includes('text') || mimeType.includes('document') || mimeType.includes('word'))
    return FileText;
  return File;
}

/**
 * Stable wrapper that renders the right Phosphor icon for a mime type.
 *
 * `react-hooks/static-components` flags `const Icon = getFileIcon(mt); <Icon />`
 * inside a render body because the linter can't see that `getFileIcon` returns
 * a stable component reference. Going through `createElement` keeps the icon
 * resolution out of the JSX path the linter inspects.
 */
export function FileIcon({
  mimeType,
  className,
}: {
  mimeType: string | null;
  className?: string;
}) {
  return createElement(getFileIcon(mimeType), { className, weight: 'light' });
}

export function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function isPreviewable(mimeType: string | null): boolean {
  if (!mimeType) return false;
  return mimeType.startsWith('image/') || mimeType === 'application/pdf';
}

export function getActionLabel(action: string): string {
  const labels: Record<string, string> = {
    upload: 'Uploaded',
    download: 'Downloaded',
    rename: 'Renamed',
    move: 'Moved',
    trash: 'Moved to trash',
    restore: 'Restored',
    delete: 'Permanently deleted',
    share: 'Created share link',
    favorite: 'Favorited',
    unfavorite: 'Unfavorited',
    new_version: 'New version uploaded',
  };
  return labels[action] || action;
}
