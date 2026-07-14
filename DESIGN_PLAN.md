# Design Implementation Plan — Unified Premium UX/UI

**Goal:** one premium visual language across all three apps (CRM, Admin, Member Portal), fixing four recurring pain points: clutter, unclear hierarchy, weak mobile, and dated/inconsistent look.

Explored in the Design Lab (8 surfaces, both themes) → this plan turns the winning directions into grounded, PR-sized changes. Directions are derived from the app's existing tokens in `packages/ui/src/styles/theme.css` (cyan brand `#06b6d4`, emerald coverage accent `#10b981`, cool-slate neutrals), so nothing here introduces a new dependency or a foreign palette.

> Coordination note: there is **active parallel design work** in flight (recent commits: "comfortable-dense RecordTable rows + status via the tone system", "tailwind ESM-safe"). This plan is sequenced to *extend* that tone system, not fight it. Land shared-token changes with whoever owns the tone system before app-wide rollouts.

---

## ✅ Shipped in this pass

- [x] **CRM · Membership Snapshot** — `apps/crm/src/components/crm/records/DynamicRecordForm.tsx`
  - Premium coverage card: gradient header strip, `ShieldCheck` coverage icon, `rounded-xl` + refined emerald border/ring/shadow, header/body separation.
  - Fields still render through `renderFieldCell`, so **inline editing is unchanged** and the earlier fix (insurer labelled *Insurance Carrier*, not "Sharing Entity") is preserved.

---

## Shared design language (the upgrade thesis)

Already largely encoded in `packages/ui/src/styles/theme.css` + `packages/ui/tailwind.preset.ts`. Fill these gaps as a shared pass so every app inherits them:

- [ ] **Elevation scale** — standardize on the two-layer soft shadow (`--shadow-sm/md/lg`) already in the lab; retire ad-hoc `shadow-*` where inconsistent.
- [ ] **Radius scale** — cards `--radius-card` (12px) / heroes 16px; buttons/inputs `--radius` (8px). Audit stray `rounded-lg`/`rounded-2xl`.
- [ ] **Status/tone tokens** — align coverage=emerald, pending=amber, critical=rose as *semantic* (separate from the cyan accent). Fold into the existing tone system.
- [ ] **Tabular numerics** — `font-variant-numeric: tabular-nums` on every money/ID/metric (premiums, MRR, member IDs).

## CRM (`apps/crm`)

- [x] Membership Snapshot (above).
- [ ] **Link Records dialog** — `apps/crm/src/components/crm/records/RelatedRecordsPanel.tsx`. Add member initials/avatars per row, strengthen the selected-row state, and make the footer sticky with `Relate as ▾ · N selected · Link N`. (Multi-select + additive behavior already shipped.)
- [ ] **Record detail hero** — `apps/crm/src/components/crm/records/RecordDetailShellV2.tsx`. Tighten the identity hero + section rhythm; carry the snapshot's header-strip pattern to other accent sections for consistency.

## Admin (`apps/admin`) — representative in the lab; ground before building

- [ ] **Dashboard** — `apps/admin/src/app/(dashboard)/dashboard/page.tsx`. KPI tiles with sparklines + delta chips (summary-before-detail); status as pills.
- [ ] **Data tables** (products, billing, enrollments) — apply the shared table shell: `bg-ground-2` header, hairline rows, status pills, tabular figures. Reuse the tone system from the RecordTable work.

## Member Portal (`apps/member-portal`) — representative in the lab; ground before building

- [ ] **My Plan** — `apps/member-portal/src/app/plan/page.tsx`. Confident coverage hero (plan, key numbers, benefits, one primary action), mobile-first. Emerald→cyan gradient hero reserved for this member-facing moment.

---

## Component API (Membership Snapshot — as shipped)
No prop/API change. Purely presentational: the hero snapshot container in `DynamicRecordForm` was restyled; field resolution (`heroSharingFieldForDisplay`, `heroProductPlanSnapshotFields`, `heroStartDateField`, `heroReferralSnapshotFields`) and `renderFieldCell` are untouched.

## Required UI states (apply to every surface above)
- **Loading** — skeletons that match final layout (no spinner-only).
- **Empty** — the existing "No … configured" copy, kept.
- **Error** — inline, actionable (already the pattern via `sonner`).
- **Disabled / Read-only** — snapshot already renders read + inline-edit modes.

## Accessibility checklist
- [x] Snapshot uses semantic markup; icon is decorative next to a real text label.
- [ ] Verify focus-visible rings on interactive lab-derived elements (theme.css already defines `button:focus-visible`).
- [ ] Color contrast: emerald-700/300 on the tinted card meets AA (verify in both themes).
- [ ] Touch targets ≥ 44px on the member-portal card actions.

## Testing checklist
- [x] `typecheck:crm` passes with the snapshot change.
- [ ] Visual check the record detail in light + dark, read + inline-edit modes.
- [ ] Per-app typecheck (admin/member-portal) before their rollouts.

## Design tokens
No new tokens required — everything maps to existing `theme.css` custom properties and standard Tailwind `emerald/slate/cyan` scales.

---
*Explored via the Design Lab; see `DESIGN_MEMORY.md` for the durable style rules.*
