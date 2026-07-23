# 11 — Email Center

> Part of the CRM-ECO vNext Master Build Prompt Package. See `README.md`.

---

## Original Prompt (verbatim)

Instead of templates, build **Enterprise Communication Center**: Email, SMS, Voice, Push, In-App, Campaigns, Sequences, Automation, A/B Testing, Templates, Brand Kits, Approval Workflow, Analytics, Deliverability, AI Writer, AI Subject Line Generator, AI Campaign Builder.

---

## Current State

Communications is **full** for email.

- Pages: `communications/page.tsx` (hub/stats), `.../compose` (template vars + member search), `.../templates{,/new,/[id],/preview}` (`EmailTemplateForm`), `.../history` (search/filter).
- CRM side has richer channels: email sequences (`apps/crm/src/lib/sequences/`), automation `notify` actions, AI email draft (`/api/crm/ai/email-draft`).
- Email plumbing in `@crm-eco/lib/email`.

## Gap Analysis

| vNext area | Status |
|---|---|
| Email templates + compose + history | Present (admin) |
| Sequences | Present (CRM only) |
| SMS / Voice / Push / In-App | Missing |
| Campaigns / A/B testing | Missing |
| Brand kits | Partial (org branding exists) |
| Approval workflow | Missing (exists generically in CRM approvals) |
| Deliverability analytics | Partial (history) |
| AI writer / subject-line / campaign builder | Partial (CRM email-draft only) |

## Build Notes

- Do not fork sequences: **promote the CRM sequences engine** (`apps/crm/src/lib/sequences/`) to a shared service both apps consume, rather than building admin sequences separately.
- Introduce a **channel abstraction** (email/SMS/voice/push/in-app) so campaigns target channels uniformly; wire SMS/voice via provider adapters (mirror the payments adapter pattern).
- Approvals → shared approvals engine (`19`).
- AI writer/subject/campaign → `14` copilot; reuse `/api/crm/ai/email-draft` as the seed.
- Member "communication" tab (`03`) must read from this center's history, not a member-local table.
