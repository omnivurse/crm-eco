/**
 * When the next step of a sequence should fire.
 *
 * Extracted from the engine so the day-of-week arithmetic is testable. The
 * previous inline version could not terminate: `send_days` is JSONB and the
 * step editor writes strings (["1","3"]), while the loop compared them
 * against Date#getDay(), a number. `["1"].includes(1)` is false forever, so
 * any step with send days configured spun the cron worker indefinitely.
 */

/** Days are stored loosely in JSONB; accept anything that means 0–6. */
export function normalizeSendDays(input: unknown): number[] {
  if (!Array.isArray(input)) return [];

  const days = new Set<number>();
  for (const raw of input) {
    const value = typeof raw === 'number' ? raw : Number(String(raw).trim());
    if (Number.isInteger(value) && value >= 0 && value <= 6) {
      days.add(value);
    }
  }
  return Array.from(days).sort((a, b) => a - b);
}

export interface NextStepTimeOptions {
  delayDays?: number | null;
  delayHours?: number | null;
  delayMinutes?: number | null;
  sendTime?: string | null;
  sendDays?: unknown;
  /** Injectable for tests. */
  now?: Date;
}

export function calculateNextStepTime({
  delayDays = 0,
  delayHours = 0,
  delayMinutes = 0,
  sendTime = null,
  sendDays = null,
  now = new Date(),
}: NextStepTimeOptions): string {
  const nextTime = new Date(now.getTime());

  nextTime.setDate(nextTime.getDate() + (delayDays || 0));
  nextTime.setHours(nextTime.getHours() + (delayHours || 0));
  nextTime.setMinutes(nextTime.getMinutes() + (delayMinutes || 0));

  if (sendTime) {
    const [hours, minutes] = sendTime.split(':').map(Number);
    if (Number.isInteger(hours) && Number.isInteger(minutes)) {
      nextTime.setHours(hours, minutes, 0, 0);
      // A time that has already passed today rolls to tomorrow.
      if (nextTime.getTime() < now.getTime()) {
        nextTime.setDate(nextTime.getDate() + 1);
      }
    }
  }

  const allowedDays = normalizeSendDays(sendDays);
  if (allowedDays.length > 0) {
    // Seven advances covers every weekday, so this cannot spin even if the
    // list is somehow unsatisfiable.
    for (let i = 0; i < 7 && !allowedDays.includes(nextTime.getDay()); i += 1) {
      nextTime.setDate(nextTime.getDate() + 1);
    }
  }

  return nextTime.toISOString();
}
