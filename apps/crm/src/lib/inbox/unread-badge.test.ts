import { describe, expect, it } from 'vitest';
import { formatUnreadBadge, UNREAD_BADGE_CAP, unreadBadgeAriaLabel } from './unread-badge';

describe('formatUnreadBadge', () => {
  it('renders a normal count', () => {
    expect(formatUnreadBadge(1)).toBe('1');
    expect(formatUnreadBadge(42)).toBe('42');
  });

  it('renders nothing at zero rather than an empty pill', () => {
    expect(formatUnreadBadge(0)).toBeNull();
  });

  it('renders nothing before the count has loaded', () => {
    expect(formatUnreadBadge(null)).toBeNull();
    expect(formatUnreadBadge(undefined)).toBeNull();
  });

  it('caps large counts so the sidebar cannot be broken by a backlog', () => {
    expect(formatUnreadBadge(UNREAD_BADGE_CAP)).toBe('99');
    expect(formatUnreadBadge(UNREAD_BADGE_CAP + 1)).toBe('99+');
    expect(formatUnreadBadge(5000)).toBe('99+');
  });

  it('ignores negative and non-finite values instead of rendering junk', () => {
    expect(formatUnreadBadge(-3)).toBeNull();
    expect(formatUnreadBadge(Number.NaN)).toBeNull();
    expect(formatUnreadBadge(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('floors fractional counts', () => {
    expect(formatUnreadBadge(3.7)).toBe('3');
  });
});

describe('unreadBadgeAriaLabel', () => {
  it('is singular for one', () => {
    expect(unreadBadgeAriaLabel(1)).toBe('1 unread conversation');
  });

  it('is plural beyond one', () => {
    expect(unreadBadgeAriaLabel(4)).toBe('4 unread conversations');
  });

  it('announces the true count even when the badge is capped', () => {
    expect(unreadBadgeAriaLabel(250)).toBe('250 unread conversations');
  });

  it('is absent when there is nothing to announce', () => {
    expect(unreadBadgeAriaLabel(0)).toBeNull();
    expect(unreadBadgeAriaLabel(null)).toBeNull();
  });
});
