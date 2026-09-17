'use client';

import { ArrowClockwise, Calendar, CheckCircle, CurrencyDollar, FileText, Play, Users, Warning } from '@phosphor-icons/react';
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
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@crm-eco/lib/supabase/client';
import { toast } from 'sonner';
import { format, addDays, startOfMonth, endOfMonth } from 'date-fns';
import { PageHeader } from '@/components/ui/PageHeader';

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

  // Form state
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [periodStart, setPeriodStart] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [periodEnd, setPeriodEnd] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [dueDate, setDueDate] = useState(format(addDays(endOfMonth(new Date()), 15), 'yyyy-MM-dd'));
  const [isRetro, setIsRetro] = useState(false);
  const [retroReason, setRetroReason] = useState('');
  const [taxRate, setTaxRate] = useState(0);

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
        setOrganizationId((profile as { id: string; organization_id: string }).organization_id);
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
    setProgress(15);
    setResult(null);

    try {
      const response = await fetch('/api/invoices/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'group',
          groupId: selectedGroupId,
          periodStart,
          periodEnd,
          dueDate,
          isRetro,
          retroReason,
          taxRate,
        }),
      });
      setProgress(80);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Failed to generate invoices');

      setProgress(100);
      setResult({
        total: (payload.successful ?? 0) + (payload.failed ?? 0),
        successful: payload.successful ?? 0,
        failed: payload.failed ?? 0,
        totalAmount: payload.totalAmount ?? 0,
      });

      toast.success(`Generated ${payload.successful ?? 0} invoices`);
    } catch (error) {
      console.error('Error generating invoices:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate invoices');
    } finally {
      setGenerating(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/invoices"
        backLabel="Invoices"
        title="Generate group invoices"
        description="Generate invoices for all members in an invoice group"
      />

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
                  <Users weight="light" className="h-10 w-10 text-slate-200 mx-auto mb-2" />
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Due Date</Label>
                  <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Sales tax %</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={taxRate}
                    onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                  />
                </div>
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
                      <Warning weight="light" className="h-3 w-3 mr-1" />
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
                  <CheckCircle weight="light" className="h-5 w-5 text-emerald-600" />
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
                  <ArrowClockwise weight="light" className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Play weight="light" className="h-4 w-4 mr-2" />
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
