// @vitest-environment jsdom
import { useState, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SuggestPicker } from './SuggestPicker';

afterEach(() => cleanup());

const attr = (el: Element, name: string) => el.getAttribute(name);
const text = (el: Element) => el.textContent ?? '';

function Harness({
  options,
  onSubmit,
  onSelect,
  status,
  children,
  initial = '',
  filter,
  onFormKeyDown,
}: {
  options: readonly string[];
  onSubmit?: () => void;
  onSelect?: (item: string) => void;
  status?: 'idle' | 'loading' | 'error';
  children?: ReactNode;
  initial?: string;
  filter?: 'contains' | 'none';
  onFormKeyDown?: (key: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <form
      data-testid="form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.();
      }}
      onKeyDown={(e) => onFormKeyDown?.(e.key)}
    >
      <SuggestPicker
        id="plan"
        aria-label="Plan"
        value={value}
        onChange={setValue}
        options={options}
        onSelect={onSelect}
        status={status}
        filter={filter}
        errorMessage="Couldn't load producers"
      />
      {children}
      <span data-testid="value">{value}</span>
    </form>
  );
}

const OPTIONS = ['Alpha Plan', 'Beta Plan', 'Gamma Plan'];

describe('SuggestPicker (shared combobox)', () => {
  it('exposes the WAI-ARIA combobox contract', async () => {
    const user = userEvent.setup();
    render(<Harness options={OPTIONS} />);
    const input = screen.getByRole('combobox', { name: 'Plan' });
    expect(attr(input, 'aria-expanded')).toBe('false');
    expect(attr(input, 'aria-haspopup')).toBe('listbox');
    expect(attr(input, 'aria-controls')).toBeNull();

    await user.click(input);
    expect(attr(input, 'aria-expanded')).toBe('true');
    const listbox = screen.getByRole('listbox');
    expect(attr(input, 'aria-controls')).toBe(listbox.id);
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(3);
    for (const opt of options) expect(attr(opt, 'tabindex')).toBe('-1');
    expect(attr(input, 'aria-activedescendant')).toBeNull();

    await user.keyboard('{ArrowDown}');
    expect(attr(input, 'aria-activedescendant')).toBe(options[0].id);
    expect(attr(options[0], 'aria-selected')).toBe('true');
    await user.keyboard('{ArrowDown}');
    expect(attr(input, 'aria-activedescendant')).toBe(options[1].id);
    await user.keyboard('{ArrowUp}{ArrowUp}');
    // wraps to the last row
    expect(attr(input, 'aria-activedescendant')).toBe(options[2].id);
  });

  it('ArrowDown + Enter selects the highlighted option WITHOUT submitting the form', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness options={OPTIONS} onSubmit={onSubmit} />);
    const input = screen.getByRole('combobox', { name: 'Plan' });
    await user.click(input);
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(text(screen.getByTestId('value'))).toContain('Beta Plan');
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(attr(input, 'aria-expanded')).toBe('false');
  });

  it('Enter with the list closed falls through to the native form submit', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness options={OPTIONS} onSubmit={onSubmit} />);
    const input = screen.getByRole('combobox', { name: 'Plan' });
    await user.click(input);
    expect(screen.getByRole('listbox')).toBeTruthy();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    await user.keyboard('{Enter}');
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('Enter while open with no highlight only closes the list (no submit)', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness options={OPTIONS} onSubmit={onSubmit} />);
    await user.click(screen.getByRole('combobox', { name: 'Plan' }));
    await user.keyboard('{Enter}');
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('Escape while open closes the list and does not reach the form (drawer stays open)', async () => {
    const user = userEvent.setup();
    const onFormKeyDown = vi.fn();
    render(<Harness options={OPTIONS} onFormKeyDown={onFormKeyDown} />);
    await user.click(screen.getByRole('combobox', { name: 'Plan' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onFormKeyDown).not.toHaveBeenCalledWith('Escape');
    // second Escape (closed) propagates to the form/drawer
    await user.keyboard('{Escape}');
    expect(onFormKeyDown).toHaveBeenCalledWith('Escape');
  });

  it('Tab commits the highlight, closes synchronously and never lands on an option', async () => {
    const user = userEvent.setup();
    render(
      <Harness options={OPTIONS}>
        <input aria-label="Next field" />
      </Harness>,
    );
    const input = screen.getByRole('combobox', { name: 'Plan' });
    await user.click(input);
    await user.keyboard('{ArrowDown}');
    await user.tab();
    expect(text(screen.getByTestId('value'))).toContain('Alpha Plan');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Next field' }));
    expect(document.activeElement?.getAttribute('role')).not.toBe('option');
  });

  it('Tab without a highlight commits nothing and moves focus on', async () => {
    const user = userEvent.setup();
    render(
      <Harness options={OPTIONS} initial="Al">
        <input aria-label="Next field" />
      </Harness>,
    );
    await user.click(screen.getByRole('combobox', { name: 'Plan' }));
    await user.tab();
    expect(text(screen.getByTestId('value'))).toContain('Al');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Next field' }));
  });

  it('blur closes the list synchronously (no 150 ms timer)', async () => {
    const user = userEvent.setup();
    render(
      <Harness options={OPTIONS}>
        <button type="button">Elsewhere</button>
      </Harness>,
    );
    await user.click(screen.getByRole('combobox', { name: 'Plan' }));
    expect(screen.getByRole('listbox')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Elsewhere' }));
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('filters client-side by contains and shows "No match" when a query matches nothing', async () => {
    const user = userEvent.setup();
    render(<Harness options={OPTIONS} />);
    const input = screen.getByRole('combobox', { name: 'Plan' });
    await user.click(input);
    await user.type(input, 'bet');
    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.getByRole('option', { name: 'Beta Plan' })).toBeTruthy();
    await user.clear(input);
    await user.type(input, 'zzz');
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(text(screen.getByRole('status'))).toContain('No match');
  });

  it('does not nag with "No match" when there are no suggestions at all (contains mode)', async () => {
    const user = userEvent.setup();
    render(<Harness options={[]} />);
    const input = screen.getByRole('combobox', { name: 'Plan' });
    await user.click(input);
    await user.type(input, 'abc');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('filter="none" shows "No match" for an empty server result', async () => {
    const user = userEvent.setup();
    render(<Harness options={[]} filter="none" />);
    await user.click(screen.getByRole('combobox', { name: 'Plan' }));
    expect(text(screen.getByRole('status'))).toContain('No match');
  });

  it('renders the loading and error states', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Harness options={[]} status="loading" filter="none" />);
    await user.click(screen.getByRole('combobox', { name: 'Plan' }));
    expect(text(screen.getByRole('status'))).toContain('Searching…');
    rerender(<Harness options={[]} status="error" filter="none" />);
    expect(text(screen.getByRole('status'))).toContain("Couldn't load producers");
  });

  it('clicking an option commits it', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness options={OPTIONS} onSubmit={onSubmit} />);
    await user.click(screen.getByRole('combobox', { name: 'Plan' }));
    await user.click(screen.getByRole('option', { name: 'Gamma Plan' }));
    expect(text(screen.getByTestId('value'))).toContain('Gamma Plan');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('onSelect receives the whole item (object support for DE-3)', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onChange = vi.fn();
    const items = [
      { name: 'Wen Producer', id: 'adv-1' },
      { name: 'Pat Producer', id: 'adv-2' },
    ];
    render(
      <SuggestPicker
        aria-label="Enrolled by"
        value=""
        onChange={onChange}
        options={items}
        getLabel={(i) => i.name}
        getKey={(i) => i.id}
        onSelect={onSelect}
      />,
    );
    await user.click(screen.getByRole('combobox', { name: 'Enrolled by' }));
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(onSelect).toHaveBeenCalledWith({ name: 'Pat Producer', id: 'adv-2' });
    // onSelect replaces the default string commit
    expect(onChange).not.toHaveBeenCalled();
  });
});
