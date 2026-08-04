import { describe, it, expect } from 'vitest';
import { escapeCsvCell, toCsvRow } from './escape';

describe('escapeCsvCell', () => {
  it('passes plain values through unquoted', () => {
    expect(escapeCsvCell('alice')).toBe('alice');
    expect(escapeCsvCell(42)).toBe('42');
    expect(escapeCsvCell(true)).toBe('true');
  });

  it('renders null and undefined as empty', () => {
    expect(escapeCsvCell(null)).toBe('');
    expect(escapeCsvCell(undefined)).toBe('');
  });

  it('quotes commas and doubles embedded quotes', () => {
    expect(escapeCsvCell('a,b')).toBe('"a,b"');
    expect(escapeCsvCell('x"y')).toBe('"x""y"');
  });

  it('quotes a bare CR — the bug in the crm/export copy', () => {
    // apps/crm/src/app/api/crm/export/route.ts checked only , " and \n, so a
    // CRLF field was emitted unquoted and every parser saw a premature row break.
    expect(escapeCsvCell('line1\r\nline2')).toBe('"line1\r\nline2"');
    expect(escapeCsvCell('bare\rcarriage')).toBe('"bare\rcarriage"');
    expect(escapeCsvCell('unix\nonly')).toBe('"unix\nonly"');
  });

  it('neutralises formula-injection prefixes', () => {
    // None of the four original implementations did this. A staff member opening
    // the export would otherwise execute attacker-controlled record content.
    expect(escapeCsvCell('=1+1')).toBe("'=1+1");
    expect(escapeCsvCell('+1234')).toBe("'+1234");
    expect(escapeCsvCell('-1234')).toBe("'-1234");
    expect(escapeCsvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(escapeCsvCell('=HYPERLINK("http://evil.example","x")')).toBe(
      '"\'=HYPERLINK(""http://evil.example"",""x"")"',
    );
  });

  it('keeps the formula guard inside the quotes', () => {
    // The prefix must land within the quoted cell, not before the opening quote,
    // or the output is not valid CSV.
    const out = escapeCsvCell('=a,b');
    expect(out.startsWith('"')).toBe(true);
    expect(out).toBe('"\'=a,b"');
  });

  it('does not mangle values that merely contain an operator', () => {
    expect(escapeCsvCell('a=b')).toBe('a=b');
    expect(escapeCsvCell('3-4')).toBe('3-4');
  });

  it('serialises objects as JSON rather than [object Object]', () => {
    expect(escapeCsvCell({ a: 1 })).toBe('"{""a"":1}"');
    expect(escapeCsvCell([1, 2])).toBe('"[1,2]"');
  });

  it('handles the empty string', () => {
    expect(escapeCsvCell('')).toBe('');
  });
});

describe('toCsvRow', () => {
  it('joins escaped cells with commas', () => {
    expect(toCsvRow(['a', 'b,c', null, '=x'])).toBe("a,\"b,c\",,'=x");
  });
});
