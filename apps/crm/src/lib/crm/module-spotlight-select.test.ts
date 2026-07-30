import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { nextModuleSpotlightStateAfterSelect } from './module-spotlight-select';

describe('nextModuleSpotlightStateAfterSelect', () => {
  it('clears query and results after picking a spotlight match', () => {
    expect(nextModuleSpotlightStateAfterSelect()).toEqual({
      searchQuery: '',
      liveResults: [],
      liveOpen: false,
    });
  });
});

describe('ModuleShell spotlight select contract', () => {
  it('applies nextModuleSpotlightStateAfterSelect when a result is chosen', () => {
    const src = readFileSync(
      join(process.cwd(), 'src/components/zoho/ModuleShell.tsx'),
      'utf8',
    );
    expect(src).toContain('nextModuleSpotlightStateAfterSelect');
    expect(src).toContain("from '@/lib/crm/module-spotlight-select'");
  });
});
