'use client';

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  DollarSign,
  Users,
  ChevronRight,
  ChevronDown,
  Clock,
  CheckCircle,
  Loader2,
  Download,
  Building2,
  Shield,
  Heart,
  Search,
  X,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@crm-eco/ui/components/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import { toast } from 'sonner';

interface AdvisorNode {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  commissionTier: string | null;
  personalProduction: number;
  teamProduction: number;
  memberCount: number;
  children: AdvisorNode[];
}

interface FlatAdvisor {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface CommissionTransaction {
  id: string;
  transaction_type: string;
  period_start: string;
  period_end: string;
  gross_amount: number;
  rate_pct: number;
  commission_amount: number;
  status: string;
  override_level: number | null;
  created_at: string;
  product_type?: string | null;
  advisors: { id: string; first_name: string; last_name: string } | null;
  source_advisor: { id: string; first_name: string; last_name: string } | null;
  members: { id: string; first_name: string; last_name: string } | null;
}

interface CommissionSummary {
  totalPending: number;
  totalApproved: number;
  totalPaid: number;
  count: number;
}

interface CommissionStats {
  totalAdvisors: number;
  activeAdvisors: number;
  totalProduction: number;
  avgTeamSize: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function flattenAdvisors(nodes: AdvisorNode[]): FlatAdvisor[] {
  const out: FlatAdvisor[] = [];
  const walk = (list: AdvisorNode[]) => {
    for (const n of list) {
      out.push({
        id: n.id,
        firstName: n.firstName,
        lastName: n.lastName,
        email: n.email,
      });
      if (n.children?.length) walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

function HierarchyNode({
  node,
  level = 0,
  selectedId,
  onSelect,
}: {
  node: AdvisorNode;
  level?: number;
  selectedId: string | null;
  onSelect: (advisor: FlatAdvisor) => void;
}) {
  const [expanded, setExpanded] = useState(level < 2);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedId === node.id;

  return (
    <div className="select-none">
      <div
        className={`flex items-center gap-3 p-3 rounded-lg transition-colors cursor-pointer ${
          isSelected
            ? 'bg-teal-50 dark:bg-teal-500/15 ring-1 ring-teal-400/50'
            : hasChildren
              ? 'hover:bg-slate-100 dark:hover:bg-slate-800/50'
              : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'
        } ${level === 0 && !isSelected ? 'bg-slate-100 dark:bg-slate-800/30' : ''}`}
        style={{ marginLeft: level * 24 }}
      >
        <button
          type="button"
          className="shrink-0 p-0.5 rounded hover:bg-slate-200/80 dark:hover:bg-slate-700"
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) setExpanded(!expanded);
          }}
          aria-label={hasChildren ? (expanded ? 'Collapse' : 'Expand') : undefined}
        >
          {hasChildren ? (
            expanded ? (
              <ChevronDown className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            )
          ) : (
            <div className="w-4" />
          )}
        </button>

        <button
          type="button"
          className="flex flex-1 items-center gap-3 min-w-0 text-left"
          onClick={() =>
            onSelect({
              id: node.id,
              firstName: node.firstName,
              lastName: node.lastName,
              email: node.email,
            })
          }
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-slate-900 dark:text-white">
                {node.firstName} {node.lastName}
              </span>
              {node.commissionTier && (
                <span className="px-2 py-0.5 rounded text-xs bg-teal-500/20 text-teal-600 dark:text-teal-400">
                  {node.commissionTier}
                </span>
              )}
              <span
                className={`px-2 py-0.5 rounded text-xs ${
                  node.status === 'active'
                    ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                    : 'bg-slate-500/20 text-slate-600 dark:text-slate-400'
                }`}
              >
                {node.status}
              </span>
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-400 truncate">{node.email}</div>
          </div>

          <div className="text-right shrink-0">
            <div className="text-slate-900 dark:text-white font-medium">
              {formatCurrency(node.teamProduction)}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {node.memberCount} members
            </div>
          </div>
        </button>
      </div>

      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <HierarchyNode
              key={child.id}
              node={child}
              level={level + 1}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CommissionsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Loading…</div>}>
      <CommissionsPageContent />
    </Suspense>
  );
}

function CommissionsPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlTab = searchParams.get('tab');
  const urlAdvisorId = searchParams.get('advisorId');
  const urlQ = searchParams.get('q') ?? '';

  const [hierarchy, setHierarchy] = useState<AdvisorNode[]>([]);
  const [transactions, setTransactions] = useState<CommissionTransaction[]>([]);
  const [summary, setSummary] = useState<CommissionSummary>({
    totalPending: 0,
    totalApproved: 0,
    totalPaid: 0,
    count: 0,
  });
  const [stats, setStats] = useState<CommissionStats>({
    totalAdvisors: 0,
    activeAdvisors: 0,
    totalProduction: 0,
    avgTeamSize: 0,
  });
  const [exporting, setExporting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [txLoading, setTxLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'hierarchy' | 'transactions'>(
    urlTab === 'payments' || urlTab === 'transactions' || urlAdvisorId || urlQ
      ? 'transactions'
      : 'hierarchy',
  );
  const [statusFilter, setStatusFilter] = useState<string>(
    searchParams.get('status') && searchParams.get('status') !== 'all'
      ? searchParams.get('status')!
      : 'all',
  );
  const [advisorId, setAdvisorId] = useState<string | null>(urlAdvisorId);
  const [advisorQuery, setAdvisorQuery] = useState(urlQ);
  const [productTypeTab, setProductTypeTab] = useState<'all' | 'health_insurance' | 'health_share'>(
    'all',
  );
  const [productSummary, setProductSummary] = useState<
    { product_type: string; total_commissions: number; commission_count: number }[]
  >([]);

  const flatAdvisors = useMemo(() => flattenAdvisors(hierarchy), [hierarchy]);

  const selectedAdvisor = useMemo(
    () => (advisorId ? flatAdvisors.find((a) => a.id === advisorId) ?? null : null),
    [advisorId, flatAdvisors],
  );

  const advisorSuggestions = useMemo(() => {
    const q = advisorQuery.trim().toLowerCase();
    if (!q || selectedAdvisor) return [];
    return flatAdvisors
      .filter((a) => {
        const name = `${a.firstName} ${a.lastName}`.toLowerCase();
        return name.includes(q) || a.email.toLowerCase().includes(q);
      })
      .slice(0, 8);
  }, [advisorQuery, flatAdvisors, selectedAdvisor]);

  const syncUrl = useCallback(
    (next: {
      advisorId?: string | null;
      q?: string;
      status?: string;
      tab?: 'hierarchy' | 'transactions';
    }) => {
      const params = new URLSearchParams(searchParams.toString());
      const nextAdvisor = next.advisorId !== undefined ? next.advisorId : advisorId;
      const nextQ = next.q !== undefined ? next.q : advisorQuery;
      const nextStatus = next.status !== undefined ? next.status : statusFilter;
      const nextTab = next.tab !== undefined ? next.tab : activeTab;

      if (nextAdvisor) params.set('advisorId', nextAdvisor);
      else params.delete('advisorId');

      if (nextQ.trim() && !nextAdvisor) params.set('q', nextQ.trim());
      else params.delete('q');

      if (nextStatus && nextStatus !== 'all') params.set('status', nextStatus);
      else params.delete('status');

      if (nextTab === 'transactions') params.set('tab', 'transactions');
      else if (urlTab === 'payments') params.set('tab', 'payments');
      else params.delete('tab');

      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [searchParams, advisorId, advisorQuery, statusFilter, activeTab, urlTab, router, pathname],
  );

  const fetchTransactions = useCallback(
    async (opts: { advisorId: string | null; status: string }) => {
      setTxLoading(true);
      try {
        const params = new URLSearchParams();
        if (opts.advisorId) {
          params.set('advisorId', opts.advisorId);
          params.set('limit', '500');
        } else {
          params.set('limit', '100');
        }
        if (opts.status && opts.status !== 'all') {
          params.set('status', opts.status);
        }
        const res = await fetch(`/api/commissions?${params.toString()}`);
        if (!res.ok) {
          toast.error('Failed to load commission transactions');
          return;
        }
        const data = await res.json();
        setTransactions(data.transactions || []);
        setSummary(data.summary || { totalPending: 0, totalApproved: 0, totalPaid: 0, count: 0 });
      } catch (error) {
        console.error('Failed to fetch commissions:', error);
        toast.error('Failed to load commission transactions');
      } finally {
        setTxLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    async function loadBootstrap() {
      try {
        const [hierarchyRes, summaryByTypeRes] = await Promise.all([
          fetch('/api/commissions/hierarchy'),
          fetch('/api/commissions/summary-by-type').catch(() => null),
        ]);

        if (cancelled) return;

        if (hierarchyRes.ok) {
          const data = await hierarchyRes.json();
          const tree: AdvisorNode[] = data.hierarchy || [];
          setHierarchy(tree);
          setStats(
            data.stats || {
              totalAdvisors: 0,
              activeAdvisors: 0,
              totalProduction: 0,
              avgTeamSize: 0,
            },
          );

          // Deep-link: resolve ?q=Beverly to an advisor when no advisorId yet
          if (!urlAdvisorId && urlQ.trim()) {
            const flat = flattenAdvisors(tree);
            const q = urlQ.trim().toLowerCase();
            const match = flat.find((a) => {
              const name = `${a.firstName} ${a.lastName}`.toLowerCase();
              return name.includes(q) || a.email.toLowerCase().includes(q);
            });
            if (match) {
              setAdvisorId(match.id);
              setAdvisorQuery(`${match.firstName} ${match.lastName}`);
            }
          }
        } else {
          toast.error('Failed to load advisor hierarchy');
        }

        if (summaryByTypeRes?.ok) {
          const data = await summaryByTypeRes.json();
          setProductSummary(data.summary || []);
        }
      } catch (error) {
        console.error('Failed to fetch commission data:', error);
        toast.error('Failed to load commission data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadBootstrap();
    return () => {
      cancelled = true;
    };
    // Intentional one-shot bootstrap from initial URL
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loading) return;
    void fetchTransactions({ advisorId, status: statusFilter });
  }, [loading, advisorId, statusFilter, fetchTransactions]);

  function selectAdvisor(advisor: FlatAdvisor) {
    setAdvisorId(advisor.id);
    setAdvisorQuery(`${advisor.firstName} ${advisor.lastName}`);
    setActiveTab('transactions');
    syncUrl({
      advisorId: advisor.id,
      q: '',
      tab: 'transactions',
    });
  }

  function clearAdvisorFilter() {
    setAdvisorId(null);
    setAdvisorQuery('');
    syncUrl({ advisorId: null, q: '' });
  }

  async function handleExport() {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (advisorId) params.set('advisorId', advisorId);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const response = await fetch(`/api/commissions/export?${params.toString()}`);
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || 'Export failed');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `commissions-report-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Report exported successfully');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to export report');
    } finally {
      setExporting(false);
    }
  }

  const filteredTransactions = transactions.filter((t) => {
    if (productTypeTab !== 'all' && t.product_type !== productTypeTab) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Commission Management</h1>
          <p className="text-slate-600 dark:text-slate-400">
            Track advisor hierarchy and commission payouts
          </p>
        </div>
        <Button
          variant="outline"
          className="border-slate-300 dark:border-slate-700"
          onClick={handleExport}
          disabled={exporting}
        >
          {exporting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Download className="w-4 h-4 mr-2" />
          )}
          Export Report
        </Button>
      </div>

      {/* Advisor search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          value={advisorQuery}
          onChange={(e) => {
            const v = e.target.value;
            setAdvisorQuery(v);
            if (advisorId) {
              setAdvisorId(null);
              syncUrl({ advisorId: null, q: v });
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && advisorSuggestions[0]) {
              e.preventDefault();
              selectAdvisor(advisorSuggestions[0]);
            }
          }}
          placeholder="Search advisor (e.g. Beverly Garretson)"
          className="pl-9 pr-9"
          aria-label="Search advisor"
        />
        {(advisorQuery || advisorId) && (
          <button
            type="button"
            onClick={clearAdvisorFilter}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            aria-label="Clear advisor filter"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        {advisorSuggestions.length > 0 && (
          <div className="absolute z-20 mt-1 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg overflow-hidden">
            {advisorSuggestions.map((a) => (
              <button
                key={a.id}
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                onClick={() => selectAdvisor(a)}
              >
                <span className="font-medium text-slate-900 dark:text-white">
                  {a.firstName} {a.lastName}
                </span>
                <span className="ml-2 text-slate-500 dark:text-slate-400">{a.email}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {selectedAdvisor && (
        <p className="text-sm text-teal-700 dark:text-teal-300 -mt-3">
          Showing commissions for{' '}
          <span className="font-medium">
            {selectedAdvisor.firstName} {selectedAdvisor.lastName}
          </span>
        </p>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Link href="/crm/commissions?tab=transactions&status=pending" aria-label="Pending commissions" className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500">
        <Card className="glass-card border-slate-200 dark:border-white/10 hover:border-teal-500/50 transition-all h-full">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-amber-500/10">
                <Clock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {formatCurrency(summary.totalPending)}
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        </Link>

        <Link href="/crm/commissions?tab=transactions&status=approved" aria-label="Approved commissions" className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500">
        <Card className="glass-card border-slate-200 dark:border-white/10 hover:border-teal-500/50 transition-all h-full">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-blue-500/10">
                <CheckCircle className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {formatCurrency(summary.totalApproved)}
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Approved</p>
              </div>
            </div>
          </CardContent>
        </Card>
        </Link>

        <Link href="/crm/commissions?tab=transactions&status=paid" aria-label="Paid Out commissions" className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500">
        <Card className="glass-card border-slate-200 dark:border-white/10 hover:border-teal-500/50 transition-all h-full">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-emerald-500/10">
                <DollarSign className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {formatCurrency(summary.totalPaid)}
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Paid Out</p>
              </div>
            </div>
          </CardContent>
        </Card>
        </Link>

        <Link href="/crm/settings/team" aria-label="Active Advisors" className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500">
        <Card className="glass-card border-slate-200 dark:border-white/10 hover:border-teal-500/50 transition-all h-full">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-violet-500/10">
                <Users className="w-6 h-6 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.activeAdvisors}</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Active Advisors</p>
              </div>
            </div>
          </CardContent>
        </Card>
        </Link>
      </div>

      {/* Product Type Split Tabs */}
      {productSummary.length > 0 && (
        <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-800/50 rounded-lg w-fit">
          <button
            onClick={() => setProductTypeTab('all')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              productTypeTab === 'all'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Shield className="w-3.5 h-3.5 inline-block mr-1.5" />
            All Types
          </button>
          <button
            onClick={() => setProductTypeTab('health_insurance')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              productTypeTab === 'health_insurance'
                ? 'bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Shield className="w-3.5 h-3.5 inline-block mr-1.5" />
            Insurance
            {(() => {
              const ins = productSummary.find((s) => s.product_type === 'health_insurance');
              return ins ? (
                <span className="ml-1.5 text-xs opacity-75">{formatCurrency(ins.total_commissions)}</span>
              ) : null;
            })()}
          </button>
          <button
            onClick={() => setProductTypeTab('health_share')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              productTypeTab === 'health_share'
                ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Heart className="w-3.5 h-3.5 inline-block mr-1.5" />
            Health Share
            {(() => {
              const hs = productSummary.find((s) => s.product_type === 'health_share');
              return hs ? (
                <span className="ml-1.5 text-xs opacity-75">{formatCurrency(hs.total_commissions)}</span>
              ) : null;
            })()}
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700">
        <button
          onClick={() => {
            setActiveTab('hierarchy');
            syncUrl({ tab: 'hierarchy' });
          }}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'hierarchy'
              ? 'text-teal-600 dark:text-teal-400 border-b-2 border-teal-600 dark:border-teal-400'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Building2 className="w-4 h-4 inline-block mr-2" />
          Advisor Hierarchy
        </button>
        <button
          onClick={() => {
            setActiveTab('transactions');
            syncUrl({ tab: 'transactions' });
          }}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'transactions'
              ? 'text-teal-600 dark:text-teal-400 border-b-2 border-teal-600 dark:border-teal-400'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <DollarSign className="w-4 h-4 inline-block mr-2" />
          Transactions
        </button>
      </div>

      {/* Content */}
      {activeTab === 'hierarchy' ? (
        <Card className="glass-card border-slate-200 dark:border-white/10">
          <CardHeader>
            <CardTitle className="text-slate-900 dark:text-white">Advisor Tree</CardTitle>
            <CardDescription>
              Click an advisor to view their commission transactions. Total Production:{' '}
              {formatCurrency(stats.totalProduction)} • Avg Team Size: {stats.avgTeamSize}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {hierarchy.length > 0 ? (
              <div className="space-y-1">
                {hierarchy.map((node) => (
                  <HierarchyNode
                    key={node.id}
                    node={node}
                    selectedId={advisorId}
                    onSelect={selectAdvisor}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No advisor hierarchy found</p>
                <p className="text-sm">Set parent advisors to build the commission tree</p>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="glass-card border-slate-200 dark:border-white/10">
          <CardHeader>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <CardTitle className="text-slate-900 dark:text-white">Commission Transactions</CardTitle>
                <CardDescription>
                  {txLoading
                    ? 'Loading…'
                    : `${filteredTransactions.length} transaction${filteredTransactions.length === 1 ? '' : 's'}${
                        selectedAdvisor
                          ? ` for ${selectedAdvisor.firstName} ${selectedAdvisor.lastName}`
                          : ''
                      }`}
                </CardDescription>
              </div>
              <Select
                value={statusFilter}
                onValueChange={(v) => {
                  setStatusFilter(v);
                  syncUrl({ status: v });
                }}
              >
                <SelectTrigger className="w-40 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700">
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="held">Held</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {txLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-teal-500" />
              </div>
            ) : filteredTransactions.length > 0 ? (
              <div className="space-y-2">
                {filteredTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`p-2 rounded-lg ${
                          tx.transaction_type === 'override'
                            ? 'bg-violet-500/20'
                            : tx.transaction_type === 'bonus'
                              ? 'bg-amber-500/20'
                              : 'bg-teal-500/20'
                        }`}
                      >
                        <DollarSign
                          className={`w-5 h-5 ${
                            tx.transaction_type === 'override'
                              ? 'text-violet-600 dark:text-violet-400'
                              : tx.transaction_type === 'bonus'
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-teal-600 dark:text-teal-400'
                          }`}
                        />
                      </div>
                      <div>
                        <div className="text-slate-900 dark:text-white font-medium">
                          {tx.advisors?.first_name} {tx.advisors?.last_name}
                        </div>
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                          {tx.transaction_type.replace('_', ' ')} • {tx.rate_pct}% rate
                          {tx.members && ` • ${tx.members.first_name} ${tx.members.last_name}`}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-slate-900 dark:text-white font-bold">
                        {formatCurrency(tx.commission_amount)}
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${
                          tx.status === 'paid'
                            ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                            : tx.status === 'approved'
                              ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                              : tx.status === 'pending'
                                ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                                : 'bg-slate-500/20 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {tx.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-50" />
                {selectedAdvisor ? (
                  <>
                    <p>
                      No commission transactions for {selectedAdvisor.firstName}{' '}
                      {selectedAdvisor.lastName}
                    </p>
                    <p className="text-sm mt-1">
                      If this advisor should have commissions, enrollments may not be attributed yet
                      or accrual has not run.
                    </p>
                  </>
                ) : (
                  <p>No commission transactions found</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
