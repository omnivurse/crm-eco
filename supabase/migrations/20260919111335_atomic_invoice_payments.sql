-- Record an invoice payment and update its balance under one row lock.
-- Additive / reversible. Expected affected data rows: 0.
--
-- Rollback:
--   drop function if exists public.apply_invoice_payment_tx(
--     uuid, uuid, numeric, text, text, text, text, date
--   );

begin;

set local lock_timeout = '5s';

create or replace function public.apply_invoice_payment_tx(
  p_organization_id uuid,
  p_invoice_id uuid,
  p_amount numeric,
  p_kind text,
  p_payment_method text default null,
  p_reference_number text default null,
  p_notes text default null,
  p_payment_date date default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_invoice public.invoices%rowtype;
  v_amount numeric(12, 2);
  v_amount_paid numeric(12, 2);
  v_balance_due numeric(12, 2);
  v_status text;
begin
  if p_kind not in ('payment', 'credit') then
    raise exception 'Unsupported invoice application kind'
      using errcode = '22023';
  end if;

  v_amount := round(abs(p_amount), 2);
  if v_amount is null or v_amount <= 0 then
    raise exception 'Amount must be greater than zero'
      using errcode = '22023';
  end if;

  select i.*
    into v_invoice
    from public.invoices i
   where i.id = p_invoice_id
     and i.organization_id = p_organization_id
   for update;

  if not found then
    raise exception 'Invoice not found'
      using errcode = 'P0002';
  end if;

  v_amount_paid := round(greatest(0::numeric, coalesce(v_invoice.amount_paid, 0) + v_amount), 2);
  v_balance_due := round(greatest(0::numeric, coalesce(v_invoice.total, 0) - v_amount_paid), 2);
  v_status := case
    when v_amount_paid >= coalesce(v_invoice.total, 0) and coalesce(v_invoice.total, 0) > 0
      then 'paid'
    when v_amount_paid > 0
      then 'partial'
    else coalesce(v_invoice.status, 'sent')
  end;

  insert into public.invoice_payments (
    invoice_id,
    amount,
    payment_method,
    payment_date,
    reference_number,
    notes
  )
  values (
    p_invoice_id,
    v_amount,
    case
      when p_kind = 'credit' then coalesce(nullif(p_payment_method, ''), 'credit')
      else coalesce(nullif(p_payment_method, ''), 'manual')
    end,
    coalesce(p_payment_date, current_date),
    p_reference_number,
    coalesce(p_notes, case when p_kind = 'credit' then 'Credit applied' else null end)
  );

  update public.invoices
     set amount_paid = v_amount_paid,
         balance_due = v_balance_due,
         status = v_status,
         paid_at = case
           when v_status = 'paid' then coalesce(v_invoice.paid_at, now())
           else null
         end,
         updated_at = now()
   where id = p_invoice_id
     and organization_id = p_organization_id;

  return jsonb_build_object(
    'amount_paid', v_amount_paid,
    'balance_due', v_balance_due,
    'status', v_status
  );
end;
$$;

revoke all on function public.apply_invoice_payment_tx(
  uuid, uuid, numeric, text, text, text, text, date
) from public, anon, authenticated;
grant execute on function public.apply_invoice_payment_tx(
  uuid, uuid, numeric, text, text, text, text, date
) to service_role;

commit;
