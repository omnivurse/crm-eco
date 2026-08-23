import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { shouldClearEphemeralSearchOnOpenChange } from './useEphemeralSearchWhenClosed';

describe('shouldClearEphemeralSearchOnOpenChange', () => {
  it('clears when the overlay closes', () => {
    expect(shouldClearEphemeralSearchOnOpenChange(false)).toBe(true);
  });

  it('does not clear while the overlay stays open', () => {
    expect(shouldClearEphemeralSearchOnOpenChange(true)).toBe(false);
  });
});

describe('shell search overlay ephemeral contracts', () => {
  const palettePath = join(
    process.cwd(),
    'src/components/crm/shell/CommandPalette.tsx',
  );
  const topBarPath = join(
    process.cwd(),
    'src/components/crm/shell/CrmTopBar.tsx',
  );

  it('CommandPalette wires useEphemeralSearchWhenClosed so prior names cannot stick', () => {
    const src = readFileSync(palettePath, 'utf8');
    expect(src).toContain('useEphemeralSearchWhenClosed');
    expect(src).toContain("from '@/hooks/useEphemeralSearchWhenClosed'");
    // Must not pass the raw parent setter — that skips synchronous clear.
    expect(src).toMatch(/<Dialog\s+open=\{open\}\s+onOpenChange=\{handleOpenChange\}/);
  });

  it('CrmTopBar does not register a competing ⌘K keydown (avoids open/toggle race)', () => {
    const src = readFileSync(topBarPath, 'utf8');
    expect(src).not.toMatch(/addEventListener\(\s*['"]keydown['"]/);
    expect(src).not.toMatch(/e\.key\s*(===|==)\s*['"]k['"]/);
  });
});
