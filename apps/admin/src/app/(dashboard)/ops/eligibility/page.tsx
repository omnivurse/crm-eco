'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@crm-eco/lib/supabase/client';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Badge,
  Progress,
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
} from '@crm-eco/ui';
import {
  Play,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Loader2,
  Building2,
  Users,
  FileCheck,
  ArrowLeft,
  Calendar,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import Link from 'next/link';

interface Vendor {
  id: string;
  name: string;
  vendor_type: string;
  status: string;
  last_sync_at: string | null;
  sync_status: string | null;
  member_count: number;
}

interface EligibilityRun {
  id: string;
  vendor_id: string;
  vendor_name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  members_checked: number;
  members_eligible: number;
  members_ineligible: number;
  members_changed: number;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
}

export default function EligibilityPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [recentRuns, setRecentRuns] = useState<EligibilityRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningJobs, setRunningJobs] = useState<Set<string>>(new Set());
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<string>('all');

  const supabase = createClient();

  // Get organization ID
  useEffect(() => {
    async function getOrgId() {
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

    getOrgId();
  }, [supabase]);

  // Fetch vendors
  const fetchVendors = useCallback(async () => {
    if (!organizationId) return;

    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('id, name, vendor_type, status, last_sync_at, sync_status')
        .eq('organization_id', organizationId)
        .eq('status', 'active')
        .order('name');

      if (error && error.code !== '42P01') throw error;

      // Get member counts per vendor (mock for now)
      const vendorsWithCounts = (data || []).map((v: Record<string, unknown>) => ({
        ...v,
        member_count: Math.floor(Math.random() * 500) + 50, // Mock data
      }));

      setVendors(vendorsWithCounts as Vendor[]);
    } catch (error) {
      console.error('Error fetching vendors:', error);
    }
  }, [supabase, organizationId]);

  // Fetch recent eligibility runs
  const fetchRecentRuns = useCallback(async () => {
    if (!organizationId) return;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('job_runs')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('job_type', 'eligibility_check')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error && error.code !== '42P01') throw error;

      const runs: EligibilityRun[] = (data || []).map((job: any) => ({
        id: job.id,
        vendor_id: job.result?.vendor_id || '',
        vendor_name: job.job_name?.replace('Eligibility Check - ', '') || 'Unknown',
        status: job.status,
        members_checked: job.records_processed || 0,
        members_eligible: job.records_succeeded || 0,
        members_ineligible: job.records_failed || 0,
        members_changed: job.result?.changed_count || 0,
        started_at: job.started_at,
        completed_at: job.completed_at,
        error_message: job.error_message,
      }));

      setRecentRuns(runs);

      // Check for running jobs
      const running = new Set(runs.filter(r => r.status === 'running').map(r => r.vendor_id));
      setRunningJobs(running);
    } catch (error) {
      console.error('Error fetching runs:', error);
    } finally {
      setLoading(false);
    }
  }, [supabase, organizationId]);

  useEffect(() => {
    if (organizationId) {
      fetchVendors();
      fetchRecentRuns();
    }
  }, [organizationId, fetchVendors, fetchRecentRuns]);

  // Poll for running jobs
  useEffect(() => {
    if (runningJobs.size === 0) return;

    const interval = setInterval(fetchRecentRuns, 5000);
    return () => clearInterval(interval);
  }, [runningJobs.size, fetchRecentRuns]);

  // Run eligibility check for a vendor
  const runEligibilityCheck = async (vendor: Vendor) => {
    setRunningJobs(prev => new Set(prev).add(vendor.id));

    try {
      // Create job record
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: job, error } = await (supabase as any)
        .from('job_runs')
        .insert({
          organization_id: organizationId,
          job_type: 'eligibility_check',
          job_name: `Eligibility Check - ${vendor.name}`,
          status: 'running',
          trigger_type: 'manual',
          triggered_by: profileId,
          started_at: new Date().toISOString(),
          result: { vendor_id: vendor.id },
        })
        .select('id')
        .single();

      if (error) throw error;

      toast.success(`Started eligibility check for ${vendor.name}`);

      // Simulate processing (in real implementation, this would be a background job)
      setTimeout(async () => {
        const membersChecked = vendor.member_count;
        const membersEligible = Math.floor(membersChecked * 0.95);
        const membersIneligible = membersChecked - membersEligible;
        const membersChanged = Math.floor(Math.random() * 10);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('job_runs')
          .update({
            status: 'completed',
            records_processed: membersChecked,
            records_succeeded: membersEligible,
            records_failed: membersIneligible,
            completed_at: new Date().toISOString(),
            result: {
              vendor_id: vendor.id,
              changed_count: membersChanged,
            },
          })
          .eq('id', job.id);

        setRunningJobs(prev => {
          const newSet = new Set(prev);
          newSet.delete(vendor.id);
          return newSet;
        });

        fetchRecentRuns();
        toast.success(`Completed eligibility check for ${vendor.name}`);
      }, 3000 + Math.random() * 2000);

    } catch (error: any) {
      console.error('Error starting eligibility check:', error);
      toast.error(error.message || 'Failed to start eligibility check');
      setRunningJobs(prev => {
        const newSet = new Set(prev);
        newSet.delete(vendor.id);
        return newSet;
      });
    }
  };

  // Run all vendor eligibility checks
  const runAllChecks = async () => {
    for (const vendor of vendors) {
      if (!runningJobs.has(vendor.id)) {
        await runEligibilityCheck(vendor);
        await new Promise(resolve => setTimeout(resolve, 500)); // Stagger starts
      }
    }
  };

  // Calculate summary stats
  const totalMembers = vendors.reduce((sum, v) => sum + v.member_count, 0);
  const lastRunTime = recentRuns[0]?.completed_at
    ? formatDistanceToNow(new Date(recentRuns[0].completed_at), { addSuffix: true })
    : 'Never';

  const filteredRuns = selectedVendor === 'all'
    ? recentRuns
    : recentRuns.filter(r => r.vendor_id === selectedVendor);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/ops">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Eligibility Management</h1>
            <p className="text-slate-500">Check and manage member eligibility across vendors</p>
          </div>
        </div>
        <Button onClick={runAllChecks} disabled={runningJobs.size > 0}>
          {runningJobs.size > 0 ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Running ({runningJobs.size})
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-2" />
              Run All Checks
            </>
          )}
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-blue-100">
                <Building2 className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{vendors.length}</p>
                <p className="text-sm text-slate-500">Active Vendors</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-purple-100">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{totalMembers.toLocaleString()}</p>
                <p className="text-sm text-slate-500">Total Members</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-emerald-100">
                <FileCheck className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{recentRuns.length}</p>
                <p className="text-sm text-slate-500">Checks This Month</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-amber-100">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-slate-900">{lastRunTime}</p>
                <p className="text-sm text-slate-500">Last Run</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Vendor Cards */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Vendors</h2>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        ) : vendors.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Building2 className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-500">No active vendors</p>
                <Link href="/vendors/new">
                  <Button className="mt-4">Add Vendor</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {vendors.map((vendor) => {
              const isRunning = runningJobs.has(vendor.id);
              const lastRun = recentRuns.find(r => r.vendor_id === vendor.id);

              return (
                <Card key={vendor.id}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-slate-900">{vendor.name}</h3>
                        <p className="text-sm text-slate-500">{vendor.vendor_type}</p>
                      </div>
                      <Badge variant={vendor.status === 'active' ? 'default' : 'secondary'}>
                        {vendor.status}
                      </Badge>
                    </div>

                    <div className="space-y-3 mb-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Members</span>
                        <span className="font-medium">{vendor.member_count.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Last Check</span>
                        <span className="font-medium">
                          {lastRun?.completed_at
                            ? formatDistanceToNow(new Date(lastRun.completed_at), { addSuffix: true })
                            : 'Never'}
                        </span>
                      </div>
                      {lastRun && lastRun.status === 'completed' && (
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Eligibility</span>
                          <span className="font-medium text-emerald-600">
                            {lastRun.members_checked > 0
                              ? `${Math.round((lastRun.members_eligible / lastRun.members_checked) * 100)}%`
                              : '-'}
                          </span>
                        </div>
                      )}
                    </div>

                    {isRunning && (
                      <div className="mb-4">
                        <Progress value={50} className="h-1.5" />
                        <p className="text-xs text-slate-500 mt-1">Running check...</p>
                      </div>
                    )}

                    <Button
                      className="w-full"
                      variant={isRunning ? 'secondary' : 'outline'}
                      onClick={() => runEligibilityCheck(vendor)}
                      disabled={isRunning}
                    >
                      {isRunning ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Running...
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 mr-2" />
                          Run Check
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Runs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Eligibility Checks</CardTitle>
              <CardDescription>History of eligibility verification runs</CardDescription>
            </div>
            <Select value={selectedVendor} onValueChange={setSelectedVendor}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by vendor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vendors</SelectItem>
                {vendors.map(v => (
                  <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredRuns.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="w-12 h-12 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-500">No eligibility checks yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Eligible</TableHead>
                  <TableHead>Changed</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRuns.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="font-medium">{run.vendor_name}</TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={
                          run.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                          run.status === 'failed' ? 'bg-red-100 text-red-700' :
                          run.status === 'running' ? 'bg-blue-100 text-blue-700' :
                          'bg-amber-100 text-amber-700'
                        }
                      >
                        {run.status === 'running' && (
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        )}
                        {run.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{run.members_checked.toLocaleString()}</TableCell>
                    <TableCell>
                      <span className="text-emerald-600">
                        {run.members_eligible.toLocaleString()}
                      </span>
                      {run.members_checked > 0 && (
                        <span className="text-slate-400 text-xs ml-1">
                          ({Math.round((run.members_eligible / run.members_checked) * 100)}%)
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {run.members_changed > 0 ? (
                        <span className="flex items-center gap-1 text-amber-600">
                          <TrendingUp className="w-3 h-3" />
                          {run.members_changed}
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {run.completed_at ? (
                        <span title={format(new Date(run.completed_at), 'PPpp')}>
                          {formatDistanceToNow(new Date(run.completed_at), { addSuffix: true })}
                        </span>
                      ) : run.started_at ? (
                        <span className="text-blue-600">In progress</span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
