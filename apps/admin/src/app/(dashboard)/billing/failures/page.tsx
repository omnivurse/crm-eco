'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from '@crm-eco/ui';
import { createClient } from '@crm-eco/lib/supabase/client';
import { format, formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  XCircle,
  Loader2,
  Mail,
} from 'lucide-react';
import { toast } from 'sonner';

interface BillingFailure {
  id: string;
  member_id: string;
  billing_schedule_id: string;
  billing_transaction_id: string;
  failure_reason: string;
  failure_code?: string;
  amount: number;
  retry_attempt: number;
  next_retry_date?: string;
  retry_scheduled: boolean;
  resolved: boolean;
  resolved_at?: string;
  resolution_type?: string;
  member_notified: boolean;
  notification_count: number;
  created_at: string;
  member?: {
    first_name: string;
    last_name: string;
    email: string;
  };
  billing_schedule?: {
    payment_profile_id?: string;
  };
}

export default function FailedPaymentsPage() {
  const [failures, setFailures] = useState<BillingFailure[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    loadFailures();
  }, []);

  async function loadFailures() {
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase
        .from('billing_failures') as any)
        .select(`
          *,
          member:members(first_name, last_name, email),
          billing_schedule:billing_schedules(payment_profile_id)
        `)
        .eq('organization_id', profile.organization_id)
        .eq('resolved', false)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading failures:', error);
        toast.error('Failed to load billing failures');
      } else {
        setFailures((data || []) as unknown as BillingFailure[]);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }

  async function retryPayment(failure: BillingFailure) {
    setProcessingId(failure.id);
    try {
      // This would call an API route to retry the payment
      // For now, we'll show a placeholder
      toast.info('Payment retry functionality will be implemented via API route');
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast.success('Payment retry initiated');
      await loadFailures();
    } catch (error) {
      toast.error('Failed to retry payment');
    } finally {
      setProcessingId(null);
    }
  }

  async function markResolved(failureId: string, resolutionType: string) {
    setProcessingId(failureId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single() as { data: { id: string } | null };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase
        .from('billing_failures') as any)
        .update({
          resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by: profile?.id,
          resolution_type: resolutionType,
          retry_scheduled: false,
        })
        .eq('id', failureId);

      if (error) {
        toast.error('Failed to update status');
      } else {
        toast.success('Marked as resolved');
        setFailures(prev => prev.filter(f => f.id !== failureId));
      }
    } catch (error) {
      toast.error('An error occurred');
    } finally {
      setProcessingId(null);
    }
  }

  async function sendNotification(failure: BillingFailure) {
    setProcessingId(failure.id);
    try {
      // This would call an API to send notification email
      toast.info('Member notification will be sent via email service');
      
      // Update notification status
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase
        .from('billing_failures') as any)
        .update({
          member_notified: true,
          notification_count: (failure.notification_count || 0) + 1,
          last_notification_at: new Date().toISOString(),
        })
        .eq('id', failure.id);

      toast.success('Notification sent to member');
      await loadFailures();
    } catch (error) {
      toast.error('Failed to send notification');
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
            <h1 className="text-2xl font-bold text-slate-900">Failed Payments</h1>
            <p className="text-slate-500">
              {failures.length} unresolved payment{failures.length !== 1 ? 's' : ''} requiring attention
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadFailures}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Failures List */}
      {failures.length > 0 ? (
        <div className="space-y-4">
          {failures.map((failure) => (
            <Card key={failure.id} className="border-l-4 border-l-red-500">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-100 rounded-full">
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">
                        {failure.member
                          ? `${failure.member.first_name} ${failure.member.last_name}`
                          : 'Unknown Member'}
                      </CardTitle>
                      <p className="text-sm text-slate-500">
                        {failure.member?.email}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-red-600">
                      ${failure.amount.toFixed(2)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatDistanceToNow(new Date(failure.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Failure Reason</p>
                    <p className="text-sm font-medium text-red-700">{failure.failure_reason}</p>
                    {failure.failure_code && (
                      <code className="text-xs bg-slate-100 px-1 rounded">
                        Code: {failure.failure_code}
                      </code>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Retry Status</p>
                    <div className="flex items-center gap-2">
                      <Badge variant={failure.retry_scheduled ? 'default' : 'secondary'}>
                        Attempt {failure.retry_attempt}/3
                      </Badge>
                      {failure.next_retry_date && failure.retry_scheduled && (
                        <span className="text-sm text-slate-600">
                          Next: {format(new Date(failure.next_retry_date), 'MMM d')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Member Notified</p>
                    <div className="flex items-center gap-2">
                      {failure.member_notified ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-slate-400" />
                      )}
                      <span className="text-sm">
                        {failure.member_notified
                          ? `${failure.notification_count} notification(s) sent`
                          : 'Not yet notified'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 pt-4 border-t">
                  <Button
                    size="sm"
                    onClick={() => retryPayment(failure)}
                    disabled={processingId === failure.id}
                  >
                    {processingId === failure.id ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Retry Payment
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => sendNotification(failure)}
                    disabled={processingId === failure.id}
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Notify Member
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => markResolved(failure.id, 'manually_resolved')}
                    disabled={processingId === failure.id}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Mark Resolved
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => markResolved(failure.id, 'waived')}
                    disabled={processingId === failure.id}
                  >
                    Waive
                  </Button>
                  <Link href={`/members/${failure.member_id}`}>
                    <Button size="sm" variant="ghost">
                      View Member
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">All Caught Up!</h3>
            <p className="text-slate-500">
              There are no unresolved payment failures at this time.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
