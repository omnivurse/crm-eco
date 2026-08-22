export async function isEmailSuppressed(
  lookup: (email: string) => Promise<boolean>,
  email: string,
): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  return lookup(normalized);
}

export async function filterUnsubscribed<T extends { email?: string | null }>(
  rows: T[],
  lookup: (email: string) => Promise<boolean>,
): Promise<{ allowed: T[]; suppressed: T[] }> {
  const allowed: T[] = [];
  const suppressed: T[] = [];
  for (const row of rows) {
    const email = row.email ?? '';
    if (await isEmailSuppressed(lookup, email)) {
      suppressed.push(row);
    } else {
      allowed.push(row);
    }
  }
  return { allowed, suppressed };
}
