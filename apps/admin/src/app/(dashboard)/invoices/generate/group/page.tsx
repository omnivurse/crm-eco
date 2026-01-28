'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Input,
  Label,
  Textarea,
  Progress,
} from '@crm-eco/ui';
import {
  Users,
  Calendar,
  DollarSign,
  RefreshCw,
  ArrowLeft,
  FileText,
  CheckCircle,
  AlertTriangle,
  Play,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@crm-eco/lib/supabase/client';
import { toast } from 'sonner';
import { format, addDays, startOfMonth, endOfMonth } from 'date-fns';

interface InvoiceGroup {
  id: string;
  name: string;
  description: string | null;
  group_type: string;
  billing_frequency: string;
  member_count: number;
  is_active: boolean;
  last_generated_at: string | null;
}

export default function GenerateGroupInvoicePage() {
  const [groups, setGroups] = useState<InvoiceGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);

  // Form state
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [periodStart, setPeriodStart] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [periodEnd, setPeriodEnd] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [dueDate, setDueDate] = useState(format(addDays(endOfMonth(new Date()), 15), 'yyyy-MM-dd'));
  const [isRetro, setIsRetro] = useState(false);
  const [retroReason, setRetroReason] = useState('');

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{
    total: number;
    successful: number;
    failed: number;
    totalAmount: number;
  } | null>(null);

  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    async function getOrgId() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
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

    getOrgId();
  }, [supabase]);

  const fetchGroups = async () => {
    if (!organizationId) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('invoice_groups')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('name');

      if (error && error.code !== '42P01') throw error;
      setGroups((data || []) as InvoiceGroup[]);
    } catch (error) {
      console.error('Error fetching groups:', error);
      toast.error('Failed to load invoice groups');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (organizationId) {
      fetchGroups();
    }
  }, [organizationId]);

  const selectedGroup = groups.find((g) => g.id === selectedGroupId);

  const handleGenerate = async () => {
    if (!selectedGroupId) {
      toast.error('Please select an invoice group');
      return;
    }

    if (isRetro && !retroReason) {
      toast.error('Please provide a reason for retroactive invoicing');
      return;
    }

    setGenerating(true);
    setProgress(0);
    setResult(null);

    try {
      // Create generation job
      const { data: job, error: jobError } = await supabase
        .from('invoice_generation_jobs')
        .insert({
          organization_id: organizationId,
          job_type: 'group',
          job_name: `Group Invoice - ${selectedGroup?.name} - ${periodStart}`,
          invoice_group_id: selectedGroupId,
          billing_period_start: periodStart,
          billing_period_end: periodEnd,
          due_date: dueDate,
          is_retro: isRetro,
          retro_reason: isRetro ? retroReason : null,
          status: 'processing',
          created_by: profileId,
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (jobError) throw jobError;

      setProgress(10);

      // Get group members
      const { data: members, error: membersError } = await supabase
        .from('invoice_group_members')
        .select('member_id')
        .eq('invoice_group_id', selectedGroupId);

      if (membersError && membersError.code !== '42P01') throw membersError;

      const memberIds = (members || []).map((m) => m.member_id);
      setProgress(20);

      if (memberIds.length === 0) {
        // Update job as failed
        await supabase
          .from('invoice_generation_jobs')
          .update({
            status: 'failed',
            error_message: 'No members in the invoice group',
            completed_at: new Date().toISOString(),
          })
          .eq('id', job.id);

        toast.error('No members in the selected group');
        setGenerating(false);
        return;
      }

      // Get member details and their plans
      const { data: memberDetails, error: memberError } = await supabase
        .from('members')
        .select('id, first_name, last_name, email, plan_id, monthly_share')
        .in('id', memberIds);

      if (memberError) throw memberError;

      setProgress(40);

      // Generate invoices
      let successCount = 0;
      let failCount = 0;
      let totalAmount = 0;

      for (let i = 0; i < (memberDetails || []).length; i++) {
        const member = memberDetails![i];
        setProgress(40 + Math.floor((i / memberDetails!.length) * 50));

        try {
          // Generate invoice number
          const invoiceNumber = `INV-${format(new Date(), 'yyyyMMdd')}-${String(successCount + 1).padStart(4, '0')}`;
          const invoiceTotal = member.monthly_share || 0;

          const { error: invoiceError } = await supabase.from('invoices').insert({
            organization_id: organizationId,
            invoice_number: invoiceNumber,
            member_id: member.id,
            status: 'draft',
            subtotal: invoiceTotal,
            discount_amount: 0,
            tax_amount: 0,
            total: invoiceTotal,
            amount_paid: 0,
            balance_due: invoiceTotal,
            due_date: dueDate,
            generation_job_id: job.id,
            is_retro: isRetro,
            retro_reason: isRetro ? retroReason : null,
          });

          if (invoiceError) throw invoiceError;

          successCount++;
          totalAmount += invoiceTotal;
        } catch (err) {
          console.error('Error generating invoice for member:', member.id, err);
          failCount++;
        }
      }

      setProgress(95);

      // Update job with results
      await supabase
        .from('invoice_generation_jobs')
        .update({
          status: 'completed',
          total_invoices: memberDetails!.length,
          successful_invoices: successCount,
          failed_invoices: failCount,
          total_amount: totalAmount,
          completed_at: new Date().toISOString(),
          result_details: {
            members_processed: memberDetails!.length,
          },
        })
        .eq('id', job.id);

      // Update group last generated
      await supabase
        .from('invoice_groups')
        .update({
          last_generated_at: new Date().toISOString(),
          last_generated_by: profileId,
        })
        .eq('id', selectedGroupId);

      // Log to audit
      await supabase.from('financial_audit_log').insert({
        organization_id: organizationId,
        action: 'invoice_batch_generated',
        entity_type: 'invoice_generation_job',
        entity_id: job.id,
        performed_by: profileId,
        details: {
          group_id: selectedGroupId,
          group_name: selectedGroup?.name,
          total_invoices: successCount,
          total_amount: totalAmount,
          is_retro: isRetro,
        },
      });

      setProgress(100);
      setResult({
        total: memberDetails!.length,
        successful: successCount,
        failed: failCount,
        totalAmount,
      });

      toast.success(`Generated ${successCount} invoices`);
    } catch (error) {
      console.error('Error generating invoices:', error);
      toast.error('Failed to generate invoices');
    } finally {
      setGenerating(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/invoices">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Generate Group Invoices</h1>
          <p className="text-muted-foreground">Generate invoices for all members in an invoice group</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Invoice Group</CardTitle>
              <CardDescription>Select the group to generate invoices for</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="animate-pulse h-10 bg-slate-100 rounded" />
              ) : groups.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-10 w-10 text-slate-200 mx-auto mb-2" />
                  <p className="text-muted-foreground">No invoice groups found</p>
                  <Link href="/invoices/groups">
                    <Button variant="outline" size="sm" className="mt-2">
                      Create Invoice Group
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {groups.map((group) => (
                    <div
                      key={group.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedGroupId === group.id
                          ? 'border-teal-500 bg-teal-50'
                          : 'hover:border-slate-300 hover:bg-slate-50'
                      }`}
                      onClick={() => setSelectedGroupId(group.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{group.name}</p>
                          {group.description && (
                            <p className="text-sm text-muted-foreground">{group.description}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline">{group.group_type}</Badge>
                            <Badge variant="secondary">{group.billing_frequency}</Badge>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold">{group.member_count}</p>
                          <p className="text-xs text-muted-foreground">members</p>
                        </div>
                      </div>
                      {group.last_generated_at && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Last generated: {format(new Date(group.last_generated_at), 'MMM d, yyyy')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Billing Period</CardTitle>
              <CardDescription>Set the period for invoice generation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Period Start</Label>
                  <Input
                    type="date"
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Period End</Label>
                  <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Retroactive Invoice</CardTitle>
              <CardDescription>Generate invoices for a past period</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isRetro"
                  checked={isRetro}
                  onChange={(e) => setIsRetro(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="isRetro">This is a retroactive invoice</Label>
              </div>

              {isRetro && (
                <div className="space-y-2">
                  <Label>Reason for Retroactive Invoice *</Label>
                  <Textarea
                    placeholder="Explain why this retroactive invoice is being generated..."
                    value={retroReason}
                    onChange={(e) => setRetroReason(e.target.value)}
                    rows={3}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Summary & Actions */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedGroup ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Group</span>
                    <span className="font-medium">{selectedGroup.name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Members</span>
                    <span className="font-medium">{selectedGroup.member_count}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Period</span>
                    <span className="font-medium text-sm">
                      {format(new Date(periodStart), 'MMM d')} - {format(new Date(periodEnd), 'MMM d, yyyy')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Due Date</span>
                    <span className="font-medium">{format(new Date(dueDate), 'MMM d, yyyy')}</span>
                  </div>
                  {isRetro && (
                    <Badge variant="outline" className="w-full justify-center">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Retroactive Invoice
                    </Badge>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground text-center py-4">Select an invoice group</p>
              )}
            </CardContent>
          </Card>

          {/* Progress */}
          {generating && (
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Generating invoices...</span>
                    <span className="text-sm text-muted-foreground">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Results */}
          {result && (
            <Card className="border-emerald-200 bg-emerald-50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle className="h-5 w-5 text-emerald-600" />
                  <span className="font-medium text-emerald-900">Generation Complete</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Total Invoices</span>
                    <span className="font-medium">{result.total}</span>
                  </div>
                  <div className="flex justify-between text-emerald-700">
                    <span>Successful</span>
                    <span className="font-medium">{result.successful}</span>
                  </div>
                  {result.failed > 0 && (
                    <div className="flex justify-between text-red-700">
                      <span>Failed</span>
                      <span className="font-medium">{result.failed}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t">
                    <span>Total Amount</span>
                    <span className="font-bold">{formatCurrency(result.totalAmount)}</span>
                  </div>
                </div>
                <Button className="w-full mt-4" onClick={() => router.push('/invoices')}>
                  View Invoices
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Generate Button */}
          {!result && (
            <Button
              className="w-full"
              size="lg"
              onClick={handleGenerate}
              disabled={!selectedGroupId || generating}
            >
              {generating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Generate Invoices
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
