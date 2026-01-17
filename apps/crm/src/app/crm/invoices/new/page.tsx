'use client';

import { Receipt, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@crm-eco/ui/components/button';

export default function NewInvoicePage() {
    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/crm/invoices">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">New Invoice</h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        Create a new invoice for your client
                    </p>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800/50 rounded-xl p-8 border border-slate-200 dark:border-slate-700 text-center">
                <div className="w-16 h-16 rounded-2xl bg-green-50 dark:bg-green-500/10 flex items-center justify-center mx-auto mb-6">
                    <Receipt className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                    Invoice Builder Coming Soon
                </h3>
                <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6">
                    The invoice builder will allow you to generate professional invoices, track payments, and send reminders.
                </p>
                <Link href="/crm/invoices">
                    <Button variant="outline">Back to Invoices</Button>
                </Link>
            </div>
        </div>
    );
}
