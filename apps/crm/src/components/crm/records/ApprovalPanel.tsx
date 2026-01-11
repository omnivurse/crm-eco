'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Textarea,
  Separator,
  Avatar,
  AvatarFallback,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@crm-eco/ui';
import {
  ClipboardCheck,
  Check,
  X,
  MessageSquare,
  Clock,
  ArrowRight,
  User,
  XCircle,
} from 'lucide-react';
import type { CrmApproval, CrmApprovalAction, ApprovalStep } from '@/lib/approvals/types';

interface ApprovalPanelProps {
  recordId: string;
  onApprovalChange?: () => void;
}

interface ApprovalWithDetails extends CrmApproval {
  process: {
    name: string;
    steps: ApprovalStep[];
  };
  requester: {
    full_name: string;
  } | null;
}

interface ActionWithActor extends CrmApprovalAction {
  actor?: {
    full_name: string;
    email: string;
  };
}

export function ApprovalPanel({ recordId, onApprovalChange }: ApprovalPanelProps) {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const [loading, setLoading] = useState(true);
  const [approval, setApproval] = useState<ApprovalWithDetails | null>(null);
  const [history, setHistory] = useState<ActionWithActor[]>([]);
  const [isApprover, setIsApprover] = useState(false);
  const [processing, setProcessing] = useState(false);
  
  // Action state
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'request_changes' | null>(null);
  const [comment, setComment] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Load approval data
  useEffect(() => {
    async function loadApproval() {
      setLoading(true);
      
      try {
        // Get approvals for this record
        const response = await fetch(`/api/approvals?recordId=${recordId}`);
        const data = await response.json();
        
        const approvals = data.approvals || [];
        const pendingApproval = approvals.find((a: ApprovalWithDetails) => a.status === 'pending');
        
        if (pendingApproval) {
          setApproval(pendingApproval);
          
          // Get history
          const historyResponse = await fetch(`/api/approvals?approvalId=${pendingApproval.id}`);
          const historyData = await historyResponse.json();
          setHistory(historyData.history || []);
          
          // Check if current user is approver
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('id, crm_role')
              .eq('user_id', user.id)
              .single();
            
            if (profile) {
              const currentStep = pendingApproval.process.steps[pendingApproval.current_step];
              if (currentStep) {
                if (currentStep.type === 'role' && currentStep.value === profile.crm_role) {
                  setIsApprover(true);
                } else if (currentStep.type === 'user' && currentStep.value === profile.id) {
                  setIsApprover(true);
                }
              }
            }
          }
        } else {
          setApproval(null);
        }
      } catch (error) {
        console.error('Failed to load approval:', error);
      } finally {
        setLoading(false);
      }
    }
    
    loadApproval();
  }, [recordId, supabase]);

  const handleAction = async () => {
    if (!approval || !actionType) return;
    
    setProcessing(true);
    setConfirmOpen(false);
    
    try {
      const response = await fetch('/api/approvals/act', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approvalId: approval.id,
          action: actionType,
          comment: comment || undefined,
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Reload approval
        onApprovalChange?.();
        
        // If approved or rejected, clear the approval
        if (result.newStatus === 'approved' || result.newStatus === 'rejected') {
          setApproval(null);
        } else {
          // Reload
          const historyResponse = await fetch(`/api/approvals?approvalId=${approval.id}`);
          const historyData = await historyResponse.json();
          setApproval(historyData.approval);
          setHistory(historyData.history || []);
        }
      } else {
        alert(result.error || 'Failed to process approval');
      }
    } catch (error) {
      alert('Failed to process approval');
    } finally {
      setProcessing(false);
      setActionType(null);
      setComment('');
    }
  };

  const openConfirm = (action: 'approve' | 'reject' | 'request_changes') => {
    setActionType(action);
    setComment('');
    setConfirmOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      pending: { variant: 'outline', label: 'Pending' },
      approved: { variant: 'default', label: 'Approved' },
      rejected: { variant: 'destructive', label: 'Rejected' },
      changes_requested: { variant: 'secondary', label: 'Changes Requested' },
      cancelled: { variant: 'secondary', label: 'Cancelled' },
    };
    const config = variants[status] || variants.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-20">
            <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!approval) {
    return null; // No pending approval
  }

  const currentStep = approval.process.steps[approval.current_step];
  const stepsTotal = approval.process.steps.length;

  return (
    <Card className="border-yellow-200 bg-yellow-50/50 dark:border-yellow-900 dark:bg-yellow-950/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-yellow-600" />
            Pending Approval
          </span>
          {getStatusBadge(approval.status)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Approval Info */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Process</span>
            <span className="font-medium">{approval.process.name}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Step</span>
            <span>
              {approval.current_step + 1} of {stepsTotal}
            </span>
          </div>
          {approval.context.action_type === 'stage_transition' && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Transition</span>
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="text-xs">
                  {approval.context.stage_from || 'New'}
                </Badge>
                <ArrowRight className="h-3 w-3" />
                <Badge variant="outline" className="text-xs">
                  {approval.context.stage_to}
                </Badge>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Requested by</span>
            <span>{approval.requester?.full_name || 'Unknown'}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Current Approver</span>
            <span className="capitalize">
              {currentStep?.type === 'role' ? currentStep.value.replace('crm_', '') : 'User'}
            </span>
          </div>
        </div>

        {/* History */}
        {history.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <h4 className="text-sm font-medium">History</h4>
              <div className="space-y-2">
                {history.map((action) => (
                  <div key={action.id} className="flex items-start gap-2 text-sm">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs">
                        {action.actor?.full_name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p>
                        <span className="font-medium">{action.actor?.full_name || 'Unknown'}</span>
                        {' '}
                        <span className="text-muted-foreground">
                          {action.action === 'approve' && 'approved'}
                          {action.action === 'reject' && 'rejected'}
                          {action.action === 'request_changes' && 'requested changes'}
                          {action.action === 'comment' && 'commented'}
                        </span>
                      </p>
                      {action.comment && (
                        <p className="text-muted-foreground mt-0.5">&quot;{action.comment}&quot;</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {new Date(action.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Actions */}
        {isApprover && (
          <>
            <Separator />
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={() => openConfirm('approve')}
                disabled={processing}
              >
                <Check className="h-4 w-4 mr-1" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => openConfirm('request_changes')}
                disabled={processing}
              >
                <MessageSquare className="h-4 w-4 mr-1" />
                Changes
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="flex-1"
                onClick={() => openConfirm('reject')}
                disabled={processing}
              >
                <X className="h-4 w-4 mr-1" />
                Reject
              </Button>
            </div>
          </>
        )}

        {!isApprover && (
          <p className="text-sm text-muted-foreground text-center py-2">
            <Clock className="h-4 w-4 inline mr-1" />
            Waiting for approval
          </p>
        )}
      </CardContent>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === 'approve' && 'Approve Request'}
              {actionType === 'reject' && 'Reject Request'}
              {actionType === 'request_changes' && 'Request Changes'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionType === 'approve' && 'Are you sure you want to approve this request?'}
              {actionType === 'reject' && 'Are you sure you want to reject this request?'}
              {actionType === 'request_changes' && 'Describe the changes you need.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={actionType === 'approve' ? 'Optional comment...' : 'Required comment...'}
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAction}
              disabled={actionType !== 'approve' && !comment.trim()}
              className={
                actionType === 'approve'
                  ? 'bg-green-600 hover:bg-green-700'
                  : actionType === 'reject'
                  ? 'bg-red-600 hover:bg-red-700'
                  : ''
              }
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
