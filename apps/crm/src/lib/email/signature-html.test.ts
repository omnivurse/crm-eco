import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PIFH_LOGO_PATH,
  SIGNATURE_LAYOUTS,
  absolutizeSignatureHtml,
  buildPifhSignatureFromProfile,
  escapeHtml,
  renderFullImageSignature,
  renderLayoutHtml,
  renderSignatureHtml,
  signatureNeedsBrandingRefresh,
  websiteHref,
} from './signature-html';

const fields = {
  full_name: 'Ada Lovelace',
  title: 'Advisor',
  email: 'ada@payitforwardhealth.com',
  phone: '(555) 010-0101',
  company_name: 'Pay it Forward Health',
  website: 'payitforwardhealth.com',
  logo_url: DEFAULT_PIFH_LOGO_PATH,
  photo_url: '',
};

describe('signature-html', () => {
  it('renders live fields into a PIFH layout without leftover tokens', () => {
    const html = renderLayoutHtml('pifh-horizontal', fields);
    expect(html).toContain('Ada Lovelace');
    expect(html).toContain('Advisor at Pay it Forward Health');
    expect(html).toContain('ada@payitforwardhealth.com');
    expect(html).toContain(DEFAULT_PIFH_LOGO_PATH);
    expect(html).not.toMatch(/\{\{[a-z_]+\}\}/);
    expect(html).not.toMatch(/HealthShare/i);
    expect(html).not.toContain('Your Name');
  });

  it('keeps empty fields blank instead of placeholder copy', () => {
    const html = renderSignatureHtml('{{full_name}} — {{title}}', {
      ...fields,
      full_name: '',
      title: '',
    });
    expect(html).toBe(' — ');
    expect(html).not.toContain('Your Name');
    expect(html).not.toContain('Your Title');
  });

  it('swaps the logo URL when the user uploads a replacement', () => {
    const html = renderLayoutHtml('pifh-stacked', {
      ...fields,
      logo_url: 'https://crm.example.com/api/email/public-assets/11111111-1111-4111-8111-111111111111',
    });
    expect(html).toContain(
      'https://crm.example.com/api/email/public-assets/11111111-1111-4111-8111-111111111111',
    );
    expect(html).not.toContain(DEFAULT_PIFH_LOGO_PATH);
  });

  it('escapes field HTML so a name cannot inject markup', () => {
    const html = renderSignatureHtml('<p>{{full_name}}</p>', {
      ...fields,
      full_name: '<img src=x onerror=alert(1)>',
    });
    expect(html).toBe('<p>&lt;img src=x onerror=alert(1)&gt;</p>');
  });

  it('absolutizes relative signature image paths', () => {
    const html = absolutizeSignatureHtml(
      `<img src="${DEFAULT_PIFH_LOGO_PATH}" alt="Logo" />`,
      'https://crm.doublehelixhub.com/',
    );
    expect(html).toBe(
      '<img src="https://crm.doublehelixhub.com/signatures/pifh-logo.png" alt="Logo" />',
    );
  });

  it('builds a full-image signature from an uploaded file URL', () => {
    const html = renderFullImageSignature(
      'https://crm.example.com/api/email/public-assets/aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
    );
    expect(html).toContain(
      'src="https://crm.example.com/api/email/public-assets/aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa"',
    );
  });

  it('does not ship HealthShare copy in any branded layout', () => {
    for (const layout of SIGNATURE_LAYOUTS.filter((item) => item.group === 'pifh')) {
      expect(layout.template).not.toMatch(/HealthShare/i);
      expect(layout.template).not.toContain('Your Name');
    }
  });

  it('flags placeholder and old Double Helix logos', () => {
    expect(signatureNeedsBrandingRefresh('<p>Your Name</p>')).toBe(true);
    expect(signatureNeedsBrandingRefresh('<img src="/signatures/EmailSignature-02.jpg" />')).toBe(true);
    expect(signatureNeedsBrandingRefresh(buildPifhSignatureFromProfile({ full_name: 'Wendy Scipione' }))).toBe(false);
  });

  it('prefixes bare websites with https', () => {
    expect(websiteHref('payitforwardhealth.com')).toBe('https://payitforwardhealth.com');
    expect(websiteHref('https://payitforwardhealth.com')).toBe('https://payitforwardhealth.com');
    expect(escapeHtml('"')).toBe('&quot;');
  });
});
