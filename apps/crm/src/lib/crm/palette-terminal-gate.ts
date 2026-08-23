/**
 * DE-M1 / D10 — which ⌘K terminal commands a viewer may run.
 *
 * Pure so it is unit-testable without mounting the palette: a command that
 * `requiresDeals` needs the org's deals module; one that `requiresCreate`
 * needs a role that may create records (`canCreateRecords`, the same predicate
 * the top bar, ModuleHeader and the quick-create drawer mount use) — for
 * crm_viewer the drawer is unmounted, so offering "new contact" would be a
 * silent no-op.
 */

export interface TerminalCommandGate {
  requiresDeals?: boolean;
  requiresCreate?: boolean;
}

export interface TerminalCommandContext {
  dealsEnabled: boolean;
  canCreate: boolean;
}

export function terminalCommandAllowed(cmd: TerminalCommandGate, ctx: TerminalCommandContext): boolean {
  if (cmd.requiresDeals && !ctx.dealsEnabled) return false;
  if (cmd.requiresCreate && !ctx.canCreate) return false;
  return true;
}
