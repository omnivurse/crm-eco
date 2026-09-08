import { describe, expect, it } from 'vitest';
import { inboxUrlHydrateDecision } from './inbox-selection';

describe('inboxUrlHydrateDecision', () => {
  it('applies a deep-link when nothing is selected yet', () => {
    expect(
      inboxUrlHydrateDecision({
        conversationFromUrl: 'A',
        lastSeenUrlId: null,
        selectedId: null,
      }),
    ).toEqual({ nextLastSeenUrlId: 'A', apply: true });
  });

  it('does not re-apply a stale URL after the reader already selected another thread', () => {
    // Click B updates state immediately; router.replace has not committed ?c=B.
    // A list refresh re-runs the effect with the old ?c=A and lastSeen still A.
    expect(
      inboxUrlHydrateDecision({
        conversationFromUrl: 'A',
        lastSeenUrlId: 'A',
        selectedId: 'B',
      }),
    ).toEqual({ nextLastSeenUrlId: 'A', apply: false });
  });

  it('does not apply when the URL has not changed (list refresh while viewing)', () => {
    expect(
      inboxUrlHydrateDecision({
        conversationFromUrl: 'A',
        lastSeenUrlId: 'A',
        selectedId: 'A',
      }),
    ).toEqual({ nextLastSeenUrlId: 'A', apply: false });
  });

  it('skips hydrate when the click already applied the new URL id', () => {
    expect(
      inboxUrlHydrateDecision({
        conversationFromUrl: 'B',
        lastSeenUrlId: 'A',
        selectedId: 'B',
      }),
    ).toEqual({ nextLastSeenUrlId: 'B', apply: false });
  });

  it('applies browser back/forward when the URL changes to a different thread', () => {
    expect(
      inboxUrlHydrateDecision({
        conversationFromUrl: 'A',
        lastSeenUrlId: 'B',
        selectedId: 'B',
      }),
    ).toEqual({ nextLastSeenUrlId: 'A', apply: true });
  });

  it('clears last-seen when ?c= is removed', () => {
    expect(
      inboxUrlHydrateDecision({
        conversationFromUrl: null,
        lastSeenUrlId: 'A',
        selectedId: 'A',
      }),
    ).toEqual({ nextLastSeenUrlId: null, apply: false });
  });
});

describe('click A then B (no revert)', () => {
  it('keeps B after a click even if the URL is still A', () => {
    let lastSeen: string | null = null;
    let selected: string | null = null;

    // Deep link / first click A — URL hydrates, then click records state
    let d = inboxUrlHydrateDecision({
      conversationFromUrl: 'A',
      lastSeenUrlId: lastSeen,
      selectedId: selected,
    });
    lastSeen = d.nextLastSeenUrlId;
    if (d.apply) selected = 'A';
    expect(selected).toBe('A');

    // Click B: state moves first; lastSeen stays A until ?c= actually changes
    selected = 'B';
    d = inboxUrlHydrateDecision({
      conversationFromUrl: 'A',
      lastSeenUrlId: lastSeen,
      selectedId: selected,
    });
    lastSeen = d.nextLastSeenUrlId;
    if (d.apply) selected = 'A';

    expect(d.apply).toBe(false);
    expect(selected).toBe('B');

    // router.replace finally commits ?c=B
    d = inboxUrlHydrateDecision({
      conversationFromUrl: 'B',
      lastSeenUrlId: lastSeen,
      selectedId: selected,
    });
    lastSeen = d.nextLastSeenUrlId;
    if (d.apply) selected = d.nextLastSeenUrlId;

    expect(d.apply).toBe(false);
    expect(selected).toBe('B');
  });
});
