// @vitest-environment jsdom
/**
 * TE-8 — CallLink is THE click-to-call primitive: a real `tel:` anchor
 * (normalised by telHref), row-click propagation stopped, graceful fallback
 * when the phone is not dialable.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { CallLink } from './CallLink';

afterEach(() => cleanup());

describe('CallLink (TE-8)', () => {
  it('renders a real tel: anchor with the digits-only href', () => {
    render(
      <CallLink phone="(555) 010-7788" data-testid="call">
        Call
      </CallLink>,
    );
    const a = screen.getByTestId('call');
    expect(a.tagName).toBe('A');
    expect(a.getAttribute('href')).toBe('tel:5550107788');
    expect(a.hasAttribute('data-call-link')).toBe(true);
  });

  it('keeps a plain 10-digit phone as the walk harness expects (tel:<digits>)', () => {
    render(<CallLink phone="5550107701">Call</CallLink>);
    expect(screen.getByRole('link').getAttribute('href')).toBe('tel:5550107701');
  });

  it('stops propagation so a Call inside a clickable row never opens the record, and still runs onClick', () => {
    const rowClick = vi.fn();
    // preventDefault: jsdom cannot navigate to tel: and would log an error.
    const onClick = vi.fn((e: React.MouseEvent) => e.preventDefault());
    render(
      <div onClick={rowClick}>
        <CallLink phone="5550107788" onClick={onClick} data-testid="call">
          Call
        </CallLink>
      </div>,
    );
    fireEvent.click(screen.getByTestId('call'));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(rowClick).not.toHaveBeenCalled();
  });

  it('renders the fallback (default nothing) when the phone is not dialable', () => {
    const { container } = render(<CallLink phone="123">Call</CallLink>);
    expect(container.querySelector('a')).toBeNull();
    render(<CallLink phone={null} fallback={<span>no phone</span>} />);
    expect(screen.getByText('no phone')).toBeTruthy();
  });
});
