import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { getCurrentProfile } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { SalesReportClient } from './client';

// Types
interface DealData {
  id: string;
  title: string;
  stage: string;
  data: { amount?: number; close_date?: string } | null;
  created_at: string;
  updated_at: string;
}

interface SalesStats {
  totalRevenue: number;
  closedDeals: number;
  avgDealSize: number;
  winRate: number;
  pipelineValue: number;
  activeDeals: number;
}

interface MonthlyData {
  month: string;
  closed: number;
  pipeline: number;
}

// Server-side data calculation
function calculateStats(deals: DealData[]): SalesStats {
  const closedWon = deals.filter(d => d.stage === 'Closed Won');
  const closedLost = deals.filter(d => d.stage === 'Closed Lost');
  const active = deals.filter(d => d.stage !== 'Closed Won' && d.stage !== 'Closed Lost');

  const totalRevenue = closedWon.reduce((sum, d) => sum + (d.data?.amount || 0), 0);
  const pipelineValue = active.reduce((sum, d) => sum + (d.data?.amount || 0), 0);
  const avgDealSize = closedWon.length > 0 ? totalRevenue / closedWon.length : 0;
  const totalClosed = closedWon.length + closedLost.length;
  const winRate = totalClosed > 0 ? Math.round((closedWon.length / totalClosed) * 100) : 0;

  return {
    totalRevenue,
    closedDeals: closedWon.length,
    avgDealSize,
    winRate,
    pipelineValue,
    activeDeals: active.length,
  };
}

function calculateMonthlyData(deals: DealData[]): MonthlyData[] {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  const currentMonth = new Date().getMonth();

  return months.map((month, index) => {
    const monthDeals = deals.filter(d => {
      const date = new Date(d.created_at);
      return date.getMonth() === (currentMonth - 5 + index + 12) % 12;
    });

    return {
      month,
      closed: monthDeals.filter(d => d.stage === 'Closed Won').reduce((s, d) => s + (d.data?.amount || 0), 0),
      pipeline: monthDeals.filter(d => d.stage !== 'Closed Won' && d.stage !== 'Closed Lost').reduce((s, d) => s + (d.data?.amount || 0), 0),
    };
  });
}

export default async function SalesReportPage() {
  // Use cached profile lookup (single request, memoized)
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect('/auth/login');
  }

  const supabase = await createServerSupabaseClient();

  // Get deals module
  const { data: dealsModuleData } = await supabase
    .from('crm_modules')
    .select('id')
    .eq('org_id', profile.organization_id)
    .eq('key', 'deals')
    .single();

  const dealsModuleId = (dealsModuleData as { id: string } | null)?.id;

  // If no deals module, return empty data
  if (!dealsModuleId) {
    return (
      <SalesReportClient
        deals={[]}
        stats={{
          totalRevenue: 0,
          closedDeals: 0,
          avgDealSize: 0,
          winRate: 0,
          pipelineValue: 0,
          activeDeals: 0,
        }}
        monthlyData={[]}
      />
    );
  }

  // Fetch all deals
  const { data: dealsData } = await supabase
    .from('crm_records')
    .select('id, title, stage, data, created_at, updated_at')
    .eq('module_id', dealsModuleId)
    .order('created_at', { ascending: false });

  const deals = (dealsData || []) as unknown as DealData[];

  // Calculate data on the server
  const stats = calculateStats(deals);
  const monthlyData = calculateMonthlyData(deals);

  return (
    <SalesReportClient
      deals={deals}
      stats={stats}
      monthlyData={monthlyData}
    />
  );
}
