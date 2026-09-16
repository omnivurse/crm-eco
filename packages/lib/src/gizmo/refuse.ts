import type { GizmoAppId } from './types';

export interface GizmoRefuse {
  reason: 'foreign_app' | 'other_person' | 'forbidden';
  message: string;
}

const WORKSPACE_REFUSE = "That's not in this workspace.";

const CRM_FOREIGN = [
  /\bpay\s+(my\s+)?(sharing\s+)?bill\b/i,
  /\bmember\s+portal\b/i,
  /\bmy\s+needs\s+request\b/i,
  /\bhospital\s+cash\b/i,
  /\bcashpay\b/i,
  /\bmy\s+coverage\s+card\b/i,
  /\bmy\s+dependents\b/i,
];

const ADMIN_FOREIGN = [
  /\b(crm\s+)?workqueue\b/i,
  /\bcrm\s+(pipeline|contacts|leads|deals)\b/i,
  /\bcommand\s+palette\b/i,
  /\bpay\s+(my\s+)?(sharing\s+)?bill\b/i,
  /\bmember\s+portal\b/i,
];

const MEMBER_FOREIGN_APP = [
  /\b(pipeline|workqueue|leads?|deals?|crm)\b/i,
  /\bcommission\s+rates?\b/i,
  /\benroll(ment)?s?\b/i,
  /\badmin\s+(portal|console|dashboard)\b/i,
  /\bcontacts\s+(module|pipeline|list)\b/i,
];

const MEMBER_OTHER_PERSON = [
  /\b(another|other)\s+member\b/i,
  /\bfind\s+(?!my\b)[a-z][a-z'-]{1,}/i,
  /\b(look\s*up|search\s+for|open)\s+(?!my\b)[a-z][a-z'-]+\s+[a-z][a-z'-]+/i,
  /\bjane\s+doe\b/i,
  /\bwendy\b/i,
];

const ADVISOR_FOREIGN = [
  /\bpay\s+(my\s+)?(sharing\s+)?bill\b/i,
  /\badmin\s+enrollments?\b/i,
  /\bcrm\s+workqueue\b/i,
  /\bmember\s+portal\b/i,
];

export function detectForeignAsk(app: GizmoAppId, query: string): GizmoRefuse | null {
  const q = query.trim();
  if (!q) return null;

  switch (app) {
    case 'crm':
      if (CRM_FOREIGN.some((re) => re.test(q))) {
        return { reason: 'foreign_app', message: WORKSPACE_REFUSE };
      }
      return null;
    case 'admin':
      if (ADMIN_FOREIGN.some((re) => re.test(q))) {
        return { reason: 'foreign_app', message: WORKSPACE_REFUSE };
      }
      return null;
    case 'member_portal':
      if (MEMBER_OTHER_PERSON.some((re) => re.test(q))) {
        return {
          reason: 'other_person',
          message: 'I can only help with your own membership — not other members or staff tools.',
        };
      }
      if (MEMBER_FOREIGN_APP.some((re) => re.test(q))) {
        return { reason: 'foreign_app', message: WORKSPACE_REFUSE };
      }
      return null;
    case 'advisor_portal':
      if (ADVISOR_FOREIGN.some((re) => re.test(q))) {
        return { reason: 'foreign_app', message: WORKSPACE_REFUSE };
      }
      return null;
    default:
      return { reason: 'forbidden', message: WORKSPACE_REFUSE };
  }
}

export function shouldSearchRecords(app: GizmoAppId, query: string): boolean {
  if (app === 'member_portal') {
    return /\b(my\s+)?(account|profile|coverage|membership|member\s*#)\b/i.test(query);
  }
  return true;
}
