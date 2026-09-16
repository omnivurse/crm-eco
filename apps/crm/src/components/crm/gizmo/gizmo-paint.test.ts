import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ui = path.resolve(__dirname, '../../../../../../packages/ui/src');

describe('gizmo companion paint', () => {
  const css = readFileSync(path.join(ui, 'styles/gizmo.css'), 'utf8');
  const companion = readFileSync(path.join(ui, 'components/gizmo-companion.tsx'), 'utf8');

  it('locks a dark panel and mint ink so light-mode teal remap cannot wash it out', () => {
    expect(css).toContain('background: #0b1f1e');
    expect(css).toContain('color: #f0fdfa');
    expect(css).toContain('#14b8a6');
  });

  it('does not paint the panel with remapped Tailwind teal utilities', () => {
    expect(companion).toMatch(/gizmo-panel/);
    expect(companion).not.toMatch(/text-teal-50|bg-\[#0b1f1e\]/);
  });
});
