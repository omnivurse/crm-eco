'use client';

import { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
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

function HierarchyNode({ node, level = 0 }: { node: AdvisorNode; level?: number }) {
  const [expanded, setExpanded] = useState(level < 2);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className="select-none">
      <div
        className={`flex items-center gap-3 p-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors cursor-pointer ${
          level === 0 ? 'bg-slate-100 dark:bg-slate-800/30' : ''
        }`}
        style={{ marginLeft: level * 24 }}
        onClick={() => hasChildren && setExpanded(!expanded)}
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

        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-900 dark:text-white">
              {node.firstName} {node.lastName}
            </span>
            {node.commissionTier && (
              <span className="px-2 py-0.5 rounded text-xs bg-teal-500/20 text-teal-600 dark:text-teal-400">
                {node.commissionTier}
              </span>
            )}
            <span className={`px-2 py-0.5 rounded text-xs ${
              node.status === 'active' 
                ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' 
                : 'bg-slate-500/20 text-slate-600 dark:text-slate-400'
            }`}>
              {node.status}
            </span>
          </div>
          <div className="text-sm text-slate-600 dark:text-slate-400">{node.email}</div>
        </div>

        <div className="text-right">
          <div className="text-slate-900 dark:text-white font-medium">{formatCurrency(node.teamProduction)}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">{node.memberCount} members</div>
        </div>
      </div>

      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <HierarchyNode key={child.id} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CommissionsPage() {
  const [hierarchy, setHierarchy] = useState<AdvisorNode[]>([]);
  const [transactions, setTransactions] = useState<CommissionTransaction[]>([]);
  const [summary, setSummary] = useState<CommissionSummary>({ totalPending: 0, totalApproved: 0, totalPaid: 0, count: 0 });
  const [stats, setStats] = useState<CommissionStats>({ totalAdvisors: 0, activeAdvisors: 0, totalProduction: 0, avgTeamSize: 0 });
  const [exporting, setExporting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'hierarchy' | 'transactions'>('hierarchy');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [hierarchyRes, commissionsRes] = await Promise.all([
        fetch('/api/commissions/hierarchy'),
        fetch('/api/commissions'),
      ]);

      if (hierarchyRes.ok) {
        const data = await hierarchyRes.json();
        setHierarchy(data.hierarchy || []);
        setStats(data.stats || { totalAdvisors: 0, activeAdvisors: 0, totalProduction: 0, avgTeamSize: 0 });
      } else {
        toast.error('Failed to load advisor hierarchy');
      }

      if (commissionsRes.ok) {
        const data = await commissionsRes.json();
        setTransactions(data.transactions || []);
        setSummary(data.summary || { totalPending: 0, totalApproved: 0, totalPaid: 0, count: 0 });
      } else {
        toast.error('Failed to load commission transactions');
      }
    } catch (error) {
      console.error('Failed to fetch commission data:', error);
      toast.error('Failed to load commission data');
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const response = await fetch('/api/commissions/export');
      if (!response.ok) {
        throw new Error('Export failed');
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
      toast.error('Failed to export report');
    } finally {
      setExporting(false);
    }
  }

  const filteredTransactions = statusFilter === 'all' 
    ? transactions 
    : transactions.filter(t => t.status === statusFilter);

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Commission Management</h1>
          <p className="text-slate-600 dark:text-slate-400">Track advisor hierarchy and commission payouts</p>
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass-card border-slate-200 dark:border-white/10">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-amber-500/10">
                <Clock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(summary.totalPending)}</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-slate-200 dark:border-white/10">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-blue-500/10">
                <CheckCircle className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(summary.totalApproved)}</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Approved</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-slate-200 dark:border-white/10">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-emerald-500/10">
                <DollarSign className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(summary.totalPaid)}</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Paid Out</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-slate-200 dark:border-white/10">
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
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700">
        <button
          onClick={() => setActiveTab('hierarchy')}
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
          onClick={() => setActiveTab('transactions')}
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
              Total Production: {formatCurrency(stats.totalProduction)} • 
              Avg Team Size: {stats.avgTeamSize}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {hierarchy.length > 0 ? (
              <div className="space-y-1">
                {hierarchy.map((node) => (
                  <HierarchyNode key={node.id} node={node} />
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
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-slate-900 dark:text-white">Commission Transactions</CardTitle>
                <CardDescription>{filteredTransactions.length} transactions</CardDescription>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
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
            {filteredTransactions.length > 0 ? (
              <div className="space-y-2">
                {filteredTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${
                        tx.transaction_type === 'override' 
                          ? 'bg-violet-500/20' 
                          : tx.transaction_type === 'bonus'
                          ? 'bg-amber-500/20'
                          : 'bg-teal-500/20'
                      }`}>
                        <DollarSign className={`w-5 h-5 ${
                          tx.transaction_type === 'override' 
                            ? 'text-violet-600 dark:text-violet-400' 
                            : tx.transaction_type === 'bonus'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-teal-600 dark:text-teal-400'
                        }`} />
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
                      <div className="text-slate-900 dark:text-white font-bold">{formatCurrency(tx.commission_amount)}</div>
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        tx.status === 'paid' 
                          ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                          : tx.status === 'approved'
                          ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                          : tx.status === 'pending'
                          ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                          : 'bg-slate-500/20 text-slate-600 dark:text-slate-400'
                      }`}>
                        {tx.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No commission transactions found</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
