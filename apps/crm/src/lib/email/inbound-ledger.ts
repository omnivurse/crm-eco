import { createHash } from 'crypto';

export function inboundEventHash(input: {
  provider: string;
  eventId?: string | null;
  messageId?: string | null;
  from?: string | null;
  to?: string | string[] | null;
}): string {
  const to = Array.isArray(input.to) ? input.to.join(',') : input.to ?? '';
  const material = [
    input.provider,
    input.eventId ?? '',
    input.messageId ?? '',
    input.from ?? '',
    to,
  ].join('\u001f');
  return createHash('sha256').update(material).digest('hex');
}

export type InboundLedgerStatus =
  | 'received'
  | 'processing'
  | 'processed'
  | 'ignored'
  | 'failed'
  | 'dead_letter';
