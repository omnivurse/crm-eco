import { describe, expect, it } from 'vitest';
import {
  sanitizeInboundEmailHtml,
  sanitizeOutboundEmailHtml,
} from './email-sanitize';

const XSS_VECTORS = [
  '<script>alert(1)</script>',
  '<img src="x" onerror="alert(1)">',
  '<a href="javascript:alert(1)">click</a>',
  '<div onmouseover="alert(1)">hover</div>',
  '<iframe src="https://evil.example"></iframe>',
  '<form action="https://evil.example"><input name="password"></form>',
  '<object data="https://evil.example/x.swf"></object>',
  '<svg onload="alert(1)"></svg>',
  '<meta http-equiv="refresh" content="0;url=https://evil.example">',
  '<base href="https://evil.example/">',
  '<a href="jAvAsCrIpT:alert(1)">mixed case</a>',
];

describe('sanitizeOutboundEmailHtml', () => {
  it('neutralizes every scripting vector', () => {
    for (const vector of XSS_VECTORS) {
      const out = sanitizeOutboundEmailHtml(vector);
      expect(out).not.toMatch(/<script/i);
      expect(out).not.toMatch(/javascript:/i);
      expect(out).not.toMatch(/onerror|onmouseover|onload/i);
      expect(out).not.toMatch(/<iframe|<object|<form|<svg|<meta|<base/i);
    }
  });

  it('keeps everything the composer legitimately produces', () => {
    const composed =
      '<h2>Hello</h2>' +
      '<p style="text-align:center">Hi <strong>there</strong>, ' +
      '<span style="color:#ef4444;font-family:Georgia, &quot;Times New Roman&quot;, serif;font-size:18px">styled</span> ' +
      '<mark data-color="#FEF08A">highlighted</mark></p>' +
      '<ul><li>one</li><li>two</li></ul>' +
      '<blockquote>quoted</blockquote><hr/>' +
      '<a href="https://example.com">link</a>' +
      '<img src="https://example.com/logo.png" alt="logo" width="120">' +
      '<table><tbody><tr><td colspan="2">cell</td></tr></tbody></table>';
    const out = sanitizeOutboundEmailHtml(composed);
    expect(out).toContain('<h2>Hello</h2>');
    expect(out).toContain('text-align:center');
    expect(out).toContain('color:#ef4444');
    expect(out).toContain('font-size:18px');
    expect(out).toContain('font-family:Georgia');
    expect(out).toContain('<mark');
    expect(out).toContain('<blockquote>quoted</blockquote>');
    expect(out).toContain('href="https://example.com"');
    expect(out).toContain('src="https://example.com/logo.png"');
    expect(out).toContain('colspan="2"');
  });

  it('keeps the crm marker attributes used by signatures and merge fields', () => {
    const html =
      '<div data-crm-signature="1">sig</div>' +
      '<blockquote data-crm-quote="1">old</blockquote>' +
      '<span data-merge-field="contact.first_name">{{contact.first_name}}</span>';
    const out = sanitizeOutboundEmailHtml(html);
    expect(out).toContain('data-crm-signature="1"');
    expect(out).toContain('data-crm-quote="1"');
    expect(out).toContain('data-merge-field="contact.first_name"');
  });

  it('forces rel on links and drops disallowed style properties', () => {
    const out = sanitizeOutboundEmailHtml(
      '<a href="https://x.example" style="position:fixed;color:#000">x</a>'
    );
    expect(out).toContain('rel="noopener noreferrer"');
    expect(out).not.toContain('position');
    expect(out).toContain('color:#000');
  });

  it('allows data: URIs on images only (composer base64 paste support)', () => {
    const img = sanitizeOutboundEmailHtml('<img src="data:image/png;base64,AAAA">');
    expect(img).toContain('data:image/png');
    const link = sanitizeOutboundEmailHtml('<a href="data:text/html,hi">x</a>');
    expect(link).not.toContain('data:text/html');
  });
});

describe('sanitizeInboundEmailHtml', () => {
  it('neutralizes every scripting vector', () => {
    for (const vector of XSS_VECTORS) {
      const out = sanitizeInboundEmailHtml(vector);
      expect(out).not.toMatch(/<script/i);
      expect(out).not.toMatch(/javascript:/i);
      expect(out).not.toMatch(/onerror|onmouseover|onload/i);
      expect(out).not.toMatch(/<iframe|<object|<form|<svg|<meta|<base/i);
    }
  });

  it('preserves pathological-but-legit newsletter markup', () => {
    const newsletter =
      '<table width="600" border="0" cellpadding="0" cellspacing="0" bgcolor="#f4f4f4" align="center">' +
      '<tr><td align="center" style="padding:24px;background-image:url(https://cdn.example/bg.png)">' +
      '<font face="Arial" size="2" color="#333333">Old-school font tag</font>' +
      '<img src="https://cdn.example/hero.jpg" width="600" height="200" border="0" alt="">' +
      '</td></tr></table>';
    const out = sanitizeInboundEmailHtml(newsletter);
    expect(out).toContain('width="600"');
    expect(out).toContain('bgcolor="#f4f4f4"');
    expect(out).toContain('cellpadding="0"');
    expect(out).toContain('<font face="Arial"');
    expect(out).toContain('background-image');
    expect(out).toContain('hero.jpg');
  });

  it('forces target=_blank and rel on inbound links', () => {
    const out = sanitizeInboundEmailHtml('<a href="https://x.example">x</a>');
    expect(out).toContain('target="_blank"');
    expect(out).toContain('rel="noopener noreferrer"');
  });

  it('keeps cid: image references from multipart mail', () => {
    const out = sanitizeInboundEmailHtml('<img src="cid:part1.abc@example.com">');
    expect(out).toContain('cid:part1.abc@example.com');
  });

  it('drops style/link/meta tags without leaking their content as text', () => {
    const out = sanitizeInboundEmailHtml(
      '<style>.x{color:red}</style><p>body</p><link rel="stylesheet" href="https://evil.example/x.css">'
    );
    expect(out).toContain('<p>body</p>');
    expect(out).not.toContain('color:red');
    expect(out).not.toContain('evil.example');
  });
});
