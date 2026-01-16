'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
import { Textarea } from '@crm-eco/ui/components/textarea';
import { Badge } from '@crm-eco/ui/components/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@crm-eco/ui/components/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@crm-eco/ui/components/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@crm-eco/ui/components/dialog';
import {
  ArrowLeft,
  HeartHandshake,
  User,
  Calendar,
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle,
  FileText,
  MessageSquare,
  History,
  Sparkles,
  Save,
  Loader2,
  Building,
  MapPin,
  Phone,
  Mail,
  Edit,
  XCircle,
} from 'lucide-react';
import { PricingEstimator } from '@/components/needs';
import type { PricingEstimate } from '@/lib/pricing/types';
import { toast } from 'sonner';

interface NeedRecord {
  id: string;
  org_id: string;
  title: string;
  status: string;
  data: {
    need_type?: string;
    description?: string;
    billed_amount?: number;
    amount_requested?: number;
    amount_approved?: number;
    urgency?: string;
    facility_type?: string;
    facility_name?: string;
    in_network?: boolean;
    incident_date?: string;
    procedure_codes?: string[];
    member_name?: string;
    member_id?: string;
    member_state?: string;
    member_email?: string;
    member_phone?: string;
    notes?: string;
    documents?: string[];
    // Pricing estimate stored
    pricing_estimate?: PricingEstimate;
  };
  created_at: string;
  updated_at: string;
}

const NEED_STATUSES = [
  { key: 'submitted', label: 'Submitted', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  { key: 'in_review', label: 'In Review', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  { key: 'pending_docs', label: 'Pending Docs', color: 'bg-violet-500/10 text-violet-400 border-violet-500/30' },
  { key: 'approved', label: 'Approved', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  { key: 'paid', label: 'Paid', color: 'bg-teal-500/10 text-teal-400 border-teal-500/30' },
  { key: 'denied', label: 'Denied', color: 'bg-red-500/10 text-red-400 border-red-500/30' },
];

const URGENCY_LEVELS = [
  { key: 'low', label: 'Low', color: 'bg-slate-500/10 text-slate-400' },
  { key: 'medium', label: 'Medium', color: 'bg-amber-500/10 text-amber-400' },
  { key: 'high', label: 'High', color: 'bg-orange-500/10 text-orange-400' },
  { key: 'urgent', label: 'Urgent', color: 'bg-red-500/10 text-red-400' },
];

export default function NeedDetailPage() {
  const router = useRouter();
  const params = useParams();
  const needId = params.id as string;

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [need, setNeed] = useState<NeedRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<NeedRecord['data']>>({});
  const [activeEstimate, setActiveEstimate] = useState<PricingEstimate | null>(null);

  const fetchNeed = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/crm-login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (!profile) return;

      // For demo, we'll use a mock need if none exists
      // In production, this would be a real database query
      const { data: needData, error } = await supabase
        .from('crm_records')
        .select('*')
        .eq('id', needId)
        .eq('org_id', profile.organization_id)
        .single();

      if (error || !needData) {
        // Demo data for showcase
        setNeed({
          id: needId,
          org_id: profile.organization_id,
          title: 'Emergency Room Visit',
          status: 'in_review',
          data: {
            need_type: 'emergency',
            description: 'Emergency room visit for acute abdominal pain. CT scan and lab work performed.',
            billed_amount: 4500,
            amount_requested: 4500,
            urgency: 'high',
            facility_type: 'hospital',
            facility_name: 'General Hospital',
            in_network: true,
            incident_date: '2026-01-08',
            procedure_codes: ['99285', '74177'],
            member_name: 'Robert Williams',
            member_id: 'MBR-001234',
            member_state: 'TX',
            member_email: 'robert.williams@email.com',
            member_phone: '(555) 123-4567',
            notes: 'Member has met their annual responsibility. Prior approval obtained.',
          },
          created_at: '2026-01-09T10:30:00Z',
          updated_at: '2026-01-10T14:20:00Z',
        });
      } else {
        setNeed(needData as NeedRecord);
      }

      if (needData?.data?.pricing_estimate) {
        setActiveEstimate(needData.data.pricing_estimate);
      }
    } catch (err) {
      console.error('Failed to fetch need:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase, needId, router]);

  useEffect(() => {
    fetchNeed();
  }, [fetchNeed]);

  const handleSave = async () => {
    if (!need) return;
    setSaving(true);

    try {
      const updatedData = { ...need.data, ...editForm };

      await supabase
        .from('crm_records')
        .update({ data: updatedData })
        .eq('id', need.id);

      setNeed({ ...need, data: updatedData });
      setEditing(false);
      toast.success('Need updated successfully');
    } catch (err) {
      console.error('Failed to save:', err);
      toast.error('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!need) return;

    try {
      await supabase
        .from('crm_records')
        .update({ status: newStatus })
        .eq('id', need.id);

      setNeed({ ...need, status: newStatus });
      toast.success(`Status updated to ${newStatus}`);
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handleEstimateGenerated = async (estimate: PricingEstimate) => {
    setActiveEstimate(estimate);

    // Save estimate to the need record
    if (need) {
      try {
        await supabase
          .from('crm_records')
          .update({
            data: {
              ...need.data,
              pricing_estimate: estimate,
            },
          })
          .eq('id', need.id);
      } catch (err) {
        console.error('Failed to save estimate:', err);
      }
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getStatusConfig = (status: string) =>
    NEED_STATUSES.find(s => s.key === status) || NEED_STATUSES[0];

  const getUrgencyConfig = (urgency: string) =>
    URGENCY_LEVELS.find(u => u.key === urgency) || URGENCY_LEVELS[0];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!need) {
    return (
      <div className="text-center py-12">
        <XCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
          Need not found
        </h3>
        <Link href="/crm/needs" className="text-teal-600 hover:underline">
          Back to Needs
        </Link>
      </div>
    );
  }

  const statusConfig = getStatusConfig(need.status);
  const urgencyConfig = getUrgencyConfig(need.data.urgency || 'medium');

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/crm/needs">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-500/10 rounded-lg">
              <HeartHandshake className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                {need.title}
              </h1>
              <p className="text-sm text-slate-500">
                {need.data.member_name} • {need.data.member_id}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={need.status} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NEED_STATUSES.map((status) => (
                <SelectItem key={status.key} value={status.key}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => setEditing(true)}>
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status & Urgency */}
          <div className="flex gap-2">
            <Badge className={`${statusConfig.color} border`}>
              {statusConfig.label}
            </Badge>
            <Badge className={urgencyConfig.color}>
              {urgencyConfig.label} Priority
            </Badge>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <DollarSign className="w-5 h-5 text-blue-500" />
                  <div>
                    <p className="text-xs text-slate-500">Billed Amount</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">
                      {formatCurrency(need.data.billed_amount || 0)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <DollarSign className="w-5 h-5 text-amber-500" />
                  <div>
                    <p className="text-xs text-slate-500">Requested</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">
                      {formatCurrency(need.data.amount_requested || 0)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-500" />
                  <div>
                    <p className="text-xs text-slate-500">Approved</p>
                    <p className="text-lg font-bold text-emerald-600">
                      {need.data.amount_approved
                        ? formatCurrency(need.data.amount_approved)
                        : 'Pending'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="details" className="w-full">
            <TabsList>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="pricing">
                <Sparkles className="w-4 h-4 mr-1" />
                AI Pricing
              </TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Description</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600 dark:text-slate-300">
                    {need.data.description || 'No description provided.'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Facility Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-600 dark:text-slate-300">
                      {need.data.facility_name || 'Not specified'}
                    </span>
                    <Badge variant="outline" className="ml-2">
                      {need.data.facility_type?.replace('_', ' ') || 'Unknown'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-600 dark:text-slate-300">
                      {need.data.member_state || 'Unknown State'}
                    </span>
                    <Badge variant={need.data.in_network ? 'default' : 'secondary'}>
                      {need.data.in_network ? 'In-Network' : 'Out-of-Network'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-600 dark:text-slate-300">
                      Incident Date: {need.data.incident_date
                        ? new Date(need.data.incident_date).toLocaleDateString()
                        : 'Not specified'}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {need.data.procedure_codes && need.data.procedure_codes.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Procedure Codes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {need.data.procedure_codes.map((code) => (
                        <Badge key={code} variant="secondary">{code}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {need.data.notes && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-slate-600 dark:text-slate-300">
                      {need.data.notes}
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="pricing">
              <PricingEstimator
                needId={need.id}
                initialData={{
                  needType: need.data.need_type || 'medical',
                  description: need.data.description || need.title,
                  procedureCodes: need.data.procedure_codes || [],
                  facilityType: need.data.facility_type as any,
                  inNetwork: need.data.in_network,
                  memberState: need.data.member_state,
                  billedAmount: need.data.billed_amount,
                  incidentDate: need.data.incident_date,
                }}
                onEstimateGenerated={handleEstimateGenerated}
              />
            </TabsContent>

            <TabsContent value="documents">
              <Card>
                <CardContent className="py-12 text-center">
                  <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">
                    No documents attached to this need.
                  </p>
                  <Button variant="outline" className="mt-4">
                    Upload Document
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history">
              <Card>
                <CardContent className="py-6">
                  <div className="space-y-4">
                    <div className="flex gap-3">
                      <div className="w-2 h-2 rounded-full bg-blue-500 mt-2" />
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                          Need submitted
                        </p>
                        <p className="text-xs text-slate-500">
                          {new Date(need.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="w-2 h-2 rounded-full bg-amber-500 mt-2" />
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                          Status changed to In Review
                        </p>
                        <p className="text-xs text-slate-500">
                          {new Date(need.updated_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Member Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="w-4 h-4" />
                Member Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  {need.data.member_name}
                </p>
                <p className="text-xs text-slate-500">{need.data.member_id}</p>
              </div>
              {need.data.member_email && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <a href={`mailto:${need.data.member_email}`} className="hover:text-teal-500">
                    {need.data.member_email}
                  </a>
                </div>
              )}
              {need.data.member_phone && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <a href={`tel:${need.data.member_phone}`} className="hover:text-teal-500">
                    {need.data.member_phone}
                  </a>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <MapPin className="w-4 h-4 text-slate-400" />
                {need.data.member_state || 'Unknown'}
              </div>
            </CardContent>
          </Card>

          {/* Quick Estimate Summary */}
          {activeEstimate && (
            <Card className="border-violet-200 dark:border-violet-800">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-violet-500" />
                  AI Estimate
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-center p-3 bg-violet-50 dark:bg-violet-900/20 rounded-lg">
                  <p className="text-xs text-violet-600 dark:text-violet-400">Expected Cost</p>
                  <p className="text-2xl font-bold text-violet-600 dark:text-violet-400">
                    {formatCurrency(activeEstimate.avgEstimate)}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-center p-2 bg-slate-50 dark:bg-slate-800/50 rounded">
                    <p className="text-xs text-slate-500">Eligible</p>
                    <p className="font-medium text-emerald-600">
                      {formatCurrency(activeEstimate.estimatedEligibleAmount)}
                    </p>
                  </div>
                  <div className="text-center p-2 bg-slate-50 dark:bg-slate-800/50 rounded">
                    <p className="text-xs text-slate-500">Member Share</p>
                    <p className="font-medium text-amber-600">
                      {formatCurrency(activeEstimate.estimatedMemberShare)}
                    </p>
                  </div>
                </div>
                <div className="text-center">
                  <Badge variant="outline">
                    {activeEstimate.confidenceScore}% confidence
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Timestamps */}
          <Card>
            <CardContent className="pt-4 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Submitted</span>
                <span className="text-slate-900 dark:text-white">
                  {new Date(need.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Last Updated</span>
                <span className="text-slate-900 dark:text-white">
                  {new Date(need.updated_at).toLocaleDateString()}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Need</DialogTitle>
            <DialogDescription>
              Update the details for this need
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={editForm.description ?? need.data.description ?? ''}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Billed Amount</Label>
                <Input
                  type="number"
                  value={editForm.billed_amount ?? need.data.billed_amount ?? ''}
                  onChange={(e) => setEditForm({ ...editForm, billed_amount: parseFloat(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Amount Approved</Label>
                <Input
                  type="number"
                  value={editForm.amount_approved ?? need.data.amount_approved ?? ''}
                  onChange={(e) => setEditForm({ ...editForm, amount_approved: parseFloat(e.target.value) })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={editForm.notes ?? need.data.notes ?? ''}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
