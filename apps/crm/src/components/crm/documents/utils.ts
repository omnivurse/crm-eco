import {
  File,
  FileText,
  FileImage,
  FileSpreadsheet,
  FileArchive,
  FileVideo,
  FileAudio,
  Presentation,
  type LucideIcon,
} from 'lucide-react';

export function getFileIcon(mimeType: string | null): LucideIcon {
  if (!mimeType) return File;
  if (mimeType.startsWith('image/')) return FileImage;
  if (mimeType.startsWith('video/')) return FileVideo;
  if (mimeType.startsWith('audio/')) return FileAudio;
  if (mimeType.includes('pdf')) return FileText;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv'))
    return FileSpreadsheet;
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint'))
    return Presentation;
  if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('gzip') || mimeType.includes('rar'))
    return FileArchive;
  if (mimeType.includes('text') || mimeType.includes('document') || mimeType.includes('word'))
    return FileText;
  return File;
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
