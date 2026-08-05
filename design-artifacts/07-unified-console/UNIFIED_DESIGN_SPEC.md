# Unified Console Design Specification — CRM + Admin

**Scope:** `apps/crm` (≈220 routes, 678 `.tsx`) and `apps/admin` (123 routes, 244 `.tsx`), unified through `packages/ui`.
**Deliverable:** developer-ready redesign specification.
**Date:** 2026-08-02

> **Implementation status.** This document was written as a spec before any code changed.
> Phases 1 and 2 have since been implemented — see [§11 Implementation log](#11-implementation-log)
> for exactly what landed, what shifted visually, and what remains unverified.
> Sections 1–10 are preserved as originally written, so the evidence that motivated
> each decision stays legible. Where a finding has since been fixed, §11 says so.

---

## 0. Standing limitation (read first)

Every finding below is derived from **source inspection**, not from rendering the applications. Code facts (a token exists, a class is used N times, a prop is never set) are labelled **Verified**. Visual and usability consequences of those facts are labelled **Inferred** — they are strongly implied but not proven until the screens are rendered.

**No accessibility conformance is claimed.** Section 6 is a *specification and test plan*, not a conformance report. Nothing here substitutes for rendering both consoles at real breakpoints with real data.

Labels used throughout: **Verified** · **Inferred** · **Proposed** · **Unknown**.

---

## 1. Executive verdict

**Status: Visually polished but systemically unbound.**

Both consoles are individually competent and clearly designed with intent. They are not divergent because anyone chose two directions — they are divergent because **almost nothing is bound to the shared design system.** The system in `packages/ui` is complete and correct. It is simply not what the products are painted with.

| Measure | CRM | Admin | Source |
|---|---|---|---|
| `.tsx` files | 678 | 244 | **Verified** |
| Files using raw Tailwind palette (`slate-*`, `teal-*`, `amber-*`…) | **528 (78%)** | **168 (69%)** | **Verified** |
| Raw colour-class occurrences | **26,536** | **3,991** | **Verified** |
| Files using semantic tokens (`bg-card`, `text-muted-foreground`, `border-border`) | **25 (3.7%)** | **49 (20%)** | **Verified** |

The shared preset (`packages/ui/tailwind.preset.ts`) already exposes the full shadcn semantic layer, brand scales, radii, shadows and type scale. The shared theme (`packages/ui/src/styles/theme.css`, 567 lines) already defines light + dark for all of it, plus a complete 7-hue `--tone-*` status system. **The infrastructure is not the problem. Adoption is.**

Consequently: **you cannot unify these consoles by choosing colours.** Changing a token today moves ~4% of CRM and ~20% of Admin. A unification effort that starts with visual direction will produce a spec nobody can apply. This document therefore specifies a **binding programme** first and a visual thesis second.

### What must be preserved

These are genuine assets. Do not rebuild them.

1. **The `--tone-*` status system** — 7 semantic tones, light + dark, one hue = one meaning, consumed by `StatusBadge` in **26 CRM files and 28 Admin files**. *(Verified.)* This is the proof the model works.
2. **CRM's density system** — `compact` / `default` / `comfortable`, applied **pre-paint** via `html[data-density]`, driving row height, toolbar height, chrome height, gutters, cell padding and a derived scroll offset. Defaults new users to `compact`. *(Verified, `apps/crm/src/app/globals.css:330-400`.)* This is better than most commercial CRMs ship.
3. **`IdentityActionsHeader`** — the shared responsive identity/actions primitive that *both* apps' page headers already wrap. *(Verified.)*
4. **CRM's `MUTED_SPRUCE` palette remap** — the de-fluorescing decision is right. Its *delivery mechanism* needs to change (§3.1.3), not the decision.
5. Admin's **breadcrumbs**, **collapsible nav sections with active-section auto-expand**, and **organization switcher**.

### The shortest path

Four dependency-ordered phases, detailed in §7. Phase 1 alone converges the two consoles' colour more than any other single change in this document, and touches **two files**.

---

## 2. Evidence ledger

| ID | Type | Source | Observation | Confidence |
|---|---|---|---|---|
| E1 | Static | `apps/crm/tailwind.config.ts:14-26` | CRM **remaps** Tailwind's `teal`, `cyan` and `brand.teal` palettes onto a custom `MUTED_SPRUCE` scale. Admin does not. | **Verified** |
| E2 | Static | `apps/admin/tailwind.config.ts` | Admin's Tailwind config extends nothing — preset + animate plugin only. Stock Tailwind palette. | **Verified** |
| E3 | Derived | E1 + E2 | `bg-teal-500` renders `#2f757f` in CRM and `#14b8a6` in Admin. **The same class is a different colour in each app.** Copying a component between apps silently changes its colour. | **Verified** |
| E4 | Static | `apps/admin/src/app/globals.css:15-56` | Admin declares a private 18-token `--adm-*` system duplicating the shared semantic layer. `--adm-ink: #0b1220` is **byte-identical** to the ink value already documented in `DESIGN_MEMORY.md`. | **Verified** |
| E5 | Static | grep across both apps | Icon libraries are cleanly split: CRM = **534 files** `lucide-react`; Admin = **181 files** `@phosphor-icons/react`. `packages/ui` = **20 files, lucide only**. | **Verified** |
| E6 | Derived | E5 | Every Admin screen that renders a shared `packages/ui` component displays **Phosphor and Lucide icons side by side** — different stroke weights and metaphors. | **Inferred** |
| E7 | Static | `packages/ui/src/components/stat-card.tsx` | Shared `stat-card` has **0 importers** across both apps. Admin ships its own `components/dashboard/StatCard.tsx`. | **Verified** |
| E8 | Static | `status-badge.tsx` (both apps) | Both CRM locals **re-export** the shared token-driven `StatusBadge`. Migration was done, and it held. | **Verified** |
| E9 | Derived | E7 + E8 | The component promoted **with a migration** (StatusBadge) reached 54 files. The component published **without one** (stat-card) reached zero. Publishing a shared component is not adoption. | **Inferred** |
| E10 | Static | both `PageHeader.tsx` files | Both wrap the same `IdentityActionsHeader`. Divergence is **skin + disjoint props only**: CRM has `badge`; Admin has `backHref`/`backLabel`/`size`. Neither can do both. | **Verified** |
| E11 | Static | `CrmShell.tsx:83` vs `AdminShell.tsx:67` | CRM uses `h-screen`; Admin uses `h-[100dvh]`. | **Verified** |
| E12 | Derived | E11 | On mobile Safari/Chrome, `100vh` excludes dynamic browser chrome, so CRM's `BottomBar` is pushed below the fold. Admin is correct. | **Inferred — high confidence** |
| E13 | Static | `apps/crm/src/app/globals.css` vs `apps/admin/src/app/globals.css` | Admin has **zero** density support (`grep -c "density\|compact"` = 0). | **Verified** |
| E14 | Derived | E13 | Admin operators working Billing / NACHA / Commissions / Transactions tables have no compact mode; CRM reps do — and CRM *defaults* to compact. The denser workload has the looser default. | **Inferred** |
| E15 | Static | `CrmTopBar.tsx:71,303` | `quickCreateOpen` is initialised `false` and `setQuickCreateOpen` is passed **only** to the drawer's own `onOpenChange`. Nothing can open it. | **Verified** |
| E16 | Derived | E15 | `QuickCreateDrawer` is dead UI — it lazy-loads a chunk that can never render. | **Inferred — high confidence** |
| E17 | Static | `layout.tsx` both apps | Theme persists under **`crm-theme`** and **`admin-theme`** — separate keys. | **Verified** |
| E18 | Derived | E17 | A user who selects dark mode in CRM lands in light mode in Admin. | **Inferred — high confidence** |
| E19 | Static | `apps/crm/src/app/layout.tsx:82` vs `CrmShell.tsx:83` | Pre-paint anti-flash background is hardcoded `#0f172a` (slate-900); the actual dark canvas is `bg-slate-950` (`#020617`). | **Verified** |
| E20 | Derived | E19 | Dark-mode load flashes a lighter navy before settling — the anti-flash script introduces the flash it exists to prevent. | **Inferred** |
| E21 | Static | three sources | Three different dark grounds: Admin `#050505` (neutral black), CRM `#020617` (slate-950), `DESIGN_MEMORY.md` `#060b16` (cool navy). | **Verified** |
| E22 | Static | `CrmTopBar.tsx:107-118` | Role badges use amber (admin), teal (manager), emerald (agent) — colliding with the `--tone-*` meanings where amber = attention/pending and emerald = success. | **Verified** |
| E23 | Derived | E22 | Violates the documented "one hue = one meaning, everywhere" rule the tone system exists to enforce. | **Inferred** |
| E24 | Static | `AdminShell.tsx:36-49` | Sidebar collapse persists to `localStorage`, but is read in `useEffect` — after first paint. CRM's `sidebarOpen` is not persisted at all. | **Verified** |
| E25 | Derived | E24 | Admin flashes an expanded sidebar then collapses it; CRM forgets the preference on every navigation that remounts the shell. | **Inferred** |
| E26 | Static | `apps/admin/src/app/globals.css:88-95` | `.adm-grain` is `position: fixed; inset: 0; z-index: 50`. Radix overlays commonly occupy `z-50`. | **Verified** |
| E27 | Derived | E26 | Grain may composite above dialogs, or below them, unpredictably by mount order. **Requires rendering to confirm.** | **Unknown** |
| E28 | Static | route maps | ~14 domains exist in **both** consoles at different addresses with different labels (§3.4.1). | **Verified** |
| E29 | Static | `ModuleContext.tsx:163` | CRM nav labels `/crm/members` as **"Advisors & Agents"** — label does not match route or object. | **Verified** |
| E30 | Static | top-level `page.tsx` files | `/leads`, `/members`, `/dashboard` etc. are legitimate back-compat `redirect()` stubs, **not** duplicate implementations. | **Verified** |

---

## 3. The unification contract

Four layers, in strict dependency order. Each lower layer is worthless until the one below it is bound.

```
  Layer 4 · Shell & IA        ← what the user navigates
  Layer 3 · Components        ← what the user touches
  Layer 2 · Icons             ← the visual alphabet
  Layer 1 · Tokens            ← everything resolves here
```

### 3.1 Layer 1 — Tokens

#### 3.1.1 Retire `--adm-*` (Proposed)

Admin's 18 private tokens map 1:1 onto tokens that already exist. This is accidental duplication, not deliberate divergence — `--adm-ink` is the *same hex* as the documented shared ink (E4).

| `--adm-*` | Light value | Replace with | Note |
|---|---|---|---|
| `--adm-void` | `#f6fafb` | `--background` | |
| `--adm-panel` | `#ffffff` | `--card` | |
| `--adm-ink` | `#0b1220` | `--foreground` | identical to documented shared ink |
| `--adm-muted` | `#64748b` | `--muted-foreground` | |
| `--adm-hairline` | `rgba(11,109,133,.10)` | `--border` | |
| `--adm-cyan` | `#0891b2` | `--primary` | |
| `--adm-emerald` | `#059669` | `--success` | |
| `--adm-amber` | `#d97706` | `--warning` | |
| `--adm-rose` | `#e11d48` | `--destructive` | |
| `--adm-teal` | `#0b6d85` | `--brand-teal-700` | **only token that does not lift in dark mode** — verify intentional |
| `--adm-glass`, `--adm-glass-inner` | | `--glass-bg`, `--glass-border` | shared equivalents exist |
| `--adm-shadow` | | `--shadow-md` | |
| `--adm-ease`, `--adm-ease-out` | | promote to shared `--ease`, `--ease-out` | Admin's curves are better; adopt them suite-wide |
| `--adm-mesh-1/2/3` | | **delete** | see §4 |

**Migration is mechanical.** `--adm-*` is referenced through `text-[var(--adm-ink)]`-style arbitrary values, which are greppable and unambiguous. Keep `--adm-*` as aliases pointing at the shared tokens for one release so nothing breaks mid-migration, then delete.

#### 3.1.2 Promote the density layer (Proposed)

CRM's `--crm-*` metrics are **not** duplicative — they are a density system Admin entirely lacks (E13). Promote them to `packages/ui/src/styles/theme.css` under a neutral prefix, and have Admin adopt them.

| Rename | `compact` | `default` | `comfortable` |
|---|---|---|---|
| `--crm-row-h` → `--ui-row-h` | 34px | 40px | 52px |
| `--crm-toolbar-h` → `--ui-toolbar-h` | 42px | 48px | 56px |
| `--crm-topbar-h` → `--ui-topbar-h` | 38px | 44px | 52px |
| `--crm-modulebar-h` → `--ui-navbar-h` | 32px | 38px | 44px |
| `--crm-gutter` → `--ui-gutter` | 14px | 20px | 28px |
| `--crm-section-gap` → `--ui-section-gap` | 16px | 24px | 32px |
| `--crm-cell-py` → `--ui-cell-py` | 5px | 8px | 12px |
| `--crm-view-offset` → `--ui-view-offset` | 184px | 220px | 248px |
| `--crm-chrome-h` → `--ui-chrome-h` | *derived* | *derived* | *derived* |

Keep `--crm-*` as aliases (`--crm-row-h: var(--ui-row-h)`) so CRM's ~existing consumers keep working untouched. Admin opts in by adding the shared `data-density` boot logic to its own pre-paint script.

**Density default per console (Proposed):** CRM keeps `compact`. Admin should also default to `compact` — its Billing, NACHA, Commissions and Transactions tables are the densest surfaces in the suite (E14).

#### 3.1.3 Resolve the palette remap — **highest leverage change in this document** (Proposed)

E3 is the single largest driver of visual divergence: 26,536 CRM colour classes resolve through `MUTED_SPRUCE`, and Admin's 3,991 do not.

Do **not** fix this by rewriting call sites. Fix it where it is declared.

**Move `MUTED_SPRUCE` into `packages/ui/tailwind.preset.ts` as a named export, then spread it into both `apps/crm` and `apps/admin` Tailwind configs.**

```ts
// packages/ui/tailwind.preset.ts
export const MUTED_SPRUCE = { 50:'#eef4f5', /* … */ 950:'#0d2126' } as const;
export const consoleColors = {
  teal: MUTED_SPRUCE, cyan: MUTED_SPRUCE, brand: { teal: MUTED_SPRUCE },
};
```

```ts
// apps/admin/tailwind.config.ts  — the entire Admin-side change
theme: { extend: { colors: consoleColors } }
```

**Why opt-in-per-app rather than putting it in the preset body:** the preset is also consumed by `member-portal`, `advisor-portal`, `website` and `doublehelixhub`. Putting the remap in the preset body would recolour four products that are out of scope. Exporting a constant that CRM and Admin both spread in is surgical.

**Effect:** ~4,000 Admin colour references converge onto CRM's palette by editing one file. **Risk:** Admin's appearance changes immediately and broadly — this change requires a full visual-regression pass before merge (§8), and it is the one change in this document that must not be shipped unreviewed.

**Sequencing note:** this is a *bridge*, not the destination. It buys visual convergence now while §3.3 binds components to semantic tokens. Once binding reaches a supermajority of surfaces, the remap can be retired.

#### 3.1.4 Unify theme persistence (Proposed)

- One key: `dhh-theme`, replacing `crm-theme` and `admin-theme` (E17/E18). Migrate on read: if `dhh-theme` is absent, adopt the legacy per-app value, then write the new key.
- One pre-paint boot script in `packages/ui` handling **theme + density together**, consumed by both `layout.tsx` files. Today CRM's handles both; Admin's handles theme only.
- Fix the anti-flash colour (E19/E20): the hardcoded `#0f172a` must equal the real canvas. Derive it from the resolved `--background` token rather than hardcoding a third value.
- Settle **one** dark ground (E21). **Proposed:** `DESIGN_MEMORY.md`'s `#060b16` — the cool navy is a deliberate brand decision; Admin's `#050505` is neutral black and CRM's `#020617` is a Tailwind default. Neither was chosen.

### 3.2 Layer 2 — Icons

**Verified state:** CRM 534 files Lucide · Admin 181 files Phosphor · `packages/ui` Lucide-only. Admin therefore mixes both families wherever it renders a shared component (E6).

**Proposed:** standardise on **Lucide**, because `packages/ui` is already Lucide and shared components are the ones that must render identically in both consoles. Standardising on Phosphor would mean rewriting the shared library *and* CRM — 554 files versus 181.

This is the **lowest-priority** item in this document and should be scheduled last. It is high-volume, low-risk, and purely mechanical; it should not block Phases 1–3. Admin may run Phosphor and Lucide side by side indefinitely without harm beyond the inconsistency itself.

Rules once migrated:
- One family. No mixing within a console.
- Icons are decorative (`aria-hidden`) whenever adjacent to a real text label.
- Icon-only controls carry an `aria-label` **and** a tooltip — never colour or position alone as the carrier of meaning.
- Sizes bind to the density scale, not per-call-site values.

### 3.3 Layer 3 — Components

#### 3.3.1 `PageHeader` — one component, union of props (Proposed)

E10 is the cleanest illustration of the whole problem: **the hard part is already shared.** Both apps wrap `IdentityActionsHeader`, so responsive behaviour, alignment and overflow are common. Only the skin and prop surface diverge — and they diverge into *disjoint* capabilities, so neither console can do what the other can.

| Aspect | CRM today | Admin today | **Unified spec** |
|---|---|---|---|
| Title | `text-2xl font-bold` slate-900 | `text-xl sm:text-2xl font-semibold` `--adm-ink` | `text-xl sm:text-2xl font-semibold text-foreground` |
| Description | `text-sm` slate-500 | `text-sm` `--adm-muted` | `text-sm text-muted-foreground` |
| Divider | `pb-6 mb-6 border-b` | none (`mb-6` only) | `pb-5 mb-5 border-b border-border`, suppressible via `divider={false}` |
| Icon treatment | neutral `bg-slate-100` chip | `bg-gradient-to-br from-primary` tile | **neutral `bg-muted` chip** — see rationale |
| `size` | ✗ | `default \| large \| small` | ✓ retained |
| `backHref` / `backLabel` | ✗ | ✓ | ✓ retained |
| `badge` slot | ✓ | ✗ | ✓ retained |

**Icon rationale (Proposed):** adopt CRM's neutral chip, not Admin's gradient tile. A saturated gradient at the top-left of every page is the most visually dominant element on the screen while carrying the *least* information — it competes with the primary action for first fixation. Reserve gradient fills for the brand mark. *(Inferred — worth validating in the first render pass.)*

Ship as `packages/ui/src/components/page-header.tsx`, exporting `PageHeader`, `SectionHeader`, `CardHeaderTitle`. Both apps re-export from their existing paths so no import churn.

#### 3.3.2 `StatCard` — migrate, don't republish (Proposed)

E7/E9 is the cautionary tale: `packages/ui/stat-card.tsx` exists, is presumably fine, and has **zero importers**. Admin's own `StatCard` is the richer component — it has `trend` with direction, `href` linking, `pulse`, and `size`.

**Do not adopt the shared one as-is.** Port Admin's superset *into* `packages/ui`, bind it to semantic and `--tone-*` tokens, then migrate both consoles and **delete both originals in the same PR**. The deletion is the part that makes it stick.

Requirements:
- Trend direction must not be colour-only — pair the hue with the ↑/↓/− glyph *and* a text label (`"+12% vs last month"`).
- Numerals use `font-mono` + `tabular-nums` per `DESIGN_MEMORY.md`.
- Must specify **loading / empty / stale / error** states. A KPI that silently renders `0` when its query failed is a correctness bug, not a visual one.

#### 3.3.3 `EmptyState` — consolidate (Proposed)

CRM has two (`crm/lists/EmptyState.tsx`, `dashboard/widgets/shared/EmptyState.tsx`); Admin has none. Promote one to `packages/ui`.

Anatomy: icon (decorative) · headline stating *what is absent* · one sentence on *why it might be absent* · **primary action** · optional secondary. Distinguish three cases that are routinely conflated:
- **First-use** — nothing has ever existed → teach + primary create action.
- **Filtered-empty** — things exist but this view excludes them → show active filter summary + **Clear filters**.
- **Permission-empty** — things exist but this user may not see them → say so plainly; do not imply the records are absent, and do not leak counts.

#### 3.3.4 Data tables — the largest open divergence (Proposed)

CRM built a **generic** `RecordTable` driven by the module system. Admin hand-rolls **one table per entity** (`AgentTable`, `MemberTable`, `ProductTable`, `VendorTable`).

This is a genuine architectural fork, not a skin difference, and it is **out of scope for a token/skin unification.** Attempting it inside this programme would blow the blast radius past what can be safely reviewed.

**Proposed for now:** unify the *presentation contract* only — row height (`--ui-row-h`), cell padding (`--ui-cell-py`), header treatment, zebra/hover, sort affordance, selection column, alignment (numerics right-aligned, `tabular-nums`, units explicit), sticky header behaviour, and empty/loading/error states. Leave the underlying implementations forked.

**Then run a separate discovery** on whether Admin's four entity tables should adopt CRM's generic `RecordTable`. That is a real decision with real trade-offs and it deserves its own evidence. **Do not fold it into this programme.** Flagged as **Unknown**.

### 3.4 Layer 4 — Shell and IA

#### 3.4.1 Overlapping domains (Verified)

~14 concepts exist in both consoles at different addresses, several under different names:

| Concept | CRM | Admin | Conflict |
|---|---|---|---|
| Members | `/crm/members` — labelled **"Advisors & Agents"** | `/members` | label ≠ route ≠ object (E29) |
| Tickets / Support | `/crm/tickets` | `/support` | **different word for the same object** |
| Enrollment | `/crm/enrollment` | `/enrollments` | singular vs plural |
| Commissions | `/crm/commissions` | `/commissions/*` (5 routes) | depth mismatch |
| Communications | `/crm/inbox`, `/crm/communications` | `/communications/inbox` | inverted hierarchy |
| Documents · Vendors · Products · Profile | `/crm/*` | `/*` | prefix only |
| Reports · Analytics | `/crm/reports`, `/crm/analytics` | `/reports`, `/analytics` | split the same way in both — good |
| Settings: audit-logs · automations · security | `/crm/settings/*` | `/settings/*` | identical shape — good |
| Learn | `/crm/learn/*` (~40 routes) | `/learn/*` (9 routes) | two separate doc sets |

**Proposed — terminology first, routes second.** Publish a shared object lexicon and enforce it in labels, breadcrumbs, page titles, empty states and search results. Settle at minimum: **Support vs Tickets** (pick one word), **Enrollment vs Enrollments** (plural for collections), and **"Advisors & Agents" → "Members"** or point that nav item at the object it actually names.

Route restructuring is **not** proposed here. It breaks bookmarks and deep links for a purely cosmetic gain, and §3.4.2 solves the user-facing confusion more cheaply.

#### 3.4.2 Unified shell model (Proposed)

Two incompatible structural theses today:

| | CRM | Admin |
|---|---|---|
| Canvas | edge-to-edge, `h-screen` ⚠️ | contained `max-w-[92rem]`, `h-[100dvh]` ✓ |
| Nav model | horizontal module tab bar (6) **+** contextual sidebar | single sidebar, 9 collapsible sections |
| Chrome | topbar 44 + modulebar 38 + **BottomBar** | topnav + breadcrumbs + footer + container padding |
| Breadcrumbs | ✗ | ✓ |
| Density | ✓ 3 modes | ✗ |
| Atmosphere | flat | mesh gradients + grain overlay |

**Take structure from CRM, refinement from Admin:**

1. **Canvas:** edge-to-edge, `h-[100dvh]` in both. Fixes E12. Drop Admin's `max-w-[92rem]` container — on a 1920px operations display it wastes ~30% of the width that Billing and Commissions tables need.
2. **Chrome:** one topbar at `--ui-topbar-h` + one navigation strip at `--ui-navbar-h`, both density-driven. Admin adopts the derived `--ui-chrome-h` so offsets cannot drift.
3. **Breadcrumbs:** adopt Admin's, in both. CRM has ~220 routes nested up to four deep with no positional indicator — the console that needs breadcrumbs most is the one without them.
4. **Sidebar state:** persist collapse under one key, read **pre-paint** in the shared boot script. Fixes both halves of E24/E25 — Admin's flash and CRM's amnesia.
5. **BottomBar:** CRM-only. Justify or retire it — it is a fourth simultaneous navigation surface (topbar, module tabs, sidebar, bottom bar, plus ⌘K palette). **Unknown** whether it earns its space; needs usage data.
6. **Remove dead UI:** delete `QuickCreateDrawer` from `CrmTopBar` or wire it to a trigger (E15/E16).
7. **Role badges:** stop using tone hues for identity (E22/E23). Role is not a status. Use a neutral chip.

---

## 4. Visual thesis (Proposed)

**One direction, both consoles: "Clean blue technology," calm and trust-forward.**

Chosen from product context, not preference: this suite moves money (NACHA, billing runs, commission payouts) and handles health enrollment data. Per the operating method, financial, compliance and operational surfaces stay calm. Both consoles are operational; neither is an exploration surface.

**Adopt from Admin:** hairline borders, two-layer soft shadow, restrained semibold headings, responsive type sizing, the `--adm-ease` motion curves, breadcrumbs.

**Adopt from CRM:** edge-to-edge structure, density system, `MUTED_SPRUCE` de-fluorescing, muted-spruce-over-neon discipline.

**Retire — with reasoning:**

- **`.adm-grain`** — a fixed full-viewport noise overlay at `z-50`, above all content. It adds no information, sits over every data table, and has an unresolved stacking relationship with Radix overlays (E26/E27). Cost: one deleted rule.
- **`--adm-mesh-1/2/3`** — three radial gradients on the app canvas. Any gradient behind a data surface reduces effective text contrast and makes AA verification position-dependent rather than token-dependent. On a compliance console this is a liability.
- **Gradient icon tiles** in page headers (§3.3.1).

Keep glass **strictly** to the top bar's translucency over scrolling content, where it communicates layering. Not on cards, not on panels, not on the canvas.

**Density is the expressive axis, not decoration.** A power user's console earns its premium feel from information per screen, predictable rhythm and instant response — not from texture.

---

## 5. Responsive behaviour matrix (Proposed)

| Region | ≥1536 wide | 1280 laptop | 1024 tablet | <768 mobile | Zoom 200% |
|---|---|---|---|---|---|
| Canvas | edge-to-edge, no max-width | same | same | same | reflow, no h-scroll |
| Top bar | full: logo · search · create · theme · notifications · avatar | same | search → icon | logo + hamburger + avatar; search icon | wraps to 2 rows, sticky |
| Nav strip | all modules inline | inline, h-scroll if needed | h-scroll, snap | collapses into drawer | in drawer |
| Sidebar | expanded, persisted | expanded, collapsible | collapsed to icon rail | off-canvas drawer, focus-trapped | off-canvas |
| Breadcrumbs | full trail | full | collapse middle → `…` | current + parent only | wraps |
| Page header | title + desc + actions inline | same | actions wrap below | actions → overflow menu; keep 1 primary visible | stacks |
| Data table | all columns | hide low-priority | horizontal scroll, **sticky first col + header** | **card-per-row**, not a squeezed table | scroll within own container |
| Stat cards | 4-up | 3-up | 2-up | 1-up | 1-up |
| Bottom bar | visible | visible | visible | **hide** — conflicts with mobile browser chrome | hide |

**Non-negotiable:** the page body never scrolls horizontally. Wide content scrolls inside its own `overflow-x: auto` container with headers preserved (already the documented rule in `DESIGN_MEMORY.md`).

**Content stress cases** that must be in the test fixtures: 60-character member names; `$1,234,567.89` currency; 20-digit NACHA trace numbers; empty avatars; 40-character enrollment link slugs; a member with 9 dependents; a commission tier table with 15 rows.

---

## 6. Accessibility specification and test plan

**This is a plan, not a conformance claim.** Target **WCAG 2.2 AA**.

**Verified baseline (present in code):** `:focus-visible` rules in `packages/ui/src/styles/theme.css:454-466`; `prefers-reduced-motion` handled in both apps; `aria-current="page"` on nav items; `aria-hidden` on decorative overlays.

| Pattern | Requirement | Criterion | Method |
|---|---|---|---|
| Colour contrast | All text AA (4.5:1 body / 3:1 large) in **both** themes, **all three densities** | 1.4.3 | Automated sweep + manual on every `--tone-*` pair. **Blocked until §3.1 lands** — 26.5k raw values cannot be verified token-wise |
| Status | Never colour-only | 1.4.1 | Manual: `StatusBadge` already pairs hue + text ✓; audit trend arrows in `StatCard` (§3.3.2) |
| Focus visible | 2px ring + offset, never clipped by `overflow-hidden` | 2.4.7 / 2.4.11 | Manual keyboard sweep of every route |
| Focus order | Follows visual order across **four** nav surfaces | 2.4.3 | Manual — highest risk area in CRM given the shell's layering |
| Keyboard traps | Drawer, command palette, dialogs return focus to trigger | 2.1.2 / 3.2.6 | Manual |
| Nav consistency | Same order and labels across both consoles | 3.2.3 | Review after §3.4 |
| Touch targets | ≥44×44 CSS px — **including `compact` density** | 2.5.8 | Measure at `--ui-row-h: 34px`; row actions likely fail |
| Reflow | 320px @ 400% zoom, no 2-D scroll | 1.4.10 | Manual per template |
| Table semantics | `<caption>`/accessible name, `<th scope>`, programmatic sort state | 1.3.1 / 4.1.2 | Per table component |
| Live regions | Toasts announce without flooding | 4.1.3 | Screen-reader pass |
| Forms | Persistent labels, programmatic error association, error summary | 3.3.1 / 3.3.2 | Per form |

**Two accessibility risks flagged now:**

1. **Compact density vs 2.5.8.** CRM defaults new users to `compact`, where `--ui-row-h` is **34px**. Inline row actions inside a 34px row are unlikely to reach the 44px minimum. Either enforce 44px hit areas independent of visual row height, or exempt pointer-precision contexts deliberately and document it. **Inferred — measure first.**
2. **Contrast verification is gated on token binding.** With 26,536 raw colour values, contrast can only be verified by rendering every screen. After §3.1, it can be verified once per token pair. **This is the strongest practical argument for doing Phase 2 before any visual polish work.**

---

## 7. Work packets (dependency-ordered)

### Phase 1 — Converge the palette · ~2 files · **highest leverage**
- Export `MUTED_SPRUCE` / `consoleColors` from `packages/ui/tailwind.preset.ts`; spread into both app configs (§3.1.3).
- Unify theme key → `dhh-theme` with legacy migration-on-read; fix the anti-flash colour (§3.1.4).
- **DoD:** Admin renders in muted spruce; theme choice survives console switching; no dark-mode flash. Full visual-regression pass on Admin — this phase changes Admin broadly and must not merge unreviewed.

### Phase 2 — Bind tokens · the real work
- Alias then retire `--adm-*` → semantic tokens (§3.1.1).
- Promote `--crm-*` → `--ui-*` with back-compat aliases; Admin adopts density (§3.1.2).
- Shared pre-paint boot script (theme + density + sidebar state).
- Mechanical sweep of raw palette → semantic tokens, **highest-traffic routes first**: CRM `/crm`, `/crm/modules/[moduleKey]`, `/crm/r/[recordId]`; Admin `/dashboard`, `/members`, `/billing`, `/enrollments`.
- **DoD:** semantic-token file coverage ≥60% on touched routes; contrast verifiable per token pair rather than per screen.

### Phase 3 — Unify components
- `PageHeader` union → `packages/ui`; both apps re-export (§3.3.1).
- `StatCard`: port Admin's superset, migrate both, **delete both originals in the same PR** (§3.3.2).
- `EmptyState` → `packages/ui` with the three-case model (§3.3.3).
- Table **presentation contract** only (§3.3.4).
- **DoD:** zero duplicate implementations of these four families; `grep` proves the originals are gone.

### Phase 4 — Shell and IA
- `h-screen` → `h-[100dvh]` in CRM (fixes E12).
- Breadcrumbs into CRM; drop Admin's `max-w-[92rem]`.
- Delete `.adm-grain` + mesh gradients (§4).
- Remove dead `QuickCreateDrawer` (E15).
- Neutral role chips (E22).
- Publish the object lexicon; fix "Advisors & Agents" (§3.4.1).
- **DoD:** both consoles pass the §5 matrix at all five breakpoints and the §6 keyboard sweep.

### Deferred — scheduled last, or separately
- **Icon consolidation** to Lucide (§3.2) — 181 mechanical files, zero risk, no blocking dependency.
- **Admin table architecture** (§3.3.4) — needs its own discovery. **Do not fold into this programme.**

---

## 8. Guardrails — make it stick

E9 is the lesson: `StatusBadge` was promoted **with** a migration and reached 54 files; `stat-card` was published **without** one and reached zero. Convergence that is not enforced regresses.

1. **ESLint `no-restricted-syntax`** on raw palette classes (`slate-*`, `gray-*`, `teal-*`, `amber-*`, `rose-*`) in `apps/crm/src` and `apps/admin/src`. Ship as **warn** with a per-directory allowlist of already-migrated paths, flip to **error** directory-by-directory as each is cleaned. A blanket error on 26,536 occurrences is unmergeable and will simply be disabled.
2. **CI check:** semantic-token coverage ratio must not decrease. This is the metric that actually tracks the goal.
3. **Ban `--adm-*` and new `--crm-*`** declarations after Phase 2 via a stylelint rule.
4. **Deletion is part of the definition of done.** Promoting a component without deleting its originals in the same PR creates a third implementation — strictly worse than two.
5. **Visual regression** on the eight highest-traffic routes listed in Phase 2, captured at all three densities × both themes.

---

## 9. Open questions

| # | Question | Why it matters | Owner |
|---|---|---|---|
| Q1 | Does CRM's `BottomBar` earn a fourth nav surface? | Removing it recovers vertical space and simplifies focus order; keeping it needs justification | Product + usage data |
| Q2 | Should Admin's four entity tables adopt CRM's generic `RecordTable`? | Largest remaining architectural fork; out of scope here by design | Separate discovery |
| Q3 | Is `--adm-teal` identical in light and dark deliberately? | Every other Admin token lifts in dark; this one does not | Design |
| Q4 | Should Admin default to `compact` density? | Its tables are the densest in the suite, yet it has no density at all today | Ops users |
| Q5 | Do the two `learn/` trees (~40 CRM + 9 Admin routes) merge? | Two doc sets for one product; large surface, low urgency | Content |
| Q6 | Does `.adm-grain` at `z-50` composite above Radix overlays? | **Unknown — requires rendering** | Verify in Phase 1 |

---

## 10. Definition of done

- [ ] One token system. `--adm-*` retired; density shared; `grep -c` proves it.
- [ ] Semantic-token coverage materially up from the 3.7% / 20% baseline on all touched routes.
- [ ] One `PageHeader`, one `StatCard`, one `EmptyState` — originals **deleted**.
- [ ] One theme key; theme and density survive console switching; no load flash.
- [ ] Both consoles rendered and inspected at all five breakpoints × three densities × two themes.
- [ ] §6 keyboard and focus-order sweep passed on both shells.
- [ ] Touch targets ≥44px verified **at compact density** — or the exemption documented.
- [ ] No dead UI (`QuickCreateDrawer`), no colour-only status, no horizontal body overflow.
- [ ] Guardrails (§8) merged and green.
- [ ] Residual risks and unverified assumptions documented — including everything still labelled **Unknown** here.

**Not done until rendered.** Nothing in this document proves usability, accessibility or fidelity; it specifies what to build and how to verify it.

---

## 11. Implementation log

### Phase 1 — Converge the palette ✅ landed

| Change | File(s) | Verification |
|---|---|---|
| `MUTED_SPRUCE` + `consoleColors` exported from the shared preset; spread into both console configs | `packages/ui/tailwind.preset.ts`, both `tailwind.config.ts` | Both configs resolve `teal-500` / `cyan-500` / `brand.teal-500` to `#2f757f`. Admin was stock `#14b8a6`. **Verified** by resolving both configs. |
| One theme key `dhh-theme`, migrating `crm-theme` / `admin-theme` on first read | `packages/ui/src/lib/theme-boot.ts` *(new)*, both `layout.tsx`, both `theme-provider.tsx` | Typecheck + build. Runtime migration **not yet verified in a browser**. |
| Anti-flash colour corrected | `apps/crm/src/app/layout.tsx` | Was `#0f172a` (slate-900) while the shell rendered slate-950 — the anti-flash script caused the flash it existed to prevent. |

The boot script is now **generated** from the same module the providers import, rather than hand-written inline in each `layout.tsx`. The key was previously duplicated across four places, which is precisely how it drifted.

### Phase 2 — Bind tokens ✅ structural work landed

| Change | Detail |
|---|---|
| **Density promoted to shared** | `--crm-*` → `--ui-*` in `packages/ui/src/styles/theme.css`, with `--crm-*` kept as `var()` aliases in CRM's `globals.css`. The aliases **must** stay `var()` forms — a literal there would re-declare at equal specificity but later in the cascade, silently freezing the CRM at one size. **Verified** in the production bundle: `--crm-row-h:var(--ui-row-h)`. |
| **Admin gained density** | Boot script sets `data-density` pre-paint; `DensityToggle` + store promoted to `packages/ui` and wired into `AdminTopNav`; `AdminShell` gutters and all four entity tables (45 cells) now consume `--ui-gutter` / `--ui-cell-py`. Admin previously had **zero** density support. |
| **`--adm-*` became an alias layer** | All 18 tokens now resolve through shared semantics (`--adm-ink: hsl(var(--foreground))` etc). The literals were **deleted from `.dark`** — restating them there would win the cascade and freeze Admin's dark mode against the shared system. **Verified** in the production bundle. |
| **Elevation scale added** | `--shadow-sm/md/lg`, light + dark. `DESIGN_MEMORY.md` documented this scale but it was **never actually defined** in `theme.css`, which is why Admin grew its own `--adm-shadow`. Admin's well-tuned two-layer shadow was promoted as `md`. |
| **Easing promoted** | Admin's `--adm-ease` / `--adm-ease-out` → shared `--ease` / `--ease-out`. |
| **One dark ground settled** | `#060b16` (`221 57% 5.5%`), the value documented in `DESIGN_MEMORY.md`. Admin's `#050505` and the CRM shell's slate-950 `#020617` were a neutral-black and a Tailwind default — neither was a decision. Per-app overrides removed; `CrmShell` canvas binds to `bg-background`. |

**Visual deltas introduced — these require a regression pass:**

- Admin's entire teal/cyan family shifts to Muted Spruce (Phase 1).
- Admin dark canvas: neutral black `#050505` → navy `#060b16`; dark panel `#0a0a0a` → shared navy card.
- CRM light canvas: `#f8fafc` → `#f2f5f8` (binding to `--background` rather than `bg-slate-50`).
- Admin `--adm-muted` `#64748b` → `#475569` (higher contrast), `--adm-hairline` from a 10 %-alpha teal to the opaque `--border`, and `emerald`/`amber`/`rose` to the shared `success`/`warning`/`destructive` values.

### Verified

`tsc --noEmit` clean on both apps · `build:crm` and `build:admin` both succeed · tokens confirmed present and correctly formed in **production** CSS bundles · palette convergence confirmed by resolving both Tailwind configs.

### Explicitly NOT verified

- **Nothing has been rendered in a browser.** No claim is made about how any of this looks.
- Contrast is now *verifiable per token pair* rather than per screen — but it **has not been measured**. That work is still open (§6).
- The theme/density localStorage migration is proven by code inspection only.
- `.adm-grain` stacking (Q6) remains **Unknown**.

### Known pre-existing failure, untouched

`npm run lint:crm` fails with **45 problems / 31 errors** — identical counts before and after these changes (verified against a stashed baseline). They are pre-existing violations such as direct `supabase.auth.getUser()` calls in `lib/tenant.ts`. Not fixed here: out of scope, and fixing them would bury this diff.

### The neutral-palette sweep — attempted, rejected, reverted ❌

A mechanical sweep of the neutral families (`slate` / `gray` / `zinc`) was run across seven disjoint component directories, then adversarially reviewed by an independent agent per directory. It produced **1,210 replacements across 135 files** and was **reverted in full**. The patch is preserved at `scratchpad/neutral-sweep-REJECTED.patch`.

This is the most useful thing the attempt produced, so record it: **a purely mechanical raw→semantic sweep does not work on this codebase.** Three rule failures caused it, each reproducible and each fixable in a future pass.

**1. Collapsing a three-level type hierarchy into one token.**
The mapping sent both `text-slate-900 dark:text-white` (40 sites) *and* `text-slate-700 dark:text-slate-300` (33 sites) *and* `text-slate-700 dark:text-slate-200` (17 sites) to `text-foreground`. Roughly 50 call sites lost a deliberate distinction between heading, body-strong and body. In `ConvertToContactDialog.tsx` a `<strong>` inside the description ended up rendering identically to the dialog's own title.
→ **Fix:** the product needs a real `text-body` / `text-body-strong` token between `foreground` and `muted-foreground` before this mapping is safe. That token does not exist yet.

**2. Migrating a base colour without its interaction variants.**
Objectively verifiable: **17 dead classes** of the form `text-foreground hover:text-foreground` across five files — base and hover collapsed to the same value, so the hover does nothing. The inverse also occurred: `text-muted-foreground hover:text-slate-600`, where CRM's `--muted-foreground` (`215 20% 32%`) is *darker* than `slate-600`, so hovering **lightened** the icon — inverting the affordance.
→ **Fix:** treat base + `hover:` + `active:` + `focus:` as one atomic unit. Reject any replacement that makes two states equal.

**3. Ignoring whether the surface underneath can theme.**
The highest-severity class of defect, and the one a per-class rule cannot see. A `<thead className="bg-slate-50">` (hard light, never themes) was correctly left alone while its `<th>` labels became `text-muted-foreground` — which in dark mode is light grey on near-white: roughly **2.6:1**, unreadable. The pair was *consistent* before the migration; the migration is what broke it. The same shape appeared as `bg-card` (near-black in dark) retaining hardcoded light-only text, and as `border-slate-100` hairlines left raw on a surface changed from `bg-white` to `bg-card`, rendering near-white rules across a near-black card.
→ **Fix:** migrate **by container subtree**, not by class. A subtree is only safe to convert when its background is itself theme-aware; otherwise convert the container first or skip the whole subtree.

**Process note.** The bind agents self-reported success and produced plausible-sounding skip rationales; several of those rationales were internally contradictory (the same `slate-100` shade refused as a border in one file and converted as a divider in another, in the same pass). The independent adversarial verifiers caught this. Single-pass mechanical migration with self-review would have shipped all of it.

**Recommendation:** do not retry this as a bulk sweep. Add the missing mid-tier text token, then migrate per component with rendering, starting with the shared primitives in `packages/ui` — where one fix propagates to both consoles instead of being repeated per call site.

### Still open

The raw-palette binding (see above — needs a different method, not a rerun); **Phase 3** (component unification); **Phase 4** (shell and IA); the deferred icon consolidation and Admin table architecture; and all guardrails in §8.
