-- ============================================================================
-- Need SLA → Urgency Rule Engine
-- ============================================================================
-- This migration adds a function and trigger to automatically compute
-- the urgency_light field based on status and sla_target_date.
--
-- Rules:
-- - paid/closed needs → 'green' (completed, no urgency)
-- - No SLA date → 'green' (default)
-- - Overdue (days <= 0) → 'red'
-- - Within 3 days → 'orange'
-- - More than 3 days → 'green'
-- ============================================================================

-- Function to compute urgency from status + SLA date
create or replace function public.compute_need_urgency(
  p_status text,
  p_sla_target_date date
) returns text as $$
declare
  v_today date := current_date;
  v_days_remaining integer;
begin
  -- For closed/paid needs, urgency is green (completed)
  if p_status in ('paid', 'closed') then
    return 'green';
  end if;

  -- If no SLA specified, default to green
  if p_sla_target_date is null then
    return 'green';
  end if;

  -- Calculate days remaining
  v_days_remaining := p_sla_target_date - v_today;

  -- Apply urgency rules
  if v_days_remaining <= 0 then
    return 'red';      -- Overdue or due today
  elsif v_days_remaining <= 3 then
    return 'orange';   -- Within 3 days
  else
    return 'green';    -- More than 3 days remaining
  end if;
end;
$$ language plpgsql stable;

-- Comment for documentation
comment on function public.compute_need_urgency(text, date) is 
  'Computes urgency_light value based on need status and SLA target date. Returns green/orange/red.';

-- Trigger function to set urgency_light automatically
create or replace function public.set_need_urgency_from_sla()
returns trigger as $$
begin
  new.urgency_light := public.compute_need_urgency(new.status, new.sla_target_date);
  return new;
end;
$$ language plpgsql;

-- Drop existing trigger if it exists (for idempotency)
drop trigger if exists trg_set_need_urgency on public.needs;

-- Create trigger on needs table
create trigger trg_set_need_urgency
  before insert or update on public.needs
  for each row
  execute procedure public.set_need_urgency_from_sla();

-- Comment for documentation
comment on trigger trg_set_need_urgency on public.needs is 
  'Automatically computes and sets urgency_light based on status and sla_target_date.';

-- Update existing needs to have computed urgency
update public.needs
set urgency_light = public.compute_need_urgency(status, sla_target_date)
where urgency_light is null 
   or urgency_light != public.compute_need_urgency(status, sla_target_date);


