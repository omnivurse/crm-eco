# 21 — UX Review

> Part of the CRM-ECO vNext Master Build Prompt Package. See `README.md`.
> **Review prompt — run after modules land, before production readiness (`23`).**

---

## Original Prompt (synthesized in package voice)

Perform an enterprise **UX review**. Walk every page, tab, modal, popup, form, empty state, loading state, and error state. Verify one consistent design language, responsive behavior across desktop/laptop/mobile, accessibility (WCAG AA), keyboard navigation, and information density. Identify inconsistencies and produce a prioritized remediation list.

---

## Current State

- Design system is centralized: `packages/ui` (Radix primitives, `BrandLogo`, app-switcher, `ExportButton`, `signature-pad`, `pin-lock-overlay`) + admin theme tokens (`--adm-*` CSS variables) + `PageHeader`.
- Recent UX work (per prior sessions): full-width responsive audit, CRM command-center redesign, sidebar optimization, horizontally-resizable table columns (Zoho/Excel-style) intended ecosystem-wide.
- Column-resize + expandable fields exist but coverage across every list is uneven (ties to `02`).

## Gap Analysis

| Area | Status / risk |
|---|---|
| Shared primitives | Present |
| Consistent list-view UX | **Inconsistent** — every list is bespoke (search/filter/empty/loading differ) |
| Resizable columns everywhere | Partial |
| Loading/empty/error states | Uneven per page |
| Accessibility (WCAG AA) | Not systematically verified |
| Keyboard nav / command palette | Partial (`Ctrl+K` terminal exists) |
| Mobile density on data tables | Risk on bespoke pages |

## Build Notes

- The single biggest UX consistency win is the **shared list-view module (`02`)** — it makes search/filter/sort/empty/loading/resize identical everywhere by construction. Prioritize it before hand-fixing pages.
- Add a `qa-accessibility` pass (axe-core) once the shared components are in place, so fixes land once.
- Standardize skeleton/loading and empty-state components in `packages/ui`.
- Verify responsive behavior at desktop/laptop/mobile breakpoints per the prior full-width audit; keep the data-density high but scrollable on mobile.
