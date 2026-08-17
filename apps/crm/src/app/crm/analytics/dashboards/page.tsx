'use client';

import Link from 'next/link';
import { LayoutDashboard, Plus } from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { EmptyState } from '@/components/crm/lists';

export default function AnalyticsDashboardsPage() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Custom Dashboards</h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        Build and customize your analytics dashboards
                    </p>
                </div>
                <Button asChild>
                    <Link href="/crm/reports/new">
                        <Plus className="w-4 h-4 mr-2" />
                        New Dashboard
                    </Link>
                </Button>
            </div>

            <EmptyState
                icon={LayoutDashboard}
                title="No custom dashboards yet"
                description="Create custom dashboards with widgets, charts, and KPIs tailored to your business needs."
                actionLabel="Create First Dashboard"
                actionHref="/crm/reports/new"
            />
        </div>
    );
}
