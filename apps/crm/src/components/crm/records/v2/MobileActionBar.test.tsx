// @vitest-environment jsdom
/**
 * TE-8 — the mobile bar's Call is a real `tel:` anchor when the record has a
 * dialable phone; a disabled button otherwise (no JS redirect anywhere).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { MobileActionBar } from './MobileActionBar';

afterEach(() => cleanup());

describe('MobileActionBar Call (TE-8)', () => {
  it('renders Call as a tel: anchor when a phone is given', () => {
    const onCall = vi.fn();
    render(<MobileActionBar phone="5550107788" hasPhone onCall={onCall} />);
    const a = screen.getByTestId('crm-mobile-bar-call');
    expect(a.tagName).toBe('A');
    expect(a.getAttribute('href')).toBe('tel:5550107788');
    expect(a.getAttribute('aria-label')).toBe('Call 5550107788');
  });

  it('renders a disabled Call button when the record has no phone', () => {
    render(<MobileActionBar hasPhone={false} onCall={vi.fn()} />);
    const btn = screen.getByRole('button', { name: 'Call' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(screen.queryByTestId('crm-mobile-bar-call')).toBeNull();
  });

  it('falls back to the onCall button when the phone is not dialable', () => {
    const onCall = vi.fn();
    render(<MobileActionBar phone="12" hasPhone onCall={onCall} />);
    const btn = screen.getByRole('button', { name: 'Call' });
    fireEvent.click(btn);
    expect(onCall).toHaveBeenCalledTimes(1);
  });
});
