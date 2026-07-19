export interface RecordTagsPatchBody {
  data: {
    tags: string[];
  };
}

/**
 * Builds a sparse JSONB patch for tag changes.
 *
 * The record PATCH endpoint merges this object into the latest database value.
 * Sending only `tags` prevents stale record props from overwriting newer inline
 * field edits when the server component has not refreshed yet.
 */
export function buildRecordTagsPatch(tags: readonly string[]): RecordTagsPatchBody {
  return {
    data: {
      tags: [...tags],
    },
  };
}
