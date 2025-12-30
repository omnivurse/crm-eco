import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@crm-eco/ui';
import { FileText, Calendar, Building2, AlertCircle, Target } from 'lucide-react';
import { format } from 'date-fns';
import { NeedStatusBadge } from './NeedStatusBadge';
import { NeedUrgencyIndicator } from './NeedUrgencyIndicator';
import { 
  getUrgencyDescription, 
  isTerminalNeedStatus,
  type UrgencyLight,
  type NeedStatus,
} from '@crm-eco/lib';

interface NeedStatusCardProps {
  need: {
    need_type: string;
    description: string;
    status: string;
    urgency_light: UrgencyLight | null | undefined;
    incident_date: string | null;
    facility_name: string | null;
    sla_target_date: string | null;
    target_completion_date?: string | null;
    created_at: string;
    updated_at: string;
  };
}

// Get explanatory message based on status
function getStatusExplanation(status: string): string {
  switch (status) {
    case 'new':
    case 'open':
    case 'submitted':
      return "We've received your Need and will begin reviewing it shortly.";
    case 'intake':
      return "Your Need is being processed through our intake system.";
    case 'in_review':
      return "We're reviewing this Need. If additional information is required, we'll reach out to you.";
    case 'awaiting_member_docs':
      return "We're waiting on additional documents from you. Please respond to any requests from our team.";
    case 'awaiting_provider_docs':
      return "We're waiting on records from your healthcare provider. We'll update you when received.";
    case 'pricing':
      return "We're working on pricing and negotiating with providers on your behalf.";
    case 'processing':
      return "Your Need has been approved and is being processed for sharing.";
    case 'approved':
      return "This Need has been approved for sharing. Reimbursement is being prepared.";
    case 'reimbursement_pending':
      return "Your reimbursement is being processed and will be sent to you soon.";
    case 'paid':
      return "This Need has been paid. See the reimbursement information below.";
    case 'closed':
      return "This Need has been closed. If you have questions, please contact support.";
    case 'denied':
      return "This Need was not approved for sharing. Please contact support for more information.";
    case 'cancelled':
      return "This Need was cancelled. If you have questions, please contact support.";
    default:
      return "Check back for updates on your Need status.";
  }
}

// Get terminal status message (when SLA info should be hidden)
function getTerminalStatusMessage(status: string): string | null {
  switch (status) {
    case 'paid':
      return "This Need has been successfully processed and paid. Thank you for your patience.";
    case 'closed':
      return "This Need has been closed. If you believe this was in error, please contact support.";
    case 'denied':
      return "This Need was not approved for sharing. If you'd like to discuss this decision, please contact our support team.";
    case 'cancelled':
      return "This Need was cancelled and no further action will be taken.";
    default:
      return null;
  }
}

export function NeedStatusCard({ need }: NeedStatusCardProps) {
  const isTerminal = isTerminalNeedStatus(need.status as NeedStatus);
  const terminalMessage = getTerminalStatusMessage(need.status);
  const targetDate = need.target_completion_date || need.sla_target_date;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <FileText className="w-6 h-6 text-blue-600" />
          Need Status
        </CardTitle>
        <CardDescription>
          {getStatusExplanation(need.status)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status and SLA row */}
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <p className="text-sm text-slate-500 mb-1">Status</p>
            <NeedStatusBadge status={need.status} />
          </div>
          {!isTerminal && need.urgency_light && (
            <div>
              <p className="text-sm text-slate-500 mb-1">Timeline</p>
              <NeedUrgencyIndicator urgency={need.urgency_light} showLabel={true} />
            </div>
          )}
          {!isTerminal && targetDate && (
            <div>
              <p className="text-sm text-slate-500 mb-1 flex items-center gap-1">
                <Target className="w-3 h-3" /> Target Date
              </p>
              <p className="text-sm font-medium text-slate-900">
                {format(new Date(targetDate), 'MMM d, yyyy')}
              </p>
            </div>
          )}
        </div>

        {/* SLA Description for non-terminal needs */}
        {!isTerminal && need.urgency_light && (
          <div className="p-3 bg-slate-50 rounded-lg">
            <p className="text-sm text-slate-600">
              {getUrgencyDescription(need.urgency_light)}
              {targetDate && (
                <span className="text-slate-500">
                  {' '}We aim to complete processing by {format(new Date(targetDate), 'MMMM d, yyyy')}.
                </span>
              )}
            </p>
          </div>
        )}

        {/* Terminal status message */}
        {isTerminal && terminalMessage && (
          <div className={`p-3 rounded-lg ${
            need.status === 'paid' ? 'bg-green-50 text-green-800' :
            need.status === 'denied' ? 'bg-red-50 text-red-800' :
            'bg-slate-50 text-slate-700'
          }`}>
            <p className="text-sm">{terminalMessage}</p>
          </div>
        )}

        {/* Need details grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-sm text-slate-500 mb-1 flex items-center gap-1">
              <FileText className="w-4 h-4" /> Need Type
            </p>
            <p className="font-medium text-slate-900">{need.need_type}</p>
          </div>

          {need.incident_date && (
            <div>
              <p className="text-sm text-slate-500 mb-1 flex items-center gap-1">
                <Calendar className="w-4 h-4" /> Service Date
              </p>
              <p className="font-medium text-slate-900">
                {format(new Date(need.incident_date), 'MMM d, yyyy')}
              </p>
            </div>
          )}

          {need.facility_name && (
            <div>
              <p className="text-sm text-slate-500 mb-1 flex items-center gap-1">
                <Building2 className="w-4 h-4" /> Facility / Provider
              </p>
              <p className="font-medium text-slate-900">{need.facility_name}</p>
            </div>
          )}
        </div>

        {/* Description */}
        {need.description && (
          <div>
            <p className="text-sm text-slate-500 mb-1">Description</p>
            <p className="text-slate-700 bg-slate-50 p-3 rounded-lg">
              {need.description}
            </p>
          </div>
        )}

        {/* Timestamps */}
        <div className="flex flex-wrap gap-6 text-sm text-slate-500 pt-4 border-t">
          <div>
            <span className="font-medium">Created:</span>{' '}
            {format(new Date(need.created_at), 'MMM d, yyyy h:mm a')}
          </div>
          <div>
            <span className="font-medium">Last Updated:</span>{' '}
            {format(new Date(need.updated_at), 'MMM d, yyyy h:mm a')}
          </div>
        </div>

        {/* Warning for attention-needed statuses */}
        {(need.status === 'awaiting_member_docs' || (!isTerminal && need.urgency_light === 'red')) && (
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800">Action may be required</p>
              <p className="text-sm text-amber-700">
                {need.status === 'awaiting_member_docs'
                  ? "Please check your email or messages for any document requests from our team."
                  : "This Need is past its target date. Our team is prioritizing it."}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
