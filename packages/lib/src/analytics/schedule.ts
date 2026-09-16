export type ScheduleType = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly';

export function computeNextScheduledRun(
  from: Date,
  scheduleType: string | null | undefined,
): Date {
  const next = new Date(from.getTime());
  switch (scheduleType) {
    case 'weekly':
    case 'weekly_monday':
    case 'weekly_friday':
      next.setDate(next.getDate() + 7);
      break;
    case 'biweekly':
      next.setDate(next.getDate() + 14);
      break;
    case 'monthly':
    case 'monthly_1st':
    case 'monthly_15th':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'quarterly':
      next.setMonth(next.getMonth() + 3);
      break;
    case 'daily':
    default:
      next.setDate(next.getDate() + 1);
      break;
  }
  return next;
}
