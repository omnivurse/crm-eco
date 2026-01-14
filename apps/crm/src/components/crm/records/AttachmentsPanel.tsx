'use client';

import { useState, useCallback, useRef } from 'react';
import { 
  Upload, 
  File, 
  FileText, 
  FileImage, 
  FileVideo, 
  FileAudio,
  Download,
  Trash2,
  MoreHorizontal,
  Loader2,
  X,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';
import { cn } from '@crm-eco/ui/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import type { CrmAttachmentWithAuthor } from '@/lib/crm/types';

interface AttachmentsPanelProps {
  recordId: string;
  attachments: CrmAttachmentWithAuthor[];
  isLoading?: boolean;
  onUpload?: (file: File, description?: string) => Promise<void>;
  onDelete?: (attachmentId: string) => Promise<void>;
  onDownload?: (attachmentId: string) => Promise<string>; // Returns signed URL
  className?: string;
}

function getFileIcon(mimeType: string | null) {
  if (!mimeType) return <File className="w-6 h-6" />;
  
  if (mimeType.startsWith('image/')) return <FileImage className="w-6 h-6" />;
  if (mimeType.startsWith('video/')) return <FileVideo className="w-6 h-6" />;
  if (mimeType.startsWith('audio/')) return <FileAudio className="w-6 h-6" />;
  if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('text')) {
    return <FileText className="w-6 h-6" />;
  }
  
  return <File className="w-6 h-6" />;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentRow({
  attachment,
  onDelete,
  onDownload,
}: {
  attachment: CrmAttachmentWithAuthor;
  onDelete?: () => Promise<void>;
  onDownload?: () => Promise<string>;
}) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    if (!onDownload) return;
    
    setIsDownloading(true);
    try {
      const url = await onDownload();
      // Open in new tab
      window.open(url, '_blank');
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    
    setIsDeleting(true);
    try {
      await onDelete();
    } catch (error) {
      console.error('Delete failed:', error);
      setIsDeleting(false);
    }
  };

  const icon = getFileIcon(attachment.mime_type);
  const size = formatFileSize(attachment.file_size);

  return (
    <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-900/30 border border-white/5 hover:border-white/10 transition-colors group">
      <div className="p-2 rounded-lg bg-slate-800/50 text-slate-400">
        {icon}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-medium text-white truncate">
            {attachment.file_name}
          </h4>
          {isDownloading && (
            <Loader2 className="w-4 h-4 text-teal-500 animate-spin" />
          )}
        </div>
        <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
          {size && <span>{size}</span>}
          <span>•</span>
          <span>{formatDistanceToNow(new Date(attachment.created_at), { addSuffix: true })}</span>
          {attachment.author && (
            <>
              <span>•</span>
              <span>{attachment.author.full_name}</span>
            </>
          )}
        </div>
        {attachment.description && (
          <p className="text-sm text-slate-400 mt-1">{attachment.description}</p>
        )}
      </div>

      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDownload}
          disabled={isDownloading}
          className="h-8 w-8 text-slate-400 hover:text-white hover:bg-white/10"
        >
          {isDownloading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-400 hover:text-white hover:bg-white/10"
            >
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="glass-card border-white/10">
            <DropdownMenuItem 
              onClick={handleDownload}
              className="text-slate-300 focus:text-white focus:bg-white/10"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Open in new tab
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/10" />
            <DropdownMenuItem
              onClick={handleDelete}
              disabled={isDeleting}
              className="text-red-400 focus:text-red-300 focus:bg-red-500/10"
            >
              {isDeleting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function UploadZone({
  onUpload,
  isUploading,
}: {
  onUpload: (file: File, description?: string) => Promise<void>;
  isUploading: boolean;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      setSelectedFile(file);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    
    await onUpload(selectedFile, description || undefined);
    setSelectedFile(null);
    setDescription('');
  };

  const handleCancel = () => {
    setSelectedFile(null);
    setDescription('');
  };

  if (selectedFile) {
    return (
      <div className="p-4 rounded-xl border border-teal-500/30 bg-teal-500/5">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-2 rounded-lg bg-teal-500/10 text-teal-400">
            {getFileIcon(selectedFile.type)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-white truncate">{selectedFile.name}</p>
            <p className="text-sm text-slate-400">{formatFileSize(selectedFile.size)}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCancel}
            className="h-8 w-8 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add a description (optional)"
          className="mb-4 bg-slate-900/50 border-white/10 text-white placeholder:text-slate-500"
        />

        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={handleCancel}
            className="text-slate-400 hover:text-white"
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={isUploading}
            className="bg-teal-500 hover:bg-teal-400 text-white"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Upload
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={cn(
        'p-8 rounded-xl border-2 border-dashed transition-colors cursor-pointer',
        'flex flex-col items-center justify-center gap-3',
        isDragOver
          ? 'border-teal-500 bg-teal-500/5'
          : 'border-slate-700 hover:border-slate-600 hover:bg-slate-900/30'
      )}
    >
      <input
        ref={inputRef}
        type="file"
        onChange={handleFileSelect}
        className="hidden"
      />
      <div className="p-3 rounded-full bg-slate-800/50 text-slate-400">
        <Upload className="w-6 h-6" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-white">
          {isDragOver ? 'Drop file here' : 'Click to upload or drag and drop'}
        </p>
        <p className="text-xs text-slate-500 mt-1">
          Any file up to 10MB
        </p>
      </div>
    </div>
  );
}

export function AttachmentsPanel({
  recordId,
  attachments,
  isLoading,
  onUpload,
  onDelete,
  onDownload,
  className,
}: AttachmentsPanelProps) {
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async (file: File, description?: string) => {
    if (!onUpload) return;
    
    setIsUploading(true);
    try {
      await onUpload(file, description);
    } finally {
      setIsUploading(false);
    }
  };

  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="h-32 bg-slate-800/30 rounded-xl animate-pulse" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 bg-slate-800/30 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Upload Zone */}
      {onUpload && (
        <UploadZone onUpload={handleUpload} isUploading={isUploading} />
      )}

      {/* Attachments List */}
      {attachments.length > 0 ? (
        <div className="space-y-2">
          {attachments.map((attachment) => (
            <AttachmentRow
              key={attachment.id}
              attachment={attachment}
              onDelete={onDelete ? () => onDelete(attachment.id) : undefined}
              onDownload={onDownload ? () => onDownload(attachment.id) : undefined}
            />
          ))}
        </div>
      ) : (
        !onUpload && (
          <div className="text-center py-12">
            <File className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-1">No attachments</h3>
            <p className="text-slate-400">
              Files uploaded to this record will appear here
            </p>
          </div>
        )
      )}
    </div>
  );
}
