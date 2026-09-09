/** Prefer the mailbox this reply belongs to; otherwise the org default. */
export function pickInitialSender<T extends { email: string; is_default: boolean }>(
  addresses: T[],
  preferredEmail?: string | null,
): T | null {
  if (addresses.length === 0) return null;
  const preferred = preferredEmail?.trim().toLowerCase();
  if (preferred) {
    const match = addresses.find((address) => address.email.toLowerCase() === preferred);
    if (match) return match;
  }
  return addresses.find((address) => address.is_default) ?? addresses[0] ?? null;
}
