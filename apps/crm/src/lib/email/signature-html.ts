export const DEFAULT_PIFH_LOGO_PATH = '/signatures/pifh-logo.png';

export interface SignatureFields {
  full_name: string;
  title: string;
  email: string;
  phone: string;
  company_name: string;
  website: string;
  logo_url: string;
  photo_url: string;
}

export const EMPTY_SIGNATURE_FIELDS: SignatureFields = {
  full_name: '',
  title: '',
  email: '',
  phone: '',
  company_name: '',
  website: '',
  logo_url: DEFAULT_PIFH_LOGO_PATH,
  photo_url: '',
};

export interface SignatureLayout {
  id: string;
  name: string;
  description: string;
  group: 'pifh' | 'custom';
  template: string;
}

const PIFH_HORIZONTAL = `<table cellpadding="0" cellspacing="0" style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #0A2233; border-collapse: collapse;">
  <tr>
    <td style="padding-right: 16px; vertical-align: middle;">
      <img src="{{logo_url}}" alt="{{company_name}}" height="52" style="display: block; max-height: 52px; width: auto;" />
    </td>
    <td style="border-left: 3px solid #12A065; padding-left: 16px; vertical-align: middle;">
      <p style="margin: 0 0 2px 0; font-weight: bold; font-size: 16px; color: #003A5C;">{{full_name}}</p>
      <p style="margin: 0 0 8px 0; color: #0E8C9A;">{{title_company}}</p>
      <p style="margin: 0 0 2px 0;"><a href="mailto:{{email}}" style="color: #003A5C; text-decoration: none;">{{email}}</a></p>
      <p style="margin: 0 0 2px 0;"><a href="tel:{{phone}}" style="color: #003A5C; text-decoration: none;">{{phone}}</a></p>
      <p style="margin: 0;"><a href="{{website_href}}" style="color: #0E8C9A; text-decoration: none;">{{website}}</a></p>
    </td>
  </tr>
</table>`;

const PIFH_STACKED = `<table cellpadding="0" cellspacing="0" style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #0A2233; border-collapse: collapse;">
  <tr>
    <td style="padding-bottom: 12px;">
      <img src="{{logo_url}}" alt="{{company_name}}" height="48" style="display: block; max-height: 48px; width: auto;" />
    </td>
  </tr>
  <tr>
    <td style="border-top: 2px solid #0E8C9A; padding-top: 12px;">
      <p style="margin: 0 0 2px 0; font-weight: bold; font-size: 16px; color: #003A5C;">{{full_name}}</p>
      <p style="margin: 0 0 8px 0; color: #666666;">{{title_company}}</p>
      <p style="margin: 0;">{{email}} | {{phone}}</p>
      <p style="margin: 4px 0 0 0;"><a href="{{website_href}}" style="color: #0E8C9A; text-decoration: none;">{{website}}</a></p>
    </td>
  </tr>
</table>`;

const PIFH_BRANDED = `<table cellpadding="0" cellspacing="0" style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #0A2233; border-collapse: collapse;">
  <tr>
    <td style="background: #003A5C; padding: 12px 16px;">
      <img src="{{logo_url}}" alt="{{company_name}}" height="40" style="display: block; max-height: 40px; width: auto;" />
    </td>
  </tr>
  <tr>
    <td style="padding: 12px 16px; border: 1px solid #D5E5EF; border-top: none;">
      <p style="margin: 0 0 2px 0; font-weight: bold; font-size: 16px; color: #003A5C;">{{full_name}}</p>
      <p style="margin: 0 0 8px 0; color: #0E8C9A;">{{title_company}}</p>
      <p style="margin: 0 0 2px 0;">{{email}} | {{phone}}</p>
      <p style="margin: 0; color: #666666;">{{company_name}}</p>
    </td>
  </tr>
</table>`;

const PROFESSIONAL = `<table cellpadding="0" cellspacing="0" style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #333333; border-collapse: collapse;">
  <tr>
    <td style="padding-right: 15px; border-right: 2px solid #0E8C9A; vertical-align: top;">
      <img src="{{photo_url}}" alt="Photo" width="80" height="80" style="border-radius: 50%; display: block;" />
    </td>
    <td style="padding-left: 15px; vertical-align: middle;">
      <p style="margin: 0 0 4px 0; font-weight: bold; font-size: 16px; color: #111111;">{{full_name}}</p>
      <p style="margin: 0 0 8px 0; color: #666666;">{{title}}</p>
      <p style="margin: 0 0 2px 0;">{{email}}</p>
      <p style="margin: 0;">{{phone}}</p>
    </td>
  </tr>
</table>`;

const MODERN = `<table cellpadding="0" cellspacing="0" style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #333333; border-collapse: collapse;">
  <tr>
    <td>
      <p style="margin: 0 0 4px 0; font-weight: bold; font-size: 16px; color: #0E8C9A;">{{full_name}}</p>
      <p style="margin: 0 0 8px 0; color: #666666;">{{title_company}}</p>
      <p style="margin: 0;">
        <a href="mailto:{{email}}" style="color: #0E8C9A; text-decoration: none;">Email</a>
        &nbsp;·&nbsp;
        <a href="tel:{{phone}}" style="color: #0E8C9A; text-decoration: none;">Phone</a>
        &nbsp;·&nbsp;
        <a href="{{website_href}}" style="color: #0E8C9A; text-decoration: none;">Website</a>
      </p>
    </td>
  </tr>
</table>`;

const MINIMAL = `<p style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #333333; margin: 0;">
  <strong>{{full_name}}</strong><br />
  {{title}}<br />
  {{email}} | {{phone}}
</p>`;

export const SIGNATURE_LAYOUTS: SignatureLayout[] = [
  {
    id: 'pifh-horizontal',
    name: 'Horizontal',
    description: 'Logo beside your name and contact details',
    group: 'pifh',
    template: PIFH_HORIZONTAL,
  },
  {
    id: 'pifh-stacked',
    name: 'Stacked',
    description: 'Logo above your details',
    group: 'pifh',
    template: PIFH_STACKED,
  },
  {
    id: 'pifh-branded',
    name: 'Branded',
    description: 'Navy header with the current wordmark',
    group: 'pifh',
    template: PIFH_BRANDED,
  },
  {
    id: 'professional',
    name: 'Professional',
    description: 'Photo plus contact info',
    group: 'custom',
    template: PROFESSIONAL,
  },
  {
    id: 'modern',
    name: 'Modern',
    description: 'Compact name and links',
    group: 'custom',
    template: MODERN,
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Text only',
    group: 'custom',
    template: MINIMAL,
  },
];

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function websiteHref(website: string): string {
  const trimmed = website.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function deriveFields(fields: SignatureFields): Record<string, string> {
  const title = fields.title.trim();
  const company = fields.company_name.trim();
  return {
    full_name: fields.full_name.trim(),
    title,
    email: fields.email.trim(),
    phone: fields.phone.trim(),
    company_name: company,
    website: fields.website.trim(),
    website_href: websiteHref(fields.website),
    logo_url: fields.logo_url.trim() || DEFAULT_PIFH_LOGO_PATH,
    photo_url: fields.photo_url.trim(),
    title_company: title && company ? `${title} at ${company}` : title || company,
  };
}

export function renderSignatureHtml(template: string, fields: SignatureFields): string {
  const values = deriveFields(fields);
  let html = template;
  for (const [key, value] of Object.entries(values)) {
    html = html.replaceAll(`{{${key}}}`, escapeHtml(value));
  }
  html = html.replace(/\{\{[a-z_]+\}\}/g, '');
  html = html.replace(/<img\b[^>]*\bsrc=(["'])\1[^>]*>/gi, '');
  html = html.replace(/<p\b[^>]*>\s*(<br\s*\/?>)?\s*<\/p>/gi, '');
  return html;
}

export function renderLayoutHtml(layoutId: string, fields: SignatureFields): string | null {
  const layout = SIGNATURE_LAYOUTS.find((item) => item.id === layoutId);
  if (!layout) return null;
  return renderSignatureHtml(layout.template, fields);
}

export function renderFullImageSignature(imageUrl: string, alt = 'Email Signature'): string {
  const src = escapeHtml(imageUrl.trim());
  const label = escapeHtml(alt);
  return `<table cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
  <tr>
    <td>
      <img src="${src}" alt="${label}" style="max-width: 100%; height: auto; display: block;" />
    </td>
  </tr>
</table>`;
}

export function absolutizeSignatureHtml(html: string, origin: string): string {
  const base = origin.replace(/\/$/, '');
  if (!base) return html;
  return html.replace(/(\s(?:src|href))=(["'])\/(?!\/)/gi, `$1=$2${base}/`);
}

export function signatureNeedsBrandingRefresh(html: string | null | undefined): boolean {
  const source = html || '';
  return /Your Name/i.test(source) || /EmailSignature-02\.jpg/i.test(source) || /Double Helix Hub/i.test(source);
}

export function buildPifhSignatureFromProfile(opts: {
  full_name: string;
  title?: string;
  email?: string;
  phone?: string;
  company_name?: string;
  website?: string;
  logo_url?: string;
}): string {
  return renderLayoutHtml('pifh-horizontal', {
    full_name: opts.full_name,
    title: opts.title || '',
    email: opts.email || '',
    phone: opts.phone || '',
    company_name: opts.company_name || 'Pay it Forward Health',
    website: opts.website || 'payitforwardhealth.com',
    logo_url: opts.logo_url || DEFAULT_PIFH_LOGO_PATH,
    photo_url: '',
  }) ?? '';
}

export function getSignatureOrigin(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    ''
  ).replace(/\/$/, '');
}
