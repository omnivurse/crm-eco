'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Link2,
  Plus,
  RefreshCw,
  Settings2,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Play,
  Pause,
  MoreVertical,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Badge } from '@crm-eco/ui/components/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@crm-eco/ui/components/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';
import { formatDistanceToNow } from 'date-fns';
import { getConnectors, getVendors, type VendorConnector, type Vendor } from '../actions';

const CONNECTOR_TYPES = [
  { value: 'enrollment_feed', label: 'Enrollment Feed', description: 'Regular enrollment data sync' },
  { value: 'pricing_feed', label: 'Pricing Feed', description: 'Plan pricing updates' },
  { value: 'roster_sync', label: 'Roster Sync', description: 'Employee roster synchronization' },
  { value: 'termination_feed', label: 'Termination Feed', description: 'Termination notifications' },
  { value: 'eligibility_check', label: 'Eligibility Check', description: 'Real-time eligibility verification' },
  { value: 'claim_submission', label: 'Claim Submission', description: 'Claim submission endpoint' },
];

const SCHEDULE_TYPES: Record<string, string> = {
  manual: 'Manual',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  real_time: 'Real-time',
};

function ConnectorTypeIcon({ type }: { type: string }) {
  return (
    <div className="p-2 bg-teal-100 dark:bg-teal-900/50 rounded-lg">
      <Link2 className="w-5 h-5 text-teal-600 dark:text-teal-400" />
    </div>
  );
}

export default function VendorConnectorsPage() {
  const [connectors, setConnectors] = useState<VendorConnector[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);

  const [vendorFilter, setVendorFilter] = useState('all');

  const fetchConnectors = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getConnectors(
        vendorFilter !== 'all' ? vendorFilter : undefined
      );

      if (result.success && result.data) {
        setConnectors(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch connectors:', error);
    } finally {
      setLoading(false);
    }
  }, [vendorFilter]);

  const fetchVendors = useCallback(async () => {
    const result = await getVendors();
    if (result.success && result.data) {
      setVendors(result.data);
    }
  }, []);

  useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

  useEffect(() => {
    fetchConnectors();
  }, [fetchConnectors]);

  const getSuccessRate = (connector: VendorConnector) => {
    if (connector.total_runs === 0) return 0;
    return Math.round((connector.successful_runs / connector.total_runs) * 100);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/crm/vendors">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
              <Link2 className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Connectors</h1>
              <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                Configure automated data integrations
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={fetchConnectors} disabled={loading} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            Add Connector
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="glass-card border border-slate-200 dark:border-slate-700">
        <CardContent className="py-4">
          <div className="flex items-center gap-4">
            <Select value={vendorFilter} onValueChange={setVendorFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Vendors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vendors</SelectItem>
                {vendors.map((vendor) => (
                  <SelectItem key={vendor.id} value={vendor.id}>
                    {vendor.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Connectors Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
        </div>
      ) : connectors.length === 0 ? (
        <Card className="glass-card border border-slate-200 dark:border-slate-700">
          <CardContent className="py-12">
            <div className="text-center">
              <Link2 className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-1">
                No Connectors Configured
              </h3>
              <p className="text-slate-500 dark:text-slate-400 mb-4">
                Set up automated data integrations with your vendors.
              </p>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Add First Connector
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {connectors.map((connector) => (
            <Card
              key={connector.id}
              className="glass-card border border-slate-200 dark:border-slate-700 hover:border-teal-500/50 transition-all"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <ConnectorTypeIcon type={connector.connector_type} />
                    <div>
                      <CardTitle className="text-base">{connector.name}</CardTitle>
                      <CardDescription>{connector.vendor_name}</CardDescription>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Play className="w-4 h-4 mr-2" />
                        Run Now
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Settings2 className="w-4 h-4 mr-2" />
                        Configure
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-red-600">
                        <Pause className="w-4 h-4 mr-2" />
                        Disable
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Type</span>
                  <span className="text-sm font-medium text-slate-900 dark:text-white">
                    {connector.connector_type.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Schedule</span>
                  <Badge variant="outline">
                    {SCHEDULE_TYPES[connector.schedule_type] || connector.schedule_type}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Status</span>
                  {connector.is_active ? (
                    <div className="flex items-center gap-1.5 text-green-600">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm font-medium">Active</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <XCircle className="w-4 h-4" />
                      <span className="text-sm font-medium">Inactive</span>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-lg font-bold text-slate-900 dark:text-white">
                        {connector.total_runs}
                      </p>
                      <p className="text-xs text-slate-400">Total Runs</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-green-600">
                        {connector.successful_runs}
                      </p>
                      <p className="text-xs text-slate-400">Success</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-red-500">
                        {connector.failed_runs}
                      </p>
                      <p className="text-xs text-slate-400">Failed</p>
                    </div>
                  </div>
                </div>

                {connector.last_run_at && (
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Clock className="w-3.5 h-3.5" />
                    Last run {formatDistanceToNow(new Date(connector.last_run_at), { addSuffix: true })}
                  </div>
                )}

                {connector.next_run_at && (
                  <div className="flex items-center gap-2 text-xs text-teal-600">
                    <RefreshCw className="w-3.5 h-3.5" />
                    Next run {formatDistanceToNow(new Date(connector.next_run_at), { addSuffix: true })}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
