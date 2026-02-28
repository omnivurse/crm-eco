'use client';

import { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import {
  Users,
  UserCheck,
  Activity,
  Shield,
  TrendingUp,
  FileText,
  Heart,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface BucketItem {
  bucket: string;
  count: number;
}

interface LabelItem {
  label: string;
  count: number;
}

interface MonthItem {
  month: string;
  count: number;
}

interface MemberDemographics {
  total: number;
  active: number;
  avgAge: number;
  ageDistribution: BucketItem[];
  genderDistribution: LabelItem[];
  stateDistribution: LabelItem[];
  planDistribution: LabelItem[];
  statusDistribution: LabelItem[];
  smokerDistribution: { smoker: number; nonSmoker: number; unknown: number };
  coverageDistribution: LabelItem[];
}

interface EnrollmentDemographics {
  total: number;
  approved: number;
  approvalRate: number;
  statusDistribution: LabelItem[];
  channelDistribution: LabelItem[];
  householdSizeDistribution: BucketItem[];
  monthlyTrend: MonthItem[];
  age65WarningCount: number;
  mandateWarningCount: number;
}

interface HealthUtilization {
  totalNeeds: number;
  approvedNeeds: number;
  approvalRate: number;
  statusDistribution: LabelItem[];
  typeDistribution: LabelItem[];
  preExistingConditionRate: number;
}

interface AgentDemographics {
  total: number;
  active: number;
  mpbCertifiedRate: number;
  eoCurrentRate: number;
  withDownline: number;
  independent: number;
  stateDistribution: LabelItem[];
  producerTypeDistribution: LabelItem[];
  statusDistribution: LabelItem[];
}

export interface DemographicsData {
  memberDemographics: MemberDemographics;
  enrollmentDemographics: EnrollmentDemographics;
  healthUtilization: HealthUtilization;
  agentDemographics: AgentDemographics;
  generatedAt: string;
}

// ============================================================================
// Constants
// ============================================================================

const PALETTE = [
  '#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1',
  '#14b8a6', '#e11d48', '#a855f7', '#22c55e', '#eab308',
];

const SMALL_GROUP_LABEL = '< 5';

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

function ChartCard({
  title,
  children,
  className = '',
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl bg-white border border-slate-200/60 shadow-sm overflow-hidden ${className}`}>
      <div className="px-5 py-4 border-b border-slate-100">
        <h4 className="font-semibold text-slate-800 text-sm">{title}</h4>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function SectionHeader({
  title,
  icon: Icon,
  expanded,
  onToggle,
}: {
  title: string;
  icon: React.ElementType;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-3 w-full group"
    >
      <div className="p-2.5 rounded-xl bg-slate-700">
        <Icon className="w-5 h-5 text-white" />
      </div>
      <h3 className="text-lg font-bold text-slate-900 flex-1 text-left">{title}</h3>
      {expanded ? (
        <ChevronUp className="w-5 h-5 text-slate-400 group-hover:text-slate-600 transition-colors" />
      ) : (
        <ChevronDown className="w-5 h-5 text-slate-400 group-hover:text-slate-600 transition-colors" />
      )}
    </button>
  );
}

/** Render count with small-group suppression */
function displayCount(n: number): string {
  return n === 0 ? SMALL_GROUP_LABEL : n.toLocaleString();
}

/** Format label items for bar chart, mapping suppressed values */
function toLabelData(items: LabelItem[]) {
  return items.map((d) => ({
    name: d.label,
    value: d.count,
  }));
}

function toBucketData(items: BucketItem[]) {
  return items.map((d) => ({
    name: d.bucket,
    value: d.count,
  }));
}

// Custom tooltip to handle suppressed values
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const val = payload[0].value;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="font-medium text-slate-800">{label}</p>
      <p className="text-slate-600">{val === 0 ? SMALL_GROUP_LABEL : val.toLocaleString()}</p>
    </div>
  );
}

// ============================================================================
// Section 1: Member Demographics
// ============================================================================

function MemberSection({ data }: { data: MemberDemographics }) {
  const topState = data.stateDistribution[0];

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Members" value={data.total.toLocaleString()} icon={Users} color="bg-sky-600" />
        <StatCard label="Active Members" value={data.active.toLocaleString()} icon={UserCheck} color="bg-emerald-600" />
        <StatCard label="Average Age" value={data.avgAge || 'N/A'} icon={Activity} color="bg-violet-600" />
        <StatCard label="Top State" value={topState?.label ?? 'N/A'} icon={TrendingUp} color="bg-amber-600" sub={topState ? `${displayCount(topState.count)} members` : undefined} />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard title="Age Distribution">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={toBucketData(data.ageDistribution)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="name" width={50} tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Gender Distribution">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={toLabelData(data.genderDistribution)}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={3}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {data.genderDistribution.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <ChartCard title="Geographic Distribution (Top States)">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={toLabelData(data.stateDistribution).slice(0, 10)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Status Distribution">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={toLabelData(data.statusDistribution)}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {data.statusDistribution.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Smoker Distribution">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={[
                  { name: 'Non-Smoker', value: data.smokerDistribution.nonSmoker },
                  { name: 'Smoker', value: data.smokerDistribution.smoker },
                  { name: 'Unknown', value: data.smokerDistribution.unknown },
                ].filter((d) => d.value > 0)}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={3}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                <Cell fill="#10b981" />
                <Cell fill="#ef4444" />
                <Cell fill="#94a3b8" />
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

// ============================================================================
// Section 2: Enrollment Demographics
// ============================================================================

function EnrollmentSection({ data }: { data: EnrollmentDemographics }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Enrollments" value={data.total.toLocaleString()} icon={FileText} color="bg-sky-600" />
        <StatCard label="Approved" value={data.approved.toLocaleString()} icon={UserCheck} color="bg-emerald-600" />
        <StatCard label="Approval Rate" value={`${data.approvalRate}%`} icon={TrendingUp} color="bg-violet-600" />
        <StatCard
          label="Warnings"
          value={data.age65WarningCount + data.mandateWarningCount}
          icon={AlertTriangle}
          color="bg-amber-600"
          sub={`Age 65: ${data.age65WarningCount} | Mandate: ${data.mandateWarningCount}`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard title="Monthly Enrollment Trend (Last 12 Months)">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.monthlyTrend.map((d) => ({ name: d.month.slice(5), value: d.count }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Enrollment Status">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={toLabelData(data.statusDistribution)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard title="Channel Distribution">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={toLabelData(data.channelDistribution)}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={3}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {data.channelDistribution.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Household Size">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={toBucketData(data.householdSizeDistribution)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

// ============================================================================
// Section 3: Health Utilization
// ============================================================================

function HealthSection({ data }: { data: HealthUtilization }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="Total Needs" value={data.totalNeeds.toLocaleString()} icon={Heart} color="bg-rose-600" />
        <StatCard label="Approval Rate" value={`${data.approvalRate}%`} icon={UserCheck} color="bg-emerald-600" />
        <StatCard label="Pre-Existing Rate" value={`${data.preExistingConditionRate}%`} icon={Shield} color="bg-amber-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard title="Needs by Status">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={toLabelData(data.statusDistribution)}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={3}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {data.statusDistribution.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Needs by Category">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={toLabelData(data.typeDistribution)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

// ============================================================================
// Section 4: Agent/Advisor Demographics
// ============================================================================

function AgentSection({ data }: { data: AgentDemographics }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Agents" value={data.total.toLocaleString()} icon={Users} color="bg-sky-600" />
        <StatCard label="Active Agents" value={data.active.toLocaleString()} icon={UserCheck} color="bg-emerald-600" />
        <StatCard label="MPB Certified" value={`${data.mpbCertifiedRate}%`} icon={Shield} color="bg-violet-600" />
        <StatCard label="With Downline" value={data.withDownline.toLocaleString()} icon={TrendingUp} color="bg-amber-600" sub={`${data.independent} independent`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <ChartCard title="Agent Geographic Distribution" className="lg:col-span-1">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={toLabelData(data.stateDistribution).slice(0, 10)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="name" width={50} tick={{ fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" fill="#06b6d4" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Producer Type">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={toLabelData(data.producerTypeDistribution)}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {data.producerTypeDistribution.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Agent Status">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={toLabelData(data.statusDistribution)}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={85}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {data.statusDistribution.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

// ============================================================================
// Main View Component
// ============================================================================

export function GroupDemographicsView({ data }: { data: DemographicsData }) {
  const [expanded, setExpanded] = useState({
    members: true,
    enrollments: true,
    health: true,
    agents: true,
  });

  const toggle = (key: keyof typeof expanded) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  const generatedDate = data.generatedAt
    ? new Date(data.generatedAt).toLocaleString()
    : 'N/A';

  return (
    <div className="space-y-8 pb-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Group Demographics</h1>
        <p className="text-sm text-slate-500 mt-1">
          Aggregated, de-identified data — no individual PII is displayed.
          <span className="ml-2 text-slate-400">Generated {generatedDate}</span>
        </p>
      </div>

      {/* De-identification badge */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800">
        <Shield className="w-4 h-4 flex-shrink-0" />
        <span>
          <strong>Privacy:</strong> All data is aggregated at the group level. Buckets with fewer than 5 records are suppressed to prevent re-identification.
        </span>
      </div>

      {/* Section 1: Member Demographics */}
      <section>
        <SectionHeader title="Member Demographics" icon={Users} expanded={expanded.members} onToggle={() => toggle('members')} />
        {expanded.members && (
          <div className="mt-5">
            <MemberSection data={data.memberDemographics} />
          </div>
        )}
      </section>

      {/* Section 2: Enrollment Demographics */}
      <section>
        <SectionHeader title="Enrollment Demographics" icon={FileText} expanded={expanded.enrollments} onToggle={() => toggle('enrollments')} />
        {expanded.enrollments && (
          <div className="mt-5">
            <EnrollmentSection data={data.enrollmentDemographics} />
          </div>
        )}
      </section>

      {/* Section 3: Health Utilization */}
      <section>
        <SectionHeader title="Health Utilization" icon={Heart} expanded={expanded.health} onToggle={() => toggle('health')} />
        {expanded.health && (
          <div className="mt-5">
            <HealthSection data={data.healthUtilization} />
          </div>
        )}
      </section>

      {/* Section 4: Agent Demographics */}
      <section>
        <SectionHeader title="Agent / Advisor Demographics" icon={UserCheck} expanded={expanded.agents} onToggle={() => toggle('agents')} />
        {expanded.agents && (
          <div className="mt-5">
            <AgentSection data={data.agentDemographics} />
          </div>
        )}
      </section>
    </div>
  );
}
