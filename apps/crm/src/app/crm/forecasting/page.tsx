'use client';

import { TrendingUp, Calendar, DollarSign, BarChart3 } from 'lucide-react';
import { EmptyState } from '@/components/crm/lists';

export default function ForecastingPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Forecasting</h1>
                <p className="text-slate-500 dark:text-slate-400">
                    Revenue projections and sales forecasts
                </p>
            </div>

            <EmptyState
                icon={TrendingUp}
                title="Forecasting Coming Soon"
                description="Revenue forecasting and predictions will be available here. Track projected revenue, compare to targets, and plan for growth."
                actionLabel="View Pipeline"
                actionHref="/crm/pipeline"
            />
        </div>
    );
}
