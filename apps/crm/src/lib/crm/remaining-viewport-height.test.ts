import { describe, expect, it } from 'vitest';
import {
  VIEWPORT_FILL_BOTTOM_GAP,
  VIEWPORT_FILL_MIN,
  remainingViewportHeight,
} from './remaining-viewport-height';

describe('remainingViewportHeight', () => {
  it('fills from the workspace top to the bottom gap', () => {
    expect(remainingViewportHeight(280, 900)).toBe(900 - 280 - VIEWPORT_FILL_BOTTOM_GAP);
  });

  it('floors at VIEWPORT_FILL_MIN so a tall toolbar cannot collapse the list', () => {
    expect(remainingViewportHeight(800, 900)).toBe(VIEWPORT_FILL_MIN);
  });

  it('is the same number for two siblings that share a top edge', () => {
    const rail = remainingViewportHeight(312, 1024);
    const table = remainingViewportHeight(312, 1024);
    expect(rail).toBe(table);
    expect(rail).toBeGreaterThan(VIEWPORT_FILL_MIN);
  });
});
