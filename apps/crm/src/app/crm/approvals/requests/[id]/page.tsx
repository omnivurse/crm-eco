'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Badge,
  Textarea,
  Separator,
} from '@crm-eco/ui';
import {
  ArrowLeft,
  Check,
  X,
  MessageSquare,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  User,
  ArrowRight,
  FileText,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import type { ApprovalDetailData, CrmApprovalAction, ApprovalStatus, ApprovalStep } from '@/lib/approvals/types';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ApprovalDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  
  const [approval, setApproval] = useState<ApprovalDetailData | null>(null);
  const [history, setHistory] = useState<CrmApprovalAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadApproval();
  }, [id]);

  async function loadApproval() {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/approvals?approvalId=${id}`);
      const data = await response.json();
      
      if (!response.ok) {
        setError(data.error || 'Failed to load approval');
        return;
      }
      
      setApproval(data.approval);
      setHistory(data.history || []);
    } catch (err) {
      setError('Failed to load approval');
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(action: 'approve' | 'reject' | 'request_changes') {
    if (!approval) return;
    
    if (action !== 'approve' && !comment.trim()) {
      alert('Please provide a comment');
      return;
    }
    
    setProcessing(true);
    
    try {
      const response = await fetch('/api/approvals/act', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approvalId: approval.id,
          action,
          comment: comment || undefined,
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Reload approval
        await loadApproval();
        setComment('');
      } else {
        alert(result.error || 'Failed to process approval');
      }
    } catch (err) {
      alert('Failed to process approval');
    } finally {
      setProcessing(false);
    }
  }

  async function handleCancel() {
    if (!approval) return;
    
    if (!confirm('Are you sure you want to cancel this approval request?')) return;
    
    setProcessing(true);
    
    try {
      const response = await fetch('/api/approvals/act', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approvalId: approval.id,
          action: 'cancel',
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        router.push('/crm/approvals');
      } else {
        alert(result.error || 'Failed to cancel approval');
      }
    } catch (err) {
      alert('Failed to cancel approval');
    } finally {
      setProcessing(false);
    }
  }

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

  const getStepTypeLabel = (step: ApprovalStep) => {
    switch (step.type) {
      case 'role':
        return `Role: ${step.value}`;
      case 'user':
        return 'Specific User';
      case 'manager':
        return 'Manager';
      case 'record_owner':
        return 'Record Owner';
      default:
        return step.type;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !approval) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <XCircle className="h-12 w-12 text-red-500 mb-4" />
            <p className="text-lg font-medium">{error || 'Approval not found'}</p>
            <Button variant="outline" className="mt-4" onClick={() => router.push('/crm/approvals')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Approvals
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const steps = approval.process_steps || [];
  const isPending = approval.status === 'pending';

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push('/crm/approvals')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{approval.record_title}</h1>
            <p className="text-muted-foreground">
              {approval.process_name} • {approval.module_name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge(approval.status)}
          <Link href={`/crm/r/${approval.record_id}`}>
            <Button variant="outline" size="sm">
              <ExternalLink className="w-4 h-4 mr-2" />
              View Record
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Action Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Requested Action</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{approval.context.action_type}</Badge>
                  {approval.context.stage_from && approval.context.stage_to && (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{approval.context.stage_from}</Badge>
                      <ArrowRight className="h-4 w-4" />
                      <Badge variant="outline">{approval.context.stage_to}</Badge>
                    </div>
                  )}
                </div>
                
                {approval.requested_by_name && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="h-4 w-4" />
                    Requested by {approval.requested_by_name}
                    <span>•</span>
                    {new Date(approval.created_at).toLocaleString()}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Entity Snapshot */}
          {approval.entity_snapshot && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Record Snapshot
                </CardTitle>
                <CardDescription>Data at time of request</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <pre className="text-sm overflow-auto max-h-64">
                    {JSON.stringify(approval.entity_snapshot, null, 2)}
                  </pre>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Approval History */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Approval History</CardTitle>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="text-muted-foreground text-sm">No actions taken yet</p>
              ) : (
                <div className="space-y-4">
                  {history.map((action, index) => (
                    <div key={action.id} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          action.action === 'approve' ? 'bg-green-100 text-green-600' :
                          action.action === 'reject' ? 'bg-red-100 text-red-600' :
                          action.action === 'request_changes' ? 'bg-yellow-100 text-yellow-600' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {action.action === 'approve' && <Check className="w-4 h-4" />}
                          {action.action === 'reject' && <X className="w-4 h-4" />}
                          {action.action === 'request_changes' && <MessageSquare className="w-4 h-4" />}
                          {!['approve', 'reject', 'request_changes'].includes(action.action) && <Clock className="w-4 h-4" />}
                        </div>
                        {index < history.length - 1 && (
                          <div className="w-0.5 h-full bg-border mt-2" />
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="font-medium capitalize">{action.action.replace('_', ' ')}</div>
                        <div className="text-sm text-muted-foreground">
                          Step {action.step_index + 1} • {new Date(action.created_at).toLocaleString()}
                        </div>
                        {action.comment && (
                          <div className="mt-2 p-3 bg-muted/50 rounded-lg text-sm">
                            {action.comment}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Action Panel (if pending) */}
          {isPending && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Take Action</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Comment</label>
                  <Textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Add a comment (required for reject/request changes)..."
                    className="mt-1"
                    rows={3}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => handleAction('approve')}
                    disabled={processing}
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    className="text-yellow-600 border-yellow-600 hover:bg-yellow-50"
                    onClick={() => handleAction('request_changes')}
                    disabled={processing || !comment.trim()}
                  >
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Request Changes
                  </Button>
                  <Button
                    variant="outline"
                    className="text-red-600 border-red-600 hover:bg-red-50"
                    onClick={() => handleAction('reject')}
                    disabled={processing || !comment.trim()}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Progress Steps */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Approval Steps</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {steps.map((step, index) => {
                  const isComplete = index < approval.current_step;
                  const isCurrent = index === approval.current_step && isPending;
                  const isPassed = approval.status === 'approved';
                  
                  return (
                    <div key={index} className="flex gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                        isComplete || (isPassed && index <= approval.current_step)
                          ? 'bg-green-500 text-white'
                          : isCurrent
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-200 text-gray-500'
                      }`}>
                        {isComplete || (isPassed && index <= approval.current_step) ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <span className="text-xs">{index + 1}</span>
                        )}
                      </div>
                      <div className={`flex-1 ${isCurrent ? 'font-medium' : ''}`}>
                        <div className="text-sm">{getStepTypeLabel(step)}</div>
                        {step.require_comment && (
                          <div className="text-xs text-muted-foreground">Comment required</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Process</span>
                <span className="font-medium">{approval.process_name}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Module</span>
                <span className="font-medium">{approval.module_name}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span className="font-medium">{new Date(approval.created_at).toLocaleDateString()}</span>
              </div>
              {approval.resolved_at && (
                <>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Resolved</span>
                    <span className="font-medium">{new Date(approval.resolved_at).toLocaleDateString()}</span>
                  </div>
                </>
              )}
              {approval.resolved_by_name && (
                <>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Resolved By</span>
                    <span className="font-medium">{approval.resolved_by_name}</span>
                  </div>
                </>
              )}
              {approval.applied_at && (
                <>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Applied</span>
                    <span className="font-medium">{new Date(approval.applied_at).toLocaleDateString()}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Cancel Button */}
          {isPending && (
            <Button
              variant="outline"
              className="w-full text-muted-foreground"
              onClick={handleCancel}
              disabled={processing}
            >
              Cancel Request
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
