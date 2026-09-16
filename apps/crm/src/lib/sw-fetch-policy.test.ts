import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('CRM service worker fetch policy', () => {
  const source = readFileSync(path.join(__dirname, '../../public/sw.js'), 'utf8');

  it('bypasses Supabase hosts before networkFirst (refresh-token race)', () => {
    expect(source).toMatch(/if \(url\.hostname\.includes\('supabase'\)\) \{\s*return;/);
    const apiFn = source.slice(source.indexOf('function isApiRequest'));
    expect(apiFn).not.toMatch(/hostname\.includes\('supabase'\)/);
  });
});
