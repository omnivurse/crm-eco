'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import { cn } from '@crm-eco/ui/lib/utils';
import {
  Mail,
  ArrowLeft,
  ArrowRight,
  Check,
  Users,
  Edit3,
  Send,
  Calendar,
  Clock,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { CampaignComposer } from '@/components/campaigns/CampaignComposer';
import { RecipientSelector } from '@/components/campaigns/RecipientSelector';
import { toast } from 'sonner';

// ============================================================================
// Types
// ============================================================================

interface Recipient {
  record_id: string;
  module_key: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
}

interface SenderAddress {
  id: string;
  email: string;
  name: string | null;
  is_default: boolean;
}

// ============================================================================
// Step Components
// ============================================================================

function StepIndicator({ currentStep }: { currentStep: number }) {
  const steps = [
    { number: 1, label: 'Details', icon: Edit3 },
    { number: 2, label: 'Content', icon: Mail },
    { number: 3, label: 'Recipients', icon: Users },
    { number: 4, label: 'Review', icon: Check },
  ];

  return (
    <div className="flex items-center justify-center mb-8">
      {steps.map((step, index) => {
        const Icon = step.icon;
        const isActive = currentStep === step.number;
        const isCompleted = currentStep > step.number;

        return (
          <div key={step.number} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center transition-all',
                  isCompleted
                    ? 'bg-teal-500 text-white'
                    : isActive
                      ? 'bg-teal-100 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400 ring-2 ring-teal-500'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                )}
              >
                {isCompleted ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <Icon className="w-5 h-5" />
                )}
              </div>
              <span
                className={cn(
                  'text-xs mt-1.5 font-medium',
                  isActive
                    ? 'text-teal-600 dark:text-teal-400'
                    : 'text-slate-500 dark:text-slate-400'
                )}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  'w-16 h-0.5 mx-2 -mt-4',
                  isCompleted ? 'bg-teal-500' : 'bg-slate-200 dark:bg-slate-700'
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default function NewCampaignPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Campaign data
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('<p>Hello {{first_name}},</p><p></p><p>Best regards</p>');
  const [fromName, setFromName] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [replyTo, setReplyTo] = useState('');
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [scheduleType, setScheduleType] = useState<'now' | 'later'>('now');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('09:00');

  // Loaded data
  const [organizationId, setOrganizationId] = useState<string>('');
  const [senderAddresses, setSenderAddresses] = useState<SenderAddress[]>([]);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Load user profile and sender addresses
  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id, full_name, email')
        .eq('user_id', user.id)
        .single();

      if (profile) {
        setOrganizationId(profile.organization_id);
        setFromName(profile.full_name || '');
        setReplyTo(profile.email || '');

        // Load sender addresses
        const { data: addresses } = await supabase
          .from('email_sender_addresses')
          .select('*')
          .eq('org_id', profile.organization_id)
          .eq('is_verified', true)
          .order('is_default', { ascending: false });

        if (addresses && addresses.length > 0) {
          setSenderAddresses(addresses);
          const defaultAddress = addresses.find(a => a.is_default) || addresses[0];
          setFromEmail(defaultAddress.email);
          if (defaultAddress.name) setFromName(defaultAddress.name);
        }
      }
    }
    loadData();
  }, [supabase]);

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return name.trim().length > 0 && fromEmail.trim().length > 0;
      case 2:
        return subject.trim().length > 0 && bodyHtml.trim().length > 0;
      case 3:
        return recipients.length > 0;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (canProceed()) {
      setCurrentStep(Math.min(currentStep + 1, 4));
    }
  };

  const handleBack = () => {
    setCurrentStep(Math.max(currentStep - 1, 1));
  };

  const handleSave = async (send: boolean = false) => {
    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!profile) throw new Error('Profile not found');

      // Calculate scheduled time
      let scheduledAt = null;
      if (scheduleType === 'later' && scheduledDate) {
        scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
      }

      // Create campaign
      const { data: campaign, error: campaignError } = await supabase
        .from('email_campaigns')
        .insert({
          org_id: organizationId,
          name,
          subject,
          body_html: bodyHtml,
          from_name: fromName || null,
          from_email: fromEmail,
          reply_to: replyTo || null,
          status: send ? (scheduledAt ? 'scheduled' : 'sending') : 'draft',
          scheduled_at: scheduledAt,
          total_recipients: recipients.length,
          created_by: profile.id,
        })
        .select()
        .single();

      if (campaignError) throw campaignError;

      // Add recipients
      if (recipients.length > 0) {
        const recipientRecords = recipients.map(r => ({
          campaign_id: campaign.id,
          record_id: r.record_id,
          module_key: r.module_key,
          email: r.email,
          first_name: r.first_name,
          last_name: r.last_name,
          status: 'pending',
        }));

        const { error: recipientsError } = await supabase
          .from('email_campaign_recipients')
          .insert(recipientRecords);

        if (recipientsError) throw recipientsError;
      }

      toast.success(
        send
          ? scheduledAt
            ? 'Campaign scheduled successfully!'
            : 'Campaign started sending!'
          : 'Campaign saved as draft!'
      );

      router.push(`/crm/campaigns/${campaign.id}`);
    } catch (error) {
      console.error('Error saving campaign:', error);
      toast.error('Failed to save campaign');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/crm/campaigns">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Create Email Campaign
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            Set up and send a mass email to your contacts
          </p>
        </div>
      </div>

      {/* Step Indicator */}
      <StepIndicator currentStep={currentStep} />

      {/* Step Content */}
      <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-6 mb-6">
        {/* Step 1: Details */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Campaign Details
            </h2>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Campaign Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., January Newsletter"
                />
                <p className="text-xs text-slate-500">
                  Internal name for your reference, not shown to recipients
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="from-name">From Name</Label>
                  <Input
                    id="from-name"
                    value={fromName}
                    onChange={(e) => setFromName(e.target.value)}
                    placeholder="Your Name or Company"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="from-email">From Email *</Label>
                  {senderAddresses.length > 0 ? (
                    <Select value={fromEmail} onValueChange={setFromEmail}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select sender email" />
                      </SelectTrigger>
                      <SelectContent>
                        {senderAddresses.map((addr) => (
                          <SelectItem key={addr.id} value={addr.email}>
                            {addr.email}
                            {addr.is_default && ' (Default)'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id="from-email"
                      type="email"
                      value={fromEmail}
                      onChange={(e) => setFromEmail(e.target.value)}
                      placeholder="sender@yourdomain.com"
                    />
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reply-to">Reply-To Email</Label>
                <Input
                  id="reply-to"
                  type="email"
                  value={replyTo}
                  onChange={(e) => setReplyTo(e.target.value)}
                  placeholder="replies@yourdomain.com"
                />
                <p className="text-xs text-slate-500">
                  Where replies will be sent (defaults to From Email if empty)
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Content */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Email Content
            </h2>
            <CampaignComposer
              subject={subject}
              bodyHtml={bodyHtml}
              onSubjectChange={setSubject}
              onBodyChange={setBodyHtml}
            />
          </div>
        )}

        {/* Step 3: Recipients */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Select Recipients
            </h2>
            <RecipientSelector
              selectedRecipients={recipients}
              onRecipientsChange={setRecipients}
              organizationId={organizationId}
            />
          </div>
        )}

        {/* Step 4: Review & Send */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Review & Send
            </h2>

            {/* Summary */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <Label className="text-slate-500">Campaign Name</Label>
                <p className="font-medium text-slate-900 dark:text-white">{name}</p>
              </div>
              <div className="space-y-2 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <Label className="text-slate-500">From</Label>
                <p className="font-medium text-slate-900 dark:text-white">
                  {fromName ? `${fromName} <${fromEmail}>` : fromEmail}
                </p>
              </div>
              <div className="space-y-2 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <Label className="text-slate-500">Subject</Label>
                <p className="font-medium text-slate-900 dark:text-white">{subject}</p>
              </div>
              <div className="space-y-2 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <Label className="text-slate-500">Recipients</Label>
                <p className="font-medium text-slate-900 dark:text-white">
                  {recipients.length} contacts
                </p>
              </div>
            </div>

            {/* Schedule Options */}
            <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-700">
              <Label className="text-sm font-medium">When to send?</Label>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setScheduleType('now')}
                  className={cn(
                    'flex-1 flex items-center gap-3 p-4 rounded-lg border-2 transition-all',
                    scheduleType === 'now'
                      ? 'border-teal-500 bg-teal-50 dark:bg-teal-500/10'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  )}
                >
                  <Send className={cn('w-5 h-5', scheduleType === 'now' ? 'text-teal-600' : 'text-slate-400')} />
                  <div className="text-left">
                    <div className={cn('font-medium', scheduleType === 'now' ? 'text-teal-700 dark:text-teal-300' : '')}>
                      Send Now
                    </div>
                    <div className="text-sm text-slate-500">Start sending immediately</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setScheduleType('later')}
                  className={cn(
                    'flex-1 flex items-center gap-3 p-4 rounded-lg border-2 transition-all',
                    scheduleType === 'later'
                      ? 'border-teal-500 bg-teal-50 dark:bg-teal-500/10'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  )}
                >
                  <Calendar className={cn('w-5 h-5', scheduleType === 'later' ? 'text-teal-600' : 'text-slate-400')} />
                  <div className="text-left">
                    <div className={cn('font-medium', scheduleType === 'later' ? 'text-teal-700 dark:text-teal-300' : '')}>
                      Schedule
                    </div>
                    <div className="text-sm text-slate-500">Pick a date and time</div>
                  </div>
                </button>
              </div>

              {scheduleType === 'later' && (
                <div className="flex gap-4 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="date">Date</Label>
                    <Input
                      id="date"
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-48"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="time">Time</Label>
                    <Input
                      id="time"
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="w-32"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Warning */}
            {recipients.length === 0 && (
              <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-500/10 rounded-lg text-amber-700 dark:text-amber-300">
                <AlertCircle className="w-5 h-5" />
                <span>No recipients selected. Go back to add recipients.</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={currentStep === 1}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>

        <div className="flex items-center gap-3">
          {currentStep === 4 && (
            <Button
              variant="outline"
              onClick={() => handleSave(false)}
              disabled={saving}
            >
              Save as Draft
            </Button>
          )}

          {currentStep < 4 ? (
            <Button
              onClick={handleNext}
              disabled={!canProceed()}
              className="gap-2"
            >
              Next
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={() => handleSave(true)}
              disabled={saving || recipients.length === 0}
              className="gap-2 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {scheduleType === 'later' ? 'Schedule Campaign' : 'Send Campaign'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
