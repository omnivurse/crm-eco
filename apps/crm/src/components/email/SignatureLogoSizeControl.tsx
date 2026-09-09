'use client';

import { Label } from '@crm-eco/ui/components/label';
import { Button } from '@crm-eco/ui/components/button';
import { cn } from '@crm-eco/ui/lib/utils';
import {
  DEFAULT_SIGNATURE_LOGO_HEIGHT,
  MAX_SIGNATURE_LOGO_HEIGHT,
  MIN_SIGNATURE_LOGO_HEIGHT,
  SIGNATURE_LOGO_SIZE_PRESETS,
  clampSignatureLogoHeight,
} from '@/lib/email/apply-signature-image';

type SignatureLogoSizeControlProps = {
  value: number;
  onChange: (height: number) => void;
  previewUrl?: string | null;
  previewAlt?: string;
  disabled?: boolean;
  label?: string;
  square?: boolean;
};

export function SignatureLogoSizeControl({
  value,
  onChange,
  previewUrl,
  previewAlt = 'Logo preview',
  disabled = false,
  label = 'Logo size',
  square = false,
}: SignatureLogoSizeControlProps) {
  const height = clampSignatureLogoHeight(value);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="signature-logo-size">{label}</Label>
        <span className="text-xs tabular-nums text-slate-500">{height}px</span>
      </div>
      {previewUrl ? (
        <div className="flex items-center justify-center rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <img
            src={previewUrl}
            alt={previewAlt}
            style={
              square
                ? { height, width: height, objectFit: 'cover', borderRadius: '50%' }
                : { height, width: 'auto', maxWidth: '100%' }
            }
          />
        </div>
      ) : null}
      <input
        id="signature-logo-size"
        type="range"
        min={MIN_SIGNATURE_LOGO_HEIGHT}
        max={MAX_SIGNATURE_LOGO_HEIGHT}
        step={2}
        value={height}
        disabled={disabled}
        onChange={(event) => onChange(clampSignatureLogoHeight(Number(event.target.value)))}
        className="w-full"
      />
      <div className="flex flex-wrap gap-2">
        {SIGNATURE_LOGO_SIZE_PRESETS.map((preset) => (
          <Button
            key={preset.id}
            type="button"
            size="sm"
            variant={height === preset.height ? 'default' : 'outline'}
            disabled={disabled}
            className={cn('h-7 px-2 text-xs')}
            onClick={() => onChange(preset.height)}
          >
            {preset.label}
          </Button>
        ))}
      </div>
      <p className="text-xs text-slate-500">
        Default is {DEFAULT_SIGNATURE_LOGO_HEIGHT}px. Email apps use this height, so the live preview matches what recipients see.
      </p>
    </div>
  );
}
