import { describe, expect, it } from 'vitest';
import {
  composerActionsClass,
  composerAttachmentsClass,
  composerEditorClass,
  composerEditorSlotClass,
  composerHeaderClass,
  composerRootClass,
} from './email-composer-layout';

describe('email composer chrome', () => {
  it('grows with content on unbounded hosts so the editor cannot collapse', () => {
    expect(composerRootClass(false)).toContain('email-composer');
    expect(composerRootClass(false)).not.toContain('h-full');
    expect(composerRootClass(false)).not.toContain('flex-col');
    expect(composerEditorSlotClass(false)).toBe('');
    expect(composerEditorClass(false)).not.toContain('flex-1');
    expect(composerAttachmentsClass(false)).not.toContain('max-h-40');
  });

  it('pins From/To/Subject and Send when the host fills a pane', () => {
    const root = composerRootClass(true);
    expect(root).toContain('flex-col');
    expect(root).toContain('h-full');
    expect(root).toContain('min-h-0');
    expect(root).toContain('overflow-hidden');
    expect(root).not.toMatch(/overflow-y-auto/);

    expect(composerHeaderClass(true)).toContain('shrink-0');
    expect(composerActionsClass(true)).toContain('shrink-0');
    expect(composerEditorSlotClass(true)).toContain('flex-1');
    expect(composerEditorSlotClass(true)).toContain('flex-col');
    expect(composerEditorSlotClass(true)).toContain('min-h-0');
    expect(composerEditorSlotClass(true)).toContain('overflow-hidden');
    expect(composerEditorClass(true)).toContain('h-full');
    expect(composerEditorClass(true)).toContain('min-h-0');
  });

  it('caps an expanded attachment list so it cannot push Send off-screen', () => {
    expect(composerAttachmentsClass(true)).toContain('shrink-0');
    expect(composerAttachmentsClass(true)).toContain('max-h-40');
    expect(composerAttachmentsClass(true)).toContain('overflow-y-auto');
  });
});
