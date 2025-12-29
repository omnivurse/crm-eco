'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@crm-eco/lib/supabase/client';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  Separator,
} from '@crm-eco/ui';
import { Plus, HeartPulse, User, DollarSign, Clock } from 'lucide-react';
import type { Database } from '@crm-eco/lib/types';

type Member = Database['public']['Tables']['members']['Row'];
type NeedInsert = Database['public']['Tables']['needs']['Insert'];

// Helper to calculate SLA target date from today
function getSlaTargetDate(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().split('T')[0];
}

export function CreateNeedDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  
  const [formData, setFormData] = useState<{
    memberId: string;
    needType: string;
    description: string;
    incidentDate: string;
    totalAmount: string;
    slaPreset: string;
    slaTargetDate: string;
    status: 'open' | 'in_review' | 'processing' | 'paid' | 'closed';
  }>({
    memberId: '',
    needType: '',
    description: '',
    incidentDate: '',
    totalAmount: '',
    slaPreset: '7',
    slaTargetDate: getSlaTargetDate(7),
    status: 'open',
  });

  // Load members when dialog opens
  useEffect(() => {
    if (open) {
      loadMembers();
    }
  }, [open]);

  // Update SLA target date when preset changes
  const handleSlaPresetChange = (preset: string) => {
    let targetDate = '';
    if (preset === 'custom') {
      // Keep current custom date or set to 7 days
      targetDate = formData.slaTargetDate || getSlaTargetDate(7);
    } else {
      targetDate = getSlaTargetDate(parseInt(preset));
    }
    setFormData({ ...formData, slaPreset: preset, slaTargetDate: targetDate });
  };

  const loadMembers = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('members')
      .select('*')
      .eq('status', 'active')
      .order('last_name');
    
    if (data) {
      setMembers(data as Member[]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profileData } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      const profile = profileData as { organization_id: string } | null;
      if (!profile) throw new Error('Profile not found');

      if (!formData.memberId) {
        throw new Error('Please select a member');
      }

      // Note: urgency_light is now computed automatically by the database trigger
      // based on status and sla_target_date
      const insertData: NeedInsert = {
        organization_id: profile.organization_id,
        member_id: formData.memberId,
        need_type: formData.needType,
        description: formData.description,
        incident_date: formData.incidentDate || null,
        total_amount: parseFloat(formData.totalAmount) || 0,
        sla_target_date: formData.slaTargetDate || null,
        status: formData.status,
        // urgency_light will be set by the database trigger
      };

      const { error: insertError } = await supabase.from('needs').insert(insertData as any);

      if (insertError) throw insertError;

      setOpen(false);
      setFormData({
        memberId: '',
        needType: '',
        description: '',
        incidentDate: '',
        totalAmount: '',
        slaPreset: '7',
        slaTargetDate: getSlaTargetDate(7),
        status: 'open',
      });
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create need';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  // Calculate what urgency will be shown based on SLA
  const getPreviewUrgency = () => {
    if (!formData.slaTargetDate) return { label: 'No SLA', color: 'bg-slate-400' };
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(formData.slaTargetDate);
    target.setHours(0, 0, 0, 0);
    
    const diffDays = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 0) {
      return { label: 'Must Complete (Red)', color: 'bg-red-500' };
    } else if (diffDays <= 3) {
      return { label: 'Near Deadline (Orange)', color: 'bg-amber-500' };
    } else {
      return { label: 'On Track (Green)', color: 'bg-emerald-500' };
    }
  };

  const urgencyPreview = getPreviewUrgency();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Create Need
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HeartPulse className="w-5 h-5 text-purple-500" />
            Create Need Request
          </DialogTitle>
          <DialogDescription>
            Submit a new healthcare need for reimbursement processing
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          {error && (
            <div className="mb-4 p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
              {error}
            </div>
          )}
          
          <div className="space-y-6 py-4">
            {/* Member Selection */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <User className="w-4 h-4 text-slate-400" />
                <h3 className="text-sm font-medium text-slate-700">Member Information</h3>
              </div>
              <div className="space-y-2">
                <Label htmlFor="member">Member *</Label>
                <Select
                  value={formData.memberId}
                  onValueChange={(value) => setFormData({ ...formData, memberId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a member..." />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.first_name} {member.last_name} ({member.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Need Details */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <HeartPulse className="w-4 h-4 text-slate-400" />
                <h3 className="text-sm font-medium text-slate-700">Need Details</h3>
              </div>
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="needType">Need Type *</Label>
                    <Select
                      value={formData.needType}
                      onValueChange={(value) => setFormData({ ...formData, needType: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hospitalization">Hospitalization</SelectItem>
                        <SelectItem value="surgery">Surgery</SelectItem>
                        <SelectItem value="diagnostic">Diagnostic</SelectItem>
                        <SelectItem value="rx">Prescription (Rx)</SelectItem>
                        <SelectItem value="emergency">Emergency</SelectItem>
                        <SelectItem value="maternity">Maternity</SelectItem>
                        <SelectItem value="preventive">Preventive Care</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="incidentDate">Incident Date</Label>
                    <Input
                      id="incidentDate"
                      type="date"
                      value={formData.incidentDate}
                      onChange={(e) => setFormData({ ...formData, incidentDate: e.target.value })}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe the healthcare need and circumstances..."
                    rows={3}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Initial Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value: 'open' | 'in_review' | 'processing' | 'paid' | 'closed') => 
                      setFormData({ ...formData, status: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in_review">In Review</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

            {/* SLA Settings */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-slate-400" />
                <h3 className="text-sm font-medium text-slate-700">SLA Target</h3>
              </div>
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="slaPreset">Processing Time</Label>
                    <Select
                      value={formData.slaPreset}
                      onValueChange={handleSlaPresetChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select SLA" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">3 Days</SelectItem>
                        <SelectItem value="7">7 Days (Standard)</SelectItem>
                        <SelectItem value="14">14 Days</SelectItem>
                        <SelectItem value="30">30 Days</SelectItem>
                        <SelectItem value="custom">Custom Date</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="slaTargetDate">Target Date</Label>
                    <Input
                      id="slaTargetDate"
                      type="date"
                      value={formData.slaTargetDate}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        slaPreset: 'custom',
                        slaTargetDate: e.target.value 
                      })}
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                </div>
                
                {/* Urgency Preview */}
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <p className="text-xs text-slate-500 mb-1">Urgency will be set to:</p>
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${urgencyPreview.color}`} />
                    <span className="font-medium text-sm">{urgencyPreview.label}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Urgency is automatically calculated based on SLA target date
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Financial Details */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <DollarSign className="w-4 h-4 text-slate-400" />
                <h3 className="text-sm font-medium text-slate-700">Financial Details</h3>
              </div>
              <div className="space-y-2">
                <Label htmlFor="totalAmount">Total Amount ($) *</Label>
                <Input
                  id="totalAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.totalAmount}
                  onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })}
                  placeholder="0.00"
                  required
                />
                <p className="text-xs text-slate-400">
                  Eligible and reimbursed amounts will be calculated during review
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Need'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
