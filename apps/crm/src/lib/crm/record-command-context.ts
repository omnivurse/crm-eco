/**
 * Lightweight store so RecordDetailShellV2 can expose "jump to field" targets
 * to the global CommandPalette without prop-drilling through CrmShell.
 */

import type { RecordFieldNavigateTarget, RecordFieldSearchHit } from './record-field-search';

export interface RecordCommandContext {
  recordId: string;
  recordTitle: string;
  /**
   * `crm_modules.key` of the open record (NV-7). The sidebar highlights
   * `module-<moduleKey>` on `/crm/r/<id>` pages, where the path alone cannot
   * say which list the record belongs to. Optional so the shell can publish a
   * context before RP-B wires the key through; missing → no highlight.
   */
  moduleKey?: string;
  searchFields: (query: string) => RecordFieldSearchHit[];
  jumpTo: (target: RecordFieldNavigateTarget) => void;
}

let activeContext: RecordCommandContext | null = null;
const listeners = new Set<() => void>();

export function setRecordCommandContext(ctx: RecordCommandContext | null): void {
  activeContext = ctx;
  listeners.forEach((fn) => fn());
}

export function getRecordCommandContext(): RecordCommandContext | null {
  return activeContext;
}

export function subscribeRecordCommandContext(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
