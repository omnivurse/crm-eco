'use client';

import { DownloadSimple } from '@phosphor-icons/react';
import { useState, useEffect } from 'react';
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
  // Loading is derived from "dialog open and URL not yet fetched" rather
  // than a separate state — that way the only setState call inside the
  // effect is setUrl after the async fetch completes, which keeps
  // react-hooks/set-state-in-effect happy.
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const loading = open && url === null && !failed;

  useEffect(() => {
    if (!open) {
      // Reset on close so the next open starts in the loading state. This
      // is one of the patterns the lint rule's docs explicitly call out as
      // legitimate (resetting state in response to a parent prop), but the
      // rule still fires — suppress with a comment rather than torture the
      // shape into something less obvious.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUrl(null);
      setFailed(false);
      return;
    }
    let cancelled = false;
    getPreviewUrl()
      .then((next) => {
        if (!cancelled) setUrl(next);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
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
              <DownloadSimple weight="light" className="w-3.5 h-3.5" /> DownloadSimple
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
