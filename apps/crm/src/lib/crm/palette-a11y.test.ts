/**
 * A11Y-1 — palette combobox/listbox id mapping. The rule that matters: an
 * `aria-activedescendant` that points at nothing is worse than none at all
 * (axe flags it as a violation and AT announces silence), so the helper must
 * return `undefined` for every "no rendered row" state.
 */
import { describe, expect, it } from 'vitest';
import {
  PALETTE_LISTBOX_LABEL,
  paletteActiveOptionId,
  paletteCategoryId,
  paletteListboxId,
  paletteOptionId,
} from './palette-a11y';

const UID = ':r7:';

describe('palette a11y ids', () => {
  it('derives listbox and option ids from the React useId value', () => {
    expect(paletteListboxId(UID)).toBe(':r7:-results');
    expect(paletteOptionId(UID, 0)).toBe(':r7:-opt-0');
    expect(paletteOptionId(UID, 12)).toBe(':r7:-opt-12');
  });

  it('slugifies bucket headings into stable group label ids', () => {
    expect(paletteCategoryId(UID, 'Records')).toBe(':r7:-cat-records');
    expect(paletteCategoryId(UID, 'Recently viewed')).toBe(':r7:-cat-recently-viewed');
    expect(paletteCategoryId(UID, 'Quick Actions')).toBe(':r7:-cat-quick-actions');
    expect(paletteCategoryId(UID, 'Jump to field')).toBe(':r7:-cat-jump-to-field');
    // Two different headings never collide on one id.
    expect(paletteCategoryId(UID, 'Navigation')).not.toBe(paletteCategoryId(UID, 'Terminal Commands'));
    // A heading with nothing slug-able still yields a usable id.
    expect(paletteCategoryId(UID, '···')).toBe(':r7:-cat-group');
  });

  it('points aria-activedescendant at the selected row', () => {
    expect(paletteActiveOptionId({ uid: UID, selectedIndex: 0, rowCount: 5 })).toBe(':r7:-opt-0');
    expect(paletteActiveOptionId({ uid: UID, selectedIndex: 4, rowCount: 5 })).toBe(':r7:-opt-4');
  });

  it('returns undefined whenever no row is rendered to point at', () => {
    // Empty palette (idle query, "no matches", search still loading).
    expect(paletteActiveOptionId({ uid: UID, selectedIndex: 0, rowCount: 0 })).toBeUndefined();
    // Selection left over from a longer list while the new list is shorter.
    expect(paletteActiveOptionId({ uid: UID, selectedIndex: 5, rowCount: 5 })).toBeUndefined();
    expect(paletteActiveOptionId({ uid: UID, selectedIndex: -1, rowCount: 5 })).toBeUndefined();
    expect(paletteActiveOptionId({ uid: UID, selectedIndex: 1.5, rowCount: 5 })).toBeUndefined();
  });

  it('names the listbox for assistive tech', () => {
    expect(PALETTE_LISTBOX_LABEL).toBe('Palette results');
  });
});
