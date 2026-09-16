export type TemplateExecuteKind = 'advisor' | 'healthcare' | 'generic';

export function getTemplateExecutePath(template: {
  id: string;
  category?: string;
}): { path: string; kind: TemplateExecuteKind } {
  if (template.category === 'advisors' || template.id.startsWith('advisor-')) {
    return { path: '/api/reports/advisor/execute', kind: 'advisor' };
  }
  if (template.category === 'healthcare' || template.id.startsWith('network-')) {
    return { path: '/api/reports/healthcare/execute', kind: 'healthcare' };
  }
  return { path: '/api/reports/execute', kind: 'generic' };
}

/** CRM templates store `{ column, aggregation }`; execute API wants `{ field, function }`. */
export function normalizeGrouping(
  grouping?: Array<{ column?: string; field?: string; aggregation?: string; function?: string; order?: string }>,
): Array<{ field: string; order?: 'asc' | 'desc' }> {
  if (!grouping?.length) return [];
  const normalized: Array<{ field: string; order?: 'asc' | 'desc' }> = [];
  for (const group of grouping) {
    const field = group.field || group.column;
    if (!field) continue;
    normalized.push({
      field,
      order: group.order === 'desc' ? 'desc' : 'asc',
    });
  }
  return normalized;
}
