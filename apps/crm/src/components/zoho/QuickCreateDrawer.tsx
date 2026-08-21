'use client';

/**
 * QuickCreateDrawer — the ONE-screen path for hand-entering a member/lead.
 *
 * - Field config + paste order live in `lib/crm/quick-create-config.ts`.
 * - Duplicate handling never loses input: email + phone are looked up via
 *   /api/crm/records/check-duplicate; on a hit we show an inline amber card
 *   ("Open existing" / "Create anyway") and the typed values stay put.
 * - Any API error → inline error + Retry, values stay.
 * - "Open full form" hands the typed values to the full create form through
 *   the same sessionStorage draft `RecordDraftAutosave` restores.
 * - Success → toast + navigate to the record; the drawer keeps its state until
 *   the pathname confirms we landed on the new record.
 * - "Save & add another" (button or Shift+Enter) saves through the SAME path,
 *   toasts, resets the form but keeps the batch-sticky fields (producer /
 *   sharing entity / status / state — `batchStickyKeys` in the config), keeps
 *   the drawer open and counts "N added this session".
 * - Duplicate parity with the server (record-create-service): a phone/email
 *   hit only BLOCKS (amber card + "Create anyway") when the candidate's name
 *   equals the typed first+last; otherwise it is a soft grey "shares a
 *   phone/email with …" hint and Create proceeds without force.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@crm-eco/ui/components/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import { cn } from '@crm-eco/ui/lib/utils';
import { EnrolledByPicker } from '@/components/crm/create/EnrolledByPicker';
import { SuggestPicker } from '@/components/crm/create/SuggestPicker';
import {
  Users,
  UserPlus,
  Building2,
  Loader2,
  Plus,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  FileText,
  Info,
  ListPlus,
} from 'lucide-react';
import { toast } from 'sonner';
import { CrmRecordCreateError, postCrmRecord } from '@/lib/crm/create-record-client';
import { dateValueToInputDisplay, maskDateTyping } from '@/lib/crm/date-field-bounds';
import { formatPhoneDisplay } from '@/lib/crm/phone-normalize';
import { toastCopy } from '@/lib/crm/toast-copy';
import { usStateOptionsWith } from '@/lib/crm/us-states';
import {
  QUICK_CREATE_FIELDS,
  QUICK_CREATE_MODULE_KEYS,
  buildQuickCreatePayload,
  fullCreateFormHref,
  initialQuickCreateValues,
  isQuickCreateDirty,
  isQuickCreateModuleKey,
  missingRequiredQuickCreateFields,
  nextQuickCreateBatchValues,
  normalizePhoneDigits,
  quickCreatePendingNeedsEffectiveDate,
  quickCreateSuggestKeys,
  splitQuickCreateDuplicates,
  writeQuickCreateDraft,
  type QuickCreateField,
  type QuickCreateModuleKey,
} from '@/lib/crm/quick-create-config';
import type { CrmModule } from '@/lib/crm/types';

export type { QuickCreateModuleKey } from '@/lib/crm/quick-create-config';

interface QuickCreateDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Which quick form to show first. Defaults to Add Member (contacts). */
  defaultModule?: QuickCreateModuleKey;
  /**
   * Enabled org modules if the host already has them (CrmTopBar does) —
   * skips the loading state. Otherwise fetched from /api/crm/modules on open.
   */
  modules?: CrmModule[];
}

type ModuleLite = Pick<CrmModule, 'id' | 'key' | 'org_id' | 'name' | 'is_enabled'>;

interface DuplicateCandidate {
  id: string;
  title: string | null;
  email: string | null;
  phone: string | null;
}

interface DuplicateState {
  matchedOn: 'email' | 'phone' | 'server';
  candidates: DuplicateCandidate[];
}

/** Family-member style overlap: same phone/email, different name. Never blocks. */
interface SoftDuplicateState {
  matchedOn: 'email' | 'phone';
  candidates: DuplicateCandidate[];
}

/** What happens after a successful save. */
type SubmitMode = 'open' | 'another';

const MODULE_ICONS: Record<QuickCreateModuleKey, React.ReactNode> = {
  contacts: <Users className="w-4 h-4" />,
  leads: <UserPlus className="w-4 h-4" />,
  accounts: <Building2 className="w-4 h-4" />,
};

const inputClass =
  'h-9 text-sm bg-white dark:bg-slate-900/50 border-slate-200 dark:border-white/10 focus-visible:ring-2 focus-visible:ring-teal-500/60';

/** crm_fields.options arrive as string[] | {value,label}[] | "[]" (legacy). */
function optionValues(raw: unknown): string[] {
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  const out: string[] = [];
  for (const entry of parsed) {
    if (typeof entry === 'string') {
      if (entry.trim()) out.push(entry);
    } else if (entry && typeof entry === 'object') {
      const o = entry as { value?: unknown; label?: unknown; is_active?: unknown };
      if (o.is_active === false) continue;
      const v = String(o.value ?? o.label ?? '').trim();
      if (v) out.push(v);
    }
  }
  return Array.from(new Set(out));
}

export function QuickCreateDrawer({
  open,
  onOpenChange,
  defaultModule = 'contacts',
  modules: modulesProp,
}: QuickCreateDrawerProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [selectedModule, setSelectedModule] = useState<QuickCreateModuleKey>(defaultModule);
  const [values, setValues] = useState<Record<string, string>>(() =>
    initialQuickCreateValues(defaultModule),
  );
  /**
   * Values the current form started from — select defaults, or after "Save &
   * add another" defaults + the sticky batch fields. Dirty = differs from this.
   */
  const [baseline, setBaseline] = useState<Record<string, string>>(() =>
    initialQuickCreateValues(defaultModule),
  );
  /** Records saved via "Save & add another" while this drawer has been open. */
  const [sessionAdded, setSessionAdded] = useState(0);
  /** Plan / Producer values typed earlier this session → datalist suggestions. */
  const [sessionSuggestions, setSessionSuggestions] = useState<Record<string, string[]>>({});

  // --- org modules (for module_id/org_id + hiding disabled tabs) -----------
  const [fetchedModules, setFetchedModules] = useState<ModuleLite[] | null>(null);
  const [modulesError, setModulesError] = useState<string | null>(null);
  const [modulesLoading, setModulesLoading] = useState(false);
  const modules: ModuleLite[] | null = modulesProp ?? fetchedModules;

  // --- select options sourced from crm_fields, per module ------------------
  const [fieldOptions, setFieldOptions] = useState<Record<string, Record<string, string[]>>>({});
  const [fieldOptionsLoaded, setFieldOptionsLoaded] = useState<Record<string, boolean>>({});

  // --- submission / feedback ----------------------------------------------
  const [submitting, setSubmitting] = useState(false);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [duplicate, setDuplicate] = useState<DuplicateState | null>(null);
  const [softDuplicate, setSoftDuplicate] = useState<SoftDuplicateState | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [created, setCreated] = useState<{ id: string; noun: string } | null>(null);
  /**
   * "name|email|phoneDigits" that was last confirmed free of BLOCKING
   * duplicates. The name is part of the signature because the blocking rule
   * depends on it (same phone + different name is allowed).
   */
  const cleanSignatureRef = useRef<string | null>(null);
  const firstInputRef = useRef<HTMLInputElement | null>(null);
  /** Latest values, so late-resolving blur checks can ignore stale results. */
  const valuesRef = useRef(values);
  valuesRef.current = values;
  /** Which outcome the in-flight submit was started for (so "Create anyway"/Retry repeat it). */
  const submitModeRef = useRef<SubmitMode>('open');

  const config = QUICK_CREATE_FIELDS[selectedModule];
  const dirty = isQuickCreateDirty(selectedModule, values, baseline);
  const currentModuleRow = modules?.find((m) => m.key === selectedModule) ?? null;
  const orgId = currentModuleRow?.org_id ?? modules?.[0]?.org_id ?? null;

  const clearFeedback = useCallback(() => {
    setDuplicate(null);
    setSoftDuplicate(null);
    setSubmitError(null);
    setValidationError(null);
    setConfirmDiscard(false);
    setCreated(null);
    cleanSignatureRef.current = null;
  }, []);

  /** Full reset (close / module switch): defaults only, session counter cleared. */
  const resetForm = useCallback(
    (moduleKey: QuickCreateModuleKey) => {
      const initial = initialQuickCreateValues(moduleKey);
      setValues(initial);
      setBaseline(initial);
      setSessionAdded(0);
      clearFeedback();
    },
    [clearFeedback],
  );

  /** After "Save & add another": keep the sticky batch fields, clear the rest. */
  const resetForNext = useCallback(
    (moduleKey: QuickCreateModuleKey, previous: Record<string, string>) => {
      const next = nextQuickCreateBatchValues(moduleKey, previous);
      setValues(next);
      setBaseline(next);
      clearFeedback();
    },
    [clearFeedback],
  );

  const duplicateSignature = (v: Record<string, string>) =>
    `${(v.first_name ?? '').trim().toLowerCase()} ${(v.last_name ?? '').trim().toLowerCase()}|${(v.email ?? '')
      .trim()
      .toLowerCase()}|${normalizePhoneDigits(v.phone ?? '')}`;

  // Re-seed the default module each time the drawer opens (the top bar and a
  // module header may pass different defaults into the same mounted instance).
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setSelectedModule(defaultModule);
      resetForm(defaultModule);
    }
    wasOpenRef.current = open;
  }, [open, defaultModule, resetForm]);

  const loadModules = useCallback(async () => {
    setModulesLoading(true);
    setModulesError(null);
    try {
      const res = await fetch('/api/crm/modules');
      if (!res.ok) throw new Error(`Failed to load modules (${res.status})`);
      const list = (await res.json()) as ModuleLite[];
      setFetchedModules(Array.isArray(list) ? list : []);
    } catch (err) {
      setModulesError(err instanceof Error ? err.message : 'Failed to load modules');
    } finally {
      setModulesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && !modulesProp && !fetchedModules && !modulesLoading && !modulesError) {
      void loadModules();
    }
  }, [open, modulesProp, fetchedModules, modulesLoading, modulesError, loadModules]);

  // Load crm_fields options for the selected module's select fields (once).
  useEffect(() => {
    if (!open || !currentModuleRow || fieldOptionsLoaded[selectedModule]) return;
    // Selects need their options; Plan/Producer (`suggest`) get a datalist
    // from the same crm_fields.options payload — one request per open.
    const wanted = config.fields
      .filter((f) => f.type === 'select' || f.type === 'suggest')
      .map((f) => f.key);
    if (wanted.length === 0) {
      setFieldOptionsLoaded((p) => ({ ...p, [selectedModule]: true }));
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/crm/modules/${currentModuleRow.id}/fields`);
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as { fields?: { key: string; options?: unknown }[] };
        if (cancelled) return;
        const map: Record<string, string[]> = {};
        for (const f of json.fields ?? []) {
          if (wanted.includes(f.key)) map[f.key] = optionValues(f.options);
        }
        setFieldOptions((p) => ({ ...p, [selectedModule]: map }));
      } catch {
        // Fall back to config defaults — never block the form on options.
      } finally {
        if (!cancelled) setFieldOptionsLoaded((p) => ({ ...p, [selectedModule]: true }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, currentModuleRow, selectedModule, config.fields, fieldOptionsLoaded]);

  // Success → the drawer only clears once we actually landed on the record.
  useEffect(() => {
    if (created && pathname === `/crm/r/${created.id}`) {
      resetForm(selectedModule);
      onOpenChange(false);
    }
  }, [created, pathname, onOpenChange, resetForm, selectedModule]);

  const availableModules = useMemo(() => {
    const enabled = new Set(
      (modules ?? []).filter((m) => m.is_enabled !== false).map((m) => m.key),
    );
    if (!modules) return [selectedModule];
    const list = QUICK_CREATE_MODULE_KEYS.filter((k) => enabled.has(k));
    return list.length > 0 ? list : [selectedModule];
  }, [modules, selectedModule]);

  const optionsFor = (field: QuickCreateField): string[] => {
    const live = fieldOptions[selectedModule]?.[field.key];
    if (live && live.length > 0) return live;
    return field.fallbackOptions ?? [];
  };

  /**
   * Datalist suggestions for a `suggest` field: crm_fields.options for the
   * key (when the org defined any) + distinct values used earlier in this
   * drawer session. There is no distinct-values endpoint for arbitrary JSONB
   * keys, so this stays cheap and never restricts free text.
   */
  const suggestionsFor = (field: QuickCreateField): string[] => {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const v of [...(sessionSuggestions[field.key] ?? []), ...optionsFor(field)]) {
      const key = v.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(v);
    }
    return out;
  };

  const visibleFields = config.fields.filter((f) => {
    if (f.type !== 'select' || !f.optionalIfNoOptions) return true;
    return optionsFor(f).length > 0;
  });

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const setField = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setValidationError(null);
    setSubmitError(null);
    if (key === 'email' || key === 'phone' || key === 'first_name' || key === 'last_name') {
      // Blocking-vs-soft depends on name + contact info, so any of them
      // changing invalidates the last check.
      setDuplicate(null);
      setSoftDuplicate(null);
      cleanSignatureRef.current = null;
    }
  };

  /**
   * Phone: normalise to NNN-NNN-NNNN on blur, only when the formatted value
   * differs (same contract as the full form's FormFieldRenderer). Then run the
   * duplicate pre-check with the value as it will be saved.
   */
  const handlePhoneBlur = (raw: string) => {
    const formatted = formatPhoneDisplay(raw);
    let next = raw;
    if (formatted !== raw) {
      next = formatted;
      // Reformatting does not change the digits, so keep any duplicate result.
      setValues((prev) => ({ ...prev, phone: formatted }));
    }
    void handleContactBlur({ phone: next });
  };

  const [pendingModuleSwitch, setPendingModuleSwitch] = useState<QuickCreateModuleKey | null>(null);
  const handleModuleChange = (moduleKey: QuickCreateModuleKey) => {
    if (moduleKey === selectedModule) return;
    if (dirty && !created) {
      // Inline confirm (footer) — switching type would drop typed values.
      setPendingModuleSwitch(moduleKey);
      setConfirmDiscard(true);
      return;
    }
    setSelectedModule(moduleKey);
    resetForm(moduleKey);
  };

  const requestClose = () => {
    if (submitting) return;
    if (created) {
      resetForm(selectedModule);
      onOpenChange(false);
      return;
    }
    if (dirty) {
      setConfirmDiscard(true);
      return;
    }
    resetForm(selectedModule);
    onOpenChange(false);
  };

  const discardAndClose = () => {
    if (pendingModuleSwitch) {
      const next = pendingModuleSwitch;
      setPendingModuleSwitch(null);
      setSelectedModule(next);
      resetForm(next);
      return;
    }
    resetForm(selectedModule);
    onOpenChange(false);
  };

  /** Look up email + phone duplicates. Returns candidates (empty = clean). */
  const lookupDuplicates = useCallback(
    async (email: string, phone: string): Promise<DuplicateState | null> => {
      const emailQ = email.trim();
      // check_crm_duplicate compares phones by digits (migration
      // 20260817180000), so one lookup with the raw typed value is enough.
      const phoneDigitsOnly = normalizePhoneDigits(phone);
      const phoneVariants = phoneDigitsOnly ? [phone.trim()] : [];
      const base = `/api/crm/records/check-duplicate?module_key=${encodeURIComponent(selectedModule)}`;
      const calls: Promise<{ on: 'email' | 'phone'; list: DuplicateCandidate[] }>[] = [];
      const fetchOne = async (qs: string, on: 'email' | 'phone') => {
        const res = await fetch(`${base}&${qs}`);
        if (!res.ok) throw new Error(`Duplicate check failed (${res.status})`);
        const json = (await res.json()) as { duplicates?: DuplicateCandidate[] };
        return { on, list: json.duplicates ?? [] };
      };
      if (emailQ) calls.push(fetchOne(`email=${encodeURIComponent(emailQ)}`, 'email'));
      // The RPC only consults phone when email is absent, so phone lookups go
      // out without the email param — one per stored format (see helper).
      for (const v of phoneVariants) calls.push(fetchOne(`phone=${encodeURIComponent(v)}`, 'phone'));
      if (calls.length === 0) return null;
      const results = await Promise.all(calls);
      const seen = new Set<string>();
      let matchedOn: 'email' | 'phone' | null = null;
      const candidates: DuplicateCandidate[] = [];
      for (const r of results) {
        for (const c of r.list) {
          if (seen.has(c.id)) continue;
          seen.add(c.id);
          candidates.push(c);
          if (!matchedOn) matchedOn = r.on;
        }
      }
      if (candidates.length === 0 || !matchedOn) return null;
      return { matchedOn, candidates };
    },
    [selectedModule],
  );

  /**
   * Split raw candidates by the server's blocking rule. Blocking → amber card
   * (matchedOn kept); soft → grey hint. Either side may be empty.
   */
  const classify = (
    found: DuplicateState | null,
    v: Record<string, string>,
  ): { blocking: DuplicateState | null; soft: SoftDuplicateState | null } => {
    if (!found) return { blocking: null, soft: null };
    const { blocking, soft } = splitQuickCreateDuplicates(v, found.candidates);
    const softOn: 'email' | 'phone' = found.matchedOn === 'server' ? 'email' : found.matchedOn;
    return {
      blocking: blocking.length > 0 ? { matchedOn: found.matchedOn, candidates: blocking } : null,
      soft: soft.length > 0 ? { matchedOn: softOn, candidates: soft } : null,
    };
  };

  /** Non-blocking early warning on blur; failures are silent (submit re-checks). */
  const handleContactBlur = async (override?: { phone?: string; email?: string }) => {
    const snapshot = { ...valuesRef.current, ...override };
    const email = snapshot.email ?? '';
    const phone = snapshot.phone ?? '';
    if (!email.trim() && !phone.trim()) return;
    const sig = duplicateSignature(snapshot);
    try {
      const found = await lookupDuplicates(email, phone);
      if (duplicateSignature(valuesRef.current) !== sig) return; // user kept typing — stale
      const { blocking, soft } = classify(found, snapshot);
      setDuplicate(blocking);
      setSoftDuplicate(soft);
      if (!blocking) cleanSignatureRef.current = sig;
    } catch {
      /* submit will re-check and surface errors */
    }
  };

  const submit = async (force: boolean, mode: SubmitMode = submitModeRef.current) => {
    if (submitting) return;
    submitModeRef.current = mode;
    setSubmitError(null);
    setValidationError(null);

    const missing = missingRequiredQuickCreateFields(selectedModule, values);
    if (missing.length > 0) {
      setValidationError(`Please fill in: ${missing.join(', ')}`);
      return;
    }
    if (quickCreatePendingNeedsEffectiveDate(selectedModule, values)) {
      setValidationError(
        `“${values[config.statusKey ?? ''] ?? 'Pending'}” status needs an Effective date (the daily activation uses it).`,
      );
      return;
    }

    setSubmitting(true);
    try {
      let mods = modules;
      if (!mods) {
        const res = await fetch('/api/crm/modules');
        if (!res.ok) throw new Error(`Failed to load modules (${res.status})`);
        mods = (await res.json()) as ModuleLite[];
        setFetchedModules(mods);
      }
      const mod = mods.find((m) => m.key === selectedModule);
      if (!mod) throw new Error(`The ${config.noun.toLowerCase()} module is not available for your organization`);

      const email = values.email ?? '';
      const phone = values.phone ?? '';
      const sig = duplicateSignature(values);
      if (!force && cleanSignatureRef.current !== sig) {
        setCheckingDuplicates(true);
        try {
          const found = await lookupDuplicates(email, phone);
          const { blocking, soft } = classify(found, values);
          setSoftDuplicate(soft);
          if (blocking) {
            // Same name + same contact info → the server would 409 anyway.
            setDuplicate(blocking);
            return;
          }
          // Soft overlap (family member) is allowed — proceed WITHOUT force so
          // the server still applies its own rule.
          setDuplicate(null);
          cleanSignatureRef.current = sig;
        } finally {
          setCheckingDuplicates(false);
        }
      }

      const record = await postCrmRecord({
        org_id: mod.org_id,
        module_id: mod.id,
        data: buildQuickCreatePayload(selectedModule, values),
        force,
      });

      toast.success(toastCopy.added(config.noun));
      setDuplicate(null);
      setSoftDuplicate(null);

      // Remember Plan / Producer for this session's datalists.
      const suggestKeys = quickCreateSuggestKeys(selectedModule);
      if (suggestKeys.length > 0) {
        setSessionSuggestions((prev) => {
          const next = { ...prev };
          for (const k of suggestKeys) {
            const v = (values[k] ?? '').trim();
            if (!v) continue;
            const list = next[k] ?? [];
            if (!list.some((x) => x.toLowerCase() === v.toLowerCase())) next[k] = [v, ...list].slice(0, 25);
          }
          return next;
        });
      }

      if (mode === 'another') {
        setSessionAdded((n) => n + 1);
        resetForNext(selectedModule, values);
        // Back to the top of the paste order for the next one.
        window.requestAnimationFrame(() => firstInputRef.current?.focus());
        return;
      }

      setCreated({ id: record.id, noun: config.noun });
      router.push(`/crm/r/${record.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create record';
      const isDup = err instanceof CrmRecordCreateError && err.code === 'DUPLICATE_RECORD';
      if (isDup && force) {
        // Forced create still rejected by the DB unique index (identical
        // name + email). Offering "Create anyway" again would just loop.
        setSubmitError(
          'An identical record (same name and email) already exists and cannot be created twice — open it instead.',
        );
        const dupErr = err as CrmRecordCreateError;
        if (dupErr.duplicates.length > 0) {
          setDuplicate({ matchedOn: 'server', candidates: dupErr.duplicates as DuplicateCandidate[] });
        }
      } else if (isDup) {
        // Server-side duplicate: use the candidates the API returned; only
        // fall back to a lookup when the body carried none.
        const dupErr = err as CrmRecordCreateError;
        let found: DuplicateState | null =
          dupErr.duplicates.length > 0
            ? { matchedOn: 'server', candidates: dupErr.duplicates as DuplicateCandidate[] }
            : null;
        if (!found) {
          try {
            found = await lookupDuplicates(values.email ?? '', values.phone ?? '');
          } catch {
            /* ignore */
          }
        }
        setDuplicate(found ?? { matchedOn: 'server', candidates: [] });
      } else {
        setSubmitError(message);
      }
    } finally {
      setSubmitting(false);
      setCheckingDuplicates(false);
    }
  };

  const openFullForm = () => {
    // Only hand off a draft when something was actually typed — otherwise the
    // full form would show a "draft restored" banner for untouched defaults.
    if (dirty) writeQuickCreateDraft(selectedModule, orgId, values);
    // Values are now in the full form's draft; safe to drop drawer state.
    resetForm(selectedModule);
    onOpenChange(false);
    router.push(fullCreateFormHref(selectedModule));
  };

  const openExisting = (id: string) => {
    onOpenChange(false);
    router.push(`/crm/r/${id}`);
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const busy = submitting || checkingDuplicates;
  const primaryDup = duplicate?.candidates[0] ?? null;

  const renderField = (field: QuickCreateField, index: number) => {
    const id = `qc-${selectedModule}-${field.key}`;
    const value = values[field.key] ?? '';
    const isFirst = index === 0;
    const label = (
      <Label
        htmlFor={id}
        className="text-xs font-medium text-slate-600 dark:text-slate-300 flex items-baseline gap-1.5"
      >
        <span>
          {field.label}
          {field.required && (
            <span className="text-red-500 ml-0.5" aria-hidden>
              *
            </span>
          )}
        </span>
        {field.hint && (
          <span className="text-[11px] font-normal text-slate-400 dark:text-slate-500">
            {field.hint}
          </span>
        )}
      </Label>
    );

    let control: React.ReactNode;
    if (field.type === 'state') {
      // Native select: type-ahead ("c","o" → CO) suits the paste workflow and
      // keyboard users; an unknown stored value is kept as its own option.
      const opts = usStateOptionsWith(value);
      control = (
        <select
          id={id}
          value={value}
          onChange={(e) => setField(field.key, e.target.value)}
          aria-label={field.label}
          className={cn(
            inputClass,
            'flex w-full rounded-md border px-3 py-1 shadow-sm focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
            value ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500',
          )}
        >
          <option value="">{field.placeholder ? `Select… (${field.placeholder})` : 'Select…'}</option>
          {opts.map((o) => (
            <option key={o.value} value={o.value} className="text-slate-900 dark:text-white">
              {o.label}
            </option>
          ))}
        </select>
      );
    } else if (field.type === 'suggest') {
      if (field.key === 'producer_name' || field.key === 'producer') {
        control = (
          <EnrolledByPicker
            id={id}
            value={value}
            onChange={(next) => setField(field.key, next)}
            placeholder={field.placeholder}
            aria-label={field.label}
            className={inputClass}
          />
        );
      } else {
        control = (
          <SuggestPicker
            id={id}
            value={value}
            options={suggestionsFor(field)}
            onChange={(next) => setField(field.key, next)}
            placeholder={field.placeholder}
            aria-label={field.label}
            className={inputClass}
          />
        );
      }
    } else if (field.type === 'select') {
      const opts = optionsFor(field);
      if (opts.length === 0) {
        control = (
          <Input
            id={id}
            value={value}
            onChange={(e) => setField(field.key, e.target.value)}
            placeholder={field.placeholder}
            className={inputClass}
          />
        );
      } else {
        control = (
          <Select value={value} onValueChange={(v) => setField(field.key, v)}>
            <SelectTrigger id={id} className={inputClass} aria-label={field.label}>
              <SelectValue placeholder="Select…" />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10">
              {opts.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }
    } else if (field.type === 'date') {
      // Same contract as DynamicRecordForm: show as typed, mask on blur only.
      control = (
        <Input
          id={id}
          ref={isFirst ? firstInputRef : undefined}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder={field.placeholder ?? 'MM/DD/YYYY'}
          value={dateValueToInputDisplay(value)}
          onChange={(e) => setField(field.key, e.target.value)}
          onBlur={(e) => setField(field.key, maskDateTyping(e.target.value))}
          className={inputClass}
        />
      );
    } else {
      const isPhone = field.type === 'tel';
      const isContactKey = field.key === 'email' || isPhone;
      control = (
        <Input
          id={id}
          ref={isFirst ? firstInputRef : undefined}
          type={field.type}
          inputMode={isPhone ? 'tel' : undefined}
          autoComplete="off"
          value={value}
          onChange={(e) => setField(field.key, e.target.value)}
          onBlur={
            isPhone
              ? (e) => handlePhoneBlur(e.target.value)
              : isContactKey
                ? () => void handleContactBlur()
                : undefined
          }
          placeholder={field.placeholder}
          required={field.required}
          aria-required={field.required || undefined}
          className={inputClass}
        />
      );
    }

    return (
      <div key={field.key} className={cn('space-y-1', field.span === 2 && 'sm:col-span-2')}>
        {label}
        {control}
      </div>
    );
  };

  return (
    <Sheet open={open} onOpenChange={(next) => (next ? onOpenChange(true) : requestClose())}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl p-0 flex flex-col bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-white/10"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          firstInputRef.current?.focus();
        }}
        onEscapeKeyDown={(e) => {
          if (dirty && !created) {
            e.preventDefault();
            setConfirmDiscard(true);
          }
        }}
        onInteractOutside={(e) => {
          if (dirty && !created) {
            e.preventDefault();
            setConfirmDiscard(true);
          }
        }}
      >
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-slate-200 dark:border-white/10 space-y-2">
          <div className="flex items-center justify-between gap-3 pr-8">
            <SheetTitle className="flex items-center gap-2 text-base text-slate-900 dark:text-white">
              <span className="text-teal-600 dark:text-teal-400">{MODULE_ICONS[selectedModule]}</span>
              {config.title}
            </SheetTitle>
            {availableModules.length > 1 && (
              <div
                role="group"
                aria-label="Record type"
                className="inline-flex rounded-md border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-0.5"
              >
                {availableModules.map((k) => {
                  const active = k === selectedModule;
                  return (
                    <button
                      key={k}
                      type="button"
                      aria-pressed={active}
                      onClick={() => handleModuleChange(k)}
                      className={cn(
                        'px-2.5 h-7 rounded text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/60',
                        active
                          ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white',
                      )}
                    >
                      {QUICK_CREATE_FIELDS[k].noun}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <SheetDescription className="text-xs text-slate-500 dark:text-slate-400">
            {config.description}
          </SheetDescription>
        </SheetHeader>

        <form
          className="flex-1 min-h-0 flex flex-col"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void submit(false, 'open');
          }}
          onKeyDown={(e) => {
            // Shift+Enter anywhere in the form = Save & add another
            // (plain Enter keeps the native submit = save & open record).
            if (e.key !== 'Enter' || !e.shiftKey || busy || created) return;
            const target = e.target as HTMLElement | null;
            if (target && target.tagName === 'BUTTON') return;
            e.preventDefault();
            void submit(false, 'another');
          }}
        >
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
            {modulesLoading && !modules && (
              <div className="flex items-center gap-2 text-xs text-slate-500" role="status">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Loading modules…
              </div>
            )}
            {modulesError && !modules && (
              <div
                role="alert"
                className="flex items-center justify-between gap-3 rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300"
              >
                <span>{modulesError}</span>
                <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => void loadModules()}>
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Retry
                </Button>
              </div>
            )}

            <fieldset
              disabled={busy || !!created}
              className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2.5 disabled:opacity-70"
            >
              {visibleFields.map((f, i) => renderField(f, i))}
            </fieldset>

            {validationError && (
              <p role="alert" className="text-xs text-red-600 dark:text-red-400">
                {validationError}
              </p>
            )}

            {duplicate && !created && (
              <div
                role="alert"
                className="rounded-lg border border-amber-200 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-900/20 p-3"
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0 space-y-2">
                    <div>
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                        {duplicate.matchedOn === 'phone'
                          ? 'This phone number is already on a record'
                          : duplicate.matchedOn === 'email'
                            ? 'This email is already on a record'
                            : 'A record with this name and contact info already exists'}
                      </p>
                      {duplicate.candidates.slice(0, 3).map((c) => (
                        <p key={c.id} className="text-xs text-amber-700 dark:text-amber-300 truncate">
                          {c.title || 'Untitled'}
                          {c.email ? ` · ${c.email}` : ''}
                          {c.phone ? ` · ${c.phone}` : ''}
                        </p>
                      ))}
                      <p className="text-[11px] text-amber-700/80 dark:text-amber-300/80 mt-1">
                        Nothing you typed has been lost.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {primaryDup && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs border-amber-300 dark:border-amber-700"
                          onClick={() => openExisting(primaryDup.id)}
                        >
                          <ExternalLink className="w-3 h-3 mr-1" />
                          Open existing
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs border-amber-300 dark:border-amber-700"
                        disabled={busy}
                        onClick={() => void submit(true)}
                      >
                        {submitting ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
                        Create anyway
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {softDuplicate && !duplicate && !created && (
              <div
                role="status"
                className="rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-3 py-2 flex items-start gap-2"
              >
                <Info className="w-4 h-4 text-slate-400 dark:text-slate-500 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0 text-xs text-slate-600 dark:text-slate-300">
                  <p>
                    Shares {softDuplicate.matchedOn === 'phone' ? 'a phone' : 'an email'} with{' '}
                    {softDuplicate.candidates.slice(0, 3).map((c, i) => (
                      <span key={c.id}>
                        {i > 0 ? ', ' : ''}
                        <button
                          type="button"
                          onClick={() => openExisting(c.id)}
                          className="font-medium text-slate-800 dark:text-white underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/60 rounded"
                        >
                          {c.title || 'an untitled record'}
                        </button>
                      </span>
                    ))}
                    {softDuplicate.candidates.length > 3 ? ` and ${softDuplicate.candidates.length - 3} more` : ''}
                    {' — '}
                    different name, so this is usually a family member. You can still create.
                  </p>
                </div>
              </div>
            )}

            {submitError && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-3 flex items-start gap-2"
              >
                <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-red-700 dark:text-red-300">Couldn&apos;t save</p>
                  <p className="text-xs text-red-600/90 dark:text-red-300/90 break-words">{submitError}</p>
                  <p className="text-[11px] text-red-600/80 dark:text-red-300/80 mt-1">
                    Your entries are still here — fix and retry, or open the full form.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs mt-2 border-red-300 dark:border-red-700"
                    disabled={busy}
                    onClick={() => void submit(duplicate ? true : false)}
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Retry
                  </Button>
                </div>
              </div>
            )}

            {created && (
              <div
                role="status"
                className="rounded-lg border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 p-3 flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <p className="text-sm text-emerald-800 dark:text-emerald-200 flex-1">
                  {created.noun} created — opening record…
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => router.push(`/crm/r/${created.id}`)}
                >
                  <ExternalLink className="w-3 h-3 mr-1" />
                  Open
                </Button>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 px-5 py-3 space-y-2">
            {confirmDiscard ? (
              <div
                role="alertdialog"
                aria-label="Discard what you typed?"
                className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between"
              >
                <p className="text-sm text-slate-700 dark:text-slate-200">
                  {pendingModuleSwitch
                    ? `Switch to ${QUICK_CREATE_FIELDS[pendingModuleSwitch].title}? What you typed will be discarded.`
                    : 'Discard what you typed?'}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8"
                    autoFocus
                    onClick={() => {
                      setConfirmDiscard(false);
                      setPendingModuleSwitch(null);
                    }}
                  >
                    Keep editing
                  </Button>
                  <Button type="button" size="sm" variant="destructive" className="h-8" onClick={discardAndClose}>
                    Discard
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={requestClose}
                    disabled={submitting}
                    className="h-9 border-slate-200 dark:border-white/10"
                  >
                    {created ? 'Close' : sessionAdded > 0 ? 'Done' : 'Cancel'}
                  </Button>
                  {!created && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void submit(false, 'another')}
                      className="h-9 border-slate-200 dark:border-white/10"
                      title="Save this one and start the next (Shift+Enter)"
                    >
                      {busy && submitModeRef.current === 'another' ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <ListPlus className="w-4 h-4 mr-2" />
                      )}
                      Save &amp; add another
                    </Button>
                  )}
                  <Button type="submit" disabled={busy || !!created} className="h-9 flex-1 min-w-[10rem]">
                    {checkingDuplicates ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Checking for duplicates…
                      </>
                    ) : submitting && submitModeRef.current === 'open' ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creating…
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-2" />
                        {config.title}
                      </>
                    )}
                  </Button>
                </div>
                {!created && (
                  <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="hidden sm:inline whitespace-nowrap">
                        <kbd className="px-1 py-0.5 rounded border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-[10px]">Enter</kbd> saves &amp; opens ·{' '}
                        <kbd className="px-1 py-0.5 rounded border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-[10px]">Shift+Enter</kbd> saves &amp; adds another
                      </span>
                      {sessionAdded > 0 && (
                        <span
                          role="status"
                          aria-live="polite"
                          className="inline-flex items-center gap-1 rounded-full border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300 whitespace-nowrap"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          {sessionAdded} added this session
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={openFullForm}
                      className="inline-flex items-center gap-1 text-teal-700 dark:text-teal-300 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/60 rounded"
                    >
                      <FileText className="w-3 h-3" />
                      Open full form{dirty ? ' (keeps what you typed)' : ''}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// Re-export so hosts can gate quick-create by module key without importing the config.
export { isQuickCreateModuleKey };
