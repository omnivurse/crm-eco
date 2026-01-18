import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button, Badge } from '@crm-eco/ui';
import { Plus, Building2, TrendingUp, RefreshCw, Activity } from 'lucide-react';
import Link from 'next/link';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { VendorTable } from '@/components/vendors/VendorTable';

interface VendorStats {
  totalVendors: number;
  activeVendors: number;
  filesInProgress: number;
  changesLast7Days: number;
}

async function getVendorsAndStats(): Promise<{ vendors: any[]; stats: VendorStats }> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { vendors: [], stats: { totalVendors: 0, activeVendors: 0, filesInProgress: 0, changesLast7Days: 0 } };

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single() as { data: { organization_id: string } | null };

  if (!profile) return { vendors: [], stats: { totalVendors: 0, activeVendors: 0, filesInProgress: 0, changesLast7Days: 0 } };

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [vendorsResult, activeResult, filesResult, changesResult] = await Promise.all([
    supabase
      .from('vendors')
      .select('*')
      .eq('org_id', profile.organization_id)
      .order('created_at', { ascending: false }),
    supabase
      .from('vendors')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', profile.organization_id)
      .eq('status', 'active'),
    supabase
      .from('vendor_files')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', profile.organization_id)
      .in('status', ['pending', 'validating', 'processing']),
    supabase
      .from('vendor_changes')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', profile.organization_id)
      .gte('detected_at', sevenDaysAgo.toISOString()),
  ]);

  const vendors = vendorsResult.data || [];

  return {
    vendors,
    stats: {
      totalVendors: vendors.length,
      activeVendors: activeResult.count || 0,
      filesInProgress: filesResult.count || 0,
      changesLast7Days: changesResult.count || 0,
    },
  };
}

// Stat Card Component
function StatCard({
  title,
  value,
  icon: Icon,
  color = 'blue',
}: {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color?: 'blue' | 'green' | 'amber' | 'red';
}) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    green: 'bg-green-50 text-green-600 border-green-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    red: 'bg-red-50 text-red-600 border-red-100',
  };

  const iconBgClasses = {
    blue: 'bg-blue-100',
    green: 'bg-green-100',
    amber: 'bg-amber-100',
    red: 'bg-red-100',
  };

  return (
    <Card className={`${colorClasses[color]} border`}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-600">{title}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
          </div>
          <div className={`p-3 rounded-xl ${iconBgClasses[color]}`}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function VendorsPage() {
  const { vendors, stats } = await getVendorsAndStats();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Vendors</h1>
          <p className="text-slate-500">Manage vendor integrations and data connections</p>
        </div>
        <Link href="/vendors/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Vendor
          </Button>
        </Link>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Vendors"
          value={stats.totalVendors}
          icon={Building2}
          color="blue"
        />
        <StatCard
          title="Active Vendors"
          value={stats.activeVendors}
          icon={TrendingUp}
          color="green"
        />
        <StatCard
          title="Files In Progress"
          value={stats.filesInProgress}
          icon={RefreshCw}
          color="amber"
        />
        <StatCard
          title="Changes (7d)"
          value={stats.changesLast7Days}
          icon={Activity}
          color="red"
        />
      </div>

      {/* Vendors Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Vendors</CardTitle>
          <CardDescription>{vendors.length} vendors found</CardDescription>
        </CardHeader>
        <CardContent>
          <VendorTable vendors={vendors} />
        </CardContent>
      </Card>
    </div>
  );
}
