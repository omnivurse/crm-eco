// @vitest-environment jsdom
/**
 * Road to Ten DE-1 / DE-2 (client) / DE-3 / DE-5 / DE-6 — the quick-create
 * drawer: closed Health Sharing Membership select + "Other…", Health Insurance
 * Plan suggestions from the org distinct-values endpoint, the producer picker
 * writing name + id, field-anchored date errors with focus-to-first-invalid
 * and no POST, the server PENDING code mapped to one sentence, and a Pending
 * lead saving without a date.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  ENROLLED_BY_SEARCH_DEBOUNCE_MS,
} from '@/components/crm/create/EnrolledByPicker';
import {
  PRODUCER_RECORD_ID_KEY,
  QUICK_CREATE_INVALID_DATE,
  QUICK_CREATE_PENDING_NEEDS_DATE,
} from '@/lib/crm/quick-create-config';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/crm/modules/contacts',
}));

const toastSuccess = vi.fn();
vi.mock('sonner', () => ({
  toast: { success: (...a: unknown[]) => toastSuccess(...a), error: vi.fn(), info: vi.fn() },
}));

import { QuickCreateDrawer } from './QuickCreateDrawer';

// jsdom lacks the pointer-capture / scroll APIs Radix Select touches when the
// status select opens (the lead Pending case); stub them — the drawer only
// needs the option list to render and commit.
beforeEach(() => {
  const proto = Element.prototype as unknown as Record<string, unknown>;
  proto.hasPointerCapture ??= () => false;
  proto.setPointerCapture ??= () => {};
  proto.releasePointerCapture ??= () => {};
  proto.scrollIntoView ??= () => {};
  (globalThis as unknown as Record<string, unknown>).ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const ORG = '00000000-0000-0000-0000-000000000001';
const MODULES = [
  { id: 'mod-contacts', key: 'contacts', org_id: ORG, name: 'Contacts', is_enabled: true },
  { id: 'mod-leads', key: 'leads', org_id: ORG, name: 'Leads', is_enabled: true },
] as const;

type Call = { url: string; method: string; body: Record<string, unknown> | null };
let calls: Call[] = [];
let postResponse: () => Response = () => json({ id: 'rec-1' });

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function installFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();
      const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : null;
      calls.push({ url, method, body });
      if (url.includes('/api/crm/modules/') && url.endsWith('/fields')) {
        return json({
          fields: [
            { key: 'product', options: ['Secure', 'Care Plus'] },
            { key: 'product_type', options: ['Secure', 'Care Plus'] },
            { key: 'contact_status', options: ['Active', 'Pending', 'Inactive'] },
            { key: 'lead_status', options: ['New', 'Pending', 'Converted'] },
            { key: 'sharing_entity', options: ['Sedera', 'MPB'] },
            { key: 'health_insurance_plan_name', options: [] },
          ],
        });
      }
      if (url.includes('/api/crm/records/field-values')) {
        return json({
          module_key: 'contacts',
          key: 'health_insurance_plan_name',
          values: [
            { value: 'Walker Bronze HMO 5000', count: 7 },
            { value: 'Silver PPO', count: 3 },
          ],
          total: 10,
        });
      }
      if (url.includes('/api/crm/advisors')) {
        return json({ data: [{ id: 'adv-1', name: 'Wen Producer' }, { id: 'adv-2', name: 'Pat Producer' }], total: 2 });
      }
      if (url.includes('/api/crm/records/check-duplicate')) {
        return json({ duplicates: [] });
      }
      if (url.endsWith('/api/crm/records') && method === 'POST') {
        return postResponse();
      }
      return json({}, 404);
    }),
  );
}

const posts = () => calls.filter((c) => c.method === 'POST' && c.url.endsWith('/api/crm/records'));
const field = (mod: string, key: string) => document.getElementById(`qc-${mod}-${key}`) as HTMLElement;
const form = () => screen.getByTestId('crm-qc-form');

async function openDrawer() {
  render(<QuickCreateDrawer open onOpenChange={() => {}} modules={MODULES as never} />);
  await waitFor(() => expect(form()).toBeTruthy());
  // options + distinct values loaded → the product select is in place
  await waitFor(() => expect(field('contacts', 'product').tagName).toBe('SELECT'));
}

async function typeNames(mod = 'contacts') {
  fireEvent.change(field(mod, 'first_name'), { target: { value: 'Walk' } });
  fireEvent.change(field(mod, 'last_name'), { target: { value: 'Tester' } });
}

async function submit() {
  await act(async () => {
    fireEvent.submit(form());
  });
}

beforeEach(() => {
  calls = [];
  postResponse = () => json({ id: 'rec-1' });
  toastSuccess.mockReset();
  push.mockReset();
  installFetch();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('QuickCreateDrawer — Health Sharing Membership (DE-1)', () => {
  it('renders a closed select from the org options with an explicit "Other…" that reveals a text input', async () => {
    await openDrawer();
    const select = field('contacts', 'product') as HTMLSelectElement;
    const labels = Array.from(select.options).map((o) => o.textContent);
    expect(labels).toEqual(['Select…', 'Secure', 'Care Plus', 'Other…']);
    expect(document.getElementById('qc-contacts-product-other')).toBeNull();

    fireEvent.change(select, { target: { value: 'Care Plus' } });
    expect(select.value).toBe('Care Plus');

    const otherValue = select.options[select.options.length - 1].value;
    fireEvent.change(select, { target: { value: otherValue } });
    const other = document.getElementById('qc-contacts-product-other') as HTMLInputElement;
    expect(other).toBeTruthy();
    expect(other.value).toBe(''); // a listed pick does not pre-fill the free-text box
    fireEvent.change(other, { target: { value: 'Walk Sharing Membership' } });

    await typeNames();
    fireEvent.change(field('contacts', 'sharing_effective_date'), { target: { value: '9/1/26' } });
    await submit();
    await waitFor(() => expect(posts()).toHaveLength(1));
    const data = posts()[0].body?.data as Record<string, string>;
    expect(data.product).toBe('Walk Sharing Membership');
    expect(data.sharing_effective_date).toBe('09/01/2026');
  });
});

describe('QuickCreateDrawer — Health Insurance Plan suggestions (DE-2 client)', () => {
  it('requests the org distinct values once per open and merges them into the suggestion list', async () => {
    await openDrawer();
    const fv = calls.filter((c) => c.url.includes('/api/crm/records/field-values'));
    expect(fv).toHaveLength(1);
    expect(fv[0].url).toContain('module_key=contacts');
    expect(fv[0].url).toContain('key=health_insurance_plan_name');
    const plan = field('contacts', 'health_insurance_plan_name');
    fireEvent.focus(plan);
    const list = await screen.findByRole('listbox', { name: 'Health Insurance Plan' });
    expect(within(list).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Walker Bronze HMO 5000',
      'Silver PPO',
    ]);
    fireEvent.change(plan, { target: { value: 'silver' } });
    expect(within(list).getAllByRole('option').map((o) => o.textContent)).toEqual(['Silver PPO']);
    // still one request — typing never re-queries
    expect(calls.filter((c) => c.url.includes('/api/crm/records/field-values'))).toHaveLength(1);
  });
});

describe('QuickCreateDrawer — Enrolled by (DE-3)', () => {
  it('a picked producer writes producer_name + producer_record_id; hand-typing afterwards drops the id', async () => {
    await openDrawer();
    await typeNames();
    fireEvent.change(field('contacts', 'sharing_effective_date'), { target: { value: '09/01/2026' } });
    const producer = field('contacts', 'producer_name');
    fireEvent.focus(producer);
    await waitFor(
      () => expect(screen.getByRole('option', { name: 'Wen Producer' })).toBeTruthy(),
      { timeout: ENROLLED_BY_SEARCH_DEBOUNCE_MS * 10 },
    );
    fireEvent.keyDown(producer, { key: 'ArrowDown' });
    fireEvent.keyDown(producer, { key: 'Enter' });
    expect((producer as HTMLInputElement).value).toBe('Wen Producer');

    await submit();
    await waitFor(() => expect(posts()).toHaveLength(1));
    const data = posts()[0].body?.data as Record<string, string>;
    expect(data.producer_name).toBe('Wen Producer');
    expect(data[PRODUCER_RECORD_ID_KEY]).toBe('adv-1');
    expect(toastSuccess).toHaveBeenCalledWith('Member added');
  });

  it('typing over a picked name detaches the id (free text is written as typed)', async () => {
    await openDrawer();
    await typeNames();
    fireEvent.change(field('contacts', 'health_insurance_start_date'), { target: { value: '09/01/2026' } });
    const producer = field('contacts', 'producer_name');
    fireEvent.focus(producer);
    await waitFor(
      () => expect(screen.getByRole('option', { name: 'Pat Producer' })).toBeTruthy(),
      { timeout: ENROLLED_BY_SEARCH_DEBOUNCE_MS * 10 },
    );
    fireEvent.keyDown(producer, { key: 'ArrowDown' });
    fireEvent.keyDown(producer, { key: 'ArrowDown' });
    fireEvent.keyDown(producer, { key: 'Enter' });
    expect((producer as HTMLInputElement).value).toBe('Pat Producer');
    fireEvent.change(producer, { target: { value: 'Pat Producer Jr' } });
    await submit();
    await waitFor(() => expect(posts()).toHaveLength(1));
    const data = posts()[0].body?.data as Record<string, string>;
    expect(data.producer_name).toBe('Pat Producer Jr');
    expect(data).not.toHaveProperty(PRODUCER_RECORD_ID_KEY);
  });
});

describe('QuickCreateDrawer — dates and field-anchored errors (DE-5)', () => {
  it('shows the Pending hint under Coverage start on open (contacts default to Pending)', async () => {
    await openDrawer();
    const start = field('contacts', 'health_insurance_start_date');
    const hintId = start.getAttribute('aria-describedby');
    expect(hintId).toBe('qc-contacts-health_insurance_start_date-hint');
    expect(document.getElementById(hintId!)?.textContent).toBe(QUICK_CREATE_PENDING_NEEDS_DATE);
    expect(start.getAttribute('aria-invalid')).toBeNull();
  });

  it('13/45/2026 is rejected on blur and at submit: role=alert under the field, aria-invalid, focus there, no POST', async () => {
    await openDrawer();
    await typeNames();
    const dob = field('contacts', 'date_of_birth') as HTMLInputElement;
    fireEvent.change(dob, { target: { value: '13/45/2026' } });
    fireEvent.blur(dob);
    const alert = await within(dob.parentElement as HTMLElement).findByRole('alert');
    expect(alert.textContent).toBe(QUICK_CREATE_INVALID_DATE);
    expect(dob.getAttribute('aria-invalid')).toBe('true');
    expect(dob.getAttribute('aria-describedby')).toBe(alert.id);

    // Pending + no date as well → two anchored errors, focus on the FIRST (DOB is earlier in the paste order)
    field('contacts', 'sharing_effective_date').focus();
    await submit();
    await waitFor(() => expect(document.activeElement).toBe(dob));
    expect(posts()).toHaveLength(0);
    const startAlert = within(field('contacts', 'health_insurance_start_date').parentElement as HTMLElement).getByRole('alert');
    expect(startAlert.textContent).toBe(QUICK_CREATE_PENDING_NEEDS_DATE);
    // no summary <p role=alert> outside the fields, and the raw server code never appears
    expect(form().textContent).not.toContain('PENDING_REQUIRES_START_DATE');
    expect(form().textContent).not.toContain('Effective date');
  });

  it('a partial date (09/01) is rejected; 9/1/26 is accepted and POSTed masked', async () => {
    await openDrawer();
    await typeNames();
    const start = field('contacts', 'health_insurance_start_date') as HTMLInputElement;
    fireEvent.change(start, { target: { value: '09/01' } });
    await submit();
    expect(posts()).toHaveLength(0);
    expect(within(start.parentElement as HTMLElement).getByRole('alert').textContent).toBe(QUICK_CREATE_INVALID_DATE);

    fireEvent.change(start, { target: { value: '9/1/26' } });
    // typing clears the error immediately
    expect(within(start.parentElement as HTMLElement).queryByRole('alert')).toBeNull();
    await submit();
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect((posts()[0].body?.data as Record<string, string>).health_insurance_start_date).toBe('09/01/2026');
  });

  it('maps the server PENDING_REQUIRES_START_DATE backstop to the one sentence, anchored to Coverage start', async () => {
    postResponse = () =>
      json(
        {
          error:
            'Pending status requires a coverage start date (original_start_date, current_year_start_date, or start_date / effective_date in data)',
          code: 'PENDING_REQUIRES_START_DATE',
        },
        400,
      );
    await openDrawer();
    await typeNames();
    // Client rule satisfied (sharing date present) → the POST goes out; the server still says no.
    fireEvent.change(field('contacts', 'sharing_effective_date'), { target: { value: '09/01/2026' } });
    await submit();
    await waitFor(() => expect(posts()).toHaveLength(1));
    const start = field('contacts', 'health_insurance_start_date');
    const alert = await within(start.parentElement as HTMLElement).findByRole('alert');
    expect(alert.textContent).toBe(QUICK_CREATE_PENDING_NEEDS_DATE);
    expect(form().textContent).not.toContain('original_start_date');
    expect(form().textContent).not.toContain('PENDING_REQUIRES_START_DATE');
    await waitFor(() => expect(document.activeElement).toBe(start));
  });

  it('a blank required field gets its own anchored message and focus', async () => {
    await openDrawer();
    fireEvent.change(field('contacts', 'last_name'), { target: { value: 'Only' } });
    fireEvent.change(field('contacts', 'sharing_effective_date'), { target: { value: '09/01/2026' } });
    await submit();
    const first = field('contacts', 'first_name');
    expect(within(first.parentElement as HTMLElement).getByRole('alert').textContent).toBe('First name is required');
    expect(first.getAttribute('aria-invalid')).toBe('true');
    await waitFor(() => expect(document.activeElement).toBe(first));
    expect(posts()).toHaveLength(0);
  });
});

describe('QuickCreateDrawer — Pending lead parity (DE-6)', () => {
  it('a lead at stage Pending saves without any coverage date', async () => {
    await openDrawer();
    fireEvent.click(screen.getByRole('group', { name: 'Record type' }).querySelector('button:nth-child(2)') as HTMLElement);
    await waitFor(() => expect(field('leads', 'first_name')).toBeTruthy());
    await typeNames('leads');
    // Drive the status select through its Radix trigger (keyboard open → pick).
    const trigger = field('leads', 'lead_status');
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: 'mouse' });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    const pending = await screen.findByRole('option', { name: 'Pending' });
    fireEvent.keyDown(pending, { key: 'Enter' });
    await waitFor(() => expect(trigger.textContent).toContain('Pending'));
    // no hint, no error on the lead's Coverage start
    expect(field('leads', 'health_insurance_start_date').getAttribute('aria-describedby')).toBeNull();
    await submit();
    await waitFor(() => expect(posts()).toHaveLength(1));
    const data = posts()[0].body?.data as Record<string, string>;
    expect(data.lead_status).toBe('Pending');
    expect(data).not.toHaveProperty('health_insurance_start_date');
    expect(data).not.toHaveProperty('sharing_effective_date');
    expect(toastSuccess).toHaveBeenCalledWith('Lead added');
  });
});
