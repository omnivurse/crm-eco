'use client';

import { useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Badge,
  Textarea,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Checkbox,
} from '@crm-eco/ui';
import {
  ClipboardCheck,
  Check,
  X,
  MessageSquare,
  ArrowRight,
  ExternalLink,
  Filter,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import type { ApprovalInboxItem, ApprovalStatus } from '@/lib/approvals/types';

type StatusFilter = ApprovalStatus | 'all';

export default function ApprovalsPage() {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  
  const [inbox, setInbox] = useState<ApprovalInboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [assignedToMe, setAssignedToMe] = useState(true);
  const [requestedByMe, setRequestedByMe] = useState(false);
  
  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  
  // Action dialog state
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState<ApprovalInboxItem | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'request_changes'>('approve');
  const [comment, setComment] = useState('');

  // Load inbox
  const loadInbox = useCallback(async () => {
    setLoading(true);
    
    try {
      const params = new URLSearchParams({
        inbox: 'true',
        assignedToMe: assignedToMe.toString(),
        requestedByMe: requestedByMe.toString(),
      });
      
      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }
      if (entityFilter !== 'all') {
        params.set('entityType', entityFilter);
      }
      
      const response = await fetch(`/api/approvals?${params}`);
      const data = await response.json();
      
      setInbox(data.inbox || []);
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Failed to load approvals:', error);
      toast.error('Failed to load approvals');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, entityFilter, assignedToMe, requestedByMe]);

  useEffect(() => {
    loadInbox();
  }, [loadInbox]);

  const handleAction = async () => {
    if (!selectedApproval) return;
    
    setProcessing(selectedApproval.id);
    
    try {
      const response = await fetch('/api/approvals/act', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approvalId: selectedApproval.id,
          action: actionType,
          comment: comment || undefined,
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast.success(`Request ${actionType === 'approve' ? 'approved' : actionType === 'reject' ? 'rejected' : 'updated'} successfully`);
        // Reload inbox
        await loadInbox();
        setActionDialogOpen(false);
        setSelectedApproval(null);
        setComment('');
      } else {
        toast.error(result.error || 'Failed to process approval');
      }
    } catch (error) {
      console.error('Failed to process approval:', error);
      toast.error('Failed to process approval');
    } finally {
      setProcessing(null);
    }
  };

  const handleBulkAction = async (action: 'approve' | 'reject') => {
    if (selectedIds.size === 0) return;
    
    setBulkProcessing(true);
    
    try {
      const promises = Array.from(selectedIds).map(id =>
        fetch('/api/approvals/act', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            approvalId: id,
            action,
          }),
        })
      );
      
      await Promise.all(promises);
      toast.success(`${selectedIds.size} approvals ${action === 'approve' ? 'approved' : 'rejected'} successfully`);
      await loadInbox();
    } catch (error) {
      console.error('Bulk action failed:', error);
      toast.error('Some actions failed');
    } finally {
      setBulkProcessing(false);
    }
  };

  const openActionDialog = (approval: ApprovalInboxItem, action: 'approve' | 'reject' | 'request_changes') => {
    setSelectedApproval(approval);
    setActionType(action);
    setComment('');
    setActionDialogOpen(true);
  };

  const getActionTitle = () => {
    switch (actionType) {
      case 'approve': return 'Approve Request';
      case 'reject': return 'Reject Request';
      case 'request_changes': return 'Request Changes';
    }
  };

  const getStatusBadge = (status: ApprovalStatus) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-yellow-600 border-yellow-600"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'approved':
        return <Badge variant="outline" className="text-green-600 border-green-600"><CheckCircle2 className="w-3 h-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="text-red-600 border-red-600"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      case 'changes_requested':
        return <Badge variant="outline" className="text-orange-600 border-orange-600"><AlertCircle className="w-3 h-3 mr-1" />Changes Requested</Badge>;
      case 'cancelled':
        return <Badge variant="secondary">Cancelled</Badge>;
      case 'expired':
        return <Badge variant="secondary">Expired</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === inbox.filter(a => a.status === 'pending').length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(inbox.filter(a => a.status === 'pending').map(a => a.id)));
    }
  };

  const moduleOptions = Array.from(new Set(inbox.map(a => a.module_key)));
  const pendingCount = inbox.filter(a => a.status === 'pending').length;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6" />
            Approvals Inbox
          </h1>
          <p className="text-muted-foreground">
            Review and manage approval requests.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <Badge variant="default" className="text-lg px-4 py-2">
              {pendingCount} pending
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={loadInbox} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="assignedToMe"
                checked={assignedToMe}
                onCheckedChange={(checked) => setAssignedToMe(!!checked)}
              />
              <label htmlFor="assignedToMe" className="text-sm">Assigned to me</label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="requestedByMe"
                checked={requestedByMe}
                onCheckedChange={(checked) => setRequestedByMe(!!checked)}
              />
              <label htmlFor="requestedByMe" className="text-sm">Requested by me</label>
            </div>
            {moduleOptions.length > 0 && (
              <Select value={entityFilter} onValueChange={setEntityFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by module" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Modules</SelectItem>
                  {moduleOptions.map(mod => (
                    <SelectItem key={mod} value={mod}>{mod}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
        <TabsList>
          <TabsTrigger value="pending">
            <Clock className="w-4 h-4 mr-2" />
            Pending
          </TabsTrigger>
          <TabsTrigger value="approved">
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Approved
          </TabsTrigger>
          <TabsTrigger value="rejected">
            <XCircle className="w-4 h-4 mr-2" />
            Rejected
          </TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>

        <TabsContent value={statusFilter} className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>
                  {statusFilter === 'all' ? 'All Approvals' : `${statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)} Approvals`}
                </CardTitle>
                <CardDescription>
                  {inbox.length} {inbox.length === 1 ? 'item' : 'items'}
                </CardDescription>
              </div>
              {statusFilter === 'pending' && selectedIds.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{selectedIds.size} selected</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-green-600"
                    onClick={() => handleBulkAction('approve')}
                    disabled={bulkProcessing}
                  >
                    <Check className="w-4 h-4 mr-1" />
                    Approve All
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600"
                    onClick={() => handleBulkAction('reject')}
                    disabled={bulkProcessing}
                  >
                    <X className="w-4 h-4 mr-1" />
                    Reject All
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : inbox.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <ClipboardCheck className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-lg font-medium">No approvals found</p>
                  <p className="text-sm">Try adjusting your filters</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      {statusFilter === 'pending' && (
                        <TableHead className="w-12">
                          <Checkbox
                            checked={selectedIds.size === inbox.filter(a => a.status === 'pending').length && inbox.filter(a => a.status === 'pending').length > 0}
                            onCheckedChange={toggleSelectAll}
                          />
                        </TableHead>
                      )}
                      <TableHead>Record</TableHead>
                      <TableHead>Process</TableHead>
                      <TableHead>Module</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Requested By</TableHead>
                      <TableHead>Step</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inbox.map((approval) => (
                      <TableRow key={approval.id}>
                        {statusFilter === 'pending' && (
                          <TableCell>
                            {approval.status === 'pending' && (
                              <Checkbox
                                checked={selectedIds.has(approval.id)}
                                onCheckedChange={() => toggleSelect(approval.id)}
                              />
                            )}
                          </TableCell>
                        )}
                        <TableCell>
                          <Link
                            href={`/crm/approvals/requests/${approval.id}`}
                            className="font-medium text-primary hover:underline flex items-center gap-1"
                          >
                            {approval.record_title}
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                          {approval.context.action_type === 'stage_transition' && (
                            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                              <Badge variant="outline" className="text-xs">
                                {approval.context.stage_from || 'New'}
                              </Badge>
                              <ArrowRight className="h-3 w-3" />
                              <Badge variant="outline" className="text-xs">
                                {approval.context.stage_to}
                              </Badge>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{approval.process_name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{approval.module_name}</Badge>
                        </TableCell>
                        <TableCell>{getStatusBadge(approval.status)}</TableCell>
                        <TableCell>{approval.requested_by_name || 'Unknown'}</TableCell>
                        <TableCell>
                          <span className="text-sm">
                            Step {approval.current_step + 1} of {approval.total_steps}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground" suppressHydrationWarning>
                            {new Date(approval.created_at).toLocaleDateString()}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            {approval.status === 'pending' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                  onClick={() => openActionDialog(approval, 'approve')}
                                  disabled={processing === approval.id}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                                  onClick={() => openActionDialog(approval, 'request_changes')}
                                  disabled={processing === approval.id}
                                >
                                  <MessageSquare className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => openActionDialog(approval, 'reject')}
                                  disabled={processing === approval.id}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => router.push(`/crm/approvals/requests/${approval.id}`)}
                            >
                              View
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {actionType === 'approve' && <Check className="h-5 w-5 text-green-500" />}
              {actionType === 'reject' && <X className="h-5 w-5 text-red-500" />}
              {actionType === 'request_changes' && <MessageSquare className="h-5 w-5 text-yellow-500" />}
              {getActionTitle()}
            </DialogTitle>
            <DialogDescription>
              {selectedApproval && (
                <>
                  <span className="font-medium">{selectedApproval.record_title}</span>
                  {' - '}
                  {selectedApproval.process_name}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Comment {actionType !== 'approve' && <span className="text-destructive">*</span>}
              </label>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={
                  actionType === 'approve'
                    ? 'Optional comment...'
                    : actionType === 'reject'
                    ? 'Reason for rejection...'
                    : 'What changes are needed...'
                }
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAction}
              disabled={processing !== null || (actionType !== 'approve' && !comment.trim())}
              className={
                actionType === 'approve'
                  ? 'bg-green-600 hover:bg-green-700'
                  : actionType === 'reject'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-yellow-600 hover:bg-yellow-700'
              }
            >
              {processing ? 'Processing...' : getActionTitle()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
