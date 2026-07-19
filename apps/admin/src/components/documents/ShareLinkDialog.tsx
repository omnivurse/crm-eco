'use client';

import { Check, Copy } from '@phosphor-icons/react';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@crm-eco/ui/components/dialog';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';

interface ShareLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateLink: (expiresInHours?: number, maxDownloads?: number) => Promise<{ share_url: string }>;
}

export function ShareLinkDialog({ open, onOpenChange, onCreateLink }: ShareLinkDialogProps) {
  const [expiresHours, setExpiresHours] = useState('72');
  const [maxDownloads, setMaxDownloads] = useState('');
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await onCreateLink(
        expiresHours ? parseInt(expiresHours) : undefined,
        maxDownloads ? parseInt(maxDownloads) : undefined
      );
      setShareUrl(result.share_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create link');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setShareUrl(null);
      setCopied(false);
      setError(null);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Share Link</DialogTitle>
        </DialogHeader>

        {shareUrl ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Input value={shareUrl} readOnly className="text-sm" />
              <Button variant="outline" size="sm" onClick={handleCopy}>
                {copied ? <Check weight="light" className="w-4 h-4" /> : <Copy weight="light" className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-xs text-gray-500">Share this link with anyone to let them download the file.</p>
            <Button className="w-full" onClick={() => handleClose(false)}>Done</Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <Label htmlFor="expires">Expires in (hours)</Label>
              <Input
                id="expires"
                type="number"
                value={expiresHours}
                onChange={e => setExpiresHours(e.target.value)}
                placeholder="Leave empty for no expiry"
              />
            </div>
            <div>
              <Label htmlFor="max-downloads">Max downloads</Label>
              <Input
                id="max-downloads"
                type="number"
                value={maxDownloads}
                onChange={e => setMaxDownloads(e.target.value)}
                placeholder="Leave empty for unlimited"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => handleClose(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={loading}>
                {loading ? 'Creating...' : 'Create Link'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
