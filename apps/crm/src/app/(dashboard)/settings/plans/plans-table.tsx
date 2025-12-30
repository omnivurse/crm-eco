'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge } from '@crm-eco/ui';
import type { Plan } from '@crm-eco/lib/types';
import { Layers } from 'lucide-react';

interface PlansTableProps {
  plans: Plan[];
}

const tierColors: Record<string, string> = {
  bronze: 'bg-amber-100 text-amber-700',
  silver: 'bg-slate-100 text-slate-700',
  gold: 'bg-yellow-100 text-yellow-700',
  platinum: 'bg-purple-100 text-purple-700',
};

export function PlansTable({ plans }: PlansTableProps) {
  if (plans.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <Layers className="w-12 h-12 mx-auto text-slate-300 mb-3" />
        <p className="font-medium">No plans defined</p>
        <p className="text-sm text-slate-400 mt-1">
          Add your first plan to get started
        </p>
      </div>
    );
  }

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Code</TableHead>
          <TableHead>Coverage</TableHead>
          <TableHead>Tier</TableHead>
          <TableHead className="text-right">Monthly Share</TableHead>
          <TableHead className="text-right">IUA</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {plans.map((plan) => (
          <TableRow key={plan.id}>
            <TableCell className="font-medium">{plan.name}</TableCell>
            <TableCell className="font-mono text-sm text-slate-500">
              {plan.code}
            </TableCell>
            <TableCell className="capitalize">
              {plan.coverage_category || '—'}
            </TableCell>
            <TableCell>
              {plan.tier ? (
                <Badge
                  variant="secondary"
                  className={tierColors[plan.tier.toLowerCase()] || 'bg-slate-100'}
                >
                  {plan.tier}
                </Badge>
              ) : (
                '—'
              )}
            </TableCell>
            <TableCell className="text-right">
              {formatCurrency(plan.monthly_share)}
            </TableCell>
            <TableCell className="text-right">
              {formatCurrency(plan.iua_amount)}
            </TableCell>
            <TableCell>
              <Badge variant={plan.is_active ? 'default' : 'secondary'}>
                {plan.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

