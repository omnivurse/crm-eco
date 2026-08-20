'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Download,
  Eye,
  FileSpreadsheet,
  Info,
  Loader2,
  RefreshCw,
  Upload,
  XCircle,
  X,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import { toast } from 'sonner';
import {
  parseCsv,
  type UpdateRow,
  MAX_CSV_ROWS,
  MAX_CSV_BYTES,
  DEFAULT_MATCH_PRIORITY,
} from '@/lib/imports/csv-update';
import type {
  AmbiguousPreview,
  ConflictPreview,
  CrmNewerPreview,
  CsvUpdateResult,
  DuplicateTargetPreview,
  MatchPreview,
  UnmatchedPreview,
} from '@/lib/imports/run-csv-update';

interface ModuleOption {
  key: string;
  name: string;
  name_plural: string | null;
}

type UpdateResponse = CsvUpdateResult;

interface Props {
  modules: ModuleOption[];
  defaultModuleKey?: string;
}

export function UpdateImportClient({ modules, defaultModuleKey }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [moduleKey, setModuleKey] = useState<string>(
    defaultModuleKey || modules[0]?.key || '',
  );
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<UpdateRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [dryRunResult, setDryRunResult] = useState<UpdateResponse | null>(null);
  const [running, setRunning] = useState(false);
  const [applyResult, setApplyResult] = useState<UpdateResponse | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const matchedKeyHints = useMemo(() => {
    let withZoho = 0;
    let withEmail = 0;
    let withPhone = 0;
    let withNameDob = 0;
    for (const r of parsedRows) {
      if (r.keys.zoho_id) withZoho++;
      else if (r.keys.email) withEmail++;
      else if (r.keys.phone) withPhone++;
      else if (r.keys.name_dob) withNameDob++;
    }
    return {
      withZoho,
      withEmail,
      withPhone,
      withNameDob,
      withoutKey:
        parsedRows.length - withZoho - withEmail - withPhone - withNameDob,
    };
  }, [parsedRows]);

  const handleFile = useCallback(async (incoming: File) => {
    setFile(incoming);
    setDryRunResult(null);
    setApplyResult(null);
    setParseError(null);

    if (incoming.size > MAX_CSV_BYTES) {
      setParseError(
        `File too large (${(incoming.size / (1024 * 1024)).toFixed(1)} MB). ` +
          `Max ${MAX_CSV_BYTES / (1024 * 1024)} MB. Split it into smaller batches.`,
      );
      return;
    }

    try {
      const text = await incoming.text();
      const parsed = parseCsv(text);
      if (parsed.rows.length > MAX_CSV_ROWS) {
        setParseError(
          `Too many rows (${parsed.rows.length}). Max ${MAX_CSV_ROWS} per upload.`,
        );
        return;
      }
      setParsedHeaders(parsed.headers);
      setParsedRows(parsed.rows);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Failed to parse CSV');
      setParsedHeaders([]);
      setParsedRows([]);
    }
  }, []);

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) void handleFile(f);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    if (!/\.csv$/i.test(f.name) && f.type !== 'text/csv') {
      toast.error('Please upload a .csv file');
      return;
    }
    void handleFile(f);
  };

  const reset = () => {
    setFile(null);
    setParsedHeaders([]);
    setParsedRows([]);
    setDryRunResult(null);
    setApplyResult(null);
    setParseError(null);
  };

  const submit = async (dryRun: boolean) => {
    if (!moduleKey) {
      toast.error('Pick a module first');
      return;
    }
    if (parsedRows.length === 0) {
      toast.error('Upload a CSV with at least one data row');
      return;
    }

    setRunning(true);
    try {
      const res = await fetch('/api/crm/imports/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moduleKey,
          rows: parsedRows.map((r) => ({
            index: r.index,
            normalized: r.normalized,
          })),
          matchPriority: DEFAULT_MATCH_PRIORITY,
          dryRun,
          fileName: file?.name,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(
          typeof err.error === 'string'
            ? err.error
            : 'Update failed — check the server log',
        );
        return;
      }

      let result = (await res.json()) as UpdateResponse;
      if (dryRun) {
        setDryRunResult(result);
      } else {
        // A large apply stops at a time budget and reports what is left, so
        // the platform can never kill it mid-write. Continue automatically
        // until the file is finished, re-sending the whole file each pass so
        // duplicate/ambiguity detection stays file-wide.
        let guard = 0;
        let incomplete = false;
        while (result.remainingRowIndices.length > 0 && guard < 200) {
          guard++;
          setApplyResult(result);
          // Carried totals must match what the server counted, or the job row
          // under-reports the run. Attempts include conflicts (a conflict IS
          // an attempted write), and skipped counts are recomputed per pass by
          // the server, so they are deliberately not carried.
          const carried = {
            updated: result.updated,
            errorCount: result.errors.length,
            writeAttemptCount:
              result.updated + result.errors.length + result.conflicts,
            conflictCount: result.conflicts,
            auditFailureCount: 0,
          };
          const next = await fetch('/api/crm/imports/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              moduleKey,
              rows: parsedRows.map((r) => ({
                index: r.index,
                normalized: r.normalized,
              })),
              matchPriority: DEFAULT_MATCH_PRIORITY,
              dryRun: false,
              fileName: file?.name,
              resumeRowIndices: result.remainingRowIndices,
              jobId: result.jobId,
              carryOver: carried,
            }),
          });
          if (!next.ok) {
            toast.error(
              `Applied ${result.updated} so far, then the run paused. ` +
                'Re-run to finish the rest — nothing is lost.',
            );
            incomplete = true;
            break;
          }
          const page = (await next.json()) as UpdateResponse;
          result = {
            ...page,
            updated: page.updated + carried.updated,
            conflicts: page.conflicts + carried.conflictCount,
            errors: [...result.errors, ...page.errors],
          };
        }
        setApplyResult(result);
        // Both loop exits (a failed pass, and hitting the iteration guard)
        // leave rows unwritten. Reporting success there would tell the
        // operator a file finished when it did not.
        if (incomplete || result.remainingRowIndices.length > 0) {
          toast.error(
            `Stopped after ${result.updated} record${result.updated === 1 ? '' : 's'} — ` +
              `${result.remainingRowIndices.length} row(s) still to apply. ` +
              'Run the update again to finish; nothing is lost.',
          );
        } else {
          toast.success(
            `Updated ${result.updated} record${result.updated === 1 ? '' : 's'} — ` +
              `${result.unmatched} unmatched, ${result.unchanged} unchanged`,
          );
        }
      }
    } catch (err) {
      console.error('[csv-update] request failed:', err);
      toast.error('Network error — please retry');
    } finally {
      setRunning(false);
    }
  };

  const downloadDelta = async () => {
    if (parsedRows.length === 0 || !moduleKey) return;
    setDownloading(true);
    try {
      const res = await fetch('/api/crm/imports/update/delta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moduleKey,
          rows: parsedRows.map((r) => ({
            index: r.index,
            normalized: r.normalized,
          })),
          matchPriority: DEFAULT_MATCH_PRIORITY,
          fileName: file?.name,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(
          typeof err.error === 'string' ? err.error : 'Could not build the delta',
        );
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download =
        res.headers
          .get('Content-Disposition')
          ?.match(/filename="([^"]+)"/)?.[1] ?? 'delta.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[csv-update] delta download failed:', err);
      toast.error('Network error — please retry');
    } finally {
      setDownloading(false);
    }
  };

  const moduleOpt = modules.find((m) => m.key === moduleKey);
  const result = applyResult ?? dryRunResult;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/crm/imports" prefetch={false}>
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-xl">
            <RefreshCw className="w-6 h-6 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Update from CSV
            </h1>
            <p className="text-slate-500 dark:text-slate-400">
              Drop a Zoho export and we&apos;ll update only the records that match — by
              Zoho&nbsp;ID, email, phone, or name&nbsp;+&nbsp;DOB. Unmatched rows aren&apos;t
              created; ambiguous matches are skipped.
            </p>
          </div>
        </div>
      </div>

      {/* ── How it works callout ───────────────────────────── */}
      <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-4 flex gap-3">
        <Info className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          <p className="font-semibold mb-1">How matching works</p>
          <ol className="list-decimal pl-5 space-y-0.5">
            <li>
              <span className="font-medium">Zoho ID</span> first (most accurate) — column
              <code className="mx-1 px-1 rounded bg-amber-100 dark:bg-amber-500/20">zoho_id</code>
              or <code className="mx-1 px-1 rounded bg-amber-100 dark:bg-amber-500/20">Record ID</code>.
            </li>
            <li>
              <span className="font-medium">Email</span> next, case-insensitive.
            </li>
            <li>
              <span className="font-medium">Phone</span>, format-agnostic — <code>(800) 555-8888</code>{' '}
              and <code>1-800-555-8888</code> match the same record.
            </li>
            <li>
              <span className="font-medium">Name + DOB</span> when higher keys are missing — first,
              last, and date of birth must all be present.
            </li>
          </ol>
          <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
            Each row is matched by its single best available key (a row with a Zoho ID that finds
            nothing does not fall back to its email). Unmatched rows are never created. If a key
            matches more than one record — or two file rows match the same person — those rows are
            skipped (fail closed). Empty cells never overwrite existing values. Notes are never
            touched.
          </p>
        </div>
      </div>

      {/* ── Step 1 — module ────────────────────────────────── */}
      <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-6 h-6 rounded-full bg-teal-500 text-white text-xs flex items-center justify-center font-bold">
            1
          </span>
          <h3 className="font-semibold text-slate-900 dark:text-white">Module</h3>
        </div>
        <Select value={moduleKey} onValueChange={setModuleKey}>
          <SelectTrigger className="w-full max-w-sm">
            <SelectValue placeholder="Select a module…" />
          </SelectTrigger>
          <SelectContent>
            {modules.map((m) => (
              <SelectItem key={m.key} value={m.key}>
                {m.name_plural || m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Step 2 — file ──────────────────────────────────── */}
      <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-6 h-6 rounded-full bg-teal-500 text-white text-xs flex items-center justify-center font-bold">
            2
          </span>
          <h3 className="font-semibold text-slate-900 dark:text-white">CSV file</h3>
        </div>
        <div
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragActive(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragActive(false);
          }}
          onDrop={onDrop}
          className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all ${
            dragActive
              ? 'border-teal-500 bg-teal-50 dark:bg-teal-500/10'
              : 'border-slate-300 dark:border-slate-700'
          }`}
        >
          <input
            type="file"
            onChange={onSelectFile}
            accept=".csv,text/csv"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          {file ? (
            <div className="flex items-center justify-center gap-3">
              <FileSpreadsheet className="w-8 h-8 text-green-500" />
              <div className="text-left">
                <p className="font-medium text-slate-900 dark:text-white">{file.name}</p>
                <p className="text-sm text-slate-500">
                  {(file.size / 1024).toFixed(1)} KB · {parsedRows.length} rows ·{' '}
                  {parsedHeaders.length} columns
                </p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  reset();
                }}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                aria-label="Remove file"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <FileSpreadsheet className="w-10 h-10 text-slate-400" />
              <p className="font-medium text-slate-900 dark:text-white">
                Drop your CSV here or click to browse
              </p>
              <p className="text-xs text-slate-500">Up to {MAX_CSV_ROWS.toLocaleString()} rows</p>
            </div>
          )}
        </div>

        {parseError && (
          <div className="mt-3 flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
            <AlertCircle className="w-4 h-4" />
            {parseError}
          </div>
        )}

        {parsedRows.length > 0 && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm">
            <KeyHint label="Have Zoho ID" value={matchedKeyHints.withZoho} tone="emerald" />
            <KeyHint label="Have email" value={matchedKeyHints.withEmail} tone="sky" />
            <KeyHint label="Have phone" value={matchedKeyHints.withPhone} tone="violet" />
            <KeyHint label="Have name+DOB" value={matchedKeyHints.withNameDob} tone="amber" />
            <KeyHint label="No match key" value={matchedKeyHints.withoutKey} tone="slate" />
          </div>
        )}
      </div>

      {/* ── Action buttons ─────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() => submit(true)}
          disabled={running || !file || !moduleKey || parsedRows.length === 0}
          variant="outline"
          size="lg"
        >
          {running && !applyResult ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Checking matches…
            </>
          ) : (
            <>
              <Eye className="w-4 h-4 mr-2" />
              Preview matches (dry run)
            </>
          )}
        </Button>
        <Button
          onClick={downloadDelta}
          disabled={downloading || running || parsedRows.length === 0 || !moduleKey}
          variant="outline"
          size="lg"
        >
          {downloading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Building full delta…
            </>
          ) : (
            <>
              <Download className="w-4 h-4 mr-2" />
              Download full delta (CSV)
            </>
          )}
        </Button>
        <Button
          onClick={() => submit(false)}
          disabled={running || !dryRunResult || dryRunResult.matched === 0}
          size="lg"
          className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
        >
          {running && applyResult ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Applying…
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              Apply updates{dryRunResult ? ` (${dryRunResult.matched})` : ''}
            </>
          )}
        </Button>
      </div>

      {/* ── Result ─────────────────────────────────────────── */}
      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <Stat label="Total rows" value={result.totalRows} />
            <Stat label="Matched" value={result.matched} tone="emerald" />
            <Stat
              label={result.dryRun ? 'Would update' : 'Updated'}
              value={result.dryRun ? result.matched - result.unchanged : result.updated}
              tone="sky"
            />
            <Stat label="Unchanged" value={result.unchanged} tone="slate" />
            <Stat
              label="Unmatched"
              value={result.unmatched}
              tone={result.unmatched > 0 ? 'amber' : 'slate'}
            />
            <Stat
              label="Ambiguous"
              value={result.ambiguous}
              tone={result.ambiguous > 0 ? 'amber' : 'slate'}
            />
            {result.duplicateTarget > 0 && (
              <Stat label="Duplicate rows" value={result.duplicateTarget} tone="amber" />
            )}
            {result.conflicts > 0 && (
              <Stat label="Edited mid-run" value={result.conflicts} tone="amber" />
            )}
            {result.invalidValues > 0 && (
              <Stat label="Bad values skipped" value={result.invalidValues} tone="amber" />
            )}
            {result.crmNewer > 0 && (
              <Stat label="CRM newer than file" value={result.crmNewer} tone="amber" />
            )}
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap gap-x-4 gap-y-1">
            <span>By Zoho ID: {result.matchSummary.byZohoId}</span>
            <span>By email: {result.matchSummary.byEmail}</span>
            <span>By phone: {result.matchSummary.byPhone}</span>
            <span>By name+DOB: {result.matchSummary.byNameDob}</span>
            {result.errors.length > 0 && (
              <span className="text-red-600 dark:text-red-400">
                Errors: {result.errors.length}
              </span>
            )}
          </div>

          {result.previewMatches.length > 0 && (
            <PreviewMatchesTable
              matches={result.previewMatches}
              dryRun={result.dryRun}
              moduleName={moduleOpt?.name_plural || moduleOpt?.name || 'records'}
            />
          )}

          {result.previewUnmatched.length > 0 && (
            <PreviewUnmatchedTable rows={result.previewUnmatched} />
          )}

          {result.previewAmbiguous.length > 0 && (
            <PreviewAmbiguousTable rows={result.previewAmbiguous} />
          )}

          {result.previewDuplicateTarget.length > 0 && (
            <PreviewDuplicateTargetTable rows={result.previewDuplicateTarget} />
          )}

          {result.previewConflicts.length > 0 && (
            <PreviewConflictsTable rows={result.previewConflicts} />
          )}

          {result.previewCrmNewer.length > 0 && (
            <PreviewCrmNewerTable rows={result.previewCrmNewer} />
          )}

          {result.errors.length > 0 && (
            <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-4">
              <p className="text-sm font-semibold text-red-700 dark:text-red-300 mb-2 flex items-center gap-2">
                <XCircle className="w-4 h-4" />
                Errors ({result.errors.length})
              </p>
              <ul className="text-xs text-red-700 dark:text-red-300 space-y-0.5 max-h-40 overflow-y-auto">
                {result.errors.map((e) => (
                  <li key={e.rowIndex}>
                    {e.rowIndex < 0 ? 'Run error' : `Row ${e.rowIndex + 1}`}:{' '}
                    {e.error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.dryRun && result.matched > 0 && (
            <p className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              Looks good? Click <strong>Apply updates</strong> above.
            </p>
          )}

          {!result.dryRun && (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Done.{' '}
              <Link
                href="/crm/imports"
                prefetch={false}
                className="text-teal-600 dark:text-teal-400 hover:underline"
              >
                See full import history
              </Link>
              .
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Small presentation helpers
// ────────────────────────────────────────────────────────────

function KeyHint({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'emerald' | 'sky' | 'violet' | 'slate' | 'amber';
}) {
  const styles: Record<string, string> = {
    emerald: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    sky: 'bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300',
    violet: 'bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300',
    amber: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300',
    slate: 'bg-slate-100 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300',
  };
  return (
    <div className={`rounded-lg px-3 py-2 ${styles[tone]}`}>
      <div className="text-xs opacity-70">{label}</div>
      <div className="text-base font-semibold">{value.toLocaleString()}</div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = 'slate',
}: {
  label: string;
  value: number;
  tone?: 'emerald' | 'sky' | 'amber' | 'slate';
}) {
  const styles: Record<string, string> = {
    emerald: 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    sky: 'border-sky-200 dark:border-sky-500/30 bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300',
    amber: 'border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300',
    slate: 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/30 text-slate-900 dark:text-white',
  };
  return (
    <div className={`rounded-xl border p-3 ${styles[tone]}`}>
      <div className="text-xs opacity-70">{label}</div>
      <div className="text-2xl font-bold">{value.toLocaleString()}</div>
    </div>
  );
}

function PreviewMatchesTable({
  matches,
  dryRun,
  moduleName,
}: {
  matches: MatchPreview[];
  dryRun: boolean;
  moduleName: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">
          {dryRun ? 'Sample of records that will be updated' : 'Sample of updated records'}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          First {matches.length} of the {dryRun ? 'matched' : 'updated'} {moduleName.toLowerCase()}
        </p>
      </div>
      <div className="divide-y divide-slate-200 dark:divide-slate-700">
        {matches.map((m) => (
          <div key={`${m.recordId}-${m.rowIndex}`} className="p-4 text-sm space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={`/crm/r/${m.recordId}`}
                prefetch={false}
                className="font-medium text-slate-900 dark:text-white hover:text-teal-600 dark:hover:text-teal-400"
              >
                {m.recordTitle || 'Untitled record'}
              </Link>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                row {m.rowIndex + 1} · matched by{' '}
                <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-xs">
                  {m.matchedBy}
                </code>{' '}
                = {m.matchValue}
              </span>
            </div>
            {Object.keys(m.fieldDelta).length > 0 ? (
              <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-0.5">
                {Object.entries(m.fieldDelta).map(([k, v]) => (
                  <li key={k} className="flex flex-wrap gap-1">
                    <span className="font-medium text-slate-700 dark:text-slate-300">{k}:</span>
                    <span className="line-through opacity-60">
                      {formatVal(v.from)}
                    </span>
                    <span>→</span>
                    <span className="text-slate-900 dark:text-white">{formatVal(v.to)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-500 italic">No column-level changes (data merge only)</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PreviewUnmatchedTable({ rows }: { rows: UnmatchedPreview[] }) {
  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50/50 dark:bg-amber-500/5 overflow-hidden">
      <div className="px-4 py-3 border-b border-amber-200 dark:border-amber-500/30">
        <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
          Unmatched rows (sample)
        </p>
        <p className="text-xs text-amber-700/80 dark:text-amber-300/80">
          These won&apos;t be touched. Add a Zoho ID column or fix the email/phone to update them.
        </p>
      </div>
      <ul className="divide-y divide-amber-200 dark:divide-amber-500/20 text-xs">
        {rows.map((r) => (
          <li key={r.rowIndex} className="px-4 py-2 flex flex-wrap gap-x-4 gap-y-1">
            <span className="text-amber-900 dark:text-amber-100">Row {r.rowIndex + 1}</span>
            {r.keys.zoho_id && <span>zoho_id: {r.keys.zoho_id}</span>}
            {r.keys.email && <span>email: {r.keys.email}</span>}
            {r.keys.phone && <span>phone: {r.keys.phone}</span>}
            {r.keys.name_dob && <span>name+DOB: {r.keys.name_dob}</span>}
            {!r.keys.zoho_id &&
              !r.keys.email &&
              !r.keys.phone &&
              !r.keys.name_dob && (
              <span className="text-amber-700 dark:text-amber-400 italic">no match key</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PreviewAmbiguousTable({ rows }: { rows: AmbiguousPreview[] }) {
  return (
    <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50/50 dark:bg-red-500/5 overflow-hidden">
      <div className="px-4 py-3 border-b border-red-200 dark:border-red-500/30">
        <p className="text-sm font-semibold text-red-700 dark:text-red-300">
          Ambiguous matches (not updated)
        </p>
        <p className="text-xs text-red-700/80 dark:text-red-300/80">
          More than one CRM record shares this key. Resolve duplicates before re-uploading.
        </p>
      </div>
      <ul className="divide-y divide-red-200 dark:divide-red-500/20 text-xs">
        {rows.map((r) => (
          <li key={r.rowIndex} className="px-4 py-2 flex flex-wrap gap-x-4 gap-y-1">
            <span className="text-red-900 dark:text-red-100">Row {r.rowIndex + 1}</span>
            <span>
              {r.matchedBy}: {r.matchValue}
            </span>
            <span>{r.candidateCount} candidates</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PreviewDuplicateTargetTable({ rows }: { rows: DuplicateTargetPreview[] }) {
  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50/50 dark:bg-amber-500/5 overflow-hidden">
      <div className="px-4 py-3 border-b border-amber-200 dark:border-amber-500/30">
        <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
          Multiple rows for the same person (not updated)
        </p>
        <p className="text-xs text-amber-700/80 dark:text-amber-300/80">
          Two or more file rows match one record — often household members sharing an email or
          phone. Fix the file (one row per person, ideally with Zoho IDs) and re-upload.
        </p>
      </div>
      <ul className="divide-y divide-amber-200 dark:divide-amber-500/20 text-xs">
        {rows.map((r) => (
          <li key={r.rowIndex} className="px-4 py-2 flex flex-wrap gap-x-4 gap-y-1">
            <span className="text-amber-900 dark:text-amber-100">Row {r.rowIndex + 1}</span>
            <Link
              href={`/crm/r/${r.recordId}`}
              prefetch={false}
              className="hover:underline"
            >
              {r.recordTitle || 'Untitled record'}
            </Link>
            <span>{r.rowsInFile} rows in this file</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PreviewConflictsTable({ rows }: { rows: ConflictPreview[] }) {
  return (
    <div className="rounded-xl border border-sky-200 dark:border-sky-500/30 bg-sky-50/50 dark:bg-sky-500/5 overflow-hidden">
      <div className="px-4 py-3 border-b border-sky-200 dark:border-sky-500/30">
        <p className="text-sm font-semibold text-sky-700 dark:text-sky-300">
          Changed while the update was running (skipped, nothing lost)
        </p>
        <p className="text-xs text-sky-700/80 dark:text-sky-300/80">
          These records were modified during the apply itself, so the file was not written to them.
          Run a fresh preview and apply again to pick them up.
        </p>
      </div>
      <ul className="divide-y divide-sky-200 dark:divide-sky-500/20 text-xs">
        {rows.map((r) => (
          <li key={r.rowIndex} className="px-4 py-2 flex flex-wrap gap-x-4 gap-y-1">
            <span className="text-sky-900 dark:text-sky-100">Row {r.rowIndex + 1}</span>
            <Link
              href={`/crm/r/${r.recordId}`}
              prefetch={false}
              className="hover:underline"
            >
              {r.recordTitle || 'Untitled record'}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PreviewCrmNewerTable({ rows }: { rows: CrmNewerPreview[] }) {
  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50/50 dark:bg-amber-500/5 overflow-hidden">
      <div className="px-4 py-3 border-b border-amber-200 dark:border-amber-500/30">
        <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
          CRM edited after this file was exported (applied — review these)
        </p>
        <p className="text-xs text-amber-700/80 dark:text-amber-300/80">
          The file&apos;s Modified Time is older than the CRM&apos;s last edit on these records, so
          the file may carry stale values. They are still updated — check their deltas before
          trusting them.
        </p>
      </div>
      <ul className="divide-y divide-amber-200 dark:divide-amber-500/20 text-xs">
        {rows.map((r) => (
          <li key={r.rowIndex} className="px-4 py-2 flex flex-wrap gap-x-4 gap-y-1">
            <span className="text-amber-900 dark:text-amber-100">Row {r.rowIndex + 1}</span>
            <Link
              href={`/crm/r/${r.recordId}`}
              prefetch={false}
              className="hover:underline"
            >
              {r.recordTitle || 'Untitled record'}
            </Link>
            <span>file: {r.fileModified}</span>
            <span>CRM: {r.recordUpdated}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatVal(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'string') return v;
  return JSON.stringify(v);
}
