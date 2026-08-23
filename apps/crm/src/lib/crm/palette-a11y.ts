/**
 * A11Y-1 — the ⌘K palette is a combobox + listbox, not a pile of buttons.
 *
 * The input owns the focus; the rows are `role="option"` inside a
 * `role="listbox"`, and `aria-activedescendant` on the input points at the
 * selected row so a screen reader announces the selection as ↑/↓ move it.
 * All the ids come from here so the component can never emit a dangling
 * `aria-activedescendant` / `aria-controls` (both are axe violations) and so
 * the mapping is unit-testable without rendering the palette.
 *
 * `uid` is a React `useId()` value (e.g. ":r7:") — legal in an id/IDREF even
 * though it is not a legal CSS selector, so query the DOM by attribute.
 */

export function paletteListboxId(uid: string): string {
  return `${uid}-results`;
}

export function paletteOptionId(uid: string, index: number): string {
  return `${uid}-opt-${index}`;
}

/** Stable id for a bucket heading, used as the group's `aria-labelledby`. */
export function paletteCategoryId(uid: string, category: string): string {
  const slug =
    category
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'group';
  return `${uid}-cat-${slug}`;
}

/**
 * The id `aria-activedescendant` should carry, or `undefined` when there is no
 * rendered row to point at (empty query, "no matches", results still loading).
 */
export function paletteActiveOptionId(args: {
  uid: string;
  selectedIndex: number;
  rowCount: number;
}): string | undefined {
  const { uid, selectedIndex, rowCount } = args;
  if (!Number.isInteger(selectedIndex) || selectedIndex < 0) return undefined;
  if (rowCount <= 0 || selectedIndex >= rowCount) return undefined;
  return paletteOptionId(uid, selectedIndex);
}

/** Accessible name for the results listbox (the input's own label is search copy). */
export const PALETTE_LISTBOX_LABEL = 'Palette results';
