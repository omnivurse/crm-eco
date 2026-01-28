'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@crm-eco/lib/supabase/client';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Badge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Checkbox,
  Textarea,
  Label,
} from '@crm-eco/ui';
import {
  Search,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Play,
  Calendar,
  Download,
  ArrowUp,
  ArrowDown,
  User,
  Users,
  TrendingUp,
  AlertCircle,
  FileText,
  ArrowLeft,
} from 'lucide-react';
import { format, formatDistanceToNow, differenceInDays, addDays } from 'date-fns';
import { toast } from 'sonner';
import Link from 'next/link';

interface AgeUpOutResult {
  id: string;
  member_id: string;
  membership_id: string | null;
  member_name: string;
  member_email: string | null;
  member_dob: string;
  current_age: number;
  status: 'aging_up' | 'aging_out' | 'age_limit_reached' | 'ok';
  event_type: 'age_up' | 'age_out' | 'dependent_age_out' | 'primary_age_out';
  event_date: string;
  days_until_event: number;
  plan_name: string | null;
  current_tier: string | null;
  new_tier: string | null;
  action_required: boolean;
  action_taken: string | null;
  action_date: string | null;
  notes: string | null;
  created_at: string;
}

interface RunHistory {
  id: string;
  vendor_code: string;
  run_type: string;
  status: string;
  members_checked: number;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  triggered_by: string | null;
  created_at: string;
}

const statusConfig: Record<string, { icon: any; color: string; label: string; bgColor: string }> = {
  aging_up: { icon: ArrowUp, color: 'text-amber-600', label: 'Aging Up', bgColor: 'bg-amber-100' },
  aging_out: { icon: ArrowDown, color: 'text-red-600', label: 'Aging Out', bgColor: 'bg-red-100' },
  age_limit_reached: { icon: AlertTriangle, color: 'text-red-600', label: 'Age Limit Reached', bgColor: 'bg-red-100' },
  ok: { icon: CheckCircle2, color: 'text-emerald-600', label: 'OK', bgColor: 'bg-emerald-100' },
};

const eventTypeLabels: Record<string, string> = {
  age_up: 'Age Up',
  age_out: 'Age Out',
  dependent_age_out: 'Dependent Age Out',
  primary_age_out: 'Primary Age Out',
};

function formatDuration(ms: number | null): string {
  if (!ms) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

export default function AgeUpOutPage() {
  const [results, setResults] = useState<AgeUpOutResult[]>([]);
  const [runHistory, setRunHistory] = useState<RunHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('upcoming');
  const [selectedResults, setSelectedResults] = useState<Set<string>>(new Set());
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [isRunModalOpen, setIsRunModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('all');
  const [daysAhead, setDaysAhead] = useState<string>('90');

  // Action form
  const [actionForm, setActionForm] = useState({
    action_taken: '',
    notes: '',
  });

  // Pagination
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 20;

  const supabase = createClient();

  const fetchData = useCallback(async () => {
    if (!organizationId) return;

    setLoading(true);
    try {
      const daysFilter = parseInt(daysAhead) || 90;
      const futureDate = addDays(new Date(), daysFilter);

      let query = supabase
        .from('age_up_out_results')
        .select('*', { count: 'exact' })
        .eq('organization_id', organizationId)
        .lte('event_date', futureDate.toISOString().split('T')[0])
        .order('event_date', { ascending: true })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (activeTab === 'upcoming') {
        query = query.eq('action_required', true);
      } else if (activeTab === 'resolved') {
        query = query.eq('action_required', false);
      }

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (eventTypeFilter !== 'all') {
        query = query.eq('event_type', eventTypeFilter);
      }

      if (searchQuery) {
        query = query.ilike('member_name', `%${searchQuery}%`);
      }

      const { data, count, error } = await query;
      if (error) throw error;

      setResults(data || []);
      setTotalCount(count || 0);

      // Fetch run history
      const { data: historyData } = await supabase
        .from('vendor_eligibility_runs')
        .select('*')
        .eq('organization_id', organizationId)
        .in('run_type', ['age_up_out', 'full_sync'])
        .order('created_at', { ascending: false })
        .limit(10);

      setRunHistory(historyData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [supabase, organizationId, page, activeTab, statusFilter, eventTypeFilter, daysAhead, searchQuery]);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const result = await supabase
        .from('profiles')
        .select('id, organization_id')
        .eq('user_id', user.id)
        .single();

      const profile = result.data as { id: string; organization_id: string } | null;
      if (profile) {
        setOrganizationId(profile.organization_id);
        setProfileId(profile.id);
      }
    }
    init();
  }, [supabase]);

  useEffect(() => {
    if (organizationId) {
      fetchData();
    }
  }, [organizationId, fetchData]);

  const handleRunReport = async () => {
    if (!organizationId || !profileId) return;

    setRunning(true);
    try {
      // Create a job run for the age up/out check
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('job_runs')
        .insert({
          organization_id: organizationId,
          job_type: 'age_up_out_check',
          job_name: 'Sedera Age Up/Out Report',
          vendor_code: 'sedera',
          status: 'pending',
          trigger_type: 'manual',
          triggered_by: profileId,
        });

      if (error) throw error;

      toast.success('Age Up/Out report started');
      setIsRunModalOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to start report');
    } finally {
      setRunning(false);
    }
  };

  const handleBulkAction = async () => {
    if (selectedResults.size === 0 || !actionForm.action_taken.trim()) {
      toast.error('Please select results and enter action taken');
      return;
    }

    setSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('age_up_out_results')
        .update({
          action_required: false,
          action_taken: actionForm.action_taken.trim(),
          action_date: new Date().toISOString(),
          action_by: profileId,
          notes: actionForm.notes.trim() || null,
        })
        .in('id', Array.from(selectedResults));

      if (error) throw error;

      toast.success(`${selectedResults.size} records updated`);
      setIsActionModalOpen(false);
      setSelectedResults(new Set());
      setActionForm({ action_taken: '', notes: '' });
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update records');
    } finally {
      setSaving(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedResults.size === results.length) {
      setSelectedResults(new Set());
    } else {
      setSelectedResults(new Set(results.map(r => r.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelection = new Set(selectedResults);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedResults(newSelection);
  };

  const exportToCSV = () => {
    const headers = ['Member Name', 'Email', 'DOB', 'Current Age', 'Status', 'Event Type', 'Event Date', 'Days Until', 'Plan', 'Current Tier', 'New Tier', 'Action Required', 'Action Taken', 'Notes'];
    const rows = results.map(r => [
      r.member_name,
      r.member_email || '',
      r.member_dob,
      r.current_age,
      r.status,
      r.event_type,
      r.event_date,
      r.days_until_event,
      r.plan_name || '',
      r.current_tier || '',
      r.new_tier || '',
      r.action_required ? 'Yes' : 'No',
      r.action_taken || '',
      r.notes || '',
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `age-up-out-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  // Stats
  const agingUpCount = results.filter(r => r.status === 'aging_up').length;
  const agingOutCount = results.filter(r => r.status === 'aging_out' || r.status === 'age_limit_reached').length;
  const urgentCount = results.filter(r => r.days_until_event <= 30 && r.action_required).length;

  if (loading && !results.length) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/ops" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-500" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Age Up/Out Report</h1>
              <p className="text-slate-500">Sedera member age tracking and tier transitions</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={exportToCSV}>
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
            <Button onClick={() => setIsRunModalOpen(true)}>
              <Play className="w-4 h-4 mr-2" />
              Run Report
            </Button>
          </div>
        </div>

        {/* Warning Banner */}
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800">Age Transition Guidelines</p>
            <p className="text-sm text-amber-700 mt-1">
              Members aging up or out require plan adjustments. Age-up transitions should be processed 30 days before the event date.
              Age-out events require termination notices and final billing coordination.
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-slate-100">
                  <Users className="w-6 h-6 text-slate-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{totalCount}</p>
                  <p className="text-sm text-slate-500">Total Events</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-amber-100">
                  <ArrowUp className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-600">{agingUpCount}</p>
                  <p className="text-sm text-slate-500">Aging Up</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-red-100">
                  <ArrowDown className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-600">{agingOutCount}</p>
                  <p className="text-sm text-slate-500">Aging Out</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-purple-100">
                  <AlertTriangle className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-purple-600">{urgentCount}</p>
                  <p className="text-sm text-slate-500">Urgent (30 days)</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs & Filters */}
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setPage(0); }}>
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="upcoming">
                <Clock className="w-4 h-4 mr-2" />
                Upcoming
              </TabsTrigger>
              <TabsTrigger value="resolved">
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Resolved
              </TabsTrigger>
              <TabsTrigger value="history">
                <FileText className="w-4 h-4 mr-2" />
                Run History
              </TabsTrigger>
            </TabsList>

            {selectedResults.size > 0 && (
              <Button onClick={() => setIsActionModalOpen(true)}>
                Mark {selectedResults.size} as Resolved
              </Button>
            )}
          </div>

          <TabsContent value="upcoming" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        placeholder="Search by member name..."
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
                        className="pl-9"
                      />
                    </div>
                  </div>

                  <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="aging_up">Aging Up</SelectItem>
                      <SelectItem value="aging_out">Aging Out</SelectItem>
                      <SelectItem value="age_limit_reached">Age Limit</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={eventTypeFilter} onValueChange={(v) => { setEventTypeFilter(v); setPage(0); }}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Event Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Events</SelectItem>
                      <SelectItem value="age_up">Age Up</SelectItem>
                      <SelectItem value="age_out">Age Out</SelectItem>
                      <SelectItem value="dependent_age_out">Dependent Age Out</SelectItem>
                      <SelectItem value="primary_age_out">Primary Age Out</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={daysAhead} onValueChange={(v) => { setDaysAhead(v); setPage(0); }}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Days Ahead" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">Next 30 days</SelectItem>
                      <SelectItem value="60">Next 60 days</SelectItem>
                      <SelectItem value="90">Next 90 days</SelectItem>
                      <SelectItem value="180">Next 180 days</SelectItem>
                      <SelectItem value="365">Next year</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button variant="outline" onClick={fetchData}>
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {results.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle2 className="w-12 h-12 text-emerald-200 mx-auto mb-3" />
                    <p className="text-slate-500">No upcoming age events</p>
                    <p className="text-sm text-slate-400">Run a report to check for age transitions</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]">
                          <Checkbox
                            checked={selectedResults.size === results.length && results.length > 0}
                            onCheckedChange={toggleSelectAll}
                          />
                        </TableHead>
                        <TableHead>Member</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Event</TableHead>
                        <TableHead>Event Date</TableHead>
                        <TableHead>Days Until</TableHead>
                        <TableHead>Plan/Tier</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.map((result) => {
                        const config = statusConfig[result.status] || statusConfig.ok;
                        const StatusIcon = config.icon;
                        const isUrgent = result.days_until_event <= 30;
                        const isPast = result.days_until_event < 0;

                        return (
                          <TableRow key={result.id} className={isUrgent ? 'bg-amber-50' : ''}>
                            <TableCell>
                              <Checkbox
                                checked={selectedResults.has(result.id)}
                                onCheckedChange={() => toggleSelect(result.id)}
                              />
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium text-slate-700">{result.member_name}</p>
                                <p className="text-xs text-slate-400">
                                  Age {result.current_age} • DOB: {format(new Date(result.member_dob), 'MMM d, yyyy')}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={`${config.bgColor} ${config.color}`}>
                                <StatusIcon className="w-3 h-3 mr-1" />
                                {config.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">{eventTypeLabels[result.event_type]}</span>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">{format(new Date(result.event_date), 'MMM d, yyyy')}</span>
                            </TableCell>
                            <TableCell>
                              <span className={`font-medium ${isPast ? 'text-red-600' : isUrgent ? 'text-amber-600' : 'text-slate-700'}`}>
                                {isPast ? `${Math.abs(result.days_until_event)} days ago` : `${result.days_until_event} days`}
                              </span>
                            </TableCell>
                            <TableCell>
                              {result.plan_name ? (
                                <div className="text-sm">
                                  <p>{result.plan_name}</p>
                                  {result.new_tier && (
                                    <p className="text-xs text-slate-400">
                                      {result.current_tier} → <span className="text-purple-600">{result.new_tier}</span>
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t">
                  <p className="text-sm text-slate-500">
                    Showing {page * pageSize + 1} - {Math.min((page + 1) * pageSize, totalCount)} of {totalCount}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page === 0}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm text-slate-500">Page {page + 1} of {totalPages}</span>
                    <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="resolved" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Resolved Events</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {results.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                    <p className="text-slate-500">No resolved events yet</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Member</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Event Date</TableHead>
                        <TableHead>Action Taken</TableHead>
                        <TableHead>Resolved On</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.map((result) => {
                        const config = statusConfig[result.status] || statusConfig.ok;
                        const StatusIcon = config.icon;

                        return (
                          <TableRow key={result.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium text-slate-700">{result.member_name}</p>
                                <p className="text-xs text-slate-400">Age {result.current_age}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={`${config.bgColor} ${config.color}`}>
                                <StatusIcon className="w-3 h-3 mr-1" />
                                {config.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {format(new Date(result.event_date), 'MMM d, yyyy')}
                            </TableCell>
                            <TableCell>
                              <p className="text-sm">{result.action_taken || '-'}</p>
                              {result.notes && (
                                <p className="text-xs text-slate-400 truncate max-w-[200px]">{result.notes}</p>
                              )}
                            </TableCell>
                            <TableCell>
                              {result.action_date ? format(new Date(result.action_date), 'MMM d, yyyy') : '-'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Run History</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {runHistory.length === 0 ? (
                  <div className="text-center py-12">
                    <Clock className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                    <p className="text-slate-500">No report runs yet</p>
                    <Button className="mt-4" onClick={() => setIsRunModalOpen(true)}>
                      <Play className="w-4 h-4 mr-2" />
                      Run Report
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Members Checked</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Started</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {runHistory.map((run) => (
                        <TableRow key={run.id}>
                          <TableCell>
                            <Badge className={
                              run.status === 'completed' ? 'bg-emerald-100 text-emerald-600' :
                              run.status === 'failed' ? 'bg-red-100 text-red-600' :
                              run.status === 'running' ? 'bg-blue-100 text-blue-600' :
                              'bg-slate-100 text-slate-600'
                            }>
                              {run.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="capitalize">{run.run_type.replace('_', ' ')}</TableCell>
                          <TableCell>{run.members_checked || '-'}</TableCell>
                          <TableCell>{formatDuration(run.duration_ms)}</TableCell>
                          <TableCell>
                            {run.started_at ? (
                              <div>
                                <p className="text-sm">{format(new Date(run.started_at), 'MMM d, h:mm a')}</p>
                                <p className="text-xs text-slate-400">
                                  {formatDistanceToNow(new Date(run.created_at), { addSuffix: true })}
                                </p>
                              </div>
                            ) : (
                              <span className="text-slate-400">Pending</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Run Report Modal */}
      <Dialog open={isRunModalOpen} onOpenChange={setIsRunModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Run Age Up/Out Report</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-slate-600">
              This will scan all active members and identify those with upcoming age transitions.
              The report will check:
            </p>
            <ul className="mt-3 space-y-2 text-sm text-slate-500">
              <li className="flex items-center gap-2">
                <ArrowUp className="w-4 h-4 text-amber-500" />
                Age-up events (tier transitions based on age)
              </li>
              <li className="flex items-center gap-2">
                <ArrowDown className="w-4 h-4 text-red-500" />
                Age-out events (members exceeding plan age limits)
              </li>
              <li className="flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-500" />
                Dependent age-out events
              </li>
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRunModalOpen(false)}>Cancel</Button>
            <Button onClick={handleRunReport} disabled={running}>
              {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
              Run Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Action Modal */}
      <Dialog open={isActionModalOpen} onOpenChange={setIsActionModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark {selectedResults.size} Events as Resolved</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Action Taken *</Label>
              <Select
                value={actionForm.action_taken}
                onValueChange={(v) => setActionForm({ ...actionForm, action_taken: v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select action..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tier_adjusted">Tier Adjusted</SelectItem>
                  <SelectItem value="plan_changed">Plan Changed</SelectItem>
                  <SelectItem value="member_notified">Member Notified</SelectItem>
                  <SelectItem value="terminated">Membership Terminated</SelectItem>
                  <SelectItem value="no_action_needed">No Action Needed</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                value={actionForm.notes}
                onChange={(e) => setActionForm({ ...actionForm, notes: e.target.value })}
                placeholder="Add any additional notes..."
                className="mt-1"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsActionModalOpen(false)}>Cancel</Button>
            <Button onClick={handleBulkAction} disabled={saving || !actionForm.action_taken}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Mark as Resolved
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
