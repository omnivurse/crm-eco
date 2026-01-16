'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from '@crm-eco/ui';
import { createClient } from '@crm-eco/lib/supabase/client';
import { format } from 'date-fns';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  RefreshCw,
  Loader2,
  Pause,
  Play,
  XCircle,
  CreditCard,
  DollarSign,
} from 'lucide-react';
import { toast } from 'sonner';

interface BillingSchedule {
  id: string;
  member_id: string;
  enrollment_id: string;
  payment_profile_id?: string;
  amount: number;
  frequency: string;
  billing_day: number;
  start_date: string;
  end_date?: string;
  next_billing_date: string;
  last_billed_date?: string;
  status: string;
  pause_reason?: string;
  retry_count: number;
  max_retries: number;
  notes?: string;
  created_at: string;
  member?: {
    first_name: string;
    last_name: string;
    email: string;
  };
  payment_profile?: {
    payment_type: string;
    last_four: string;
    card_type?: string;
  };
  enrollment?: {
    plan_id: string;
  };
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'active':
      return <Badge className="bg-green-100 text-green-800">Active</Badge>;
    case 'paused':
      return <Badge className="bg-yellow-100 text-yellow-800">Paused</Badge>;
    case 'cancelled':
      return <Badge className="bg-red-100 text-red-800">Cancelled</Badge>;
    case 'completed':
      return <Badge className="bg-blue-100 text-blue-800">Completed</Badge>;
    default:
      return <Badge className="bg-gray-100 text-gray-800">{status}</Badge>;
  }
}

function getFrequencyLabel(frequency: string) {
  switch (frequency) {
    case 'monthly':
      return 'Monthly';
    case 'quarterly':
      return 'Quarterly';
    case 'annual':
      return 'Annual';
    default:
      return frequency;
  }
}

export default function BillingSchedulesPage() {
  const [schedules, setSchedules] = useState<BillingSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('active');
  const supabase = createClient();

  useEffect(() => {
    loadSchedules();
  }, [filter]);

  async function loadSchedules() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single() as { data: { organization_id: string } | null };

      if (!profile) return;

      let query = (supabase.from('billing_schedules') as any)
        .select(`
          *,
          member:members(first_name, last_name, email),
          payment_profile:payment_profiles(payment_type, last_four, card_type),
          enrollment:enrollments(plan_id)
        `)
        .eq('organization_id', profile.organization_id)
        .order('next_billing_date', { ascending: true });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query.limit(100);

      if (error) {
        console.error('Error loading schedules:', error);
        toast.error('Failed to load billing schedules');
      } else {
        setSchedules((data || []) as unknown as BillingSchedule[]);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }

  async function pauseSchedule(schedule: BillingSchedule) {
    setProcessingId(schedule.id);
    try {
      const { error } = await (supabase.from('billing_schedules') as any)
        .update({
          status: 'paused',
          paused_at: new Date().toISOString(),
        })
        .eq('id', schedule.id);

      if (error) {
        toast.error('Failed to pause schedule');
      } else {
        toast.success('Billing schedule paused');
        await loadSchedules();
      }
    } catch (error) {
      toast.error('An error occurred');
    } finally {
      setProcessingId(null);
    }
  }

  async function resumeSchedule(schedule: BillingSchedule) {
    setProcessingId(schedule.id);
    try {
      const { error } = await (supabase.from('billing_schedules') as any)
        .update({
          status: 'active',
          paused_at: null,
          pause_reason: null,
        })
        .eq('id', schedule.id);

      if (error) {
        toast.error('Failed to resume schedule');
      } else {
        toast.success('Billing schedule resumed');
        await loadSchedules();
      }
    } catch (error) {
      toast.error('An error occurred');
    } finally {
      setProcessingId(null);
    }
  }

  async function cancelSchedule(schedule: BillingSchedule) {
    if (!confirm('Are you sure you want to cancel this billing schedule?')) return;
    
    setProcessingId(schedule.id);
    try {
      const { error } = await (supabase.from('billing_schedules') as any)
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
        })
        .eq('id', schedule.id);

      if (error) {
        toast.error('Failed to cancel schedule');
      } else {
        toast.success('Billing schedule cancelled');
        await loadSchedules();
      }
    } catch (error) {
      toast.error('An error occurred');
    } finally {
      setProcessingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const totalMonthlyRevenue = schedules
    .filter(s => s.status === 'active')
    .reduce((sum, s) => {
      const monthlyAmount = s.frequency === 'monthly' ? s.amount :
        s.frequency === 'quarterly' ? s.amount / 3 :
        s.frequency === 'annual' ? s.amount / 12 : s.amount;
      return sum + monthlyAmount;
    }, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" asChild>
            <Link href="/billing">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Billing Schedules</h1>
            <p className="text-slate-500">Manage recurring billing for members</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadSchedules}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Calendar className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{schedules.filter(s => s.status === 'active').length}</p>
                <p className="text-sm text-slate-500">Active Schedules</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <DollarSign className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">${totalMonthlyRevenue.toFixed(0)}</p>
                <p className="text-sm text-slate-500">Est. Monthly Revenue</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Pause className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{schedules.filter(s => s.status === 'paused').length}</p>
                <p className="text-sm text-slate-500">Paused</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-100 rounded-lg">
                <XCircle className="h-5 w-5 text-slate-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{schedules.filter(s => s.status === 'cancelled').length}</p>
                <p className="text-sm text-slate-500">Cancelled</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {['active', 'paused', 'cancelled', 'all'].map((status) => (
          <Button
            key={status}
            variant={filter === status ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(status)}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Button>
        ))}
      </div>

      {/* Schedules Table */}
      <Card>
        <CardHeader>
          <CardTitle>Billing Schedules</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-3 font-medium text-slate-500 text-sm">Member</th>
                  <th className="pb-3 font-medium text-slate-500 text-sm">Amount</th>
                  <th className="pb-3 font-medium text-slate-500 text-sm">Frequency</th>
                  <th className="pb-3 font-medium text-slate-500 text-sm">Payment Method</th>
                  <th className="pb-3 font-medium text-slate-500 text-sm">Next Billing</th>
                  <th className="pb-3 font-medium text-slate-500 text-sm">Status</th>
                  <th className="pb-3 font-medium text-slate-500 text-sm">Actions</th>
                </tr>
              </thead>
              <tbody>
                {schedules.length > 0 ? (
                  schedules.map((schedule) => (
                    <tr key={schedule.id} className="border-b last:border-b-0 hover:bg-slate-50">
                      <td className="py-3 text-sm">
                        {schedule.member ? (
                          <div>
                            <Link
                              href={`/members/${schedule.member_id}`}
                              className="text-blue-600 hover:underline font-medium"
                            >
                              {schedule.member.first_name} {schedule.member.last_name}
                            </Link>
                            <p className="text-xs text-slate-500">{schedule.member.email}</p>
                          </div>
                        ) : (
                          <span className="text-slate-400">Unknown</span>
                        )}
                      </td>
                      <td className="py-3 text-sm">
                        <span className="font-semibold">${schedule.amount.toFixed(2)}</span>
                      </td>
                      <td className="py-3 text-sm">
                        <div>
                          <span className="font-medium">{getFrequencyLabel(schedule.frequency)}</span>
                          <p className="text-xs text-slate-500">Day {schedule.billing_day}</p>
                        </div>
                      </td>
                      <td className="py-3 text-sm">
                        {schedule.payment_profile ? (
                          <div className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4 text-slate-400" />
                            <span>
                              {schedule.payment_profile.card_type || schedule.payment_profile.payment_type}
                            </span>
                            <span className="text-slate-400">
                              •••• {schedule.payment_profile.last_four}
                            </span>
                          </div>
                        ) : (
                          <span className="text-red-500 text-xs">No payment method</span>
                        )}
                      </td>
                      <td className="py-3 text-sm">
                        {schedule.status === 'active' ? (
                          <div>
                            <p className="font-medium">
                              {format(new Date(schedule.next_billing_date), 'MMM d, yyyy')}
                            </p>
                            {schedule.last_billed_date && (
                              <p className="text-xs text-slate-500">
                                Last: {format(new Date(schedule.last_billed_date), 'MMM d')}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 text-sm">
                        {getStatusBadge(schedule.status)}
                        {schedule.retry_count > 0 && (
                          <p className="text-xs text-red-500 mt-1">
                            {schedule.retry_count}/{schedule.max_retries} retries
                          </p>
                        )}
                      </td>
                      <td className="py-3 text-sm">
                        <div className="flex gap-1">
                          {schedule.status === 'active' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => pauseSchedule(schedule)}
                              disabled={processingId === schedule.id}
                              title="Pause"
                            >
                              <Pause className="h-4 w-4" />
                            </Button>
                          )}
                          {schedule.status === 'paused' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => resumeSchedule(schedule)}
                              disabled={processingId === schedule.id}
                              title="Resume"
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                          )}
                          {['active', 'paused'].includes(schedule.status) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => cancelSchedule(schedule)}
                              disabled={processingId === schedule.id}
                              title="Cancel"
                              className="text-red-600 hover:text-red-700"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      <Calendar className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                      No billing schedules found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
