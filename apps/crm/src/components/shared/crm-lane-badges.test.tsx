// @vitest-environment jsdom
/**
 * RP-4 / D6b — `MarketTypeBadge` can stay quiet for an unclassified lane so the
 * rep-facing record header shows no amber "Needs Classification" badge, while
 * every other surface (rail, sheet, lists) still renders it by default.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MarketTypeBadge, NormalizationBadge } from './crm-lane-badges';

afterEach(() => cleanup());

describe('MarketTypeBadge hideUnknown', () => {
  it('renders "Needs Classification" by default for an unknown / null lane', () => {
    render(<MarketTypeBadge marketType={null} />);
    expect(screen.getByText('Needs Classification')).toBeTruthy();
  });

  it('renders nothing for unknown, null and unrecognised lanes when hideUnknown is set', () => {
    const { container } = render(
      <>
        <MarketTypeBadge marketType="unknown" hideUnknown />
        <MarketTypeBadge marketType={null} hideUnknown />
        <MarketTypeBadge marketType={undefined} hideUnknown />
        <MarketTypeBadge marketType="not-a-lane" hideUnknown />
      </>,
    );
    expect(container.textContent).toBe('');
  });

  it('still renders a classified lane when hideUnknown is set', () => {
    render(
      <>
        <MarketTypeBadge marketType="healthshare" hideUnknown />
        <MarketTypeBadge marketType="traditional_insurance" hideUnknown short />
      </>,
    );
    expect(screen.getByText('HealthShare')).toBeTruthy();
    expect(screen.getByText('Ins')).toBeTruthy();
  });
});

describe('NormalizationBadge', () => {
  it('is silent for a normalized / empty status and loud for needs_review', () => {
    const { container, rerender } = render(<NormalizationBadge status="normalized" />);
    expect(container.textContent).toBe('');
    rerender(<NormalizationBadge status={null} />);
    expect(container.textContent).toBe('');
    rerender(<NormalizationBadge status="needs_review" />);
    expect(screen.getByText('Needs Review')).toBeTruthy();
  });
});
