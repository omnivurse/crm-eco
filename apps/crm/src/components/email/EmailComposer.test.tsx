// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./LazyEmailEditor', () => ({
  LazyEmailEditor: () => <div data-testid="email-editor" />,
}));

vi.mock('./SenderSelector', () => ({
  SenderSelector: () => <div data-testid="sender-selector" />,
}));

import { EmailComposer } from './EmailComposer';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('EmailComposer stale-branding warning', () => {
  it('opens signature settings separately so navigation cannot discard compose state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          signatures: [
            {
              id: 'signature-1',
              name: 'Legacy',
              content_html: '<p>Pay it Forward HealthShare</p>',
              is_default: true,
              include_in_replies: true,
              include_in_new: true,
            },
          ],
        }),
      }),
    );

    render(
      <EmailComposer
        initialSubject="Unsaved subject"
        initialBody="<p>Unsaved body</p>"
        fallbackEmail="advisor@example.com"
      />,
    );

    const link = await screen.findByRole('link', { name: 'Update it in Settings' });
    expect(link.getAttribute('href')).toBe('/crm/settings/signatures');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });
});
