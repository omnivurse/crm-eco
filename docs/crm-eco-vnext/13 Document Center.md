# 13 — Document Center

> Part of the CRM-ECO vNext Master Build Prompt Package. See `README.md`.

---

## Original Prompt (synthesized in package voice)

Build an enterprise **Document Center**: folder tree, drag-drop upload, versioning, preview, search, tags, sharing links, e-signature, retention policies, per-record attachment surface (member/agent/enrollment), access-controlled by permissions, and a full audit log of every view/download/share (HIPAA). One document system, shared by every app.

---

## Current State

Documents is **full** — and **forked**.

- Admin: `apps/admin/src/app/(dashboard)/documents/page.tsx` → `apps/admin/src/components/documents/DocumentsPage.tsx` (folder tree, drag-drop upload, search/sort, list/grid, multi-select, move/rename/trash/favorites, share links, version history, preview, **audit log tab**). Richest component kit in admin.
- CRM: `apps/crm/src/components/crm/documents/*` — a **near-identical** file manager over the same `documents` table.
- E-signature primitive: `signature-pad` in `@crm-eco/ui`.

## Gap Analysis

| vNext area | Status |
|---|---|
| Folders / upload / versions / preview / share / audit | Present (admin DMS) |
| Retention policies | Missing |
| E-signature workflow | Partial (pad exists, not wired) |
| Per-record attachment surface | Partial — member "documents" tab shows only `enrollment_contracts`, not the DMS |
| Tags | Partial |
| **Duplication** admin vs CRM | **Yes — two forks of the same manager** |

## Build Notes

- **Primary consolidation target** (architecture review, Candidate 2): two adapters already exist over one `documents` table = a real seam. Extract the document manager into `@crm-eco/documents` (or `packages/ui`), parameterized by app auth, and delete both forks.
- Expose a `<DocumentPanel entityType entityId />` mixin so members/agents/enrollments get the full DMS in their Command Center tab (fixes `03` documents-tab gap) instead of the contracts-only view.
- Access + view/download audit must go through the unified permission gate (`16`) and unified audit (`unified_audit_logs`), satisfying HIPAA.
- E-signature: wire `signature-pad` into an agreement/signature flow bound to documents.
