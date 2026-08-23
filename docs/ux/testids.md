# CRM walk-harness test hooks (EV-6)

Stable `data-testid` / `data-field-key` hooks at the Road-to-Ten walk touchpoints.
Pure attribute additions — no copy, aria, role, behaviour or layout changed. Existing
`aria-label`/`role` contracts (Add note group, More actions, Quick filters `aria-pressed`,
Filters trigger label, Modules/Primary navs, Search (⌘K), field inputs `aria-label=field.label`)
are untouched and remain valid selectors.

Naming: `crm-<area>-<action>`. Paths are relative to `apps/crm/src`. Line numbers are as of
branch `feat/usability-road-to-ten` (Wave 2 interim tree, 2026-08-23).

| testid / attribute | file:line | element | purpose |
|---|---|---|---|
| `crm-palette-input` | components/crm/shell/CommandPalette.tsx:736 | `<Input>` | Command palette query box |
| `crm-palette-result` | components/crm/shell/CommandPalette.tsx:815 | `<button>` (one per row) | Palette result / command row — `getByTestId(...).first()` or filter by text |
| `crm-qc-form` | components/zoho/QuickCreateDrawer.tsx:1085 | `<form>` | Quick-create drawer form root |
| `data-field-key="<key>"` | components/zoho/QuickCreateDrawer.tsx:1004 | wrapper `<div>` per field | Quick-create field cell; select the control with `[data-field-key="phone"] input` / `select` / `button[role=combobox]` |
| `crm-qc-save-add-another` | components/zoho/QuickCreateDrawer.tsx:1316 | `<Button type=button>` | "Save & add another" (hidden once `created`) |
| `crm-qc-submit` | components/zoho/QuickCreateDrawer.tsx:1330 | `<Button type=submit>` | Primary save (save & open record) |
| `id="qc-<module>-<key>"` | components/zoho/QuickCreateDrawer.tsx:778 | field control (`input` / native `select` / picker input) | Quick-create control id (Wave 1: `product`/`product_type` are native `<select>`s — drive by type-ahead; `producer_name`/`producer` are the Enrolled-by combobox) |
| `id="qc-<module>-<key>-other"` (+ `data-testid` same) | components/zoho/QuickCreateDrawer.tsx:933 | `<Input>` | "Other…" free-text input revealed under an `allowOther` select (DE-1) |
| `id="qc-<module>-<key>-error"` | components/zoho/QuickCreateDrawer.tsx:1010 | `<p role=alert>` | Field-anchored validation message (DE-5); the control carries `aria-invalid` + `aria-describedby` |
| `id="qc-<module>-<key>-hint"` | components/zoho/QuickCreateDrawer.tsx:1014 | `<p>` | Render-time hint under Coverage start (`Pending needs a Coverage start date`) |
| `crm-notes-composer` | app/crm/r/[recordId]/NotesPanel.tsx:386 | `<div>` | Add-Note composer root (rendered only while adding) |
| `crm-notes-save` | app/crm/r/[recordId]/NotesPanel.tsx:430 | `<Button>` | Composer Save (disabled while empty/saving) |
| `data-field-key="<key>"` | components/crm/records/DynamicRecordForm.tsx:1059, 1086 | field cell `<div>` (dense row + stacked) | Record edit/overview field cell; input inside also has `id=<key>` and `aria-label` |
| `crm-record-snapshot` | components/crm/records/DynamicRecordForm.tsx:1467 | `<div>` | Coverage Snapshot card root (record detail + edit hero) |
| `crm-filter-apply` | components/crm/filters/FilterSidebar.tsx:1413 | `<Button>` | Filter Apply (label varies by variant — use the testid) |
| `crm-filter-cancel` | components/crm/filters/FilterSidebar.tsx:1405 | `<Button>` | Filter Cancel |
| `crm-filter-rail` (+ `data-state="collapsed"`/`"open"`) | components/crm/filters/FilterRailFrame.tsx:31, 66 | `<aside>` | Docked filter rail root; lg+ only (`hidden lg:flex`) |
| `crm-filter-toggle` | components/crm/filters/FilterRailFrame.tsx:37 | `<button>` | Collapsed-rail "Show Filters" toggle (only in collapsed state) |
| `crm-filter-trigger` | components/crm/filters/FilterSidebarTrigger.tsx:55 | `<Button>` (SheetTrigger) | Filters sheet trigger (mobile / non-docked) |
| `crm-pager` | app/crm/modules/[moduleKey]/ModuleListClient.tsx:131 (`ListPager`) | `<nav aria-label="Pagination" aria-busy>` | Pager landmark (client component; page.tsx only builds the `ListPagerModel`) |
| `crm-pager-showing` | app/crm/modules/[moduleKey]/ModuleListClient.tsx:134 | `<p aria-live=polite>` | "Showing X to Y of N {module noun}" (LS-7: noun via `toastCopy.pluralize`) |
| `crm-pager-page` | app/crm/modules/[moduleKey]/ModuleListClient.tsx:172 | `<span>` | "Page X of Y" |
| `crm-pager-size` + `data-size="25|50|100"` | app/crm/modules/[moduleKey]/ModuleListClient.tsx:155 | `<a>` inside `role=group` "Rows per page" | Per-page links; the active one carries `aria-current="true"` (not `aria-pressed` — invalid on anchors); remembered in list prefs `pageSize` |
| `crm-pager-prev` / `crm-pager-next` | app/crm/modules/[moduleKey]/ModuleListClient.tsx:178, 211 | `<a>` (`aria-disabled` at the edges) | Prev / Next page links; page numbers carry `aria-current="page"` |
| `crm-list-progress` | components/crm/filters/FilterWorkspaceRow.tsx:51 | `<div role=progressbar>` (2 px bar) | LS-3 pending state while a list navigation is in transition (pane is `aria-busy`); arm `armPendingStateLatch` BEFORE the action — it is shorter than a poll |
| `crm-lane-chip` + `data-lane="<preset.id>"` (+ `data-count-scope="module"` when the list is narrowed) | components/crm/records/v2/QuickFilterChips.tsx:368-370 | `<button>` | Status-lane quick-filter chip; `aria-pressed` = active; Pending chip also sets `sortField=created_at&sortDirection=asc` (TE-3b) |
| `crm-lane-chip-count` | components/crm/records/v2/QuickFilterChips.tsx:420 | `<span>` inside the chip | Lane count pill; muted + sr-only " of all {noun}" when search/scope/territory/view narrows the list (LS-5 option A) |
| `crm-row-phone` | components/crm/records/RecordTable.tsx:1071 | `<a href=tel:>` in the `phone` column cell | Table phone value is a click-to-call anchor (TE-3a); desktop table only; absent when no phone |
| `crm-row-call` | components/crm/records/RecordTable.tsx:1632, components/crm/views/ListView.tsx:339 | `<a href=tel:>` (`CallLink`) | Row hover/focus Call action (desktop table + ListView rows; only when `record.phone`) |
| `crm-card-phone` | components/crm/records/RecordTable.tsx:487 | `<a href=tel:>` | Mobile card phone link (`md:hidden` card view) |
| `crm-card-call` | components/crm/records/RecordTable.tsx:505 | `<a href=tel:>` (`CallLink`) | Mobile card Call action |
| `crm-record-call` | components/crm/records/RecordDetailShellV2.tsx:1755 | `<a href=tel:>` (`CallLink`, also `data-call-link`) | Record header phone anchor; hotkey `c` clicks it |
| `crm-mobile-bar-call` | components/crm/records/v2/MobileActionBar.tsx:122 | `<a href=tel:>` | Bottom action bar Call (<lg) |
| `crm-record-add-note` | components/crm/records/RecordDetailShellV2.tsx:1886 | `<Button>` | Record header Add Note (inside `role=group aria-label="Add note"`) |
| `crm-record-more` | components/crm/records/RecordDetailShellV2.tsx:1964 | `<Button aria-label="More actions">` | Record header ⋯ menu trigger |
| `crm-record-more-insights` | components/crm/records/RecordDetailShellV2.tsx:1993 | menu item (`xl:hidden`) | ⋯ › Insights opens the insights sheet below xl (RP-6) |
| `crm-record-skip-link` | components/crm/records/RecordDetailShellV2.tsx:1594 | sr-only `<a href="#record-section-nav">` | "Skip to record details" → SectionNav tablist (`id=record-section-nav`, `tabIndex=-1`) |
| `crm-record-more-timeline` | components/crm/records/RecordDetailShellV2.tsx | menu item (`xl:hidden`) | ⋯ › Timeline — the door in while the Overview/Timeline strip is hidden below xl at rest (RP-6) |
| `crm-record-add-tags` | components/crm/records/v2/RecordTagsRow.tsx:209 | `<button>` | "Add Tags" pill on a tagless record — `opacity-0` until `group/identity` hover / focus-within (RP-5); measure with `getComputedStyle` (Playwright `:visible` ignores opacity) |
| `crm-record-task-title` / `crm-record-task-submit` | components/crm/records/RecordDetailShellV2.tsx:2593, 2640 | `<Input>` / `<Button>` | Add Task dialog: submit disabled while empty + `role=alert` "Task title is required" (FB-6) |
| `crm-inline-save-status` | components/crm/records/v2/InlineFieldEditor.tsx:310 | `<span role=status aria-live=polite class=sr-only>` | Reads "Saved" while the emerald check shows (RP-M1 / D7); sibling of the `role=button` span |
| `crm-record-skeleton` | app/crm/r/[recordId]/page.tsx:348 | `<div role=status aria-busy>` | Record detail skeleton (RP-8, mirrors the V2 paint order) |
| `crm-record-layout-notice-error` / `-missing` | app/crm/r/[recordId]/RecordLayoutNotice.tsx:60 | `<div>` | RP-M2 layout fetch failed (amber, Retry) / no default layout (configuration notice) |
| `crm-create-primary` | components/crm/shell/SplitCreateButton.tsx:195 (quick path), 209 (Link fallback) | `<Button>` / `<a>` | Top-bar primary Add Member / Create (sm+) — exactly one renders; absent for `crm_viewer` (DE-M1 `canCreateRecords`) |
| `crm-create-primary-mobile` | components/crm/shell/CrmTopBar.tsx:237 | `<Button aria-label="Add Member">` | Mobile (<sm) Add Member icon; absent for `crm_viewer` |
| `crm-module-create` | components/zoho/ModuleHeader.tsx:222, 228 | `<Button>` / `<a>` | Module list primary create button; absent for `crm_viewer` |
| `crm-topbar-search` | components/crm/shell/CrmTopBar.tsx:203 | `<button>` | Top-bar search pill (md+) — opens palette; text = `SEARCH_PLACEHOLDER` |
| `crm-topbar-search-mobile` | components/crm/shell/CrmTopBar.tsx:220 | `<Button aria-label={SEARCH_PLACEHOLDER}>` | Search icon below md (NV-1: aria-label is the canonical placeholder, no longer "Search (⌘K)") |
| `crm-search-result` | app/crm/search/page.tsx:125 | result row | /crm/search rows (NV-4 parity with the palette resolver) |
| `crm-list-export` | components/zoho/ModuleHeader.tsx:210 | `<Button>` | Module list Export (disabled at 0 rows) |
| `crm-module-tab` (+ existing `data-crm-module="<key>"`) | components/crm/shell/CrmModuleTabBar.tsx:83 | `<a>` | Module tab items |
| `crm-sidenav-item` + `data-nav-key="<item.key>"` | components/crm/shell/ZohoContextualSidebar.tsx | `<a>` | Contextual sidebar nav links (desktop + mobile sheet); admin-only Settings links are absent for non-admins (NV-M1) |
| `data-display-only` + `title={DISPLAY_ONLY_FIELD_HINT}` | components/crm/filters/FilterSidebar.tsx:1122 | `<button disabled aria-disabled>` | Rail field rows for display-only twins (Members plan / effective date) — LS-4 |
| `aria-current="page"` | components/crm/shell/ModuleSwitcherRail.tsx:78 (+ CrmModuleTabBar, sidebar links) | `<a data-crm-module>` | Exactly one current tab on every surface (NV-2 sticky tab) |

Notes for harness authors
- Desktop/mobile twins (`crm-row-*` vs `crm-card-*`, `crm-topbar-search` vs `-mobile`,
  `crm-create-primary` vs `-mobile`) are distinct ids so strict-mode locators never double-match.
- `crm-palette-result`, `crm-lane-chip`, `crm-module-tab`, `crm-sidenav-item` and
  `data-field-key` are intentionally repeated — narrow with `data-lane`, `data-nav-key`,
  `data-crm-module`, the field key, or `.filter({ hasText })`.
- `crm-filter-rail` is rendered in both states with `data-state`; `crm-filter-toggle` exists only
  while collapsed (the open rail is closed from inside FilterSidebar / by the rail's own chrome).
