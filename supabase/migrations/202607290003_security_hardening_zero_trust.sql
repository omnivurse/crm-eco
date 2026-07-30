-- Zero-trust hardening: durable rate limiting + device recognition.
--
-- Purely ADDITIVE. This migration creates two new tables and three new
-- functions. It does not alter, drop, or re-policy anything that already
-- exists, so it cannot change the behaviour of any current query or policy.
--
-- Both tables are RLS-enabled and write-only through the service role:
--   * security_rate_limits — NO policies at all (service_role bypasses RLS,
--     every other role is denied). Counters are never client-readable.
--   * known_devices — users may SELECT their own devices (for a "your devices"
--     UI); all writes are service-role only.
--
-- ROLLBACK (safe — nothing else depends on these objects):
--   DROP FUNCTION IF EXISTS public.consume_rate_limit(text, integer, integer);
--   DROP FUNCTION IF EXISTS public.gc_security_rate_limits(integer);
--   DROP FUNCTION IF EXISTS public.touch_known_device(uuid, text, text, text);
--   DROP TABLE IF EXISTS public.security_rate_limits;
--   DROP TABLE IF EXISTS public.known_devices;

-- Fail fast rather than queueing behind live traffic.
set lock_timeout = '5s';

-- ---------------------------------------------------------------------------
-- 1) security_rate_limits — durable, cross-instance fixed-window counters
-- ---------------------------------------------------------------------------
create table if not exists public.security_rate_limits (
  key               text        primary key,
  hits              integer     not null default 0,
  window_started_at timestamptz not null default now(),
  expires_at        timestamptz not null,
  updated_at        timestamptz not null default now()
);

comment on table public.security_rate_limits is
  'Fixed-window rate-limit counters. Mutated only via consume_rate_limit() under the service role; RLS denies all direct client access.';

create index if not exists security_rate_limits_expires_at_idx
  on public.security_rate_limits (expires_at);

alter table public.security_rate_limits enable row level security;
-- Intentionally NO policies. service_role bypasses RLS; anon/authenticated are denied.

-- Defense in depth. Supabase's default privileges grant SELECT on new public
-- tables to anon and authenticated. RLS already denies them here (no policy
-- matches), but a table nobody should touch shouldn't carry the grant either.
revoke all on table public.security_rate_limits from anon;
revoke all on table public.security_rate_limits from authenticated;

-- ---------------------------------------------------------------------------
-- 2) consume_rate_limit — atomic increment + verdict
-- ---------------------------------------------------------------------------
-- Atomicity comes from INSERT .. ON CONFLICT DO UPDATE, which takes a row lock,
-- so concurrent callers cannot both read a stale count. An expired window is
-- reset in the same statement (no separate read-then-write race).
create or replace function public.consume_rate_limit(
  p_key            text,
  p_max            integer,
  p_window_seconds integer
)
returns table (allowed boolean, hits integer, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hits    integer;
  v_expires timestamptz;
begin
  if p_key is null or length(p_key) = 0
     or p_max is null or p_max < 1
     or p_window_seconds is null or p_window_seconds < 1 then
    raise exception 'consume_rate_limit: invalid arguments';
  end if;

  insert into public.security_rate_limits as srl
    (key, hits, window_started_at, expires_at, updated_at)
  values
    (p_key, 1, now(), now() + make_interval(secs => p_window_seconds), now())
  on conflict (key) do update
    set hits = case when srl.expires_at <= now() then 1 else srl.hits + 1 end,
        window_started_at =
          case when srl.expires_at <= now() then now() else srl.window_started_at end,
        expires_at =
          case when srl.expires_at <= now()
               then now() + make_interval(secs => p_window_seconds)
               else srl.expires_at end,
        updated_at = now()
  returning srl.hits, srl.expires_at into v_hits, v_expires;

  return query
    select v_hits <= p_max,
           v_hits,
           greatest(0, ceil(extract(epoch from (v_expires - now())))::integer);
end;
$$;

comment on function public.consume_rate_limit(text, integer, integer) is
  'Atomically consumes one unit from a fixed-window rate-limit bucket. Returns whether the caller is allowed, the current hit count, and seconds until the window resets.';

revoke all on function public.consume_rate_limit(text, integer, integer) from public;
revoke all on function public.consume_rate_limit(text, integer, integer) from anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- 3) gc_security_rate_limits — bounded cleanup of long-expired buckets
-- ---------------------------------------------------------------------------
create or replace function public.gc_security_rate_limits(
  p_older_than_seconds integer default 3600
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from public.security_rate_limits
  where expires_at < now() - make_interval(secs => greatest(coalesce(p_older_than_seconds, 3600), 0));
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

comment on function public.gc_security_rate_limits(integer) is
  'Deletes rate-limit buckets whose window expired more than p_older_than_seconds ago. Safe to run repeatedly.';

revoke all on function public.gc_security_rate_limits(integer) from public;
revoke all on function public.gc_security_rate_limits(integer) from anon, authenticated;
grant execute on function public.gc_security_rate_limits(integer) to service_role;

-- ---------------------------------------------------------------------------
-- 4) known_devices — device recognition for new-device step-up
-- ---------------------------------------------------------------------------
-- No FK to auth.users: keeps this migration applyable without cross-schema
-- ownership concerns. Orphan rows are inert and cleaned by gc_known_devices
-- semantics at the application layer.
create table if not exists public.known_devices (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid        not null,
  device_hash   text        not null,
  label         text,
  user_agent    text,
  last_ip       text,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  trusted_at    timestamptz,
  revoked_at    timestamptz
);

comment on table public.known_devices is
  'One row per (user, device fingerprint). Used to detect first-time devices and require MFA step-up. Written only by the service role.';
comment on column public.known_devices.device_hash is
  'HMAC-SHA256 of coarse request signals (user-agent + language + platform hints) keyed by a server secret. Not a tracking identifier and never exposed to other users.';

create unique index if not exists known_devices_user_device_uidx
  on public.known_devices (user_id, device_hash);

create index if not exists known_devices_user_last_seen_idx
  on public.known_devices (user_id, last_seen_at desc);

alter table public.known_devices enable row level security;

-- Users may read their own devices; nobody can write via the client.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'known_devices'
      and policyname = 'known_devices_select_own'
  ) then
    create policy known_devices_select_own
      on public.known_devices
      for select
      to authenticated
      using (user_id = auth.uid());
  end if;
end $$;

-- authenticated keeps SELECT (the "your devices" list needs it, scoped by the
-- policy above); everything else comes back. anon has no business here at all.
revoke all on table public.known_devices from anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.known_devices from authenticated;

-- ---------------------------------------------------------------------------
-- 5) touch_known_device — atomic upsert returning first-seen verdict
-- ---------------------------------------------------------------------------
-- Returns is_new_device = true only when this (user, device_hash) pair had not
-- been seen before, so the caller can require step-up exactly once per device.
create or replace function public.touch_known_device(
  p_user_id     uuid,
  p_device_hash text,
  p_user_agent  text default null,
  p_ip          text default null
)
returns table (is_new_device boolean, trusted boolean, revoked boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existed  boolean;
  v_trusted  timestamptz;
  v_revoked  timestamptz;
begin
  if p_user_id is null or p_device_hash is null or length(p_device_hash) = 0 then
    raise exception 'touch_known_device: invalid arguments';
  end if;

  select true, kd.trusted_at, kd.revoked_at
    into v_existed, v_trusted, v_revoked
  from public.known_devices kd
  where kd.user_id = p_user_id and kd.device_hash = p_device_hash;

  insert into public.known_devices as kd
    (user_id, device_hash, user_agent, last_ip, first_seen_at, last_seen_at)
  values
    (p_user_id, p_device_hash, p_user_agent, p_ip, now(), now())
  on conflict (user_id, device_hash) do update
    set last_seen_at = now(),
        last_ip      = coalesce(excluded.last_ip, kd.last_ip),
        user_agent   = coalesce(excluded.user_agent, kd.user_agent);

  return query
    select coalesce(v_existed, false) = false,
           v_trusted is not null,
           v_revoked is not null;
end;
$$;

comment on function public.touch_known_device(uuid, text, text, text) is
  'Upserts a device sighting for a user and reports whether the device had never been seen before.';

revoke all on function public.touch_known_device(uuid, text, text, text) from public;
revoke all on function public.touch_known_device(uuid, text, text, text) from anon, authenticated;
grant execute on function public.touch_known_device(uuid, text, text, text) to service_role;
