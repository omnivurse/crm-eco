import { describe, expect, it } from 'vitest';
import { DEFAULT_PIFH_LOGO_PATH, buildPifhSignatureFromProfile } from './signature-html';
import {
  applyEditorSignatureImage,
  detectSignatureLayout,
  extractSignatureFields,
  renderEditorSignatureHtml,
  sizeEditorSignatureHtml,
} from './signature-editor';

const WENDY_HTML = `<table cellpadding="0" cellspacing="0" style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #0A2233; border-collapse: collapse;">
  <tr>
    <td style="padding-bottom: 12px;">
      <img src="https://crm.doublehelixhub.com/api/email/public-assets/62abf4c2-5f1d-448c-80f6-d9d0123c7397" alt="Pay It Forward Health" height="82" style="display: block; max-height: 82px; width: auto; height: auto" />
    </td>
  </tr>
  <tr>
    <td style="border-top: 2px solid #0E8C9A; padding-top: 12px;">
      <p style="margin: 0 0 2px 0; font-weight: bold; font-size: 16px; color: #003A5C;">Wendy Scipione</p>
      <p style="margin: 0 0 2px 0; color: #666666;">Founder / Director</p>
      <p style="margin: 0 0 8px 0; color: #666666;">Pay It Forward Health</p>
      <p style="margin: 0;">wendy@payitforwardhealth.com | 303-970-2200</p>
      <p style="margin: 4px 0 0 0;"><a href="" style="color: #0E8C9A; text-decoration: none;"></a></p>
    </td>
  </tr>
</table>`;

const WENDY_LOGO =
  'https://crm.doublehelixhub.com/api/email/public-assets/62abf4c2-5f1d-448c-80f6-d9d0123c7397';
const NEW_LOGO =
  'https://crm.doublehelixhub.com/api/email/public-assets/11111111-1111-4111-8111-111111111111';

const fallback = {
  full_name: 'Profile Name',
  title: 'Profile Title',
  email: 'profile@example.com',
  phone: '000',
  company_name: 'Profile Co',
  website: '',
  logo_url: DEFAULT_PIFH_LOGO_PATH,
  photo_url: '',
};

describe('detectSignatureLayout', () => {
  it('binds Wendy’s saved stacked signature so field edits write HTML', () => {
    expect(detectSignatureLayout(WENDY_HTML)).toBe('pifh-stacked');
  });

  it('detects official banner artwork', () => {
    expect(
      detectSignatureLayout('<img src="/signatures/pifh-signature-banner.png" alt="PIFH" />'),
    ).toBe('pifh-banner');
  });
});

describe('extractSignatureFields', () => {
  it('reads name, title, and logo from the live stacked HTML', () => {
    const fields = extractSignatureFields(WENDY_HTML, fallback);
    expect(fields.full_name).toBe('Wendy Scipione');
    expect(fields.title).toBe('Founder / Director');
    expect(fields.company_name).toBe('Pay It Forward Health');
    expect(fields.email).toBe('wendy@payitforwardhealth.com');
    expect(fields.phone).toBe('303-970-2200');
    expect(fields.logo_url).toBe(WENDY_LOGO);
    expect(fields.website).toBe('');
  });
});

describe('renderEditorSignatureHtml', () => {
  it('writes field changes back into a detected stacked layout', () => {
    const fields = {
      ...extractSignatureFields(WENDY_HTML, fallback),
      title: 'Founder',
    };
    const html = renderEditorSignatureHtml('pifh-stacked', fields, WENDY_HTML);
    expect(html).toContain('Founder');
    expect(html).not.toContain('Founder / Director');
    expect(html).toContain(WENDY_LOGO);
    expect(html).toContain('Wendy Scipione');
  });

  it('keeps a custom uploaded image when official is selected and details change', () => {
    const fields = extractSignatureFields(WENDY_HTML, fallback);
    const html = renderEditorSignatureHtml('pifh-banner', fields, WENDY_HTML);
    expect(html).toContain('/signatures/pifh-signature-banner.png');
    expect(html).toContain('Wendy Scipione');
    expect(html).toContain('Founder / Director');
  });
});

describe('applyEditorSignatureImage', () => {
  it('replaces the image in stored HTML when no layout is selected', () => {
    const fields = extractSignatureFields(WENDY_HTML, fallback);
    const result = applyEditorSignatureImage({
      slot: 'logo',
      url: NEW_LOGO,
      layoutId: null,
      fields,
      contentHtml: WENDY_HTML,
      logoHeight: 82,
    });
    expect(result.content_html).toContain(NEW_LOGO);
    expect(result.content_html).not.toContain(WENDY_LOGO);
    expect(result.content_html).toContain('Wendy Scipione');
    expect(result.fields.logo_url).toBe(NEW_LOGO);
  });

  it('does not reset an official layout back to canned artwork on upload', () => {
    const fields = extractSignatureFields(WENDY_HTML, fallback);
    const officialHtml = renderEditorSignatureHtml('pifh-banner', fields, '');
    const result = applyEditorSignatureImage({
      slot: 'logo',
      url: NEW_LOGO,
      layoutId: 'pifh-banner',
      fields,
      contentHtml: officialHtml,
      logoHeight: 72,
    });
    expect(result.layoutId).toBe('pifh-stacked');
    expect(result.content_html).toContain(NEW_LOGO);
    expect(result.content_html).not.toContain('/signatures/pifh-signature-banner.png');
    expect(result.content_html).toContain('Wendy Scipione');
  });

  it('keeps name and logo when regenerating the live stacked layout at save size', () => {
    const fields = extractSignatureFields(WENDY_HTML, fallback);
    const html = sizeEditorSignatureHtml(
      renderEditorSignatureHtml('pifh-stacked', fields, WENDY_HTML),
      'pifh-stacked',
      fields,
      82,
    );
    expect(html).toContain(WENDY_LOGO);
    expect(html).toContain('height="82"');
    expect(html).toContain('Wendy Scipione');
  });

  it('still builds a profile layout from scratch', () => {
    const html = buildPifhSignatureFromProfile({ full_name: 'Ada Lovelace' });
    expect(detectSignatureLayout(html)).toBe('pifh-horizontal');
    expect(html).toContain('Ada Lovelace');
  });
});
