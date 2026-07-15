# Handoff → other machine: set the edge

**Date:** 2026-07-15 (from the primary dev machine)
**Repo state:** `main` @ `8af2c1a5`, pushed to `origin/main`, working tree clean.

## Action item

**Set the edge** on this machine. (Reminder left verbatim — you know which edge this is.
Most likely candidates, in case memory needs a jog:)

- Deploy/refresh Supabase Edge Functions from `supabase/functions/` (`supabase functions deploy <name>`), and/or
- Set the edge function secrets / env (`supabase secrets set …`), and/or
- Vercel edge/env config for the CRM app.

None of the commits below touch `supabase/functions/` or migrations, so nothing in this
push *requires* an edge deploy — this is a standalone task for the other machine.

## What just landed on `main` (pull first)

- `8af2c1a5` — CRM notes: absolute timestamps everywhere ("Tue, Jul 15 · 3:52 PM") + auto-stamp
  hint in composers; Note Template button stays visible in the compact sticky record header;
  call/meeting note templates now merge date **and time** (`{{now}}`, `{{time}}` tokens).
- `bf5f0400` — stale field displays fixed, faster search bars, section accent colors restored.
- `b923eab6` — Layout V2 power-cockpit record detail.
- `7510f633` — dashboard shake after login fixed + notes restored on record overview.

Frontend-only changes; no DB migrations, no RLS changes, no edge-function changes pending.
