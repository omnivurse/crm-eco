# CRM walk-harness test hooks (EV-6)

Stable `data-testid` / `data-field-key` hooks at the Road-to-Ten walk touchpoints.
Pure attribute additions — no copy, aria, role, behaviour or layout changed. Existing
`aria-label`/`role` contracts (Add note group, More actions, Quick filters `aria-pressed`,
Filters trigger label, Modules/Primary navs, Search (⌘K), field inputs `aria-label=field.label`)
are untouched and remain valid selectors.

Naming: `crm-<area>-<action>`. Paths are relative to `apps/crm/src`. Line numbers are as of
branch `feat/usability-road-to-ten` (wave 0).

| testid / attribute | file:line | element | purpose |
|---|---|---|---|
| `crm-palette-input` | components/crm/shell/CommandPalette.tsx:736 | `<Input>` | Command palette query box |
| `crm-palette-result` | components/crm/shell/CommandPalette.tsx:815 | `<button>` (one per row) | Palette result / command row — `getByTestId(...).first()` or filter by text |
| `crm-qc-form` | components/zoho/QuickCreateDrawer.tsx:889 | `<form>` | Quick-create drawer form root |
| `data-field-key="<key>"` | components/zoho/QuickCreateDrawer.tsx:817 | wrapper `<div>` per field | Quick-create field cell; select the control with `[data-field-key="phone"] input` / `select` / `button[role=combobox]` |
| `crm-qc-save-add-another` | components/zoho/QuickCreateDrawer.tsx:1126 | `<Button type=button>` | "Save & add another" (hidden once `created`) |
| `crm-qc-submit` | components/zoho/QuickCreateDrawer.tsx:1140 | `<Button type=submit>` | Primary save (save & open record) |
| `crm-notes-composer` | app/crm/r/[recordId]/NotesPanel.tsx:355 | `<div>` | Add-Note composer root (rendered only while adding) |
| `crm-notes-save` | app/crm/r/[recordId]/NotesPanel.tsx:393 | `<Button>` | Composer Save (disabled while empty/saving) |
| `data-field-key="<key>"` | components/crm/records/DynamicRecordForm.tsx:1059, 1086 | field cell `<div>` (dense row + stacked) | Record edit/overview field cell; input inside also has `id=<key>` and `aria-label` |
| `crm-record-snapshot` | components/crm/records/DynamicRecordForm.tsx:1441 | `<div>` | Coverage Snapshot card root (record detail + edit hero) |
| `crm-filter-apply` | components/crm/filters/FilterSidebar.tsx:1356 | `<Button>` | Filter Apply (label varies by variant — use the testid) |
| `crm-filter-cancel` | components/crm/filters/FilterSidebar.tsx:1348 | `<Button>` | Filter Cancel |
| `crm-filter-rail` (+ `data-state="collapsed"`/`"open"`) | components/crm/filters/FilterRailFrame.tsx:31, 66 | `<aside>` | Docked filter rail root; lg+ only (`hidden lg:flex`) |
| `crm-filter-toggle` | components/crm/filters/FilterRailFrame.tsx:37 | `<button>` | Collapsed-rail "Show Filters" toggle (only in collapsed state) |
| `crm-filter-trigger` | components/crm/filters/FilterSidebarTrigger.tsx:55 | `<Button>` (SheetTrigger) | Filters sheet trigger (mobile / non-docked) |
| `crm-pager-showing` | app/crm/modules/[moduleKey]/page.tsx:367 | `<p>` | "Showing X to Y of N results" text (server-rendered) |
| `crm-pager-prev` | app/crm/modules/[moduleKey]/page.tsx:403 | `<a>` (Link inside Button asChild) | Previous page link |
| `crm-pager-next` | app/crm/modules/[moduleKey]/page.tsx:446 | `<a>` | Next page link |
| `crm-lane-chip` + `data-lane="<preset.id>"` | components/crm/records/v2/QuickFilterChips.tsx:296-297 | `<button>` | Status-lane quick-filter chip; `aria-pressed` = active (unchanged) |
| `crm-row-phone` | components/crm/records/RecordTable.tsx:1055 | `<span>` in the `phone` column cell | Table phone value (desktop table only; absent when no phone) |
| `crm-row-call` | components/crm/records/RecordTable.tsx:1610 | `<Button>` | Row hover Call action (desktop table; only when `record.phone`) |
| `crm-card-phone` | components/crm/records/RecordTable.tsx:481 | `<a href=tel:>` | Mobile card phone link (`md:hidden` card view) |
| `crm-card-call` | components/crm/records/RecordTable.tsx:500 | `<Button>` | Mobile card Call action |
| `crm-record-add-note` | components/crm/records/RecordDetailShellV2.tsx:1855 | `<Button>` | Record header Add Note (inside `role=group aria-label="Add note"`) |
| `crm-record-more` | components/crm/records/RecordDetailShellV2.tsx:1932 | `<Button aria-label="More actions">` | Record header ⋯ menu trigger |
| `crm-create-primary` | components/crm/shell/SplitCreateButton.tsx:185 (quick path), 199 (Link fallback) | `<Button>` / `<a>` | Top-bar primary Add Member / Create (sm+) — exactly one renders |
| `crm-create-primary-mobile` | components/crm/shell/CrmTopBar.tsx:226 | `<Button aria-label="Add Member">` | Mobile (<sm) Add Member icon |
| `crm-topbar-search` | components/crm/shell/CrmTopBar.tsx:195 | `<button>` | Top-bar search pill (sm+) — opens palette |
| `crm-topbar-search-mobile` | components/crm/shell/CrmTopBar.tsx:211 | `<Button aria-label="Search (⌘K)">` | Mobile search icon |
| `crm-list-export` | components/zoho/ModuleHeader.tsx:193 | `<Button>` | Module list Export |
| `crm-module-tab` (+ existing `data-crm-module="<key>"`) | components/crm/shell/CrmModuleTabBar.tsx:83 | `<a>` | Module tab items |
| `crm-sidenav-item` + `data-nav-key="<item.key>"` | components/crm/shell/ZohoContextualSidebar.tsx:397, 544 | `<a>` | Contextual sidebar nav links (desktop + mobile sheet) |

Notes for harness authors
- Desktop/mobile twins (`crm-row-*` vs `crm-card-*`, `crm-topbar-search` vs `-mobile`,
  `crm-create-primary` vs `-mobile`) are distinct ids so strict-mode locators never double-match.
- `crm-palette-result`, `crm-lane-chip`, `crm-module-tab`, `crm-sidenav-item` and
  `data-field-key` are intentionally repeated — narrow with `data-lane`, `data-nav-key`,
  `data-crm-module`, the field key, or `.filter({ hasText })`.
- `crm-filter-rail` is rendered in both states with `data-state`; `crm-filter-toggle` exists only
  while collapsed (the open rail is closed from inside FilterSidebar / by the rail's own chrome).
