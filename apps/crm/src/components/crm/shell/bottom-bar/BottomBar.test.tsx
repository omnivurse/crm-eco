// @vitest-environment jsdom
/**
 * NV-8 (D10) — the bottom action bar is desktop chrome.
 *
 * On a phone it consumed a whole row of the viewport (and, with the module tab
 * strip, was the second thing pushing Coverage Snapshot below the fold), so it
 * renders from `lg` up only. The panels it hosts are mocked: this asserts the
 * breakpoint contract, not the chat/notes panels.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('../SmartChatInput', () => ({ SmartChatInput: () => <div /> }));
vi.mock('../ChatPanel', () => ({ ChatPanel: () => <div /> }));
vi.mock('../ChannelsPanel', () => ({ ChannelsPanel: () => <div /> }));
vi.mock('../ContactsPanel', () => ({ ContactsPanel: () => <div /> }));
vi.mock('../CommandsPopup', () => ({ CommandsPopup: () => <div /> }));
vi.mock('../StickyNotesPanel', () => ({ StickyNotesPanel: () => <div /> }));

import { BottomBar } from './BottomBar';
import type { CrmModule, CrmProfile } from '@/lib/crm/types';

afterEach(cleanup);

describe('BottomBar (NV-8)', () => {
  it('is hidden below lg and shown from lg up', () => {
    render(
      <BottomBar
        modules={[] as unknown as CrmModule[]}
        profile={{ id: 'p1', crm_role: 'crm_admin' } as unknown as CrmProfile}
      />,
    );
    const bar = screen.getByTestId('crm-bottom-bar');
    const classes = bar.className.split(/\s+/);
    expect(classes).toContain('hidden');
    expect(classes).toContain('lg:block');
    expect(classes).not.toContain('block');
  });
});
