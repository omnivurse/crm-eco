import { describe, expect, it } from 'vitest';
import { partitionViewModes } from './ViewModeSwitcher';

const modes = (opts: { mode: string }[]) => opts.map((o) => o.mode);

describe('partitionViewModes', () => {
  it('default (no visibleModes): every choosable mode as a radio, no overflow menu', () => {
    const { visible, more } = partitionViewModes('table');
    expect(modes(visible)).toEqual(['table', 'list', 'kanban', 'chart', 'timeline', 'calendar', 'split']);
    expect(more).toEqual([]);
  });

  it('visibleModes: those radios in the given order, the rest in "More views"', () => {
    const { visible, more } = partitionViewModes('table', ['table', 'list', 'split']);
    expect(modes(visible)).toEqual(['table', 'list', 'split']);
    expect(modes(more)).toEqual(['kanban', 'chart', 'timeline', 'calendar']);
  });

  it('promotes a currently-active hidden mode into the radios (and out of the menu)', () => {
    const { visible, more } = partitionViewModes('kanban', ['table', 'list', 'split']);
    expect(modes(visible)).toEqual(['table', 'list', 'split', 'kanban']);
    expect(modes(more)).toEqual(['chart', 'timeline', 'calendar']);
  });

  it('tree is only shown while active — never offered in the menu', () => {
    expect(modes(partitionViewModes('table', ['table', 'list', 'split']).more)).not.toContain('tree');
    expect(modes(partitionViewModes('tree', ['table', 'list', 'split']).visible)).toEqual([
      'table', 'list', 'split', 'tree',
    ]);
    expect(modes(partitionViewModes('tree').visible)).toContain('tree');
  });

  // ── LS-9 / decision D11: the trim is org-flag gated ──
  it('trimSurface=false ignores visibleModes — byte-identical to the untrimmed default', () => {
    const off = partitionViewModes('table', ['table', 'list', 'split'], false);
    const untrimmed = partitionViewModes('table');
    expect(modes(off.visible)).toEqual(modes(untrimmed.visible));
    expect(off.more).toEqual([]);
    expect(untrimmed.more).toEqual([]);
  });

  it('trimSurface=false keeps an active pipeline mode as a plain radio (no menu)', () => {
    const { visible, more } = partitionViewModes('kanban', ['table', 'list', 'split'], false);
    expect(modes(visible)).toEqual(['table', 'list', 'kanban', 'chart', 'timeline', 'calendar', 'split']);
    expect(more).toEqual([]);
  });

  it('trimSurface=true trims, and defaults to true for callers that omit it', () => {
    const on = partitionViewModes('table', ['table', 'list', 'split'], true);
    expect(modes(on.visible)).toEqual(['table', 'list', 'split']);
    expect(modes(on.more)).toEqual(['kanban', 'chart', 'timeline', 'calendar']);
    expect(on).toEqual(partitionViewModes('table', ['table', 'list', 'split']));
  });

  it('trimSurface has no effect when no visibleModes are given', () => {
    expect(partitionViewModes('table', undefined, true)).toEqual(
      partitionViewModes('table', undefined, false),
    );
  });
});
