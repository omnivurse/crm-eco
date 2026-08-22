import { headers } from 'next/headers';
import { headersIndicatePinLock } from './pin-lock';

/** True when middleware marked this request as the public PIN page. */
export async function isPinLockRequest(): Promise<boolean> {
  const hdrs = await headers();
  return headersIndicatePinLock((name) => hdrs.get(name));
}
