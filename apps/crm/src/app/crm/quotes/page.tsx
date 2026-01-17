import { FileCheck } from 'lucide-react';
import { EmptyState } from '@/components/crm/lists';

export default function QuotesPage() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Quotes</h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        Create and send professional quotes to your prospects
                    </p>
                </div>
            </div>

            <EmptyState
                icon={FileCheck}
                title="No quotes yet"
                description="Create professional quotes to send to your prospects. Add products, apply discounts, and track acceptance."
                actionLabel="Create First Quote"
                actionHref="/crm/quotes/new"
            />
        </div>
    );
}
