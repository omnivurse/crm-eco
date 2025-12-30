-- Migration: Personal Saved Views
-- Create a generic saved_views table that can be used for different contexts
-- Starting with the Needs Command Center.

-- Create the saved_views table
create table if not exists public.saved_views (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null references public.organizations(id) on delete cascade,
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,

  -- Context allows reuse for different features (e.g., 'needs_command_center', 'tickets_board')
  context text not null,

  -- User-defined name for the view
  name text not null,

  -- Whether this is the user's default view for this context
  is_default boolean not null default false,

  -- JSONB storing the serialized filter state
  filters jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes for efficient lookups
create index if not exists idx_saved_views_org_owner_context
  on public.saved_views(organization_id, owner_profile_id, context);

create index if not exists idx_saved_views_context
  on public.saved_views(context);

create index if not exists idx_saved_views_owner
  on public.saved_views(owner_profile_id);

-- Enable RLS
alter table public.saved_views enable row level security;

-- RLS Policies: Users can only see/modify their own views

-- Select: owner only
drop policy if exists "saved_views_select_own" on public.saved_views;
create policy "saved_views_select_own" on public.saved_views
  for select
  using (
    owner_profile_id = auth.uid()
  );

-- Insert: owner can insert their own
drop policy if exists "saved_views_insert_own" on public.saved_views;
create policy "saved_views_insert_own" on public.saved_views
  for insert
  with check (
    owner_profile_id = auth.uid()
  );

-- Update: owner can update their own
drop policy if exists "saved_views_update_own" on public.saved_views;
create policy "saved_views_update_own" on public.saved_views
  for update
  using (
    owner_profile_id = auth.uid()
  )
  with check (
    owner_profile_id = auth.uid()
  );

-- Delete: owner can delete their own
drop policy if exists "saved_views_delete_own" on public.saved_views;
create policy "saved_views_delete_own" on public.saved_views
  for delete
  using (
    owner_profile_id = auth.uid()
  );

-- Trigger to update updated_at on changes
create or replace function public.saved_views_update_timestamp()
returns trigger
language plpgsql
as $$
begin
  NEW.updated_at := now();
  return NEW;
end;
$$;

drop trigger if exists trg_saved_views_update_timestamp on public.saved_views;
create trigger trg_saved_views_update_timestamp
  before update on public.saved_views
  for each row
  execute function public.saved_views_update_timestamp();

