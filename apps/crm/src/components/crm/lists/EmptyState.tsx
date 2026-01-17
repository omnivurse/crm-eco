'use client';

import { cn } from '@crm-eco/ui/lib/utils';
import { Button } from '@crm-eco/ui/components/button';
import {
    Package,
    FileText,
    Receipt,
    FileCheck,
    Building,
    CheckSquare,
    Activity,
    Mail,
    Phone,
    Calendar,
    MessageCircle,
    Hash,
    Webhook,
    ScrollText,
    BarChart3,
    type LucideIcon,
} from 'lucide-react';

export interface EmptyStateProps {
    icon?: LucideIcon;
    title: string;
    description: string;
    actionLabel?: string;
    actionHref?: string;
    onAction?: () => void;
    secondaryActionLabel?: string;
    secondaryActionHref?: string;
    className?: string;
}

export function EmptyState({
    icon: Icon = Package,
    title,
    description,
    actionLabel,
    actionHref,
    onAction,
    secondaryActionLabel,
    secondaryActionHref,
    className,
}: EmptyStateProps) {
    return (
        <div className={cn(
            'flex flex-col items-center justify-center py-16 px-4 text-center',
            'bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700',
            className
        )}>
            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-6">
                <Icon className="w-8 h-8 text-slate-400 dark:text-slate-500" />
            </div>

            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                {title}
            </h3>

            <p className="text-slate-500 dark:text-slate-400 max-w-md mb-6">
                {description}
            </p>

            <div className="flex items-center gap-3">
                {actionLabel && (
                    actionHref ? (
                        <Button
                            asChild
                            className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white font-medium"
                        >
                            <a href={actionHref}>{actionLabel}</a>
                        </Button>
                    ) : (
                        <Button
                            onClick={onAction}
                            className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white font-medium"
                        >
                            {actionLabel}
                        </Button>
                    )
                )}

                {secondaryActionLabel && secondaryActionHref && (
                    <Button variant="outline" asChild>
                        <a href={secondaryActionHref}>{secondaryActionLabel}</a>
                    </Button>
                )}
            </div>
        </div>
    );
}

// Pre-configured empty states for common modules
export const EMPTY_STATE_CONFIGS: Record<string, Omit<EmptyStateProps, 'className'>> = {
    accounts: {
        icon: Building,
        title: 'No accounts yet',
        description: 'Accounts help you organize contacts and deals under their parent company. Create your first account to get started.',
        actionLabel: 'Create First Account',
        actionHref: '/crm/accounts/new',
    },
    tasks: {
        icon: CheckSquare,
        title: 'No tasks yet',
        description: 'Tasks help you stay organized and never miss a follow-up. Create a task to track your to-dos.',
        actionLabel: 'Create First Task',
        actionHref: '/crm/tasks/new',
    },
    activities: {
        icon: Activity,
        title: 'No activities yet',
        description: 'Activities track all your interactions - calls, meetings, and emails - in one place.',
        actionLabel: 'Log an Activity',
        actionHref: '/crm/activities/new',
    },
    documents: {
        icon: FileText,
        title: 'No documents yet',
        description: 'Store and organize your proposals, contracts, and other files. Connect cloud storage or upload directly.',
        actionLabel: 'Upload First Document',
        actionHref: '/crm/documents/upload',
    },
    products: {
        icon: Package,
        title: 'No products yet',
        description: 'Define your products and services to quickly add them to quotes and invoices.',
        actionLabel: 'Create First Product',
        actionHref: '/crm/products/new',
    },
    quotes: {
        icon: FileCheck,
        title: 'No quotes yet',
        description: 'Create professional quotes to send to your prospects. Add products and pricing with ease.',
        actionLabel: 'Create First Quote',
        actionHref: '/crm/quotes/new',
    },
    invoices: {
        icon: Receipt,
        title: 'No invoices yet',
        description: 'Generate and send invoices directly from your CRM. Track payment status in one place.',
        actionLabel: 'Create First Invoice',
        actionHref: '/crm/invoices/new',
    },
    'integrations/email': {
        icon: Mail,
        title: 'Connect your email',
        description: 'Connect Gmail, Outlook, or SMTP to send emails directly from the CRM and sync conversations.',
        actionLabel: 'Connect Email Provider',
        actionHref: '/crm/integrations/email/connect',
    },
    'integrations/sms-voice': {
        icon: Phone,
        title: 'Connect SMS & Voice',
        description: 'Integrate with Twilio or other providers to send SMS and make calls directly from record pages.',
        actionLabel: 'Connect SMS/Voice Provider',
        actionHref: '/crm/integrations/sms-voice/connect',
    },
    'integrations/calendar': {
        icon: Calendar,
        title: 'Connect your calendar',
        description: 'Sync with Google Calendar or Outlook to see your meetings and availability in the CRM.',
        actionLabel: 'Connect Google Calendar',
        actionHref: '/crm/integrations/calendar/connect',
    },
    'integrations/whatsapp': {
        icon: MessageCircle,
        title: 'Connect WhatsApp',
        description: 'Send WhatsApp messages to your contacts using the WhatsApp Business API.',
        actionLabel: 'Connect WhatsApp Business',
        actionHref: '/crm/integrations/whatsapp/connect',
    },
    'integrations/slack': {
        icon: Hash,
        title: 'Connect Slack',
        description: 'Get notifications in Slack when deals are won, tasks are due, or new leads come in.',
        actionLabel: 'Connect Slack',
        actionHref: '/crm/integrations/slack/connect',
    },
    'integrations/webhooks': {
        icon: Webhook,
        title: 'No webhooks configured',
        description: 'Webhooks notify external systems when events happen in your CRM. Great for custom integrations.',
        actionLabel: 'Create First Webhook',
        actionHref: '/crm/integrations/webhooks/new',
    },
    'integrations/logs': {
        icon: ScrollText,
        title: 'No integration logs yet',
        description: 'Integration logs will appear here once you connect external services and start syncing data.',
        actionLabel: 'View All Integrations',
        actionHref: '/crm/integrations',
    },
    revenue: {
        icon: BarChart3,
        title: 'Revenue Overview',
        description: 'Track your revenue metrics, pipeline value, and forecasting from this dashboard.',
        actionLabel: 'View Pipeline',
        actionHref: '/crm/pipeline',
    },
};
