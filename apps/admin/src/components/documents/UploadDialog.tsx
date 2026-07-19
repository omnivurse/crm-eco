'use client';

import { File, UploadSimple, X } from '@phosphor-icons/react';
import { useState, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@crm-eco/ui/components/dialog';
import { Button } from '@crm-eco/ui/components/button';
import { Progress } from '@crm-eco/ui/components/progress';
import { formatFileSize } from './utils';

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: (file: File) => Promise<void>;
}

export function UploadDialog({ open, onOpenChange, onUpload }: UploadDialogProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((newFiles: FileList | null) => {
    if (!newFiles) return;
    setFiles(Array.from(newFiles));
    setError(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    setError(null);

    try {
      for (let i = 0; i < files.length; i++) {
        await onUpload(files[i]);
        setProgress(Math.round(((i + 1) / files.length) * 100));
      }
      setFiles([]);
      setProgress(0);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'UploadSimple failed');
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>UploadSimple Files</DialogTitle>
        </DialogHeader>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          <UploadSimple weight="light" className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          <p className="text-sm text-gray-600">Drag & drop files here, or click to browse</p>
          <p className="text-xs text-gray-400 mt-1">Max 50 MB per file</p>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>

        {files.length > 0 && (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {files.map((file, i) => (
              <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 rounded text-sm">
                <File weight="light" className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="truncate flex-1">{file.name}</span>
                <span className="text-gray-400 text-xs">{formatFileSize(file.size)}</span>
                {!uploading && (
                  <button onClick={() => removeFile(i)} className="p-0.5 hover:bg-gray-200 rounded">
                    <X weight="light" className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {uploading && <Progress value={progress} className="h-2" />}
        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploading}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={files.length === 0 || uploading}>
            {uploading ? `Uploading... ${progress}%` : `UploadSimple ${files.length} file${files.length !== 1 ? 's' : ''}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
