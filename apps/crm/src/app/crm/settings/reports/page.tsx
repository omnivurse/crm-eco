'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
import { Textarea } from '@crm-eco/ui/components/textarea';
import { Switch } from '@crm-eco/ui/components/switch';
import { Badge } from '@crm-eco/ui/components/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@crm-eco/ui/components/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@crm-eco/ui/components/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@crm-eco/ui/components/alert-dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@crm-eco/ui/components/tabs';
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  FileBarChart,
  Table as TableIcon,
  BarChart3,
  PieChart,
  LineChart,
  Download,
  Play,
  Copy,
  Eye,
  Share2,
  Clock,
  Loader2,
  MoreHorizontal,
  CheckCircle,
  ChevronRight,
  Filter,
  Columns,
  SortAsc,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';

interface CustomReport {
  id: string;
  organization_id: string;
  created_by: string | null;
  creator_name?: string;
  name: string;
  description: string | null;
  report_type: 'dashboard' | 'table' | 'chart' | 'export';
  data_source: string;
  filters: any[];
  columns: any[];
  grouping: any | null;
  sorting: any | null;
  chart_type: string | null;
  chart_config: Record<string, unknown>;
  is_public: boolean;
  shared_with: string[];
  schedule_enabled: boolean;
  schedule_cron: string | null;
  schedule_recipients: string[] | null;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
}

const DATA_SOURCES = [
  { value: 'members', label: 'Members', icon: '👥' },
  { value: 'leads', label: 'Leads', icon: '🎯' },
  { value: 'enrollments', label: 'Enrollments', icon: '📝' },
  { value: 'needs', label: 'Needs/Claims', icon: '🏥' },
  { value: 'advisors', label: 'Advisors', icon: '👤' },
  { value: 'commissions', label: 'Commissions', icon: '💰' },
];

const CHART_TYPES = [
  { value: 'bar', label: 'Bar Chart', icon: BarChart3 },
  { value: 'line', label: 'Line Chart', icon: LineChart },
  { value: 'pie', label: 'Pie Chart', icon: PieChart },
  { value: 'table', label: 'Data Table', icon: TableIcon },
];

const REPORT_TYPES = [
  { value: 'table', label: 'Table Report', description: 'Tabular data with filters and sorting' },
  { value: 'chart', label: 'Chart Report', description: 'Visual charts and graphs' },
  { value: 'dashboard', label: 'Dashboard', description: 'Combined widgets and metrics' },
  { value: 'export', label: 'Export Template', description: 'Scheduled data exports' },
];

export default function CustomReportsPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [reports, setReports] = useState<CustomReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState('');
  const [userId, setUserId] = useState('');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CustomReport | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(1);

  // Form state
  const [form, setForm] = useState({
    name: '',
    description: '',
    report_type: 'table' as 'dashboard' | 'table' | 'chart' | 'export',
    data_source: 'members',
    chart_type: 'bar',
    is_public: false,
    schedule_enabled: false,
    schedule_cron: '',
    columns: [] as { field: string; label: string }[],
    filters: [] as { field: string; operator: string; value: string }[],
    sorting: { field: '', direction: 'asc' },
  });

  // Available fields based on data source
  const getFieldsForSource = (source: string) => {
    const baseFields = [
      { value: 'created_at', label: 'Created Date' },
      { value: 'updated_at', label: 'Updated Date' },
    ];

    switch (source) {
      case 'members':
        return [
          { value: 'first_name', label: 'First Name' },
          { value: 'last_name', label: 'Last Name' },
          { value: 'email', label: 'Email' },
          { value: 'phone', label: 'Phone' },
          { value: 'status', label: 'Status' },
          { value: 'plan_name', label: 'Plan' },
          { value: 'advisor_name', label: 'Advisor' },
          ...baseFields,
        ];
      case 'leads':
        return [
          { value: 'first_name', label: 'First Name' },
          { value: 'last_name', label: 'Last Name' },
          { value: 'email', label: 'Email' },
          { value: 'phone', label: 'Phone' },
          { value: 'source', label: 'Source' },
          { value: 'status', label: 'Status' },
          { value: 'score', label: 'Score' },
          { value: 'assigned_to', label: 'Assigned To' },
          ...baseFields,
        ];
      case 'enrollments':
        return [
          { value: 'member_name', label: 'Member' },
          { value: 'plan_name', label: 'Plan' },
          { value: 'status', label: 'Status' },
          { value: 'effective_date', label: 'Effective Date' },
          { value: 'monthly_share', label: 'Monthly Share' },
          { value: 'advisor_name', label: 'Advisor' },
          ...baseFields,
        ];
      case 'needs':
        return [
          { value: 'member_name', label: 'Member' },
          { value: 'need_type', label: 'Type' },
          { value: 'description', label: 'Description' },
          { value: 'status', label: 'Status' },
          { value: 'urgency', label: 'Urgency' },
          { value: 'amount_requested', label: 'Amount Requested' },
          { value: 'amount_approved', label: 'Amount Approved' },
          { value: 'assigned_to', label: 'Assigned To' },
          ...baseFields,
        ];
      case 'advisors':
        return [
          { value: 'full_name', label: 'Name' },
          { value: 'email', label: 'Email' },
          { value: 'phone', label: 'Phone' },
          { value: 'status', label: 'Status' },
          { value: 'tier_name', label: 'Commission Tier' },
          { value: 'member_count', label: 'Member Count' },
          { value: 'production_ytd', label: 'Production YTD' },
          ...baseFields,
        ];
      case 'commissions':
        return [
          { value: 'advisor_name', label: 'Advisor' },
          { value: 'transaction_type', label: 'Type' },
          { value: 'gross_amount', label: 'Gross Amount' },
          { value: 'rate_pct', label: 'Rate %' },
          { value: 'commission_amount', label: 'Commission' },
          { value: 'status', label: 'Status' },
          { value: 'period_start', label: 'Period Start' },
          { value: 'period_end', label: 'Period End' },
          ...baseFields,
        ];
      default:
        return baseFields;
    }
  };

  const fetchData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setUserId(user.id);

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (!profile) return;
      setOrgId(profile.organization_id);

      const { data: reportsData } = await supabase
        .from('custom_reports')
        .select(`*, profiles(full_name)`)
        .eq('organization_id', profile.organization_id)
        .order('name');

      setReports(
        (reportsData || []).map((r: any) => ({
          ...r,
          creator_name: r.profiles?.full_name || 'Unknown',
        }))
      );
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreateDialog = () => {
    setEditing(null);
    setStep(1);
    setForm({
      name: '',
      description: '',
      report_type: 'table',
      data_source: 'members',
      chart_type: 'bar',
      is_public: false,
      schedule_enabled: false,
      schedule_cron: '',
      columns: [],
      filters: [],
      sorting: { field: '', direction: 'asc' },
    });
    setDialogOpen(true);
  };

  const openEditDialog = (report: CustomReport) => {
    setEditing(report);
    setStep(1);
    setForm({
      name: report.name,
      description: report.description || '',
      report_type: report.report_type,
      data_source: report.data_source,
      chart_type: report.chart_type || 'bar',
      is_public: report.is_public,
      schedule_enabled: report.schedule_enabled,
      schedule_cron: report.schedule_cron || '',
      columns: report.columns || [],
      filters: report.filters || [],
      sorting: report.sorting || { field: '', direction: 'asc' },
    });
    setDialogOpen(true);
  };

  const handleDuplicate = async (report: CustomReport) => {
    try {
      await supabase.from('custom_reports').insert({
        organization_id: orgId,
        created_by: userId,
        name: `${report.name} (Copy)`,
        description: report.description,
        report_type: report.report_type,
        data_source: report.data_source,
        filters: report.filters,
        columns: report.columns,
        grouping: report.grouping,
        sorting: report.sorting,
        chart_type: report.chart_type,
        chart_config: report.chart_config,
        is_public: false,
        schedule_enabled: false,
      });
      fetchData();
    } catch (error) {
      console.error('Failed to duplicate:', error);
    }
  };

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);

    try {
      const data = {
        organization_id: orgId,
        created_by: editing?.created_by || userId,
        name: form.name,
        description: form.description || null,
        report_type: form.report_type,
        data_source: form.data_source,
        filters: form.filters,
        columns: form.columns,
        sorting: form.sorting,
        chart_type: form.report_type === 'chart' ? form.chart_type : null,
        is_public: form.is_public,
        schedule_enabled: form.schedule_enabled,
        schedule_cron: form.schedule_enabled ? form.schedule_cron : null,
      };

      if (editing) {
        await supabase.from('custom_reports').update(data).eq('id', editing.id);
      } else {
        await supabase.from('custom_reports').insert(data);
      }

      fetchData();
      setDialogOpen(false);
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await supabase.from('custom_reports').delete().eq('id', deleteId);
      setReports(reports.filter(r => r.id !== deleteId));
    } catch (error) {
      console.error('Failed to delete:', error);
    } finally {
      setDeleteId(null);
    }
  };

  const runReport = async (reportId: string) => {
    // In a real implementation, this would execute the report
    // and navigate to a results view
    window.location.href = `/crm/reports/${reportId}`;
  };

  const getReportTypeIcon = (type: string) => {
    switch (type) {
      case 'chart': return <BarChart3 className="w-4 h-4" />;
      case 'table': return <TableIcon className="w-4 h-4" />;
      case 'dashboard': return <FileBarChart className="w-4 h-4" />;
      case 'export': return <Download className="w-4 h-4" />;
      default: return <FileBarChart className="w-4 h-4" />;
    }
  };

  const addColumn = (field: string) => {
    const fieldDef = getFieldsForSource(form.data_source).find(f => f.value === field);
    if (fieldDef && !form.columns.find(c => c.field === field)) {
      setForm({
        ...form,
        columns: [...form.columns, { field, label: fieldDef.label }],
      });
    }
  };

  const removeColumn = (field: string) => {
    setForm({
      ...form,
      columns: form.columns.filter(c => c.field !== field),
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/crm/settings">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg">
              <FileBarChart className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Custom Reports</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Build and schedule custom reports
              </p>
            </div>
          </div>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="w-4 h-4 mr-2" />
          Create Report
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Reports</p>
                <p className="text-2xl font-bold">{reports.length}</p>
              </div>
              <FileBarChart className="w-8 h-8 text-indigo-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Shared</p>
                <p className="text-2xl font-bold">{reports.filter(r => r.is_public).length}</p>
              </div>
              <Share2 className="w-8 h-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Scheduled</p>
                <p className="text-2xl font-bold">{reports.filter(r => r.schedule_enabled).length}</p>
              </div>
              <Clock className="w-8 h-8 text-amber-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Chart Reports</p>
                <p className="text-2xl font-bold">{reports.filter(r => r.report_type === 'chart').length}</p>
              </div>
              <BarChart3 className="w-8 h-8 text-emerald-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reports Grid */}
      {reports.length === 0 ? (
        <div className="text-center py-12 glass-card border border-slate-200 dark:border-slate-700 rounded-xl">
          <FileBarChart className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
            No custom reports yet
          </h3>
          <p className="text-slate-500 dark:text-slate-400 mb-4">
            Create your first report to visualize your data
          </p>
          <Button onClick={openCreateDialog}>
            <Plus className="w-4 h-4 mr-2" />
            Create Report
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reports.map((report) => (
            <Card key={report.id} className="hover:border-indigo-500/50 transition-colors">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
                      {getReportTypeIcon(report.report_type)}
                    </div>
                    <div>
                      <CardTitle className="text-base">{report.name}</CardTitle>
                      <CardDescription className="text-xs">
                        {DATA_SOURCES.find(s => s.value === report.data_source)?.label || report.data_source}
                      </CardDescription>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => runReport(report.id)}>
                        <Play className="w-4 h-4 mr-2" />
                        Run Report
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openEditDialog(report)}>
                        <Pencil className="w-4 h-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDuplicate(report)}>
                        <Copy className="w-4 h-4 mr-2" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={() => setDeleteId(report.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                {report.description && (
                  <p className="text-sm text-slate-500 mb-3 line-clamp-2">{report.description}</p>
                )}
                <div className="flex flex-wrap gap-2 mb-3">
                  <Badge variant="outline">{report.report_type}</Badge>
                  {report.chart_type && <Badge variant="secondary">{report.chart_type}</Badge>}
                  {report.is_public && <Badge><Share2 className="w-3 h-3 mr-1" />Shared</Badge>}
                  {report.schedule_enabled && <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Scheduled</Badge>}
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>by {report.creator_name}</span>
                  <span>{new Date(report.updated_at).toLocaleDateString()}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit' : 'Create'} Report</DialogTitle>
            <DialogDescription>
              Step {step} of 3: {step === 1 ? 'Basic Info' : step === 2 ? 'Configure Data' : 'Options'}
            </DialogDescription>
          </DialogHeader>

          {/* Step 1: Basic Info */}
          {step === 1 && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Report Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., Monthly Enrollment Summary"
                />
              </div>

              <div className="space-y-2">
                <Label>Description (optional)</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="What does this report show?"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Report Type</Label>
                <div className="grid grid-cols-2 gap-3">
                  {REPORT_TYPES.map((type) => (
                    <button
                      key={type.value}
                      onClick={() => setForm({ ...form, report_type: type.value as any })}
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        form.report_type === type.value
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <p className="font-medium text-sm">{type.label}</p>
                      <p className="text-xs text-slate-500">{type.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Data Source</Label>
                <Select value={form.data_source} onValueChange={(v) => setForm({ ...form, data_source: v, columns: [] })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DATA_SOURCES.map((source) => (
                      <SelectItem key={source.value} value={source.value}>
                        <span className="mr-2">{source.icon}</span>
                        {source.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {form.report_type === 'chart' && (
                <div className="space-y-2">
                  <Label>Chart Type</Label>
                  <div className="flex gap-2">
                    {CHART_TYPES.map((type) => (
                      <button
                        key={type.value}
                        onClick={() => setForm({ ...form, chart_type: type.value })}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                          form.chart_type === type.value
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <type.icon className="w-4 h-4" />
                        <span className="text-sm">{type.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Configure Data */}
          {step === 2 && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Columns className="w-4 h-4" />
                  Select Columns
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  {getFieldsForSource(form.data_source).map((field) => {
                    const isSelected = form.columns.some(c => c.field === field.value);
                    return (
                      <button
                        key={field.value}
                        onClick={() => isSelected ? removeColumn(field.value) : addColumn(field.value)}
                        className={`p-2 text-sm rounded-lg border text-left transition-colors ${
                          isSelected
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {isSelected && <CheckCircle className="w-4 h-4 text-indigo-500" />}
                          <span>{field.label}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <SortAsc className="w-4 h-4" />
                  Sort By
                </Label>
                <div className="flex gap-2">
                  <Select
                    value={form.sorting.field}
                    onValueChange={(v) => setForm({ ...form, sorting: { ...form.sorting, field: v } })}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select field..." />
                    </SelectTrigger>
                    <SelectContent>
                      {getFieldsForSource(form.data_source).map((field) => (
                        <SelectItem key={field.value} value={field.value}>{field.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={form.sorting.direction}
                    onValueChange={(v) => setForm({ ...form, sorting: { ...form.sorting, direction: v } })}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asc">Ascending</SelectItem>
                      <SelectItem value="desc">Descending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Options */}
          {step === 3 && (
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <div>
                  <p className="font-medium">Share with team</p>
                  <p className="text-sm text-slate-500">Make this report visible to all users</p>
                </div>
                <Switch
                  checked={form.is_public}
                  onCheckedChange={(checked) => setForm({ ...form, is_public: checked })}
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <div>
                  <p className="font-medium">Schedule report</p>
                  <p className="text-sm text-slate-500">Run automatically and send via email</p>
                </div>
                <Switch
                  checked={form.schedule_enabled}
                  onCheckedChange={(checked) => setForm({ ...form, schedule_enabled: checked })}
                />
              </div>

              {form.schedule_enabled && (
                <div className="space-y-2">
                  <Label>Schedule (cron expression)</Label>
                  <Select value={form.schedule_cron} onValueChange={(v) => setForm({ ...form, schedule_cron: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select frequency..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0 9 * * 1">Weekly (Mon 9am)</SelectItem>
                      <SelectItem value="0 9 1 * *">Monthly (1st 9am)</SelectItem>
                      <SelectItem value="0 9 * * *">Daily (9am)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Summary */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg space-y-2">
                <p className="font-medium">Report Summary</p>
                <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                  <p><strong>Name:</strong> {form.name || 'Untitled'}</p>
                  <p><strong>Type:</strong> {form.report_type}</p>
                  <p><strong>Data:</strong> {DATA_SOURCES.find(s => s.value === form.data_source)?.label}</p>
                  <p><strong>Columns:</strong> {form.columns.length} selected</p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep(step - 1)}>
                Back
              </Button>
            )}
            {step < 3 ? (
              <Button onClick={() => setStep(step + 1)} disabled={step === 1 && !form.name}>
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleSave} disabled={saving || !form.name}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {editing ? 'Save Changes' : 'Create Report'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Report</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this report? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
