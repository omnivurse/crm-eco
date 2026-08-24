import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const pageSrc = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'page.tsx'), 'utf8');

describe('needs list page contract', () => {
  it('opens CreateNeedDialog instead of a dead ?new=true refetch', () => {
    expect(pageSrc).not.toContain('?new=true');
    expect(pageSrc).toContain('CreateNeedDialog');
  });

  it('selects custom_fields so portal share requests can be badged', () => {
    expect(pageSrc).toContain('custom_fields');
    expect(pageSrc).toContain('isPortalShareRequest');
  });
});
