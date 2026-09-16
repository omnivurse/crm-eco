// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { GizmoCompanion } from '@crm-eco/ui/components/gizmo-companion';

afterEach(cleanup);

describe('GizmoCompanion reset', () => {
  it('exposes New search and clears the thread', () => {
    render(<GizmoCompanion chatUrl="/api/gizmo/chat" />);
    fireEvent.click(screen.getByRole('button', { name: 'Open Gizmo' }));
    expect(screen.getByRole('button', { name: 'New search' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'New search' }));
    expect(screen.getByText(/find a record, a page, or a how-to/i)).toBeTruthy();
  });
});
