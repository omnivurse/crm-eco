'use client';

/**
 * AiSuggestChip — tiny sparkle button attached to an inline editor. On
 * click it posts to `/api/crm/ai/field-suggest`, and passes the returned
 * text to the parent via `onSuggest`. The parent (usually
 * `InlineFieldEditor`) is responsible for applying the text to the draft.
 *
 * Shows three visual states:
 *   - idle: small ✨ Suggest button (opacity ramps on hover of the row).
 *   - loading: spinner inline.
 *   - error: tooltip surfaces the reason; button returns to idle on hover.
 *
 * Feature-flagged per-instance via the `enabled` prop so the inline
 * editors can opt out for PII-sensitive fields (never shown for phone /
 * URL / number variants today).
 */

import { memo, useCallback, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';
import { toast } from 'sonner';

export interface AiSuggestChipProps {
  recordId: string;
  fieldKey: string;
  fieldLabel: string;
  fieldType: string;
  currentValue?: string | null;
  /** Optional user instruction to steer the draft. */
  instruction?: string;
  /** Called when a suggestion is ready. Parent decides what to do with it. */
  onSuggest: (suggestion: string) => void;
  /** Disables the chip entirely. */
  disabled?: boolean;
  className?: string;
}

export const AiSuggestChip = memo(function AiSuggestChip({
  recordId,
  fieldKey,
  fieldLabel,
  fieldType,
  currentValue,
  instruction,
  onSuggest,
  disabled,
  className,
}: AiSuggestChipProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled || loading) return;
      setLoading(true);
      try {
        const res = await fetch('/api/crm/ai/field-suggest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            recordId,
            fieldKey,
            fieldLabel,
            fieldType,
            currentValue: currentValue ?? null,
            instruction,
          }),
        });
        if (!res.ok) {
          let code: string | undefined;
          let message = `AI request failed (${res.status})`;
          try {
            const body = await res.json();
            if (body?.error) message = body.error as string;
            if (body?.code) code = body.code as string;
          } catch {
            /* ignore */
          }
          if (code === 'AI_NOT_CONFIGURED') {
            toast.warning('AI assistant not configured', {
              description: 'Set OPENAI_API_KEY on the server to enable suggestions.',
            });
          } else {
            toast.error(message);
          }
          return;
        }
        const body = (await res.json()) as { suggestion?: string };
        const suggestion = (body.suggestion ?? '').trim();
        if (!suggestion) {
          toast.info('No suggestion available — try adding more context.');
          return;
        }
        onSuggest(suggestion);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        toast.error('AI request failed', { description: message });
      } finally {
        setLoading(false);
      }
    },
    [disabled, loading, recordId, fieldKey, fieldLabel, fieldType, currentValue, instruction, onSuggest],
  );

  return (
    <button
      type="button"
      // Stop the parent input from blurring (and committing the stale draft)
      // before the AI returns. The onClick still fires.
      onMouseDown={(e) => e.preventDefault()}
      onClick={handleClick}
      disabled={disabled || loading}
      aria-label={`AI suggest ${fieldLabel}`}
      title={`AI suggest ${fieldLabel}`}
      data-no-hotkeys
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium',
        'text-violet-600 dark:text-violet-300',
        'bg-violet-50/70 dark:bg-violet-500/10',
        'ring-1 ring-violet-200/70 dark:ring-violet-500/20',
        'hover:bg-violet-100 dark:hover:bg-violet-500/20 transition-colors',
        'disabled:opacity-60 disabled:cursor-not-allowed',
        className,
      )}
    >
      {loading ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : (
        <Sparkles className="w-3 h-3" />
      )}
      Suggest
    </button>
  );
});
