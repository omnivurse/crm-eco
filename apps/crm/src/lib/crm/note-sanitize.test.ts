/**
 * sanitizeNoteHtml must be safe on BOTH sides of the RP-7 Notes-pane SSR:
 * node (no DOM → hazard strip, never a throw) and the browser (DOMPurify).
 * Run in the default node environment; the jsdom half lives in
 * note-sanitize.dom.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { sanitizeNoteHtml, stripHazardousHtml } from './note-sanitize';

describe('sanitizeNoteHtml on the server (no window)', () => {
  it('does not throw and keeps the formatting tags', () => {
    expect(typeof window).toBe('undefined');
    const out = sanitizeNoteHtml('<p>Called <b>Wendy</b> — <i>left voicemail</i><br>next step</p>');
    expect(out).toBe('<p>Called <b>Wendy</b> — <i>left voicemail</i><br>next step</p>');
  });

  it('strips script blocks, inline handlers and javascript: URLs instead of returning the raw body', () => {
    const dirty =
      '<p>hi</p><script>alert(1)</script><img src="x" onerror="alert(1)"><a href="javascript:alert(1)">x</a><style>body{}</style>';
    const out = sanitizeNoteHtml(dirty);
    expect(out).not.toMatch(/<script/i);
    expect(out).not.toMatch(/<style/i);
    expect(out).not.toMatch(/onerror/i);
    expect(out).not.toMatch(/javascript:/i);
    expect(out).toContain('<p>hi</p>');
    expect(out).toContain('<img src="x"');
  });

  it('stripHazardousHtml handles unterminated blocks and mixed case', () => {
    expect(stripHazardousHtml('<P>ok</P><SCRIPT>alert(1)')).toBe('<P>ok</P>');
    expect(stripHazardousHtml("<div OnClick='x()'>t</div>")).toBe('<div>t</div>');
    expect(stripHazardousHtml('<a href=" JavaScript:alert(1)">t</a>')).toBe('<a href="">t</a>');
  });
});
