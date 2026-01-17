import { Receipt } from 'lucide-react';
import { EmptyState } from '@/components/crm/lists';

export default function InvoicesPage() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Invoices</h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        Generate and track invoices for your clients
                    </p>
                </div>
            </div>

            <EmptyState
                icon={Receipt}
                title="No invoices yet"
                description="Generate and send invoices directly from your CRM. Track payment status, send reminders, and manage billing."
                actionLabel="Create First Invoice"
                actionHref="/crm/invoices/new"
            />
        </div>
    );
}
