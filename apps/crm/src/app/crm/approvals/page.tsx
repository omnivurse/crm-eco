'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Badge,
  Input,
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
} from '@crm-eco/ui';
import {
  ClipboardCheck,
  Check,
  X,
  MessageSquare,
  Clock,
  ArrowRight,
  ExternalLink,
  Filter,
} from 'lucide-react';
import type { PendingApproval } from '@/lib/approvals/types';

export default function ApprovalsPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const [pending, setPending] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');
  
  // Action dialog state
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState<PendingApproval | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'request_changes'>('approve');
  const [comment, setComment] = useState('');

  // Load pending approvals
  useEffect(() => {
    async function loadPending() {
      setLoading(true);
      
      try {
        const response = await fetch('/api/approvals');
        const data = await response.json();
        
        setPending(data.pending || []);
      } catch (error) {
        console.error('Failed to load approvals:', error);
      } finally {
        setLoading(false);
      }
    }
    
    loadPending();
  }, [supabase]);

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
        // Remove from list
        setPending(pending.filter(p => p.id !== selectedApproval.id));
        setActionDialogOpen(false);
        setSelectedApproval(null);
        setComment('');
      } else {
        alert(result.error || 'Failed to process approval');
      }
    } catch (error) {
      alert('Failed to process approval');
    } finally {
      setProcessing(null);
    }
  };

  const openActionDialog = (approval: PendingApproval, action: 'approve' | 'reject' | 'request_changes') => {
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

  const filteredPending = filter === 'all'
    ? pending
    : pending.filter(p => p.module_name.toLowerCase() === filter.toLowerCase());

  const moduleOptions = Array.from(new Set(pending.map(p => p.module_name)));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6" />
            My Approvals
          </h1>
          <p className="text-muted-foreground">
            Review and take action on pending approval requests.
          </p>
        </div>
        <Badge variant="outline" className="text-lg px-4 py-2">
          {pending.length} pending
        </Badge>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Pending Approvals</CardTitle>
            <CardDescription>
              These items are waiting for your approval.
            </CardDescription>
          </div>
          {moduleOptions.length > 1 && (
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by module" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modules</SelectItem>
                {moduleOptions.map(mod => (
                  <SelectItem key={mod} value={mod.toLowerCase()}>{mod}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardHeader>
        <CardContent>
          {filteredPending.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <ClipboardCheck className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">No pending approvals</p>
              <p className="text-sm">You&apos;re all caught up!</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Record</TableHead>
                  <TableHead>Process</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>Requested By</TableHead>
                  <TableHead>Step</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPending.map((approval) => (
                  <TableRow key={approval.id}>
                    <TableCell>
                      <Link
                        href={`/crm/r/${approval.record_id}`}
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
                    <TableCell>{approval.requested_by_name || 'Unknown'}</TableCell>
                    <TableCell>
                      <span className="text-sm">
                        Step {approval.current_step + 1} of {approval.total_steps}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {new Date(approval.created_at).toLocaleDateString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
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
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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
