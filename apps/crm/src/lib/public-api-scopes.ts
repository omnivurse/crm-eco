export type PublicApiAccess = 'read' | 'write';

export function hasCrmApiScope(scopes: string[], access: PublicApiAccess): boolean {
  if (scopes.includes('crm.admin')) return true;
  if (access === 'write') {
    return scopes.includes('crm.write') || scopes.includes('membership.write');
  }
  return (
    scopes.includes('crm.read') ||
    scopes.includes('crm.write') ||
    scopes.includes('membership.read') ||
    scopes.includes('membership.write') ||
    scopes.includes('plans.read')
  );
}
