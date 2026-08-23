// @vitest-environment jsdom
/**
 * Browser half of note-sanitize.test.ts — with a DOM present the full
 * DOMPurify allow-list runs (not the server hazard strip).
 */
import { describe, expect, it } from 'vitest';
import { sanitizeNoteHtml } from './note-sanitize';

describe('sanitizeNoteHtml in the browser (jsdom)', () => {
  it('uses DOMPurify: drops disallowed tags/attributes, keeps the note allow-list', () => {
    expect(typeof window).toBe('object');
    const out = sanitizeNoteHtml(
      '<p data-x="1" style="color:red">Called <b>Wendy</b></p><script>alert(1)</script><font color="red">c</font><span onclick="x()">s</span>',
    );
    expect(out).toBe('<p>Called <b>Wendy</b></p><font color="red">c</font><span>s</span>');
  });
});
