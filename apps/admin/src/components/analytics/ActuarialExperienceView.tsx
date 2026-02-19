'use client';

import { useState, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
} from 'recharts';
import {
  DollarSign,
  Users,
  TrendingUp,
  Shield,
  AlertTriangle,
  Activity,
  Download,
  ChevronDown,
  ChevronUp,
  FileText,
  Heart,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface MonthlyExperience {
  period: string;
  eligibleMembers: number;
  newMembers: number;
  contributionsCollected: number;
  processingFees: number;
  netRevenue: number;
  failedPayments: number;
  failedAmount: number;
  needsSubmittedCount: number;
  needsSubmittedAmount: number;
  needsApprovedCount: number;
  needsApprovedAmount: number;
  needsPaidAmount: number;
  avgNeedSize: number;
  medianNeedSize: number;
  maxSingleNeed: number;
  needsOver25k: number;
  needsOver50k: number;
  needsPer100Members: number;
  lossRatio: number;
  avgMemberContribution: number;
  iuaApplied: number;
  memberResponsibility: number;
}

interface NeedByType {
  needType: string;
  count: number;
  totalSubmitted: number;
  totalApproved: number;
  totalPaid: number;
  avgAmount: number;
  pctOfTotal: number;
}

interface ContributionMonth {
  period: string;
  activeSchedules: number;
  avgContribution: number;
  medianContribution: number;
  totalExpected: number;
  totalCollected: number;
  totalFailed: number;
  failedCount: number;
  processingFees: number;
  netRevenue: number;
  collectionRate: number;
}

interface AgeBandExperience {
  ageBand: string;
  eligibleMembers: number;
  needsCount: number;
  totalSubmitted: number;
  totalApproved: number;
  totalPaid: number;
  avgNeedSize: number;
  needsPer100: number;
  pctPreexisting: number;
}

interface ExposureDevelopment {
  period: string;
  serviceMonth: string;
  memberMonths: number;
  beginningMembers: number;
  endingMembers: number;
  newEnrollments: number;
  terminations: number;
  incurredAmount: number;
  paidAmount: number;
  pendingAmount: number;
  reportLagDays: number;
  paymentLagDays: number;
  pmpm: number;
}

interface Summary {
  totalMembers: number;
  activeMembers: number;
  totalNeedsSubmitted: number;
  totalAmountSubmitted: number;
  totalAmountApproved: number;
  totalAmountPaid: number;
  totalContributionsCollected: number;
  currentMRR: number;
  avgMonthlyShare: number;
  overallLossRatio: number;
  collectionRate: number;
  utilizationPer100: number;
  catastrophicNeedsCount: number;
}

interface ActuarialData {
  monthlyExperience: MonthlyExperience[];
  needsByType: NeedByType[];
  contributionAdequacy: ContributionMonth[];
  ageBandExperience: AgeBandExperience[];
  exposureDevelopment: ExposureDevelopment[];
  summary: Summary;
  periodMonths: number;
  generatedAt: string;
}

// ============================================================================
// Helpers
// ============================================================================

function fmt(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtUsd(n: number): string {
  return `$${fmt(n)}`;
}

function fmtInt(n: number): string {
  return n.toLocaleString('en-US');
}

function fmtPct(n: number): string {
  return `${n}%`;
}

/** Generate a CSV string from an array of objects */
function toCSV(rows: Record<string, unknown>[], filename: string) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map((r) =>
      headers.map((h) => {
        const val = r[h];
        if (typeof val === 'string' && val.includes(',')) return `"${val}"`;
        return String(val ?? '');
      }).join(',')
    ),
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ============================================================================
// Shared Sub-Components
// ============================================================================

function StatCard({
  label,
  value,
  icon: Icon,
  color = 'bg-slate-700',
  sub,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color?: string;
  sub?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200/60 shadow-sm p-5">
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-xl ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-500 truncate">{label}</p>
          <p className="text-2xl font-bold text-slate-900 mt-0.5">{value}</p>
          {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  icon: Icon,
  expanded,
  onToggle,
  onExport,
  exportLabel = 'Export CSV',
}: {
  title: string;
  icon: React.ElementType;
  expanded: boolean;
  onToggle: () => void;
  onExport?: () => void;
  exportLabel?: string;
}) {
  return (
    <div className="flex items-center gap-3 w-full">
      <button onClick={onToggle} className="flex items-center gap-3 flex-1 group">
        <div className="p-2.5 rounded-xl bg-slate-700">
          <Icon className="w-5 h-5 text-white" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 text-left">{title}</h3>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-slate-400 group-hover:text-slate-600" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-400 group-hover:text-slate-600" />
        )}
      </button>
      {onExport && (
        <button
          onClick={onExport}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
        >
          <Download className="w-4 h-4" />
          {exportLabel}
        </button>
      )}
    </div>
  );
}

function DataTable({
  columns,
  rows,
}: {
  columns: { key: string; label: string; align?: 'left' | 'right'; format?: (v: any) => string }[];
  rows: Record<string, any>[];
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200/60">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-slate-50">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 font-semibold text-slate-600 whitespace-nowrap ${
                  col.align === 'right' ? 'text-right' : 'text-left'
                }`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-slate-50/50">
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`px-4 py-2.5 whitespace-nowrap ${
                    col.align === 'right' ? 'text-right font-mono' : 'text-left'
                  }`}
                >
                  {col.format ? col.format(row[col.key]) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// Section 1: Monthly Experience
// ============================================================================

const MONTHLY_COLUMNS = [
  { key: 'period', label: 'Period' },
  { key: 'eligibleMembers', label: 'Members', align: 'right' as const, format: fmtInt },
  { key: 'contributionsCollected', label: 'Contributions', align: 'right' as const, format: fmtUsd },
  { key: 'needsSubmittedCount', label: 'Needs Filed', align: 'right' as const, format: fmtInt },
  { key: 'needsSubmittedAmount', label: 'Submitted $', align: 'right' as const, format: fmtUsd },
  { key: 'needsApprovedAmount', label: 'Approved $', align: 'right' as const, format: fmtUsd },
  { key: 'needsPaidAmount', label: 'Paid/Shared $', align: 'right' as const, format: fmtUsd },
  { key: 'avgNeedSize', label: 'Avg Need', align: 'right' as const, format: fmtUsd },
  { key: 'maxSingleNeed', label: 'Max Need', align: 'right' as const, format: fmtUsd },
  { key: 'needsOver25k', label: '>$25k', align: 'right' as const, format: fmtInt },
  { key: 'needsPer100Members', label: 'Per 100', align: 'right' as const, format: fmtPct },
  { key: 'lossRatio', label: 'Loss Ratio', align: 'right' as const, format: fmtPct },
];

function MonthlySection({
  data,
  onExport,
}: {
  data: MonthlyExperience[];
  onExport: () => void;
}) {
  return (
    <div className="space-y-5">
      <DataTable columns={MONTHLY_COLUMNS} rows={data} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-2xl bg-white border border-slate-200/60 shadow-sm p-5">
          <h4 className="font-semibold text-slate-800 text-sm mb-4">Loss Ratio Trend</h4>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data.map((d) => ({ name: d.period.slice(5), value: d.lossRatio }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 12 }} unit="%" />
              <Tooltip formatter={(v: number) => `${v}%`} />
              <Line type="monotone" dataKey="value" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200/60 shadow-sm p-5">
          <h4 className="font-semibold text-slate-800 text-sm mb-4">Contributions vs Paid (Monthly)</h4>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={data.map((d) => ({
              name: d.period.slice(5),
              contributions: d.contributionsCollected,
              paid: d.needsPaidAmount,
            }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: number) => fmtUsd(v)} />
              <Area type="monotone" dataKey="contributions" fill="#10b981" fillOpacity={0.2} stroke="#10b981" strokeWidth={2} />
              <Area type="monotone" dataKey="paid" fill="#ef4444" fillOpacity={0.2} stroke="#ef4444" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Section 2: Needs by Type
// ============================================================================

const TYPE_COLUMNS = [
  { key: 'needType', label: 'Need Type' },
  { key: 'count', label: 'Count', align: 'right' as const, format: fmtInt },
  { key: 'totalSubmitted', label: 'Submitted $', align: 'right' as const, format: fmtUsd },
  { key: 'totalApproved', label: 'Approved $', align: 'right' as const, format: fmtUsd },
  { key: 'totalPaid', label: 'Paid $', align: 'right' as const, format: fmtUsd },
  { key: 'avgAmount', label: 'Avg $', align: 'right' as const, format: fmtUsd },
  { key: 'pctOfTotal', label: '% of Total', align: 'right' as const, format: fmtPct },
];

function NeedsTypeSection({ data }: { data: NeedByType[] }) {
  return (
    <div className="space-y-5">
      <DataTable columns={TYPE_COLUMNS} rows={data} />

      <div className="rounded-2xl bg-white border border-slate-200/60 shadow-sm p-5">
        <h4 className="font-semibold text-slate-800 text-sm mb-4">Needs by Category (Paid Amount)</h4>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data.filter((d) => d.count > 0).map((d) => ({ name: d.needType, value: d.totalPaid }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={60} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v: number) => fmtUsd(v)} />
            <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ============================================================================
// Section 3: Contribution Adequacy
// ============================================================================

const CONTRIB_COLUMNS = [
  { key: 'period', label: 'Period' },
  { key: 'activeSchedules', label: 'Active Plans', align: 'right' as const, format: fmtInt },
  { key: 'avgContribution', label: 'Avg Share', align: 'right' as const, format: fmtUsd },
  { key: 'totalExpected', label: 'Expected $', align: 'right' as const, format: fmtUsd },
  { key: 'totalCollected', label: 'Collected $', align: 'right' as const, format: fmtUsd },
  { key: 'totalFailed', label: 'Failed $', align: 'right' as const, format: fmtUsd },
  { key: 'netRevenue', label: 'Net Revenue', align: 'right' as const, format: fmtUsd },
  { key: 'collectionRate', label: 'Collection %', align: 'right' as const, format: fmtPct },
];

function ContributionSection({ data }: { data: ContributionMonth[] }) {
  return (
    <div className="space-y-5">
      <DataTable columns={CONTRIB_COLUMNS} rows={data} />

      <div className="rounded-2xl bg-white border border-slate-200/60 shadow-sm p-5">
        <h4 className="font-semibold text-slate-800 text-sm mb-4">Collection Rate Trend</h4>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={data.map((d) => ({ name: d.period.slice(5), rate: d.collectionRate }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 12 }} unit="%" domain={[0, 110]} />
            <Tooltip formatter={(v: number) => `${v}%`} />
            <Line type="monotone" dataKey="rate" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ============================================================================
// Section 4: Age-Band Loss Experience
// ============================================================================

const AGEBAND_COLUMNS = [
  { key: 'ageBand', label: 'Age Band' },
  { key: 'eligibleMembers', label: 'Members', align: 'right' as const, format: (v: number) => v === 0 ? '< 5' : fmtInt(v) },
  { key: 'needsCount', label: 'Needs', align: 'right' as const, format: (v: number) => v === 0 ? '< 5' : fmtInt(v) },
  { key: 'totalSubmitted', label: 'Submitted $', align: 'right' as const, format: (v: number) => v === 0 ? '< 5' : fmtUsd(v) },
  { key: 'totalPaid', label: 'Paid $', align: 'right' as const, format: (v: number) => v === 0 ? '< 5' : fmtUsd(v) },
  { key: 'avgNeedSize', label: 'Avg Need', align: 'right' as const, format: (v: number) => v === 0 ? '< 5' : fmtUsd(v) },
  { key: 'needsPer100', label: 'Per 100', align: 'right' as const, format: (v: number) => v === 0 ? '< 5' : fmtPct(v) },
  { key: 'pctPreexisting', label: 'Pre-Existing %', align: 'right' as const, format: (v: number) => v === 0 ? '< 5' : fmtPct(v) },
];

function AgeBandSection({ data }: { data: AgeBandExperience[] }) {
  return (
    <div className="space-y-5">
      <DataTable columns={AGEBAND_COLUMNS} rows={data} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-2xl bg-white border border-slate-200/60 shadow-sm p-5">
          <h4 className="font-semibold text-slate-800 text-sm mb-4">Paid Amount by Age Band</h4>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.filter((d) => d.eligibleMembers > 0).map((d) => ({ name: d.ageBand, value: d.totalPaid }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: number) => fmtUsd(v)} />
              <Bar dataKey="value" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200/60 shadow-sm p-5">
          <h4 className="font-semibold text-slate-800 text-sm mb-4">Utilization Rate by Age Band</h4>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.filter((d) => d.eligibleMembers > 0).map((d) => ({ name: d.ageBand, value: d.needsPer100 }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} unit="%" />
              <Tooltip formatter={(v: number) => `${v}%`} />
              <Bar dataKey="value" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Section 5: Exposure & Development
// ============================================================================

const EXPOSURE_COLUMNS = [
  { key: 'period', label: 'Period' },
  { key: 'serviceMonth', label: 'Service Month' },
  { key: 'memberMonths', label: 'Member-Months', align: 'right' as const, format: fmtInt },
  { key: 'beginningMembers', label: 'Begin', align: 'right' as const, format: fmtInt },
  { key: 'endingMembers', label: 'End', align: 'right' as const, format: fmtInt },
  { key: 'newEnrollments', label: 'New', align: 'right' as const, format: fmtInt },
  { key: 'terminations', label: 'Terms', align: 'right' as const, format: fmtInt },
  { key: 'incurredAmount', label: 'Incurred $', align: 'right' as const, format: fmtUsd },
  { key: 'paidAmount', label: 'Paid $', align: 'right' as const, format: fmtUsd },
  { key: 'pendingAmount', label: 'Pending $', align: 'right' as const, format: fmtUsd },
  { key: 'pmpm', label: 'PMPM', align: 'right' as const, format: fmtUsd },
  { key: 'reportLagDays', label: 'Report Lag', align: 'right' as const, format: (v: number) => `${v}d` },
  { key: 'paymentLagDays', label: 'Payment Lag', align: 'right' as const, format: (v: number) => `${v}d` },
];

function ExposureSection({ data }: { data: ExposureDevelopment[] }) {
  return (
    <div className="space-y-5">
      <DataTable columns={EXPOSURE_COLUMNS} rows={data} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-2xl bg-white border border-slate-200/60 shadow-sm p-5">
          <h4 className="font-semibold text-slate-800 text-sm mb-4">PMPM Trend (Per Member Per Month Cost)</h4>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={data.map((d) => ({ name: d.period.slice(5), value: d.pmpm }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: number) => fmtUsd(v)} />
              <Area type="monotone" dataKey="value" fill="#8b5cf6" fillOpacity={0.2} stroke="#8b5cf6" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200/60 shadow-sm p-5">
          <h4 className="font-semibold text-slate-800 text-sm mb-4">Incurred vs Paid vs Pending</h4>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.map((d) => ({
              name: d.period.slice(5),
              incurred: d.incurredAmount,
              paid: d.paidAmount,
              pending: d.pendingAmount,
            }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: number) => fmtUsd(v)} />
              <Bar dataKey="incurred" fill="#0ea5e9" radius={[4, 4, 0, 0]} name="Incurred" />
              <Bar dataKey="paid" fill="#10b981" radius={[4, 4, 0, 0]} name="Paid" />
              <Bar dataKey="pending" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Pending" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main View
// ============================================================================

export function ActuarialExperienceView({ data }: { data: ActuarialData }) {
  const [expanded, setExpanded] = useState({
    monthly: true,
    types: true,
    contributions: true,
    ageBands: true,
    exposure: true,
  });

  const toggle = (key: keyof typeof expanded) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  const generatedDate = data.generatedAt
    ? new Date(data.generatedAt).toLocaleString()
    : 'N/A';

  const s = data.summary;

  const exportMonthly = useCallback(() => {
    toCSV(data.monthlyExperience, `actuarial_monthly_experience_${new Date().toISOString().slice(0, 10)}.csv`);
  }, [data.monthlyExperience]);

  const exportTypes = useCallback(() => {
    toCSV(data.needsByType, `actuarial_needs_by_type_${new Date().toISOString().slice(0, 10)}.csv`);
  }, [data.needsByType]);

  const exportContributions = useCallback(() => {
    toCSV(data.contributionAdequacy, `actuarial_contributions_${new Date().toISOString().slice(0, 10)}.csv`);
  }, [data.contributionAdequacy]);

  const exportAgeBands = useCallback(() => {
    toCSV(data.ageBandExperience, `actuarial_age_bands_${new Date().toISOString().slice(0, 10)}.csv`);
  }, [data.ageBandExperience]);

  const exportExposure = useCallback(() => {
    toCSV(data.exposureDevelopment, `actuarial_exposure_development_${new Date().toISOString().slice(0, 10)}.csv`);
  }, [data.exposureDevelopment]);

  const exportAll = useCallback(() => {
    exportMonthly();
    setTimeout(exportTypes, 300);
    setTimeout(exportContributions, 600);
    setTimeout(exportAgeBands, 900);
    setTimeout(exportExposure, 1200);
  }, [exportMonthly, exportTypes, exportContributions, exportAgeBands, exportExposure]);

  return (
    <div className="space-y-8 pb-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Actuarial Experience Data</h1>
          <p className="text-sm text-slate-500 mt-1">
            De-identified, aggregated financial experience -- {data.periodMonths}-month lookback.
            <span className="ml-2 text-slate-400">Generated {generatedDate}</span>
          </p>
        </div>
        <button
          onClick={exportAll}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 text-white text-sm font-semibold rounded-xl hover:bg-slate-700 transition-colors shadow-sm"
        >
          <Download className="w-4 h-4" />
          Export All CSVs
        </button>
      </div>

      {/* Privacy badge */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800">
        <Shield className="w-4 h-4 flex-shrink-0" />
        <span>
          <strong>De-Identified:</strong> All data is aggregated at the population level. No individual member data is included.
          Small groups (&lt; 5 members) are suppressed. No BAA required for actuary submission.
        </span>
      </div>

      {/* Portfolio Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <StatCard label="Active Members" value={fmtInt(s.activeMembers)} icon={Users} color="bg-sky-600" sub={`${fmtInt(s.totalMembers)} total`} />
        <StatCard label="Total Contributions" value={fmtUsd(s.totalContributionsCollected)} icon={DollarSign} color="bg-emerald-600" sub={`MRR: ${fmtUsd(s.currentMRR)}`} />
        <StatCard label="Total Paid/Shared" value={fmtUsd(s.totalAmountPaid)} icon={Heart} color="bg-rose-600" sub={`${fmtInt(s.totalNeedsSubmitted)} needs`} />
        <StatCard label="Loss Ratio" value={fmtPct(s.overallLossRatio)} icon={TrendingUp} color={s.overallLossRatio > 80 ? 'bg-red-600' : s.overallLossRatio > 60 ? 'bg-amber-600' : 'bg-emerald-600'} sub="paid / collected" />
        <StatCard label="Catastrophic (>$25k)" value={fmtInt(s.catastrophicNeedsCount)} icon={AlertTriangle} color="bg-amber-600" sub={`Utilization: ${fmtPct(s.utilizationPer100)}`} />
      </div>

      {/* Section 1: Monthly Experience */}
      <section>
        <SectionHeader
          title="Monthly Experience Summary"
          icon={Activity}
          expanded={expanded.monthly}
          onToggle={() => toggle('monthly')}
          onExport={exportMonthly}
        />
        {expanded.monthly && (
          <div className="mt-5">
            <MonthlySection data={data.monthlyExperience} onExport={exportMonthly} />
          </div>
        )}
      </section>

      {/* Section 2: Needs by Type */}
      <section>
        <SectionHeader
          title="Needs Distribution by Type"
          icon={FileText}
          expanded={expanded.types}
          onToggle={() => toggle('types')}
          onExport={exportTypes}
        />
        {expanded.types && (
          <div className="mt-5">
            <NeedsTypeSection data={data.needsByType} />
          </div>
        )}
      </section>

      {/* Section 3: Contribution Adequacy */}
      <section>
        <SectionHeader
          title="Contribution Adequacy"
          icon={DollarSign}
          expanded={expanded.contributions}
          onToggle={() => toggle('contributions')}
          onExport={exportContributions}
        />
        {expanded.contributions && (
          <div className="mt-5">
            <ContributionSection data={data.contributionAdequacy} />
          </div>
        )}
      </section>

      {/* Section 4: Age-Band Loss Experience */}
      <section>
        <SectionHeader
          title="Age-Band Loss Experience"
          icon={Users}
          expanded={expanded.ageBands}
          onToggle={() => toggle('ageBands')}
          onExport={exportAgeBands}
        />
        {expanded.ageBands && (
          <div className="mt-5">
            <AgeBandSection data={data.ageBandExperience} />
          </div>
        )}
      </section>

      {/* Section 5: Exposure & Development */}
      <section>
        <SectionHeader
          title="Exposure & Claims Development"
          icon={Shield}
          expanded={expanded.exposure}
          onToggle={() => toggle('exposure')}
          onExport={exportExposure}
        />
        {expanded.exposure && (
          <div className="mt-5">
            <ExposureSection data={data.exposureDevelopment} />
          </div>
        )}
      </section>
    </div>
  );
}
