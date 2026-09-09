'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@crm-eco/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@crm-eco/ui/components/dialog';
import { Label } from '@crm-eco/ui/components/label';
import { cn } from '@crm-eco/ui/lib/utils';
import { FileSignature, Loader2 } from 'lucide-react';
import { toastCopy } from '@/lib/crm/toast-copy';
import {
  DEFAULT_SIGNATURE_LOGO_HEIGHT,
  type SignatureImageSlot,
  readSignatureLogoHeight,
} from '@/lib/email/apply-signature-image';
import { SignatureLogoSizeControl } from './SignatureLogoSizeControl';

export type SignatureTargetAsset = {
  id: string;
  public_url: string;
  name: string;
  alt_text?: string | null;
};

type SignatureChoice = {
  id: string;
  name: string;
  is_default?: boolean;
  profile_id: string;
  is_mine?: boolean;
  owner_name?: string;
  owner_email?: string;
  content_html?: string;
  logo_url?: string | null;
};

const SLOTS: Array<{ id: SignatureImageSlot; label: string; hint: string }> = [
  { id: 'logo', label: 'Logo', hint: 'Replace the company mark' },
  { id: 'photo', label: 'Photo', hint: 'Headshot on the professional layout' },
  { id: 'full', label: 'Full image', hint: 'Use this as the whole signature' },
];

type AddToSignatureDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: SignatureTargetAsset | null;
};

function displayUrl(asset: SignatureTargetAsset): string {
  return asset.public_url?.trim() || `/api/email/public-assets/${asset.id}`;
}

function signatureLabel(signature: SignatureChoice): string {
  const owner = signature.owner_name?.trim() || (signature.is_mine ? 'You' : 'Teammate');
  return `${owner} · ${signature.name}`;
}

export function AddToSignatureDialog({
  open,
  onOpenChange,
  asset,
}: AddToSignatureDialogProps) {
  const [signatures, setSignatures] = useState<SignatureChoice[]>([]);
  const [scope, setScope] = useState<'own' | 'team'>('own');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [slot, setSlot] = useState<SignatureImageSlot>('logo');
  const [logoHeight, setLogoHeight] = useState(DEFAULT_SIGNATURE_LOGO_HEIGHT);
  const [saving, setSaving] = useState(false);

  const selected = useMemo(
    () => signatures.find((row) => row.id === selectedId) || null,
    [signatures, selectedId],
  );

  const fetchSignatures = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch('/api/email/signatures?scope=team');
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to load signatures');
      }
      const data = await response.json();
      const rows = (data.signatures || []) as SignatureChoice[];
      setSignatures(rows);
      setScope(data.scope === 'team' ? 'team' : 'own');
      const initial = rows.find((row) => row.is_default) || rows[0] || null;
      setSelectedId(initial?.id ?? null);
      setLogoHeight(
        readSignatureLogoHeight(initial?.content_html, initial?.logo_url) ??
          DEFAULT_SIGNATURE_LOGO_HEIGHT,
      );
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load signatures');
      setSignatures([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setSlot('logo');
      void fetchSignatures();
    }
  }, [open, fetchSignatures]);

  const handleSelectSignature = (signature: SignatureChoice) => {
    setSelectedId(signature.id);
    setLogoHeight(
      readSignatureLogoHeight(signature.content_html, signature.logo_url) ??
        DEFAULT_SIGNATURE_LOGO_HEIGHT,
    );
  };

  const apply = async (createIfMissing = false) => {
    if (!asset) return;
    if (!createIfMissing && !selectedId) {
      toast.error(toastCopy.chooseFirst('a signature'));
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/email/signatures/apply-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: asset.id,
          signatureId: createIfMissing ? null : selectedId,
          slot,
          createIfMissing,
          logoHeight,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to add image');
      }
      toast.success(
        createIfMissing ? toastCopy.added('Signature') : toastCopy.applied('Image'),
      );
      onOpenChange(false);
    } catch (err) {
      toast.error(toastCopy.failed('add that image to the signature', err, 'Try again'));
    } finally {
      setSaving(false);
    }
  };

  const sizeLabel = slot === 'photo' ? 'Photo size' : slot === 'full' ? 'Image size' : 'Logo size';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add to signature</DialogTitle>
          <DialogDescription>
            {scope === 'team'
              ? 'Pick whose signature should get this image, then set the size.'
              : 'Add this image to one of your signatures, then set the size.'}
          </DialogDescription>
        </DialogHeader>

        {asset ? (
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <img
              src={displayUrl(asset)}
              alt={asset.alt_text || asset.name}
              className="h-12 w-12 rounded object-contain bg-slate-50 dark:bg-slate-800"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                {asset.name}
              </p>
              <p className="text-xs text-slate-500">Library image</p>
            </div>
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
          </div>
        ) : loadError ? (
          <div className="space-y-3 py-4 text-center">
            <p className="text-sm text-red-500">{loadError}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => void fetchSignatures()}>
              Try again
            </Button>
          </div>
        ) : signatures.length === 0 ? (
          <div className="space-y-3 rounded-lg border border-dashed border-slate-300 p-4 text-sm dark:border-slate-700">
            <p className="text-slate-600 dark:text-slate-300">
              No signatures yet. Create one with this image, or open signature settings.
            </p>
            {asset ? (
              <SignatureLogoSizeControl
                value={logoHeight}
                onChange={setLogoHeight}
                previewUrl={displayUrl(asset)}
                previewAlt={asset.alt_text || asset.name}
                label={sizeLabel}
                square={slot === 'photo'}
                disabled={saving}
              />
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => void apply(true)} disabled={saving || !asset}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSignature className="mr-2 h-4 w-4" />}
                Create my signature
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/crm/settings/signatures">Open signatures</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Signature</Label>
              <div className="max-h-48 space-y-2 overflow-y-auto">
                {signatures.map((signature) => (
                  <button
                    key={signature.id}
                    type="button"
                    onClick={() => handleSelectSignature(signature)}
                    className={cn(
                      'w-full rounded-lg border px-3 py-2 text-left transition-colors',
                      selectedId === signature.id
                        ? 'border-teal-500 bg-teal-50 dark:bg-teal-950/40'
                        : 'border-slate-200 hover:border-teal-500/50 dark:border-slate-700',
                    )}
                  >
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      {signatureLabel(signature)}
                      {signature.is_default ? (
                        <span className="ml-2 text-xs font-normal text-teal-700 dark:text-teal-300">
                          Default
                        </span>
                      ) : null}
                    </p>
                    {signature.owner_email ? (
                      <p className="truncate text-xs text-slate-500">{signature.owner_email}</p>
                    ) : null}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Use as</Label>
              <div className="grid grid-cols-3 gap-2">
                {SLOTS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSlot(item.id)}
                    className={cn(
                      'rounded-lg border px-2 py-2 text-left',
                      slot === item.id
                        ? 'border-teal-500 bg-teal-50 dark:bg-teal-950/40'
                        : 'border-slate-200 dark:border-slate-700',
                    )}
                  >
                    <p className="text-xs font-medium text-slate-900 dark:text-white">{item.label}</p>
                    <p className="mt-0.5 text-[10px] leading-snug text-slate-500">{item.hint}</p>
                  </button>
                ))}
              </div>
            </div>

            {asset ? (
              <SignatureLogoSizeControl
                value={logoHeight}
                onChange={setLogoHeight}
                previewUrl={displayUrl(asset)}
                previewAlt={asset.alt_text || asset.name}
                label={sizeLabel}
                square={slot === 'photo'}
                disabled={saving}
              />
            ) : null}
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="ghost" asChild>
            <Link href="/crm/settings/signatures">Edit signatures</Link>
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void apply(false)}
              disabled={saving || loading || !asset || signatures.length === 0 || !selected}
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Add to {selected ? signatureLabel(selected).split(' · ')[0] : 'signature'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
