'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  cn,
} from '@crm-eco/ui';
import {
  Paperclip,
  X,
  FileText,
  Image,
  FileSpreadsheet,
  File,
  Upload,
  AlertCircle,
  Loader2,
  Download,
  Eye,
} from 'lucide-react';

export interface EmailAttachment {
  id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  file_path?: string;
  bucket_path?: string;
  public_url?: string;
  is_uploading?: boolean;
  upload_progress?: number;
  error?: string;
}

interface EmailAttachmentsProps {
  attachments: EmailAttachment[];
  onAttachmentsChange: (attachments: EmailAttachment[]) => void;
  maxFileSize?: number; // in bytes, default 10MB
  maxTotalSize?: number; // in bytes, default 25MB
  allowedTypes?: string[]; // MIME types
  disabled?: boolean;
  compact?: boolean;
}

const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const DEFAULT_MAX_TOTAL_SIZE = 25 * 1024 * 1024; // 25MB
const DEFAULT_ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
  'application/zip',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return Image;
  if (mimeType.includes('pdf')) return FileText;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) return FileSpreadsheet;
  if (mimeType.includes('word') || mimeType.includes('document')) return FileText;
  return File;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toUpperCase() || 'FILE';
}

export function EmailAttachments({
  attachments,
  onAttachmentsChange,
  maxFileSize = DEFAULT_MAX_FILE_SIZE,
  maxTotalSize = DEFAULT_MAX_TOTAL_SIZE,
  allowedTypes = DEFAULT_ALLOWED_TYPES,
  disabled = false,
  compact = false,
}: EmailAttachmentsProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const totalSize = attachments.reduce((sum, a) => sum + a.file_size, 0);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setUploadError(null);

    // Validate files
    const validFiles: File[] = [];
    for (const file of acceptedFiles) {
      // Check file type
      if (!allowedTypes.includes(file.type)) {
        setUploadError(`File type not allowed: ${file.name}`);
        continue;
      }

      // Check individual file size
      if (file.size > maxFileSize) {
        setUploadError(`File too large: ${file.name} (max ${formatFileSize(maxFileSize)})`);
        continue;
      }

      // Check total size
      const newTotal = totalSize + file.size;
      if (newTotal > maxTotalSize) {
        setUploadError(`Total attachments exceed limit (max ${formatFileSize(maxTotalSize)})`);
        continue;
      }

      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    setIsUploading(true);

    // Create temporary attachment entries
    const newAttachments: EmailAttachment[] = validFiles.map(file => ({
      id: crypto.randomUUID(),
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type,
      is_uploading: true,
      upload_progress: 0,
    }));

    onAttachmentsChange([...attachments, ...newAttachments]);

    // Upload files
    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      const attachment = newAttachments[i];

      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/email/attachments', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error('Upload failed');
        }

        const data = await response.json();

        // Update attachment with server response
        const updatedAttachments = attachments.map(a =>
          a.id === attachment.id
            ? {
                ...a,
                id: data.id,
                file_path: data.file_path,
                bucket_path: data.bucket_path,
                public_url: data.public_url,
                is_uploading: false,
              }
            : a
        );
        onAttachmentsChange(updatedAttachments);
      } catch {
        // Mark as failed
        const failedAttachments = attachments.map(a =>
          a.id === attachment.id
            ? { ...a, is_uploading: false, error: 'Upload failed' }
            : a
        );
        onAttachmentsChange(failedAttachments);
      }
    }

    setIsUploading(false);
  }, [attachments, onAttachmentsChange, maxFileSize, maxTotalSize, allowedTypes, totalSize]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled: disabled || isUploading,
    accept: allowedTypes.reduce((acc, type) => {
      acc[type] = [];
      return acc;
    }, {} as Record<string, string[]>),
    maxSize: maxFileSize,
  });

  const removeAttachment = (id: string) => {
    onAttachmentsChange(attachments.filter(a => a.id !== id));
  };

  const retryUpload = (attachment: EmailAttachment) => {
    // Remove and let user re-add
    removeAttachment(attachment.id);
  };

  if (compact && attachments.length === 0) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="gap-2"
        disabled={disabled}
        {...getRootProps()}
      >
        <input {...getInputProps()} />
        <Paperclip className="w-4 h-4" />
        Attach
      </Button>
    );
  }

  return (
    <div className="space-y-3">
      {/* Drop Zone */}
      <div
        {...getRootProps()}
        className={cn(
          'relative border-2 border-dashed rounded-lg p-4 transition-colors cursor-pointer',
          isDragActive
            ? 'border-teal-500 bg-teal-50 dark:bg-teal-500/10'
            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
            <Upload className="w-5 h-5 text-slate-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {isDragActive ? 'Drop files here' : 'Drag files here or click to browse'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              PDF, DOC, XLS, CSV, TXT, ZIP, Images up to {formatFileSize(maxFileSize)}
            </p>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {uploadError && (
        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* Attachments List */}
      {attachments.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {attachments.length} file{attachments.length !== 1 ? 's' : ''} attached
            </span>
            <span className="text-slate-500 dark:text-slate-400">
              {formatFileSize(totalSize)} / {formatFileSize(maxTotalSize)}
            </span>
          </div>

          <div className="grid gap-2">
            {attachments.map(attachment => {
              const Icon = getFileIcon(attachment.mime_type);
              const isImage = attachment.mime_type.startsWith('image/');

              return (
                <div
                  key={attachment.id}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg border',
                    attachment.error
                      ? 'border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50'
                  )}
                >
                  {/* File Icon */}
                  <div className={cn(
                    'p-2 rounded-lg shrink-0',
                    attachment.error
                      ? 'bg-red-100 dark:bg-red-500/20'
                      : 'bg-white dark:bg-slate-700'
                  )}>
                    <Icon className={cn(
                      'w-5 h-5',
                      attachment.error
                        ? 'text-red-500'
                        : 'text-slate-500 dark:text-slate-400'
                    )} />
                  </div>

                  {/* File Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                      {attachment.file_name}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span>{getFileExtension(attachment.file_name)}</span>
                      <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                      <span>{formatFileSize(attachment.file_size)}</span>
                      {attachment.is_uploading && (
                        <>
                          <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                          <span className="text-teal-600 dark:text-teal-400">Uploading...</span>
                        </>
                      )}
                      {attachment.error && (
                        <>
                          <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                          <span className="text-red-500">{attachment.error}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {attachment.is_uploading ? (
                      <Loader2 className="w-4 h-4 text-teal-500 animate-spin" />
                    ) : attachment.error ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                        onClick={() => retryUpload(attachment)}
                      >
                        <Upload className="w-4 h-4" />
                      </Button>
                    ) : (
                      <>
                        {isImage && attachment.public_url && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => setPreviewUrl(attachment.public_url!)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        )}
                        {attachment.public_url && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            asChild
                          >
                            <a href={attachment.public_url} download={attachment.file_name} target="_blank" rel="noopener">
                              <Download className="w-4 h-4" />
                            </a>
                          </Button>
                        )}
                      </>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-slate-400 hover:text-red-500"
                      onClick={() => removeAttachment(attachment.id)}
                      disabled={attachment.is_uploading}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Image Preview Dialog */}
      <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent className="max-w-3xl" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Image Preview</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <div className="flex items-center justify-center p-4">
              <img
                src={previewUrl}
                alt="Attachment preview"
                className="max-w-full max-h-[60vh] object-contain rounded-lg"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Compact attachment button for use in toolbars
export function AttachmentButton({
  attachmentCount = 0,
  onClick,
  disabled,
}: {
  attachmentCount?: number;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="gap-2"
      onClick={onClick}
      disabled={disabled}
    >
      <Paperclip className="w-4 h-4" />
      {attachmentCount > 0 ? (
        <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-400">
          {attachmentCount}
        </span>
      ) : (
        <span>Attach</span>
      )}
    </Button>
  );
}
