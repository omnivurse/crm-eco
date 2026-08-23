// @vitest-environment jsdom
/**
 * Dropdown lists (settings/field-options) — the curation screen for
 * crm_fields.options: renders the menu with usage counts and the
 * "in your records, but not on the menu" drift section; add POSTs; rename
 * PUTs a label; hide / bring back PUTs is_active; Move up/down PATCHes a
 * full reorder; agents get a friendly permission view, not a dead end.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/crm/settings/field-options',
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
    info: vi.fn(),
  },
}));

import { DropdownListsClient } from './DropdownListsClient';

// ---------------------------------------------------------------------------
// Fixtures + fetch stub
// ---------------------------------------------------------------------------

const FIELD = { id: 'f-1', key: 'product', label: 'Membership / Plan', type: 'text' };
const MODULES = [{ id: 'm-1', key: 'contacts', name: 'Contacts' }];

function opt(id: string, label: string, display_order: number, extra: Partial<Record<string, unknown>> = {}) {
  return {
    id,
    value: label,
    label,
    color: null,
    icon: null,
    is_default: false,
    is_active: true,
    display_order,
    metadata: {},
    ...extra,
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

type Call = { url: string; method: string; body: Record<string, unknown> | null };
let calls: Call[] = [];
let optionsResponse: () => Response;
let valuesResponse: () => Response;
let writeResponse: (call: Call) => Response;

function installFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();
      const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : null;
      const call = { url, method, body };
      calls.push(call);
      if (url.startsWith('/api/crm/field-options') && method === 'GET') return optionsResponse();
      if (url.startsWith('/api/crm/records/field-values')) return valuesResponse();
      return writeResponse(call);
    })
  );
}

function baseProps() {
  return {
    canManage: true,
    modules: MODULES,
    selectedModuleKey: 'contacts',
    fields: [FIELD],
    selectedField: FIELD,
    badParams: false,
  };
}

beforeEach(() => {
  calls = [];
  push.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
  optionsResponse = () =>
    json({ options: [opt('o1', 'Health Sharing', 0), opt('o2', 'Secure HSA', 1, { is_active: false })] });
  valuesResponse = () =>
    json({
      module_key: 'contacts',
      key: 'product',
      values: [
        { value: 'Health Sharing', count: 120 },
        { value: 'Helth Sharing', count: 3 },
      ],
      total: 123,
    });
  writeResponse = () => json({ success: true });
  installFetch();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DropdownListsClient', () => {
  it('renders the menu with usage counts, the Hidden badge, and the not-on-the-menu section', async () => {
    render(<DropdownListsClient {...baseProps()} />);

    expect(await screen.findByText('Health Sharing')).toBeTruthy();
    // Heading names what she is editing, not the field key.
    expect(screen.getByRole('heading', { level: 1, name: 'Membership / Plan' })).toBeTruthy();
    expect(screen.getByText('120 records already use this')).toBeTruthy();
    expect(screen.getByText('Hidden')).toBeTruthy();
    expect(screen.getByText('Not used on any record yet')).toBeTruthy();
    // The drift section lists the stored spelling that is not an option.
    expect(screen.getByText('In your records, but not on the menu')).toBeTruthy();
    expect(screen.getByText('Helth Sharing')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add Helth Sharing to the menu' })).toBeTruthy();
    // Never-delete promise is stated in plain words.
    expect(screen.getByText(/hidden, never deleted/)).toBeTruthy();
  });

  it('adding an option POSTs value+label and appends it to the menu', async () => {
    writeResponse = (call) => json({ option: opt('o3', String(call.body?.label ?? ''), 2) }, 201);
    render(<DropdownListsClient {...baseProps()} />);
    await screen.findByText('Health Sharing');

    fireEvent.change(screen.getByLabelText('New option'), { target: { value: 'Care Plus' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findByText('Care Plus')).toBeTruthy();
    const post = calls.find((c) => c.method === 'POST');
    expect(post?.url).toBe('/api/crm/field-options');
    expect(post?.body).toMatchObject({ field_id: 'f-1', value: 'Care Plus', label: 'Care Plus' });
    expect(toastSuccess).toHaveBeenCalledWith('Option added');
  });

  it('renaming PUTs the new label and shows it', async () => {
    writeResponse = (call) => json({ option: opt('o1', String(call.body?.label ?? ''), 0) });
    render(<DropdownListsClient {...baseProps()} />);
    await screen.findByText('Health Sharing');

    fireEvent.click(screen.getByRole('button', { name: 'Rename Health Sharing' }));
    const input = screen.getByLabelText('New name for Health Sharing');
    fireEvent.change(input, { target: { value: 'Health Share Plans' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Health Share Plans')).toBeTruthy();
    const put = calls.find((c) => c.method === 'PUT');
    expect(put?.body).toMatchObject({ field_id: 'f-1', id: 'o1', label: 'Health Share Plans' });
    expect(toastSuccess).toHaveBeenCalledWith('Option updated');
  });

  it('a stale-option 404 never toasts a raw UUID', async () => {
    const staleId = '00000000-0000-0000-0000-00000000cccc';
    writeResponse = () => json({ error: `Option not found: ${staleId}` }, 404);
    render(<DropdownListsClient {...baseProps()} />);
    await screen.findByText('Health Sharing');

    fireEvent.click(screen.getByRole('button', { name: 'Rename Health Sharing' }));
    fireEvent.change(screen.getByLabelText('New name for Health Sharing'), {
      target: { value: 'Health Share Plans' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    const shown = String(toastError.mock.calls[0][0]);
    expect(shown).not.toContain(staleId);
    expect(shown).not.toMatch(/Option not found/i);
    expect(shown).toMatch(/reload the page/i);
  });

  it('Hide PUTs is_active:false; Bring back PUTs is_active:true', async () => {
    writeResponse = (call) =>
      json({
        option: opt(String(call.body?.id), call.body?.id === 'o1' ? 'Health Sharing' : 'Secure HSA', 0, {
          is_active: call.body?.is_active,
        }),
      });
    render(<DropdownListsClient {...baseProps()} />);
    await screen.findByText('Health Sharing');

    fireEvent.click(screen.getByRole('button', { name: 'Hide Health Sharing' }));
    await waitFor(() => {
      expect(calls.find((c) => c.method === 'PUT')?.body).toMatchObject({ id: 'o1', is_active: false });
    });
    // The active option is now hidden too → two Hidden badges.
    expect((await screen.findAllByText('Hidden')).length).toBe(2);

    fireEvent.click(screen.getByRole('button', { name: 'Bring back Secure HSA' }));
    await waitFor(() => {
      const puts = calls.filter((c) => c.method === 'PUT');
      expect(puts[puts.length - 1]?.body).toMatchObject({ id: 'o2', is_active: true });
    });
  });

  it('Move down PATCHes a full renumbering and swaps the rows', async () => {
    writeResponse = () =>
      json({ options: [opt('o2', 'Secure HSA', 0, { is_active: false }), opt('o1', 'Health Sharing', 1)] });
    render(<DropdownListsClient {...baseProps()} />);
    await screen.findByText('Health Sharing');

    fireEvent.click(screen.getByRole('button', { name: 'Move Health Sharing down' }));

    await waitFor(() => {
      const patch = calls.find((c) => c.method === 'PATCH');
      expect(patch?.body).toMatchObject({
        field_id: 'f-1',
        updates: [
          { id: 'o2', display_order: 0 },
          { id: 'o1', display_order: 1 },
        ],
      });
    });
    const items = screen.getAllByRole('listitem');
    expect(items[0].textContent).toContain('Secure HSA');
    expect(items[1].textContent).toContain('Health Sharing');
    expect(toastSuccess).toHaveBeenCalledWith('Order saved');
  });

  it('a failed reorder reverts the rows and explains with the server reason', async () => {
    writeResponse = () => json({ error: 'Cannot leave the list with no active option' }, 400);
    render(<DropdownListsClient {...baseProps()} />);
    await screen.findByText('Health Sharing');

    fireEvent.click(screen.getByRole('button', { name: 'Move Health Sharing down' }));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(String(toastError.mock.calls[0][0])).toContain('Cannot leave the list with no active option');
    const items = screen.getAllByRole('listitem');
    expect(items[0].textContent).toContain('Health Sharing');
  });

  it('agents/viewers get a friendly explanation and a way back, never an editor', () => {
    render(
      <DropdownListsClient
        canManage={false}
        modules={[]}
        selectedModuleKey={null}
        fields={[]}
        selectedField={null}
        badParams={false}
      />
    );
    expect(screen.getByText('This page is for admins and managers')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Back to Settings/ })).toBeTruthy();
    expect(screen.queryByLabelText('New option')).toBeNull();
    expect(calls.length).toBe(0);
  });

  it('with no field selected it shows the picker prompt and fetches nothing', () => {
    render(<DropdownListsClient {...baseProps()} selectedField={null} badParams />);
    expect(screen.getByText(/Pick where the list is used/)).toBeTruthy();
    // The bad deep link is called out gently.
    expect(screen.getByText(/That link didn.t match a list/)).toBeTruthy();
    expect(calls.length).toBe(0);
  });

  it('a load failure shows Try again, which refetches', async () => {
    optionsResponse = () => json({ error: 'boom' }, 500);
    render(<DropdownListsClient {...baseProps()} />);
    expect(await screen.findByText("Couldn't load this list.")).toBeTruthy();

    optionsResponse = () => json({ options: [opt('o1', 'Health Sharing', 0)] });
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Health Sharing')).toBeTruthy();
  });
});
