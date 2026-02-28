'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@crm-eco/ui/components/dialog';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';

interface RenameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentName: string;
  onRename: (newName: string) => Promise<void>;
}

export function RenameDialog({ open, onOpenChange, currentName, onRename }: RenameDialogProps) {
  const [name, setName] = useState(currentName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setName(currentName); }, [currentName]);

  const handleRename = async () => {
    if (!name.trim() || name.trim() === currentName) return;
    setLoading(true);
    setError(null);
    try {
      await onRename(name.trim());
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rename failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Rename</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="new-name">New Name</Label>
            <Input
              id="new-name"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleRename()}
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleRename} disabled={!name.trim() || name.trim() === currentName || loading}>
              {loading ? 'Renaming...' : 'Rename'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
