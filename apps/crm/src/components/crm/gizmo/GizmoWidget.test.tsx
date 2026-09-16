// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  usePathname: () => '/crm',
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('./GizmoProvider', () => ({
  useGizmo: () => ({
    enabled: false,
    currentPageLabel: 'CRM',
    currentTips: [],
    dismissTip: vi.fn(),
    setEnabled: vi.fn(),
    hasNewTips: false,
  }),
}));

import { GizmoWidget } from './GizmoWidget';

afterEach(cleanup);

describe('GizmoWidget', () => {
  it('keeps the orb in the corner even when old Hide persisted enabled:false', () => {
    render(<GizmoWidget />);
    expect(screen.getByRole('button', { name: 'Open Gizmo' })).toBeTruthy();
  });
});
