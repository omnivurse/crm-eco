'use client';

import { Button } from '@crm-eco/ui';
import { Merge } from 'lucide-react';

interface MergeMembersSectionProps {
  organizationId: string;
  profileId: string;
  member: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    status: string;
    created_at: string;
    effective_date: string | null;
    plan_name: string | null;
    member_number: string | null;
  };
}

/**
 * Merge is intentionally DISABLED here until the atomic `merge_members_tx` RPC
 * lands. 30 tables FK to members.id; the previous client-side modal repointed
 * only a few of them and never recalculated billing (review blocker B1 —
 * silent billing drift + split records + double-billing risk). Rather than wire
 * an unsafe merge, we show a disabled control until the transactional,
 * recalc-correct server path exists.
 */
export function MergeMembersSection(_props: MergeMembersSectionProps) {
  return (
    <div className="flex items-center gap-3">
      <Button type="button" variant="outline" className="gap-2" disabled>
        <Merge className="h-4 w-4" />
        Merge duplicate members
      </Button>
      <span className="text-xs text-slate-500">
        Coming soon — safe, transactional merge is in progress.
      </span>
    </div>
  );
}
