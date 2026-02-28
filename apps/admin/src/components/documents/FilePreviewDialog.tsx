'use client';

import { useState, useEffect } from 'react';
import { Download } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@crm-eco/ui/components/dialog';
import { Button } from '@crm-eco/ui/components/button';

interface FilePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentName: string;
  mimeType: string | null;
  getPreviewUrl: () => Promise<string>;
  onDownload: () => void;
}

export function FilePreviewDialog({
  open,
  onOpenChange,
  documentName,
  mimeType,
  getPreviewUrl,
  onDownload,
}: FilePreviewDialogProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setLoading(true);
      getPreviewUrl()
        .then(setUrl)
        .finally(() => setLoading(false));
    } else {
      setUrl(null);
    }
  }, [open, getPreviewUrl]);

  const isImage = mimeType?.startsWith('image/');
  const isPdf = mimeType === 'application/pdf';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="truncate">{documentName}</span>
            <Button variant="outline" size="sm" onClick={onDownload} className="gap-1.5 shrink-0 ml-2">
              <Download className="w-3.5 h-3.5" /> Download
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-center min-h-[300px] overflow-auto">
          {loading ? (
            <p className="text-gray-400">Loading preview...</p>
          ) : !url ? (
            <p className="text-gray-400">Preview unavailable</p>
          ) : isImage ? (
            <img src={url} alt={documentName} className="max-w-full max-h-[60vh] object-contain" />
          ) : isPdf ? (
            <iframe src={url} className="w-full h-[60vh]" title={documentName} />
          ) : (
            <p className="text-gray-400">Preview not supported for this file type</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
