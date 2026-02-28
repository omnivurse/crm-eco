'use client';

import { useState, useEffect } from 'react';
import { Download, Upload } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@crm-eco/ui/components/dialog';
import { Button } from '@crm-eco/ui/components/button';
import type { DocumentVersion } from './types';
import { formatFileSize, formatDateTime } from './utils';

interface VersionHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string | null;
  documentName: string;
  getVersions: (docId: string) => Promise<DocumentVersion[]>;
  onDownloadVersion: (docId: string, version: number) => void;
  onUploadNewVersion: (file: File, docId: string) => Promise<void>;
}

export function VersionHistoryDialog({
  open,
  onOpenChange,
  documentId,
  documentName,
  getVersions,
  onDownloadVersion,
  onUploadNewVersion,
}: VersionHistoryDialogProps) {
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (open && documentId) {
      setLoading(true);
      getVersions(documentId)
        .then(setVersions)
        .finally(() => setLoading(false));
    }
  }, [open, documentId, getVersions]);

  const handleUploadVersion = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !documentId) return;
    setUploading(true);
    try {
      await onUploadNewVersion(file, documentId);
      const updated = await getVersions(documentId);
      setVersions(updated);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Version History — {documentName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-2 max-h-64 overflow-y-auto">
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-4">Loading...</p>
          ) : versions.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No versions found</p>
          ) : (
            versions.map(v => (
              <div key={v.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded text-sm">
                <span className="font-medium">v{v.version_number}</span>
                <span className="text-gray-500 flex-1">{formatDateTime(v.created_at)}</span>
                <span className="text-gray-400 text-xs">{formatFileSize(v.size_bytes)}</span>
                <button
                  onClick={() => documentId && onDownloadVersion(documentId, v.version_number)}
                  className="p-1 hover:bg-gray-200 rounded"
                  title="Download this version"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="flex justify-between items-center">
          <label className="cursor-pointer">
            <Button variant="outline" size="sm" className="gap-1.5" asChild disabled={uploading}>
              <span>
                <Upload className="w-3.5 h-3.5" />
                {uploading ? 'Uploading...' : 'Upload New Version'}
              </span>
            </Button>
            <input type="file" className="hidden" onChange={handleUploadVersion} disabled={uploading} />
          </label>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
