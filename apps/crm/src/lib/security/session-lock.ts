/**
 * Inactivity session lock (password re-entry). Off by default for tester access.
 * Set `NEXT_PUBLIC_ENABLE_SESSION_LOCK=true` and redeploy to restore.
 */
export function isSessionLockEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_SESSION_LOCK === 'true';
}
