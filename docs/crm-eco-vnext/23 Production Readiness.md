# 23 — Production Readiness

> Part of the CRM-ECO vNext Master Build Prompt Package. See `README.md`.
> **Review prompt — gate before shipping vNext increments.**

---

## Original Prompt (synthesized in package voice)

Assess **production readiness**: security (secrets, headers, auth), performance (indexes, N+1, bundle size, Core Web Vitals), reliability (idempotency, retries, error handling, monitoring), compliance (HIPAA/SOC2 controls + audit), backups/DR, observability, rate limiting, and deploy pipeline. Produce a go/no-go checklist with a quality score per area.

---

## Current State

- Deploy: Vercel (Next.js 15) + Supabase; Turborepo build. ESLint 9 flat config; Husky pre-commit runs `eslint --fix` (recently enforced).
- Security controls present: RLS, unified/PHI audit, auth logging, rate-limit + captcha helpers, PIN-lock overlay on all apps.
- Migrations managed via Supabase CLI; prior ordering incidents resolved with `--include-all`.

## Gap Analysis

| Area | Status |
|---|---|
| Secrets via env (no hardcoding) | Present (enforced by rule) |
| Auth/session logging | Present |
| Rate limiting | Partial (selective) |
| Idempotency on payments | **Missing** (blocker) |
| Webhook HMAC | **Missing** (blocker for external webhooks) |
| Index coverage for hot queries | Needs audit (`18`) |
| N+1 / bundle / CWV | Needs audit (`performance-optimizer`) |
| Monitoring / alerting | Unknown / likely thin |
| Backups / DR runbook | Not documented |
| HIPAA/SOC2 control mapping | Partial (controls exist; formal mapping missing) |

## Build Notes

- Treat **idempotency keys + webhook HMAC + secret hygiene** as hard gates before enabling higher billing volume or external integrations.
- Run `qa-security`, `qa-performance`, and `performance-optimizer` passes; capture scores per module (the Final Audit `README` expects a score table).
- Add security headers + verify no service-role key reaches the client.
- Document a backup/restore + incident runbook; wire basic error monitoring (Sentry-class) across apps.
- Produce a per-module quality score (0–100) and a go/no-go list; nothing ships without its blockers cleared.
