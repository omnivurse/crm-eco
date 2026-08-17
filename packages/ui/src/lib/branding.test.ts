import { describe, expect, it } from 'vitest';
import {
  brandingToCssText,
  brandingToCssVariables,
  hexRelativeLuminance,
  hexToContrastForegroundTriple,
  hexToHslTriple,
} from './branding';

describe('hexToContrastForegroundTriple', () => {
  it('puts paper text on dark tenant colors (PIFH secondary #1d4ed8 → white, not ink)', () => {
    expect(hexToContrastForegroundTriple('#1d4ed8')).toBe('210 40% 98%');
    expect(hexToContrastForegroundTriple('#2563eb')).toBe('210 40% 98%');
    expect(hexToContrastForegroundTriple('#000')).toBe('210 40% 98%');
  });

  it('puts ink text on light tenant colors', () => {
    expect(hexToContrastForegroundTriple('#e2e8f0')).toBe('222 47% 11%');
    expect(hexToContrastForegroundTriple('#ffffff')).toBe('222 47% 11%');
    expect(hexToContrastForegroundTriple('#facc15')).toBe('222 47% 11%'); // yellow-400
  });

  it('returns empty for unparseable input', () => {
    expect(hexToContrastForegroundTriple('teal')).toBe('');
    expect(hexRelativeLuminance('nope')).toBeNull();
  });
});

describe('brandingToCssText', () => {
  it('emits a matching -foreground for every overridden token, in :root and .dark', () => {
    const css = brandingToCssText({
      colors: { primary: '#2563eb', secondary: '#1d4ed8', accent: '#0ea5e9' },
    });
    expect(css).toContain(`--secondary: ${hexToHslTriple('#1d4ed8')};`);
    expect(css).toContain('--secondary-foreground: 210 40% 98%;');
    expect(css).toContain('--primary-foreground: 210 40% 98%;');
    // sky-500 is mid-luminance: ink wins (5.9:1 vs 2.8:1 for white)
    expect(css).toContain('--accent-foreground: 222 47% 11%;');
    expect(css.startsWith(':root{')).toBe(true);
    expect(css).toContain('.dark{');
  });

  it('still returns empty for empty branding', () => {
    expect(brandingToCssText({})).toBe('');
    expect(brandingToCssText(null)).toBe('');
  });

  it('exposes the same pairs as inline variables', () => {
    const vars = brandingToCssVariables({ primary_color: '#f8fafc' });
    expect(vars['--primary']).toBe(hexToHslTriple('#f8fafc'));
    expect(vars['--primary-foreground']).toBe('222 47% 11%');
  });
});
