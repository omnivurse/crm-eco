# 15 — Notification Center

> Part of the CRM-ECO vNext Master Build Prompt Package. See `README.md`.

---

## Original Prompt (synthesized in package voice)

Build a unified **Notification Center**: in-app inbox, real-time delivery, read/unread + mark-all, per-user + per-role targeting, categories, preferences/opt-out, multi-channel fan-out (in-app/email/SMS/push), deep links to the source record, and tenant isolation. One notification service, all apps.

---

## Current State

**Three separate notification systems, unified by nothing.**

- Admin: `admin_notifications` table; `notifications/page.tsx` (paginated inbox, unread styling/count); TopNav dropdown; listener `components/notifications/AdminNotificationListener.tsx`.
- CRM: `crm_notifications`; `/api/notifications/route.ts`; automation `notify` action.
- Member portal: member notifications API `apps/member-portal/src/app/api/member/notifications/route.ts`.
- Activation outbox migration (`activation_notification_outbox`) for email/ops.

## Gap Analysis

| vNext area | Status |
|---|---|
| In-app inbox | Present (per app, separately) |
| Unread count | Present (admin) |
| Mark-as-read / mark-all | **Missing (admin)** |
| Filters / categories | Missing |
| Preferences / opt-out | Missing |
| Multi-channel fan-out | Missing |
| Real-time | Partial (admin listener) |
| Deep links to source record | Partial |
| **Unified service** | **Missing — 3 forks** |

## Build Notes

- Consolidation target (architecture review, Candidate 5): define one **notification service** + one logical schema (channel, category, actor, target user/role, entity link, read state) that all three tables migrate toward, or a single table with an `app` discriminator.
- Emit notifications from the **automation/workflow engine** (`12`/`19`) via the `notify` action, so producers don't hand-write inserts.
- Fan-out to email/SMS reuses the channel abstraction from `11 Email Center.md`.
- Admin quick win regardless of consolidation: add mark-as-read / mark-all / filters to `notifications/page.tsx`.
- Realtime via Supabase subscription behind a shared `useNotifications()` hook.
