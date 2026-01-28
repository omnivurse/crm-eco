'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@crm-eco/lib/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Badge,
  Card,
  CardContent,
  ScrollArea,
  Label,
} from '@crm-eco/ui';
import {
  Search,
  Merge,
  Check,
  AlertTriangle,
  Loader2,
  User,
  ArrowRight,
  X,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';

interface Member {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  status: string;
  created_at: string;
  effective_date: string | null;
  plan_name: string | null;
  member_id: string | null;
}

interface MergeMembersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  profileId: string;
  preselectedMember?: Member;
  onMergeComplete?: () => void;
}

type MergeStep = 'search' | 'select' | 'preview' | 'complete';

export function MergeMembersModal({
  open,
  onOpenChange,
  organizationId,
  profileId,
  preselectedMember,
  onMergeComplete,
}: MergeMembersModalProps) {
  const [step, setStep] = useState<MergeStep>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Member[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<Member[]>([]);
  const [primaryMemberId, setPrimaryMemberId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [merging, setMerging] = useState(false);

  const supabase = createClient();

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setStep('search');
      setSearchQuery('');
      setSearchResults([]);
      setSelectedMembers(preselectedMember ? [preselectedMember] : []);
      setPrimaryMemberId(preselectedMember?.id || null);
    }
  }, [open, preselectedMember]);

  // Search for potential duplicates
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('members')
        .select('id, first_name, last_name, email, phone, status, created_at, effective_date, plan_name, member_id')
        .eq('organization_id', organizationId)
        .or(`first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      // Filter out already selected members
      const filtered = (data || []).filter(
        (m: { id: string }) => !selectedMembers.some(s => s.id === m.id)
      );
      setSearchResults(filtered as Member[]);
    } catch (error) {
      console.error('Error searching members:', error);
      toast.error('Error searching members');
    } finally {
      setLoading(false);
    }
  };

  // Add member to selection
  const addMember = (member: Member) => {
    if (selectedMembers.length >= 5) {
      toast.error('Maximum 5 members can be merged at once');
      return;
    }
    setSelectedMembers([...selectedMembers, member]);
    setSearchResults(searchResults.filter(m => m.id !== member.id));
    if (!primaryMemberId) {
      setPrimaryMemberId(member.id);
    }
  };

  // Remove member from selection
  const removeMember = (memberId: string) => {
    setSelectedMembers(selectedMembers.filter(m => m.id !== memberId));
    if (primaryMemberId === memberId) {
      const remaining = selectedMembers.filter(m => m.id !== memberId);
      setPrimaryMemberId(remaining[0]?.id || null);
    }
  };

  // Execute merge
  const executeMerge = async () => {
    if (!primaryMemberId || selectedMembers.length < 2) return;

    setMerging(true);
    try {
      const primaryMember = selectedMembers.find(m => m.id === primaryMemberId)!;
      const secondaryMembers = selectedMembers.filter(m => m.id !== primaryMemberId);

      // For each secondary member, update related records to point to primary
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      for (const secondary of secondaryMembers) {
        // Update dependents
        await sb
          .from('dependents')
          .update({ member_id: primaryMemberId })
          .eq('member_id', secondary.id);

        // Update billing transactions
        await sb
          .from('billing_transactions')
          .update({ member_id: primaryMemberId })
          .eq('member_id', secondary.id);

        // Update enrollments
        await sb
          .from('enrollments')
          .update({ member_id: primaryMemberId })
          .eq('member_id', secondary.id);

        // Update notes/activities if they exist
        await sb
          .from('admin_activity_log')
          .update({
            entity_id: primaryMemberId,
            metadata: { merged_from: secondary.id }
          })
          .eq('entity_type', 'member')
          .eq('entity_id', secondary.id);

        // Soft delete the secondary member (or mark as merged)
        await sb
          .from('members')
          .update({
            status: 'merged',
            merged_into_id: primaryMemberId,
            merged_at: new Date().toISOString(),
          })
          .eq('id', secondary.id);
      }

      // Log the merge action
      await sb.rpc('log_admin_activity', {
        p_actor_profile_id: profileId,
        p_entity_type: 'member',
        p_entity_id: primaryMemberId,
        p_action: 'merge',
        p_metadata: {
          merged_members: secondaryMembers.map(m => ({
            id: m.id,
            name: `${m.first_name} ${m.last_name}`,
            email: m.email,
          })),
        },
      }).catch(() => {});

      setStep('complete');
      toast.success(`Successfully merged ${selectedMembers.length} members`);

      if (onMergeComplete) {
        onMergeComplete();
      }
    } catch (error: any) {
      console.error('Error merging members:', error);
      toast.error(error.message || 'Failed to merge members');
    } finally {
      setMerging(false);
    }
  };

  const primaryMember = selectedMembers.find(m => m.id === primaryMemberId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Merge className="w-5 h-5" />
            Merge Duplicate Members
          </DialogTitle>
        </DialogHeader>

        {/* Step: Search */}
        {step === 'search' && (
          <div className="space-y-4 py-4">
            <p className="text-sm text-slate-500">
              Search for duplicate member records to merge. Select 2-5 members that represent the same person.
            </p>

            {/* Selected Members */}
            {selectedMembers.length > 0 && (
              <div className="space-y-2">
                <Label>Selected Members ({selectedMembers.length})</Label>
                <div className="space-y-2">
                  {selectedMembers.map(member => (
                    <div
                      key={member.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border ${
                        member.id === primaryMemberId
                          ? 'border-[#047474] bg-[#047474]/5'
                          : 'border-slate-200'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-sm font-medium">
                        {member.first_name[0]}{member.last_name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 truncate">
                          {member.first_name} {member.last_name}
                        </p>
                        <p className="text-xs text-slate-500 truncate">{member.email}</p>
                      </div>
                      {member.id === primaryMemberId && (
                        <Badge className="bg-[#047474]">Primary</Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeMember(member.id)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Search */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search by name, email, or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-9"
                />
              </div>
              <Button onClick={handleSearch} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
              </Button>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <ScrollArea className="h-48 border rounded-lg">
                <div className="p-2 space-y-1">
                  {searchResults.map(member => (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer"
                      onClick={() => addMember(member)}
                    >
                      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-sm font-medium">
                        {member.first_name[0]}{member.last_name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 text-sm truncate">
                          {member.first_name} {member.last_name}
                        </p>
                        <p className="text-xs text-slate-500 truncate">{member.email}</p>
                      </div>
                      <Badge variant="secondary">{member.status}</Badge>
                      <Button variant="ghost" size="sm">
                        Add
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        )}

        {/* Step: Select Primary */}
        {step === 'select' && (
          <div className="space-y-4 py-4">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-800">Choose the primary record</p>
                <p className="text-amber-700">
                  The primary record will be kept. All other records will be merged into it and marked as merged.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {selectedMembers.map(member => (
                <Card
                  key={member.id}
                  className={`cursor-pointer transition-colors ${
                    member.id === primaryMemberId
                      ? 'border-[#047474] ring-2 ring-[#047474]/20'
                      : 'hover:border-slate-300'
                  }`}
                  onClick={() => setPrimaryMemberId(member.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        member.id === primaryMemberId
                          ? 'border-[#047474] bg-[#047474]'
                          : 'border-slate-300'
                      }`}>
                        {member.id === primaryMemberId && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-slate-900">
                            {member.first_name} {member.last_name}
                          </p>
                          <Badge variant="secondary">{member.status}</Badge>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-slate-500">
                          <div>Email: {member.email}</div>
                          <div>Phone: {member.phone || '-'}</div>
                          <div>Member ID: {member.member_id || '-'}</div>
                          <div>Plan: {member.plan_name || '-'}</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Step: Preview */}
        {step === 'preview' && primaryMember && (
          <div className="space-y-4 py-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex gap-3">
              <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-blue-800">Review merge</p>
                <p className="text-blue-700">
                  {selectedMembers.length - 1} record(s) will be merged into the primary record.
                  Related data (dependents, billing, enrollments) will be transferred.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 justify-center py-4">
              <div className="text-center">
                <p className="text-xs text-slate-500 mb-2">Will be merged</p>
                <div className="flex -space-x-2">
                  {selectedMembers.filter(m => m.id !== primaryMemberId).map(member => (
                    <div
                      key={member.id}
                      className="w-10 h-10 rounded-full bg-slate-300 border-2 border-white flex items-center justify-center text-sm font-medium"
                      title={`${member.first_name} ${member.last_name}`}
                    >
                      {member.first_name[0]}{member.last_name[0]}
                    </div>
                  ))}
                </div>
              </div>

              <ArrowRight className="w-6 h-6 text-slate-400" />

              <div className="text-center">
                <p className="text-xs text-slate-500 mb-2">Primary record</p>
                <div className="w-10 h-10 rounded-full bg-[#047474] flex items-center justify-center text-white font-medium">
                  {primaryMember.first_name[0]}{primaryMember.last_name[0]}
                </div>
              </div>
            </div>

            <Card>
              <CardContent className="p-4">
                <h4 className="font-medium text-slate-900 mb-2">Primary Record Details</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-slate-500">Name:</span> {primaryMember.first_name} {primaryMember.last_name}</div>
                  <div><span className="text-slate-500">Email:</span> {primaryMember.email}</div>
                  <div><span className="text-slate-500">Phone:</span> {primaryMember.phone || '-'}</div>
                  <div><span className="text-slate-500">Status:</span> {primaryMember.status}</div>
                  <div><span className="text-slate-500">Member ID:</span> {primaryMember.member_id || '-'}</div>
                  <div><span className="text-slate-500">Plan:</span> {primaryMember.plan_name || '-'}</div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step: Complete */}
        {step === 'complete' && (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Merge Complete</h3>
            <p className="text-slate-500">
              {selectedMembers.length} member records have been successfully merged.
            </p>
          </div>
        )}

        <DialogFooter>
          {step === 'search' && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => setStep('select')}
                disabled={selectedMembers.length < 2}
              >
                Continue ({selectedMembers.length} selected)
              </Button>
            </>
          )}

          {step === 'select' && (
            <>
              <Button variant="outline" onClick={() => setStep('search')}>
                Back
              </Button>
              <Button onClick={() => setStep('preview')} disabled={!primaryMemberId}>
                Preview Merge
              </Button>
            </>
          )}

          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('select')}>
                Back
              </Button>
              <Button
                onClick={executeMerge}
                disabled={merging}
                className="bg-amber-500 hover:bg-amber-600"
              >
                {merging ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Merging...
                  </>
                ) : (
                  <>
                    <Merge className="w-4 h-4 mr-2" />
                    Confirm Merge
                  </>
                )}
              </Button>
            </>
          )}

          {step === 'complete' && (
            <Button onClick={() => onOpenChange(false)}>
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
