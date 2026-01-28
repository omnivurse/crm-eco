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
} from '@crm-eco/ui';
import {
  User,
  Calendar,
  DollarSign,
  RefreshCw,
  ArrowLeft,
  FileText,
  Plus,
  Trash2,
  Search,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@crm-eco/lib/supabase/client';
import { toast } from 'sonner';
import { format, addDays, startOfMonth, endOfMonth } from 'date-fns';

interface Member {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  monthly_share: number | null;
  plan?: {
    name: string;
  } | null;
}

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export default function GenerateIndividualInvoicePage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [showMemberList, setShowMemberList] = useState(false);

  // Selected member
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  // Form state
  const [periodStart, setPeriodStart] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [periodEnd, setPeriodEnd] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [dueDate, setDueDate] = useState(format(addDays(endOfMonth(new Date()), 15), 'yyyy-MM-dd'));
  const [isRetro, setIsRetro] = useState(false);
  const [retroReason, setRetroReason] = useState('');
  const [notes, setNotes] = useState('');

  // Line items
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: '1', description: '', quantity: 1, unitPrice: 0, amount: 0 },
  ]);

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [generatedInvoice, setGeneratedInvoice] = useState<{
    id: string;
    invoice_number: string;
    total: number;
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

  const fetchMembers = async () => {
    if (!organizationId) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('members')
        .select(
          `
          id,
          first_name,
          last_name,
          email,
          monthly_share,
          plan:plans(name)
        `
        )
        .eq('organization_id', organizationId)
        .eq('status', 'active')
        .order('last_name')
        .limit(500);

      if (error) throw error;
      setMembers((data || []) as unknown as Member[]);
    } catch (error) {
      console.error('Error fetching members:', error);
      toast.error('Failed to load members');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (organizationId) {
      fetchMembers();
    }
  }, [organizationId]);

  // Filter members by search
  const filteredMembers = members.filter((m) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      m.first_name.toLowerCase().includes(query) ||
      m.last_name.toLowerCase().includes(query) ||
      m.email.toLowerCase().includes(query)
    );
  });

  const selectMember = (member: Member) => {
    setSelectedMember(member);
    setShowMemberList(false);
    setSearchQuery('');

    // Pre-fill line item with member's monthly share
    if (member.monthly_share) {
      setLineItems([
        {
          id: '1',
          description: `Monthly Share - ${member.plan?.name || 'Plan'}`,
          quantity: 1,
          unitPrice: member.monthly_share,
          amount: member.monthly_share,
        },
      ]);
    }
  };

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      { id: Date.now().toString(), description: '', quantity: 1, unitPrice: 0, amount: 0 },
    ]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length === 1) return;
    setLineItems(lineItems.filter((item) => item.id !== id));
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: string | number) => {
    setLineItems(
      lineItems.map((item) => {
        if (item.id !== id) return item;

        const updated = { ...item, [field]: value };
        if (field === 'quantity' || field === 'unitPrice') {
          updated.amount = updated.quantity * updated.unitPrice;
        }
        return updated;
      })
    );
  };

  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const total = subtotal; // No discount or tax in this simple version

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const handleGenerate = async () => {
    if (!selectedMember) {
      toast.error('Please select a member');
      return;
    }

    if (lineItems.every((item) => item.amount === 0)) {
      toast.error('Please add at least one line item');
      return;
    }

    if (isRetro && !retroReason) {
      toast.error('Please provide a reason for retroactive invoicing');
      return;
    }

    setGenerating(true);

    try {
      // Generate invoice number
      const invoiceNumber = `INV-${format(new Date(), 'yyyyMMddHHmmss')}`;

      // Create invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          organization_id: organizationId,
          invoice_number: invoiceNumber,
          member_id: selectedMember.id,
          status: 'draft',
          subtotal: subtotal,
          discount_amount: 0,
          tax_amount: 0,
          total: total,
          amount_paid: 0,
          balance_due: total,
          due_date: dueDate,
          is_retro: isRetro,
          retro_reason: isRetro ? retroReason : null,
          notes: notes || null,
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Create line items
      const lineItemsToInsert = lineItems
        .filter((item) => item.amount > 0)
        .map((item) => ({
          invoice_id: invoice.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          amount: item.amount,
        }));

      if (lineItemsToInsert.length > 0) {
        const { error: itemsError } = await supabase.from('invoice_line_items').insert(lineItemsToInsert);

        if (itemsError) throw itemsError;
      }

      // Log to audit
      await supabase.from('financial_audit_log').insert({
        organization_id: organizationId,
        action: 'invoice_created',
        entity_type: 'invoice',
        entity_id: invoice.id,
        performed_by: profileId,
        details: {
          invoice_number: invoiceNumber,
          member_id: selectedMember.id,
          member_name: `${selectedMember.first_name} ${selectedMember.last_name}`,
          total: total,
          is_retro: isRetro,
        },
      });

      setGeneratedInvoice({
        id: invoice.id,
        invoice_number: invoiceNumber,
        total: total,
      });

      toast.success('Invoice generated successfully');
    } catch (error) {
      console.error('Error generating invoice:', error);
      toast.error('Failed to generate invoice');
    } finally {
      setGenerating(false);
    }
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
          <h1 className="text-2xl font-bold">Generate Individual Invoice</h1>
          <p className="text-muted-foreground">Create an invoice for a specific member</p>
        </div>
      </div>

      {generatedInvoice ? (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <CheckCircle className="h-16 w-16 text-emerald-600 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-emerald-900 mb-2">Invoice Generated</h2>
              <p className="text-emerald-700 mb-1">
                Invoice #{generatedInvoice.invoice_number}
              </p>
              <p className="text-2xl font-bold text-emerald-900 mb-6">
                {formatCurrency(generatedInvoice.total)}
              </p>
              <div className="flex justify-center gap-3">
                <Button variant="outline" onClick={() => router.push('/invoices')}>
                  View All Invoices
                </Button>
                <Button
                  onClick={() => {
                    setGeneratedInvoice(null);
                    setSelectedMember(null);
                    setLineItems([{ id: '1', description: '', quantity: 1, unitPrice: 0, amount: 0 }]);
                    setIsRetro(false);
                    setRetroReason('');
                    setNotes('');
                  }}
                >
                  Generate Another
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Member Selection */}
            <Card>
              <CardHeader>
                <CardTitle>Member</CardTitle>
                <CardDescription>Select the member to invoice</CardDescription>
              </CardHeader>
              <CardContent>
                {selectedMember ? (
                  <div className="flex items-center justify-between p-4 bg-teal-50 border border-teal-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-teal-100 rounded-full">
                        <User className="h-5 w-5 text-teal-600" />
                      </div>
                      <div>
                        <p className="font-medium">
                          {selectedMember.first_name} {selectedMember.last_name}
                        </p>
                        <p className="text-sm text-muted-foreground">{selectedMember.email}</p>
                        {selectedMember.plan && (
                          <Badge variant="outline" className="mt-1">
                            {selectedMember.plan.name}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedMember(null)}>
                      Change
                    </Button>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search members by name or email..."
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setShowMemberList(true);
                        }}
                        onFocus={() => setShowMemberList(true)}
                        className="pl-9"
                      />
                    </div>

                    {showMemberList && (
                      <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-64 overflow-y-auto">
                        {loading ? (
                          <div className="p-4 text-center">
                            <RefreshCw className="h-5 w-5 animate-spin mx-auto" />
                          </div>
                        ) : filteredMembers.length === 0 ? (
                          <div className="p-4 text-center text-muted-foreground">No members found</div>
                        ) : (
                          filteredMembers.slice(0, 10).map((member) => (
                            <div
                              key={member.id}
                              className="p-3 hover:bg-slate-50 cursor-pointer border-b last:border-0"
                              onClick={() => selectMember(member)}
                            >
                              <p className="font-medium">
                                {member.first_name} {member.last_name}
                              </p>
                              <p className="text-sm text-muted-foreground">{member.email}</p>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Billing Period */}
            <Card>
              <CardHeader>
                <CardTitle>Billing Period</CardTitle>
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

            {/* Line Items */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Line Items</CardTitle>
                    <CardDescription>Add items to the invoice</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={addLineItem}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Item
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {lineItems.map((item, index) => (
                    <div key={item.id} className="flex gap-3 items-start">
                      <div className="flex-1">
                        <Input
                          placeholder="Description"
                          value={item.description}
                          onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                        />
                      </div>
                      <div className="w-20">
                        <Input
                          type="number"
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) => updateLineItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="w-28">
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Price"
                          value={item.unitPrice || ''}
                          onChange={(e) => updateLineItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="w-28 text-right pt-2 font-medium">{formatCurrency(item.amount)}</div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLineItem(item.id)}
                        disabled={lineItems.length === 1}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Retro Invoice */}
            <Card>
              <CardHeader>
                <CardTitle>Retroactive Invoice</CardTitle>
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
                    <Label>Reason *</Label>
                    <Textarea
                      placeholder="Explain why this retroactive invoice is being generated..."
                      value={retroReason}
                      onChange={(e) => setRetroReason(e.target.value)}
                      rows={2}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Notes */}
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Additional notes (optional)..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
              </CardContent>
            </Card>
          </div>

          {/* Summary */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Invoice Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedMember && (
                  <div className="pb-4 border-b">
                    <p className="text-sm text-muted-foreground">Bill To</p>
                    <p className="font-medium">
                      {selectedMember.first_name} {selectedMember.last_name}
                    </p>
                    <p className="text-sm">{selectedMember.email}</p>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t font-bold">
                    <span>Total</span>
                    <span className="text-lg">{formatCurrency(total)}</span>
                  </div>
                </div>

                <div className="pt-4 border-t space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Period</span>
                    <span>
                      {format(new Date(periodStart), 'MMM d')} - {format(new Date(periodEnd), 'MMM d')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Due Date</span>
                    <span>{format(new Date(dueDate), 'MMM d, yyyy')}</span>
                  </div>
                </div>

                {isRetro && (
                  <Badge variant="outline" className="w-full justify-center">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Retroactive Invoice
                  </Badge>
                )}
              </CardContent>
            </Card>

            <Button
              className="w-full"
              size="lg"
              onClick={handleGenerate}
              disabled={!selectedMember || generating || total === 0}
            >
              {generating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Generate Invoice
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
