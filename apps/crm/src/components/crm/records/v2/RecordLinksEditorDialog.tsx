'use client';

import { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@crm-eco/ui/components/dialog';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { toast } from 'sonner';
import type { RecordRelatedListLink } from './RecordRelatedListNav';

export interface RecordLinksEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recordId: string;
  links: RecordRelatedListLink[];
  updatedAt?: string | null;
  onSaved?: (links: RecordRelatedListLink[]) => void;
}

interface DraftLink {
  id: string;
  label: string;
  href: string;
}

function toDraft(links: RecordRelatedListLink[]): DraftLink[] {
  return links.map((link) => ({
    id: link.id,
    label: link.label,
    href: link.href,
  }));
}

function toPayload(links: DraftLink[]): Array<{ label: string; href: string }> {
  return links
    .map((link) => ({
      label: link.label.trim() || link.href.trim(),
      href: link.href.trim(),
    }))
    .filter((link) => link.href.length > 0);
}

export function RecordLinksEditorDialog({
  open,
  onOpenChange,
  recordId,
  links,
  updatedAt,
  onSaved,
}: RecordLinksEditorDialogProps) {
  const [draft, setDraft] = useState<DraftLink[]>(toDraft(links));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setDraft(toDraft(links));
  }, [open, links]);

  const addRow = () => {
    setDraft((prev) => [
      ...prev,
      { id: `new-${Date.now()}`, label: '', href: '' },
    ]);
  };

  const removeRow = (id: string) => {
    setDraft((prev) => prev.filter((row) => row.id !== id));
  };

  const updateRow = (id: string, patch: Partial<Pick<DraftLink, 'label' | 'href'>>) => {
    setDraft((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  };

  const save = async () => {
    const payload = toPayload(draft);
    setSaving(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (updatedAt) headers['x-if-updated-at'] = updatedAt;

      const res = await fetch(`/api/crm/records/${encodeURIComponent(recordId)}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers,
        body: JSON.stringify({ data: { links: payload } }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || 'Failed to save links');
      }

      const saved = payload.map((link, idx) => ({
        id: `link-${idx}`,
        label: link.label,
        href: link.href,
        external: true,
      }));
      onSaved?.(saved);
      toast.success('Links updated');
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save links');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit record links</DialogTitle>
          <DialogDescription>
            Add external URLs that appear in the Related List sidebar for this record.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {draft.length === 0 ? (
            <p className="text-sm text-slate-500">No links yet. Add one below.</p>
          ) : null}
          {draft.map((row) => (
            <div key={row.id} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
              <Input
                value={row.label}
                onChange={(e) => updateRow(row.id, { label: e.target.value })}
                placeholder="Label"
              />
              <Input
                value={row.href}
                onChange={(e) => updateRow(row.id, { href: e.target.value })}
                placeholder="https://..."
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={() => removeRow(row.id)}
                aria-label="Remove link"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addRow}>
            <Plus className="w-4 h-4 mr-1" />
            Add link
          </Button>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
