'use client';

import { Package } from 'lucide-react';
import { EmptyState } from '@/components/crm/lists';

export default function ProductsPage() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Products</h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        Define your products and services for quotes and invoices
                    </p>
                </div>
            </div>

            <EmptyState
                icon={Package}
                title="No products yet"
                description="Define your products and services to quickly add them to quotes and invoices. Set pricing, descriptions, and SKUs."
                actionLabel="Create First Product"
                actionHref="/crm/products/new"
                secondaryActionLabel="Import Products"
                secondaryActionHref="/crm/imports?module=products"
            />
        </div>
    );
}
