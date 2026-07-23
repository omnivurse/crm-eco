# 14 — AI Assistant

> Part of the CRM-ECO vNext Master Build Prompt Package. See `README.md`.

---

## Original Prompt (verbatim)

Every page in CRM-ECO should have AI. Every module should have an AI copilot: Member AI, Billing AI, Commission AI, Sales AI, Support AI, Marketing AI, Operations AI, Reporting AI, Developer AI, Database AI, Workflow AI, Compliance AI. Every AI assistant understands: current page, database, permissions, tenant, context, workflow, history, relationships — and can perform contextual actions.

---

## Current State

AI exists but is **CRM-scoped and feature-specific**, not a per-module copilot.

- Field suggest: `apps/crm/src/app/api/crm/ai/field-suggest/route.ts` (OpenAI `gpt-4o-mini`), UI `AiSuggestChip.tsx`.
- Email draft: `/api/crm/ai/email-draft` + `AiFollowUpEmailButton.tsx`.
- Habits AI tips cron, import smart-mapping (OpenAI + heuristic fallback), AI context builder `apps/crm/src/lib/crm/ai-context.ts`.
- Rx pricing via Gemini `packages/lib/src/ai/geminiClient.ts`.
- Voice command intent parser `apps/crm/src/components/voice/` (not LLM-first).
- Gated by `OPENAI_API_KEY` / `GEMINI_API_KEY`.

## Gap Analysis

| vNext area | Status |
|---|---|
| Point AI features (suggest, draft, mapping) | Present (CRM) |
| Per-module copilot pattern | Missing |
| Context contract (page + tenant + permissions + relationships) | Partial (`ai-context.ts`, not generalized) |
| Contextual actions (AI performs writes) | Missing (read/suggest only) |
| AI in admin app | Missing |
| Compliance/guardrails (PHI-safe prompts, audit of AI actions) | Missing |

## Build Notes

- Define one **copilot contract**: `{ module, entityType, entityId, tenant, permissions, contextLoader, tools[] }`. Each module supplies a context loader + allowed tools; the shell is shared. This turns "12 different AIs" into one deep module with 12 adapters.
- Build on the existing `ai-context.ts` as the context loader seed; keep provider behind `@crm-eco/lib/ai`.
- **AI actions must pass through the same permission gate (`16`) and be audited (`unified_audit_logs`)** — an AI copilot is just another actor.
- Keep PHI out of prompts by feeding de-identified/aggregate context where possible (mirror the actuarial RPC discipline).
- Ship read-only copilots first (summaries, insights), then gated write-actions.
