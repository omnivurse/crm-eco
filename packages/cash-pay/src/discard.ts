export const DISCARDED_STORAGE_PREFIX = 'cashpay:discarded:v1:';

export function discardedStorageKey(procedureCode: string, msaName: string): string {
  return `${DISCARDED_STORAGE_PREFIX}${procedureCode.trim().toUpperCase()}|${msaName.trim().toLowerCase()}`;
}

export function readDiscardedIds(raw: string | null | undefined): Set<string> {
  if (!raw) return new Set();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === 'string' && id.length > 0));
  } catch {
    return new Set();
  }
}

export function serializeDiscardedIds(ids: Set<string>): string {
  return JSON.stringify([...ids]);
}

export function persistDiscardedIds(
  storage: Pick<Storage, 'setItem'>,
  key: string,
  ids: Set<string>,
): void {
  try {
    storage.setItem(key, serializeDiscardedIds(ids));
  } catch {
    // private mode / quota — in-session discard still works
  }
}
