import { describe, expect, it } from 'vitest';
import { summarizeImportJobCompletion } from './import-job-status';

describe('summarizeImportJobCompletion', () => {
  it.each([
    {
      name: 'completed when every attempted write succeeds',
      errors: 0,
      attempts: 3,
      expectedStatus: 'completed',
      expectedMessage: null,
    },
    {
      name: 'completed when every row is intentionally skipped',
      errors: 0,
      attempts: 0,
      expectedStatus: 'completed',
      expectedMessage: null,
    },
    {
      name: 'completed_with_errors when only some writes fail',
      errors: 1,
      attempts: 3,
      expectedStatus: 'completed_with_errors',
      expectedMessage: '1 of 3 row(s) failed to write',
    },
    {
      name: 'failed when every attempted write fails',
      errors: 3,
      attempts: 3,
      expectedStatus: 'failed',
      expectedMessage: '3 of 3 row(s) failed to write',
    },
  ])('$name', ({ errors, attempts, expectedStatus, expectedMessage }) => {
    expect(summarizeImportJobCompletion(errors, attempts)).toEqual({
      status: expectedStatus,
      errorMessage: expectedMessage,
    });
  });
});
