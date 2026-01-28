'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
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
  Switch,
  Label,
  Textarea,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  ScrollArea,
} from '@crm-eco/ui';
import {
  Play,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Settings,
  Key,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Shield,
  Users,
  Building2,
  Database,
  RotateCcw,
  ArrowLeft,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import Link from 'next/link';

interface VendorRun {
  id: string;
  vendor_code: string;
  run_type: string;
  status: string;
  members_checked: number;
  members_eligible: number;
  members_ineligible: number;
  members_error: number;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  error_message: string | null;
  retry_count: number;
  trigger_type: string;
  created_at: string;
}

interface VendorConfig {
  id: string;
  vendor_code: string;
  job_type: string;
  name: string;
  description: string | null;
  schedule_enabled: boolean;
  schedule_cron: string | null;
  retry_enabled: boolean;
  retry_max_attempts: number;
  alert_on_failure: boolean;
  last_run_at: string | null;
  last_success_at: string | null;
  total_runs: number;
  total_successes: number;
  total_failures: number;
}

interface VendorCredential {
  id: string;
  vendor_code: string;
  credential_type: string;
  name: string;
  environment: string;
  is_active: boolean;
  last_verified_at: string | null;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

const vendorInfo: Record<string, { name: string; icon: any; color: string; description: string }> = {
  arm: { name: 'ARM', icon: Shield, color: 'bg-blue-100 text-blue-600', description: 'Alliance of Health Care Sharing Ministries' },
  sedera: { name: 'Sedera', icon: Users, color: 'bg-purple-100 text-purple-600', description: 'Health cost sharing community' },
  zion: { name: 'Zion', icon: Building2, color: 'bg-emerald-100 text-emerald-600', description: 'Zion Healthshare' },
  mphc: { name: 'MPHC', icon: Shield, color: 'bg-amber-100 text-amber-600', description: 'Medical Professional Health Coalition' },
  altrua: { name: 'Altrua', icon: Users, color: 'bg-pink-100 text-pink-600', description: 'Altrua Healthshare' },
};

const statusConfig: Record<string, { icon: any; color: string; label: string }> = {
  pending: { icon: Clock, color: 'bg-slate-100 text-slate-600', label: 'Pending' },
  running: { icon: Loader2, color: 'bg-blue-100 text-blue-600', label: 'Running' },
  completed: { icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-600', label: 'Completed' },
  failed: { icon: XCircle, color: 'bg-red-100 text-red-600', label: 'Failed' },
  cancelled: { icon: AlertTriangle, color: 'bg-amber-100 text-amber-600', label: 'Cancelled' },
};

const jobTypeLabels: Record<string, string> = {
  eligibility_check: 'Eligibility Check',
  enrollment_sync: 'Enrollment Sync',
  termination_sync: 'Termination Sync',
  roster_pull: 'Roster Pull',
  claims_submission: 'Claims Submission',
  payment_reconciliation: 'Payment Reconciliation',
  age_up_out_report: 'Age Up/Out Report',
  custom: 'Custom',
};

const credentialTypeLabels: Record<string, string> = {
  api_key: 'API Key',
  oauth2: 'OAuth 2.0',
  sftp: 'SFTP',
  basic_auth: 'Basic Auth',
  certificate: 'Certificate',
};

function formatDuration(ms: number | null): string {
  if (!ms) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

export default function VendorOpsPage() {
  const params = useParams();
  const vendorCode = params.vendor as string;
  const vendor = vendorInfo[vendorCode] || { name: vendorCode?.toUpperCase() || 'Unknown', icon: Database, color: 'bg-slate-100 text-slate-600', description: 'Vendor integration' };
  const VendorIcon = vendor.icon;

  const [runs, setRuns] = useState<VendorRun[]>([]);
  const [configs, setConfigs] = useState<VendorConfig[]>([]);
  const [credentials, setCredentials] = useState<VendorCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('runs');

  // Modal states
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isCredentialModalOpen, setIsCredentialModalOpen] = useState(false);
  const [isRunModalOpen, setIsRunModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<VendorConfig | null>(null);
  const [editingCredential, setEditingCredential] = useState<VendorCredential | null>(null);
  const [saving, setSaving] = useState(false);
  const [runningJob, setRunningJob] = useState(false);

  // Form states
  const [configForm, setConfigForm] = useState({
    name: '',
    description: '',
    job_type: 'eligibility_check',
    schedule_enabled: false,
    schedule_cron: '',
    retry_enabled: true,
    retry_max_attempts: 3,
    alert_on_failure: true,
  });

  const [credentialForm, setCredentialForm] = useState({
    name: '',
    credential_type: 'api_key',
    environment: 'production',
    api_key: '',
    api_secret: '',
    username: '',
    password: '',
    host: '',
    port: '',
  });

  const [runForm, setRunForm] = useState({
    run_type: 'full_sync',
    config_id: '',
  });

  // Pagination
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 20;

  const supabase = createClient();

  const fetchData = useCallback(async () => {
    if (!organizationId || !vendorCode) return;

    setLoading(true);
    try {
      const [runsResult, configsResult, credentialsResult] = await Promise.all([
        supabase
          .from('vendor_eligibility_runs')
          .select('*', { count: 'exact' })
          .eq('organization_id', organizationId)
          .eq('vendor_code', vendorCode)
          .order('created_at', { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1),
        supabase
          .from('vendor_job_configs')
          .select('*')
          .eq('organization_id', organizationId)
          .eq('vendor_code', vendorCode)
          .order('name'),
        supabase
          .from('vendor_credentials')
          .select('id, vendor_code, credential_type, name, environment, is_active, last_verified_at, last_used_at, expires_at, created_at')
          .eq('organization_id', organizationId)
          .eq('vendor_code', vendorCode)
          .order('name'),
      ]);

      setRuns(runsResult.data || []);
      setTotalCount(runsResult.count || 0);
      setConfigs(configsResult.data || []);
      setCredentials(credentialsResult.data || []);
    } catch (error) {
      console.error('Error fetching vendor data:', error);
    } finally {
      setLoading(false);
    }
  }, [supabase, organizationId, vendorCode, page]);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, organization_id')
        .eq('user_id', user.id)
        .single();

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

  // Poll for running jobs
  useEffect(() => {
    const hasRunning = runs.some(r => r.status === 'running' || r.status === 'pending');
    if (!hasRunning) return;

    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [runs, fetchData]);

  const handleRunJob = async () => {
    if (!organizationId || !profileId) return;

    setRunningJob(true);
    try {
      // Create eligibility run
      const { data: run, error: runError } = await supabase
        .from('vendor_eligibility_runs')
        .insert({
          organization_id: organizationId,
          vendor_code: vendorCode,
          run_type: runForm.run_type,
          status: 'pending',
          trigger_type: 'manual',
          triggered_by: profileId,
        })
        .select()
        .single();

      if (runError) throw runError;

      // Create job run record
      const { error: jobError } = await supabase
        .from('job_runs')
        .insert({
          organization_id: organizationId,
          job_type: 'vendor_eligibility',
          job_name: `${vendor.name} Eligibility Check`,
          vendor_code: vendorCode,
          status: 'pending',
          trigger_type: 'manual',
          triggered_by: profileId,
        });

      if (jobError) throw jobError;

      toast.success('Eligibility check started');
      setIsRunModalOpen(false);
      fetchData();
    } catch (error: any) {
      console.error('Error starting run:', error);
      toast.error(error.message || 'Failed to start run');
    } finally {
      setRunningJob(false);
    }
  };

  const handleRetryRun = async (run: VendorRun) => {
    if (!organizationId || !profileId) return;

    try {
      const { error } = await supabase
        .from('vendor_eligibility_runs')
        .insert({
          organization_id: organizationId,
          vendor_code: vendorCode,
          run_type: 'retry',
          status: 'pending',
          trigger_type: 'retry',
          triggered_by: profileId,
          retry_count: (run.retry_count || 0) + 1,
          retried_from_id: run.id,
        });

      if (error) throw error;

      toast.success('Retry queued');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to retry');
    }
  };

  const handleSaveConfig = async () => {
    if (!organizationId || !profileId) return;
    if (!configForm.name.trim()) {
      toast.error('Name is required');
      return;
    }

    setSaving(true);
    try {
      const configData = {
        name: configForm.name.trim(),
        description: configForm.description.trim() || null,
        job_type: configForm.job_type,
        schedule_enabled: configForm.schedule_enabled,
        schedule_cron: configForm.schedule_cron.trim() || null,
        retry_enabled: configForm.retry_enabled,
        retry_max_attempts: configForm.retry_max_attempts,
        alert_on_failure: configForm.alert_on_failure,
      };

      if (editingConfig) {
        const { error } = await supabase
          .from('vendor_job_configs')
          .update(configData)
          .eq('id', editingConfig.id);

        if (error) throw error;
        toast.success('Configuration updated');
      } else {
        const { error } = await supabase
          .from('vendor_job_configs')
          .insert({
            ...configData,
            organization_id: organizationId,
            vendor_code: vendorCode,
            created_by: profileId,
          });

        if (error) throw error;
        toast.success('Configuration created');
      }

      setIsConfigModalOpen(false);
      setEditingConfig(null);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCredential = async () => {
    if (!organizationId || !profileId) return;
    if (!credentialForm.name.trim()) {
      toast.error('Name is required');
      return;
    }

    setSaving(true);
    try {
      // Build encrypted credentials based on type
      let credentials_encrypted: Record<string, string> = {};
      switch (credentialForm.credential_type) {
        case 'api_key':
          credentials_encrypted = { api_key: credentialForm.api_key, api_secret: credentialForm.api_secret };
          break;
        case 'basic_auth':
          credentials_encrypted = { username: credentialForm.username, password: credentialForm.password };
          break;
        case 'sftp':
          credentials_encrypted = {
            host: credentialForm.host,
            port: credentialForm.port || '22',
            username: credentialForm.username,
            password: credentialForm.password,
          };
          break;
        default:
          credentials_encrypted = {};
      }

      const credData = {
        name: credentialForm.name.trim(),
        credential_type: credentialForm.credential_type,
        environment: credentialForm.environment,
        credentials_encrypted,
      };

      if (editingCredential) {
        const { error } = await supabase
          .from('vendor_credentials')
          .update(credData)
          .eq('id', editingCredential.id);

        if (error) throw error;
        toast.success('Credential updated');
      } else {
        const { error } = await supabase
          .from('vendor_credentials')
          .insert({
            ...credData,
            organization_id: organizationId,
            vendor_code: vendorCode,
            created_by: profileId,
            is_active: true,
          });

        if (error) throw error;
        toast.success('Credential created');
      }

      setIsCredentialModalOpen(false);
      setEditingCredential(null);
      resetCredentialForm();
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save credential');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfig = async (id: string) => {
    try {
      const { error } = await supabase
        .from('vendor_job_configs')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Configuration deleted');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete configuration');
    }
  };

  const handleDeleteCredential = async (id: string) => {
    try {
      const { error } = await supabase
        .from('vendor_credentials')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Credential deleted');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete credential');
    }
  };

  const openConfigModal = (config?: VendorConfig) => {
    if (config) {
      setEditingConfig(config);
      setConfigForm({
        name: config.name,
        description: config.description || '',
        job_type: config.job_type,
        schedule_enabled: config.schedule_enabled,
        schedule_cron: config.schedule_cron || '',
        retry_enabled: config.retry_enabled,
        retry_max_attempts: config.retry_max_attempts,
        alert_on_failure: config.alert_on_failure,
      });
    } else {
      setEditingConfig(null);
      setConfigForm({
        name: '',
        description: '',
        job_type: 'eligibility_check',
        schedule_enabled: false,
        schedule_cron: '',
        retry_enabled: true,
        retry_max_attempts: 3,
        alert_on_failure: true,
      });
    }
    setIsConfigModalOpen(true);
  };

  const resetCredentialForm = () => {
    setCredentialForm({
      name: '',
      credential_type: 'api_key',
      environment: 'production',
      api_key: '',
      api_secret: '',
      username: '',
      password: '',
      host: '',
      port: '',
    });
  };

  const openCredentialModal = (cred?: VendorCredential) => {
    if (cred) {
      setEditingCredential(cred);
      setCredentialForm({
        name: cred.name,
        credential_type: cred.credential_type,
        environment: cred.environment,
        api_key: '',
        api_secret: '',
        username: '',
        password: '',
        host: '',
        port: '',
      });
    } else {
      setEditingCredential(null);
      resetCredentialForm();
    }
    setIsCredentialModalOpen(true);
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  // Stats
  const successfulRuns = runs.filter(r => r.status === 'completed').length;
  const failedRuns = runs.filter(r => r.status === 'failed').length;
  const lastRun = runs[0];

  if (loading) {
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
            <div className={`p-3 rounded-xl ${vendor.color}`}>
              <VendorIcon className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{vendor.name}</h1>
              <p className="text-slate-500">{vendor.description}</p>
            </div>
          </div>
          <Button onClick={() => setIsRunModalOpen(true)}>
            <Play className="w-4 h-4 mr-2" />
            Run Now
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-slate-100">
                  <Clock className="w-6 h-6 text-slate-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{totalCount}</p>
                  <p className="text-sm text-slate-500">Total Runs</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-emerald-100">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-600">{successfulRuns}</p>
                  <p className="text-sm text-slate-500">Successful</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-red-100">
                  <XCircle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-600">{failedRuns}</p>
                  <p className="text-sm text-slate-500">Failed</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-purple-100">
                  <Calendar className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {lastRun ? formatDistanceToNow(new Date(lastRun.created_at), { addSuffix: true }) : 'Never'}
                  </p>
                  <p className="text-sm text-slate-500">Last Run</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="runs">
              <Clock className="w-4 h-4 mr-2" />
              Run History
            </TabsTrigger>
            <TabsTrigger value="configs">
              <Settings className="w-4 h-4 mr-2" />
              Configurations
            </TabsTrigger>
            <TabsTrigger value="credentials">
              <Key className="w-4 h-4 mr-2" />
              Credentials
            </TabsTrigger>
          </TabsList>

          <TabsContent value="runs" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Run History</CardTitle>
                  <Button variant="outline" onClick={fetchData}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {runs.length === 0 ? (
                  <div className="text-center py-12">
                    <Clock className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                    <p className="text-slate-500">No runs yet</p>
                    <Button className="mt-4" onClick={() => setIsRunModalOpen(true)}>
                      <Play className="w-4 h-4 mr-2" />
                      Run Now
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Members</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Started</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {runs.map((run) => {
                        const config = statusConfig[run.status] || statusConfig.pending;
                        const StatusIcon = config.icon;

                        return (
                          <TableRow key={run.id}>
                            <TableCell>
                              <Badge className={config.color}>
                                <StatusIcon className={`w-3 h-3 mr-1 ${run.status === 'running' ? 'animate-spin' : ''}`} />
                                {config.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span className="capitalize">{run.run_type.replace('_', ' ')}</span>
                              {run.retry_count > 0 && (
                                <span className="ml-1 text-xs text-amber-500">(Retry #{run.retry_count})</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <span className="text-emerald-600">{run.members_eligible}</span>
                                <span className="text-slate-400"> / </span>
                                <span>{run.members_checked}</span>
                                {run.members_error > 0 && (
                                  <span className="text-red-500 ml-1">({run.members_error} errors)</span>
                                )}
                              </div>
                            </TableCell>
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
                            <TableCell>
                              {run.status === 'failed' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRetryRun(run)}
                                >
                                  <RotateCcw className="w-4 h-4" />
                                </Button>
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

          <TabsContent value="configs" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Job Configurations</CardTitle>
                  <Button onClick={() => openConfigModal()}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Configuration
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {configs.length === 0 ? (
                  <div className="text-center py-12">
                    <Settings className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                    <p className="text-slate-500">No configurations yet</p>
                    <Button className="mt-4" onClick={() => openConfigModal()}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Configuration
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {configs.map((config) => (
                      <div key={config.id} className="p-4 border rounded-lg">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-slate-900">{config.name}</h3>
                              {config.schedule_enabled && (
                                <Badge variant="secondary">
                                  <Calendar className="w-3 h-3 mr-1" />
                                  Scheduled
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-slate-500 mt-1">{jobTypeLabels[config.job_type]}</p>
                            {config.description && (
                              <p className="text-sm text-slate-400 mt-1">{config.description}</p>
                            )}
                            <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                              {config.schedule_cron && <span>Cron: {config.schedule_cron}</span>}
                              <span>Runs: {config.total_runs}</span>
                              <span className="text-emerald-500">Success: {config.total_successes}</span>
                              <span className="text-red-500">Failed: {config.total_failures}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" onClick={() => openConfigModal(config)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleDeleteConfig(config.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="credentials" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Credentials</CardTitle>
                    <p className="text-sm text-slate-500 mt-1">Securely stored credentials for vendor API access</p>
                  </div>
                  <Button onClick={() => openCredentialModal()}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Credential
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {credentials.length === 0 ? (
                  <div className="text-center py-12">
                    <Key className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                    <p className="text-slate-500">No credentials configured</p>
                    <Button className="mt-4" onClick={() => openCredentialModal()}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Credential
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {credentials.map((cred) => (
                      <div key={cred.id} className="p-4 border rounded-lg">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-slate-900">{cred.name}</h3>
                              <Badge variant={cred.is_active ? 'default' : 'secondary'}>
                                {cred.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                              <Badge variant="outline">{cred.environment}</Badge>
                            </div>
                            <p className="text-sm text-slate-500 mt-1">{credentialTypeLabels[cred.credential_type]}</p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                              {cred.last_verified_at && (
                                <span>Verified: {formatDistanceToNow(new Date(cred.last_verified_at), { addSuffix: true })}</span>
                              )}
                              {cred.last_used_at && (
                                <span>Used: {formatDistanceToNow(new Date(cred.last_used_at), { addSuffix: true })}</span>
                              )}
                              {cred.expires_at && (
                                <span className={new Date(cred.expires_at) < new Date() ? 'text-red-500' : ''}>
                                  Expires: {format(new Date(cred.expires_at), 'MMM d, yyyy')}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" onClick={() => openCredentialModal(cred)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleDeleteCredential(cred.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Run Modal */}
      <Dialog open={isRunModalOpen} onOpenChange={setIsRunModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Run {vendor.name} Eligibility Check</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Run Type</Label>
              <Select
                value={runForm.run_type}
                onValueChange={(v) => setRunForm({ ...runForm, run_type: v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_sync">Full Sync</SelectItem>
                  <SelectItem value="incremental">Incremental</SelectItem>
                  <SelectItem value="batch">Batch</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRunModalOpen(false)}>Cancel</Button>
            <Button onClick={handleRunJob} disabled={runningJob}>
              {runningJob ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
              Start Run
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Config Modal */}
      <Dialog open={isConfigModalOpen} onOpenChange={setIsConfigModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingConfig ? 'Edit Configuration' : 'New Configuration'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Name *</Label>
              <Input
                value={configForm.name}
                onChange={(e) => setConfigForm({ ...configForm, name: e.target.value })}
                placeholder="Daily Eligibility Check"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={configForm.description}
                onChange={(e) => setConfigForm({ ...configForm, description: e.target.value })}
                placeholder="Optional description..."
                className="mt-1"
                rows={2}
              />
            </div>
            <div>
              <Label>Job Type</Label>
              <Select
                value={configForm.job_type}
                onValueChange={(v) => setConfigForm({ ...configForm, job_type: v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(jobTypeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="schedule_enabled"
                checked={configForm.schedule_enabled}
                onCheckedChange={(checked) => setConfigForm({ ...configForm, schedule_enabled: checked })}
              />
              <Label htmlFor="schedule_enabled">Enable Schedule</Label>
            </div>
            {configForm.schedule_enabled && (
              <div>
                <Label>Cron Expression</Label>
                <Input
                  value={configForm.schedule_cron}
                  onChange={(e) => setConfigForm({ ...configForm, schedule_cron: e.target.value })}
                  placeholder="0 6 * * *"
                  className="mt-1 font-mono"
                />
              </div>
            )}
            <div className="flex items-center gap-2">
              <Switch
                id="retry_enabled"
                checked={configForm.retry_enabled}
                onCheckedChange={(checked) => setConfigForm({ ...configForm, retry_enabled: checked })}
              />
              <Label htmlFor="retry_enabled">Enable Retries</Label>
            </div>
            {configForm.retry_enabled && (
              <div>
                <Label>Max Retry Attempts</Label>
                <Input
                  type="number"
                  value={configForm.retry_max_attempts}
                  onChange={(e) => setConfigForm({ ...configForm, retry_max_attempts: parseInt(e.target.value) || 3 })}
                  className="mt-1"
                  min={1}
                  max={10}
                />
              </div>
            )}
            <div className="flex items-center gap-2">
              <Switch
                id="alert_on_failure"
                checked={configForm.alert_on_failure}
                onCheckedChange={(checked) => setConfigForm({ ...configForm, alert_on_failure: checked })}
              />
              <Label htmlFor="alert_on_failure">Alert on Failure</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfigModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveConfig} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingConfig ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credential Modal */}
      <Dialog open={isCredentialModalOpen} onOpenChange={setIsCredentialModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCredential ? 'Edit Credential' : 'New Credential'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Name *</Label>
              <Input
                value={credentialForm.name}
                onChange={(e) => setCredentialForm({ ...credentialForm, name: e.target.value })}
                placeholder="Production API Key"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Type</Label>
              <Select
                value={credentialForm.credential_type}
                onValueChange={(v) => setCredentialForm({ ...credentialForm, credential_type: v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(credentialTypeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Environment</Label>
              <Select
                value={credentialForm.environment}
                onValueChange={(v) => setCredentialForm({ ...credentialForm, environment: v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sandbox">Sandbox</SelectItem>
                  <SelectItem value="staging">Staging</SelectItem>
                  <SelectItem value="production">Production</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {credentialForm.credential_type === 'api_key' && (
              <>
                <div>
                  <Label>API Key</Label>
                  <Input
                    type="password"
                    value={credentialForm.api_key}
                    onChange={(e) => setCredentialForm({ ...credentialForm, api_key: e.target.value })}
                    placeholder={editingCredential ? '••••••••' : 'Enter API key'}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>API Secret (optional)</Label>
                  <Input
                    type="password"
                    value={credentialForm.api_secret}
                    onChange={(e) => setCredentialForm({ ...credentialForm, api_secret: e.target.value })}
                    placeholder={editingCredential ? '••••••••' : 'Enter API secret'}
                    className="mt-1"
                  />
                </div>
              </>
            )}

            {(credentialForm.credential_type === 'basic_auth' || credentialForm.credential_type === 'sftp') && (
              <>
                {credentialForm.credential_type === 'sftp' && (
                  <>
                    <div>
                      <Label>Host</Label>
                      <Input
                        value={credentialForm.host}
                        onChange={(e) => setCredentialForm({ ...credentialForm, host: e.target.value })}
                        placeholder="sftp.vendor.com"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Port</Label>
                      <Input
                        value={credentialForm.port}
                        onChange={(e) => setCredentialForm({ ...credentialForm, port: e.target.value })}
                        placeholder="22"
                        className="mt-1"
                      />
                    </div>
                  </>
                )}
                <div>
                  <Label>Username</Label>
                  <Input
                    value={credentialForm.username}
                    onChange={(e) => setCredentialForm({ ...credentialForm, username: e.target.value })}
                    placeholder="username"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Password</Label>
                  <Input
                    type="password"
                    value={credentialForm.password}
                    onChange={(e) => setCredentialForm({ ...credentialForm, password: e.target.value })}
                    placeholder={editingCredential ? '••••••••' : 'Enter password'}
                    className="mt-1"
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCredentialModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveCredential} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingCredential ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
