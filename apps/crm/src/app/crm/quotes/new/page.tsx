'use client';

import { FileCheck, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@crm-eco/ui/components/button';

export default function NewQuotePage() {
    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/crm/quotes">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">New Quote</h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        Create a new quote for your prospect
                    </p>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800/50 rounded-xl p-8 border border-slate-200 dark:border-slate-700 text-center">
                <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center mx-auto mb-6">
                    <FileCheck className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                    Quote Builder Coming Soon
                </h3>
                <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6">
                    The quote builder will allow you to create professional quotes with products, pricing, terms, and e-signature capabilities.
                </p>
                <Link href="/crm/quotes">
                    <Button variant="outline">Back to Quotes</Button>
                </Link>
            </div>
        </div>
    );
}
