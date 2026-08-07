export type ImportJobTerminalStatus = 'completed' | 'completed_with_errors' | 'failed';

export interface ImportJobCompletion {
  status: ImportJobTerminalStatus;
  errorMessage: string | null;
}

/**
 * Derive an honest terminal state from attempted writes.
 *
 * Skipped rows are intentionally excluded from `writeAttemptCount`: they are
 * expected no-ops, not failed writes. A run with only skipped rows therefore
 * completes successfully.
 */
export function summarizeImportJobCompletion(
  errorCount: number,
  writeAttemptCount: number,
): ImportJobCompletion {
  const status: ImportJobTerminalStatus =
    errorCount === 0
      ? 'completed'
      : errorCount === writeAttemptCount && writeAttemptCount > 0
        ? 'failed'
        : 'completed_with_errors';

  return {
    status,
    errorMessage:
      errorCount > 0
        ? `${errorCount} of ${writeAttemptCount} row(s) failed to write`
        : null,
  };
}
