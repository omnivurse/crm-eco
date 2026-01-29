/**
 * Type-safe query key factory for TanStack Query
 * Follows the pattern: ['entity', 'scope', identifier, ...filters]
 */
export const queryKeys = {
  // Records
  records: {
    all: ['records'] as const,
    lists: () => [...queryKeys.records.all, 'list'] as const,
    list: (moduleId: string, filters?: Record<string, unknown>) =>
      [...queryKeys.records.lists(), moduleId, filters] as const,
    details: () => [...queryKeys.records.all, 'detail'] as const,
    detail: (recordId: string) => [...queryKeys.records.details(), recordId] as const,
    // For drawer - lighter version with limited data
    drawer: (recordId: string) => [...queryKeys.records.all, 'drawer', recordId] as const,
  },

  // Fields
  fields: {
    all: ['fields'] as const,
    byModule: (moduleId: string) => [...queryKeys.fields.all, moduleId] as const,
  },

  // Timeline & Notes
  timeline: {
    all: ['timeline'] as const,
    byRecord: (recordId: string) => [...queryKeys.timeline.all, recordId] as const,
    notes: (recordId: string) => [...queryKeys.timeline.all, 'notes', recordId] as const,
    tasks: (recordId: string) => [...queryKeys.timeline.all, 'tasks', recordId] as const,
  },

  // Modules
  modules: {
    all: ['modules'] as const,
    byOrg: (orgId: string) => [...queryKeys.modules.all, orgId] as const,
  },
} as const;
