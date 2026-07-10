'use client';

/**
 * DataPrivacyPanel — content for the "Data Privacy" tab in
 * `RecordDetailShellV2`.
 *
 * Scope (intentionally UI-first, no schema migration required):
 *   - Reads privacy settings from `record.data.privacy` (free-form JSONB).
 *   - Writes updates via existing PATCH /api/crm/records/[id] using the
 *     merge semantics in `record-patch-service` (shallow-merges `data`).
 *   - Exposes: email / marketing / SMS / call consent, do-not-contact
 *     flags, data source, retention hint, privacy notes.
 *   - Action row: "Export record JSON" (client-side download) +
 *     "Request erasure" (stamps `erasure_requested_at` so an admin can
 *     process it via the existing delete flow).
 *
 * When a dedicated `crm_consent_events` table ships, this panel can switch
 * to reading event history without changing its public props — callers
 * only pass the record in/out.
 */

import { useCallback, useMemo, useState } from 'react';
import {
  Shield,
  Mail,
  MessageSquare,
  Phone,
  Tag,
  CalendarClock,
  FileDown,
  AlertTriangle,
  Trash2,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@crm-eco/ui/components/button';
import { confirmDialog } from '@crm-eco/ui/components/confirm-dialog';
import { Textarea } from '@crm-eco/ui/components/textarea';
import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import { cn } from '@crm-eco/ui/lib/utils';
import type { CrmRecord } from '@/lib/crm/types';

// ---------------------------------------------------------------------------
// Shape stored under `record.data.privacy`
// ---------------------------------------------------------------------------

export type ConsentStatus = 'granted' | 'revoked' | 'unknown';

export interface RecordPrivacyData {
  email_consent?: ConsentStatus;
  marketing_consent?: ConsentStatus;
  sms_consent?: ConsentStatus;
  call_consent?: ConsentStatus;
  do_not_contact?: boolean;
  data_source?: string;
  retention_until?: string | null;
  notes?: string;
  erasure_requested_at?: string | null;
  updated_at?: string | null;
  updated_by?: string | null;
}

function readPrivacy(record: CrmRecord): RecordPrivacyData {
  const data = (record.data ?? {}) as Record<string, unknown>;
  const raw = (data.privacy ?? {}) as Record<string, unknown>;
  return {
    email_consent: (raw.email_consent as ConsentStatus) ?? 'unknown',
    marketing_consent: (raw.marketing_consent as ConsentStatus) ?? 'unknown',
    sms_consent: (raw.sms_consent as ConsentStatus) ?? 'unknown',
    call_consent: (raw.call_consent as ConsentStatus) ?? 'unknown',
    do_not_contact: !!raw.do_not_contact,
    data_source: typeof raw.data_source === 'string' ? raw.data_source : '',
    retention_until:
      typeof raw.retention_until === 'string' ? raw.retention_until : null,
    notes: typeof raw.notes === 'string' ? raw.notes : '',
    erasure_requested_at:
      typeof raw.erasure_requested_at === 'string'
        ? raw.erasure_requested_at
        : null,
    updated_at: typeof raw.updated_at === 'string' ? raw.updated_at : null,
    updated_by: typeof raw.updated_by === 'string' ? raw.updated_by : null,
  };
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DataPrivacyPanelProps {
  record: CrmRecord;
  /** Called after successful save so the parent can `router.refresh()`. */
  onUpdated?: () => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DataPrivacyPanel({
  record,
  onUpdated,
  className,
}: DataPrivacyPanelProps) {
  const initial = useMemo(() => readPrivacy(record), [record]);
  const [draft, setDraft] = useState<RecordPrivacyData>(initial);
  const [saving, setSaving] = useState(false);
  const [erasureLoading, setErasureLoading] = useState(false);

  const isDirty = useMemo(() => {
    const keys: Array<keyof RecordPrivacyData> = [
      'email_consent',
      'marketing_consent',
      'sms_consent',
      'call_consent',
      'do_not_contact',
      'data_source',
      'retention_until',
      'notes',
    ];
    return keys.some((k) => (draft[k] ?? '') !== (initial[k] ?? ''));
  }, [draft, initial]);

  const persist = useCallback(
    async (next: RecordPrivacyData, successMsg: string) => {
      setSaving(true);
      try {
        const existingData = (record.data ?? {}) as Record<string, unknown>;
        const mergedPrivacy: RecordPrivacyData = {
          ...initial,
          ...next,
          updated_at: new Date().toISOString(),
        };
        const res = await fetch(`/api/crm/records/${record.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            data: { ...existingData, privacy: mergedPrivacy },
          }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        toast.success(successMsg);
        onUpdated?.();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Failed to update privacy settings',
        );
      } finally {
        setSaving(false);
      }
    },
    [record.id, record.data, initial, onUpdated],
  );

  const handleSave = () => persist(draft, 'Privacy settings saved');

  const handleExport = useCallback(() => {
    try {
      const payload = {
        record_id: record.id,
        module_id: record.module_id,
        title: record.title,
        email: record.email,
        phone: record.phone,
        status: record.status,
        created_at: record.created_at,
        updated_at: record.updated_at,
        data: record.data,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `record-${record.id}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Record exported');
    } catch (err) {
      toast.error('Failed to export record');
      console.error(err);
    }
  }, [record]);

  const handleRequestErasure = useCallback(async () => {
    if (initial.erasure_requested_at) {
      toast.info('Erasure already requested for this record');
      return;
    }
    const confirmed = await confirmDialog({
      title: 'Request erasure for this record?',
      description: 'An administrator will review and delete the record per your retention policy.',
      confirmLabel: 'Request erasure',
      destructive: true,
    });
    if (!confirmed) return;

    setErasureLoading(true);
    try {
      await persist(
        {
          ...draft,
          erasure_requested_at: new Date().toISOString(),
        },
        'Erasure request submitted for admin review',
      );
    } finally {
      setErasureLoading(false);
    }
  }, [draft, initial.erasure_requested_at, persist]);

  const handleCancelErasure = useCallback(async () => {
    await persist(
      { ...draft, erasure_requested_at: null },
      'Erasure request cancelled',
    );
  }, [draft, persist]);

  return (
    <div className={cn('space-y-4 max-w-4xl', className)}>
      {/* Header strip ------------------------------------------------------- */}
      <section className="flex items-start gap-3 rounded-xl border border-slate-200 dark:border-white/10 bg-gradient-to-r from-slate-50 to-white dark:from-slate-900/80 dark:to-slate-900/40 p-4">
        <div className="shrink-0 w-10 h-10 rounded-lg bg-teal-100 dark:bg-teal-500/10 flex items-center justify-center">
          <Shield className="w-5 h-5 text-teal-600 dark:text-teal-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Data privacy &amp; consent
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Track consent, source and retention for <strong>{record.title}</strong>. Changes are
            stored on the record and audited through existing CRM audit logs.
          </p>
          {initial.updated_at && (
            <p className="text-[11px] text-slate-400 mt-1">
              Last updated {new Date(initial.updated_at).toLocaleString()}
            </p>
          )}
        </div>
      </section>

      {/* Erasure banner ----------------------------------------------------- */}
      {initial.erasure_requested_at && (
        <section className="flex items-start gap-3 rounded-xl border border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-4">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              Erasure requested
            </p>
            <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
              Requested {new Date(initial.erasure_requested_at).toLocaleString()}. An
              administrator will process this record per your organization&apos;s retention policy.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleCancelErasure}
            disabled={saving}
            className="border-amber-400 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-500/20"
          >
            Cancel request
          </Button>
        </section>
      )}

      {/* Consent grid ------------------------------------------------------- */}
      <section className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/40 overflow-hidden">
        <header className="px-4 py-3 border-b border-slate-100 dark:border-white/5">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
            Communication consent
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Consent status per channel. Set to &ldquo;Revoked&rdquo; to prevent automations
            from contacting this record on that channel.
          </p>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-slate-100 dark:bg-white/5">
          <ConsentRow
            icon={<Mail className="w-4 h-4" />}
            label="Email"
            value={draft.email_consent ?? 'unknown'}
            onChange={(v) => setDraft({ ...draft, email_consent: v })}
          />
          <ConsentRow
            icon={<MessageSquare className="w-4 h-4" />}
            label="Marketing emails"
            value={draft.marketing_consent ?? 'unknown'}
            onChange={(v) => setDraft({ ...draft, marketing_consent: v })}
          />
          <ConsentRow
            icon={<Phone className="w-4 h-4" />}
            label="Phone calls"
            value={draft.call_consent ?? 'unknown'}
            onChange={(v) => setDraft({ ...draft, call_consent: v })}
          />
          <ConsentRow
            icon={<MessageSquare className="w-4 h-4" />}
            label="SMS / text"
            value={draft.sms_consent ?? 'unknown'}
            onChange={(v) => setDraft({ ...draft, sms_consent: v })}
          />
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-white/5">
          <div className="flex items-center gap-2">
            <input
              id="dnc"
              type="checkbox"
              checked={!!draft.do_not_contact}
              onChange={(e) => setDraft({ ...draft, do_not_contact: e.target.checked })}
              className="w-4 h-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
            />
            <Label htmlFor="dnc" className="text-sm text-slate-700 dark:text-slate-200">
              Do not contact (global override)
            </Label>
          </div>
          {draft.do_not_contact && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
              Contact attempts blocked
            </span>
          )}
        </div>
      </section>

      {/* Source + retention ------------------------------------------------- */}
      <section className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/40 p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="data_source" className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5" />
              Data source
            </Label>
            <Input
              id="data_source"
              value={draft.data_source || ''}
              onChange={(e) => setDraft({ ...draft, data_source: e.target.value })}
              placeholder="e.g. Website form, Referral, Event — 2026 AEP"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="retention_until" className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <CalendarClock className="w-3.5 h-3.5" />
              Retention until
            </Label>
            <Input
              id="retention_until"
              type="date"
              value={draft.retention_until || ''}
              onChange={(e) =>
                setDraft({ ...draft, retention_until: e.target.value || null })
              }
              className="mt-1"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="privacy_notes" className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
            Privacy notes
          </Label>
          <Textarea
            id="privacy_notes"
            rows={3}
            value={draft.notes || ''}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            placeholder="Any special handling, consent collection method, or regulator references (HIPAA/GDPR/CCPA)…"
            className="mt-1 resize-none"
          />
        </div>
      </section>

      {/* Actions ------------------------------------------------------------ */}
      <section className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/40 p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <FileDown className="w-4 h-4 mr-1.5" />
            Export record JSON
          </Button>
          {!initial.erasure_requested_at && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRequestErasure}
              disabled={erasureLoading}
              className="border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10"
            >
              <Trash2 className="w-4 h-4 mr-1.5" />
              Request erasure
            </Button>
          )}
        </div>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!isDirty || saving}
          className="bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save privacy settings'}
        </Button>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function ConsentRow({
  icon,
  label,
  value,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: ConsentStatus;
  onChange: (v: ConsentStatus) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 bg-white dark:bg-slate-900">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-slate-400">{icon}</span>
        <span className="text-sm text-slate-700 dark:text-slate-200 truncate">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <ConsentPill value={value} />
        <Select value={value} onValueChange={(v) => onChange(v as ConsentStatus)}>
          <SelectTrigger className="w-[128px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="granted">Granted</SelectItem>
            <SelectItem value="revoked">Revoked</SelectItem>
            <SelectItem value="unknown">Unknown</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function ConsentPill({ value }: { value: ConsentStatus }) {
  if (value === 'granted') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
        <CheckCircle2 className="w-3 h-3" />
        Granted
      </span>
    );
  }
  if (value === 'revoked') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
        <XCircle className="w-3 h-3" />
        Revoked
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-400">
      Unknown
    </span>
  );
}
