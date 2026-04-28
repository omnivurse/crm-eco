import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { getCurrentProfile } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { LeadsReportClient } from './client';

// Types
interface LeadData {
  id: string;
  title: string;
  status: string;
  data: {
    source?: string;
    lead_score?: number;
    email?: string;
    phone?: string;
    converted_at?: string;
  } | null;
  created_at: string;
  updated_at: string;
}

interface LeadStats {
  totalLeads: number;
  newLeadsThisMonth: number;
  convertedLeads: number;
  conversionRate: number;
  avgLeadScore: number;
  avgTimeToConvert: number;
}

interface SourceData {
  source: string;
  count: number;
  converted: number;
  conversionRate: number;
}

interface FunnelStage {
  stage: string;
  count: number;
  percent: number;
  color: string;
}

interface ScoreDistribution {
  range: string;
  count: number;
}

// Server-side calculations
function calculateStats(leads: LeadData[]): LeadStats {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const newThisMonth = leads.filter(l => new Date(l.created_at) >= startOfMonth);
  const converted = leads.filter(l =>
    l.status?.toLowerCase() === 'converted' || l.data?.converted_at
  );

  const scores = leads
    .map(l => l.data?.lead_score)
    .filter((s): s is number => typeof s === 'number');
  const avgScore = scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0;

  const conversionTimes = converted
    .filter(l => l.data?.converted_at)
    .map(l => {
      const created = new Date(l.created_at).getTime();
      const convertedAt = new Date(l.data!.converted_at!).getTime();
      return (convertedAt - created) / (1000 * 60 * 60 * 24);
    });
  const avgTimeToConvert = conversionTimes.length > 0
    ? Math.round(conversionTimes.reduce((a, b) => a + b, 0) / conversionTimes.length)
    : 0;

  return {
    totalLeads: leads.length,
    newLeadsThisMonth: newThisMonth.length,
    convertedLeads: converted.length,
    conversionRate: leads.length > 0 ? Math.round((converted.length / leads.length) * 100) : 0,
    avgLeadScore: avgScore,
    avgTimeToConvert,
  };
}

function calculateSourceData(leads: LeadData[]): SourceData[] {
  const sourceMap = new Map<string, { count: number; converted: number }>();

  leads.forEach(lead => {
    const source = lead.data?.source || 'Unknown';
    const existing = sourceMap.get(source) || { count: 0, converted: 0 };
    existing.count++;
    if (lead.status?.toLowerCase() === 'converted' || lead.data?.converted_at) {
      existing.converted++;
    }
    sourceMap.set(source, existing);
  });

  return Array.from(sourceMap.entries())
    .map(([source, data]) => ({
      source,
      count: data.count,
      converted: data.converted,
      conversionRate: data.count > 0 ? Math.round((data.converted / data.count) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
}

function calculateFunnelStages(leads: LeadData[]): FunnelStage[] {
  const statusCounts = new Map<string, number>();

  leads.forEach(lead => {
    const status = lead.status || 'New';
    statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
  });

  const funnelColors = [
    'bg-gradient-to-r from-blue-500 to-cyan-500',
    'bg-gradient-to-r from-violet-500 to-purple-500',
    'bg-gradient-to-r from-amber-500 to-orange-500',
    'bg-gradient-to-r from-emerald-500 to-green-500',
  ];

  const orderedStatuses = ['New', 'Contacted', 'Qualified', 'Converted'];

  return orderedStatuses.map((status, idx) => {
    const count = statusCounts.get(status) || 0;
    return {
      stage: status,
      count,
      percent: leads.length > 0 ? Math.round((count / leads.length) * 100) : 0,
      color: funnelColors[idx] || funnelColors[0],
    };
  });
}

function calculateScoreDistribution(leads: LeadData[]): ScoreDistribution[] {
  const scoreRanges = [
    { range: '0-20', min: 0, max: 20 },
    { range: '21-40', min: 21, max: 40 },
    { range: '41-60', min: 41, max: 60 },
    { range: '61-80', min: 61, max: 80 },
    { range: '81-100', min: 81, max: 100 },
  ];

  return scoreRanges.map(range => {
    const count = leads.filter(l => {
      const score = l.data?.lead_score;
      return typeof score === 'number' && score >= range.min && score <= range.max;
    }).length;
    return { range: range.range, count };
  });
}

export default async function LeadsReportPage() {
  // Use cached profile lookup (single request, memoized)
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect('/auth/login');
  }

  const supabase = await createServerSupabaseClient();

  // Get leads module
  const { data: leadsModuleData } = await supabase
    .from('crm_modules')
    .select('id')
    .eq('org_id', profile.organization_id)
    .eq('key', 'leads')
    .single();

  const leadsModuleId = (leadsModuleData as { id: string } | null)?.id;

  if (!leadsModuleId) {
    return (
      <LeadsReportClient
        leads={[]}
        stats={{
          totalLeads: 0,
          newLeadsThisMonth: 0,
          convertedLeads: 0,
          conversionRate: 0,
          avgLeadScore: 0,
          avgTimeToConvert: 0,
        }}
        sourceData={[]}
        funnelStages={[]}
        scoreDistribution={[]}
      />
    );
  }

  // Fetch leads
  const { data: leadsData } = await supabase
    .from('crm_records')
    .select('id, title, status, data, created_at, updated_at')
    .eq('org_id', profile.organization_id)
    .eq('module_id', leadsModuleId)
    .order('created_at', { ascending: false });

  const leads = (leadsData || []) as unknown as LeadData[];

  // Calculate all data on the server
  const stats = calculateStats(leads);
  const sourceData = calculateSourceData(leads);
  const funnelStages = calculateFunnelStages(leads);
  const scoreDistribution = calculateScoreDistribution(leads);

  return (
    <LeadsReportClient
      leads={leads}
      stats={stats}
      sourceData={sourceData}
      funnelStages={funnelStages}
      scoreDistribution={scoreDistribution}
    />
  );
}
