import { describe, expect, it } from 'vitest';
import {
  crmShellMainClass,
  crmShellMainInnerClass,
  isCrmFullBleedPath,
  isCrmRecordPath,
} from './full-bleed-main';

describe('isCrmFullBleedPath', () => {
  it('treats inbox as a full-bleed workspace', () => {
    expect(isCrmFullBleedPath('/crm/inbox')).toBe(true);
    expect(isCrmFullBleedPath('/crm/inbox?c=abc')).toBe(true);
  });

  it('keeps other CRM pages padded', () => {
    expect(isCrmFullBleedPath('/crm/needs')).toBe(false);
    expect(isCrmFullBleedPath('/crm/modules/contacts')).toBe(false);
    expect(isCrmFullBleedPath('/crm/r/abc')).toBe(false);
    expect(isCrmFullBleedPath('/crm-login')).toBe(false);
    expect(isCrmFullBleedPath(null)).toBe(false);
  });
});

describe('isCrmRecordPath', () => {
  it('matches record detail only', () => {
    expect(isCrmRecordPath('/crm/r/abc')).toBe(true);
    expect(isCrmRecordPath('/crm/modules/contacts')).toBe(false);
    expect(isCrmRecordPath('/crm/inbox')).toBe(false);
    expect(isCrmRecordPath(null)).toBe(false);
  });
});

describe('crmShellMainClass', () => {
  it('drops shell gutters on inbox', () => {
    const cls = crmShellMainClass(true);
    expect(cls).toContain('px-0');
    expect(cls).toContain('py-0');
    expect(cls).toContain('overflow-hidden');
    expect(cls).not.toContain('px-2');
    expect(cls).not.toContain('lg:px-4');
  });

  it('keeps reading gutters on other pages', () => {
    const cls = crmShellMainClass(false);
    expect(cls).toContain('px-2');
    expect(cls).toContain('lg:px-4');
    expect(cls).toContain('overflow-auto');
  });

  it('drops side gutters on record detail without inbox overflow-hidden', () => {
    const cls = crmShellMainClass(false, true);
    expect(cls).toContain('px-0');
    expect(cls).toContain('overflow-auto');
    expect(cls).toContain('pb-0');
    expect(cls).not.toContain('overflow-hidden');
    expect(cls).not.toContain('lg:px-4');
  });
});

describe('crmShellMainInnerClass', () => {
  it('fills the main pane on inbox and keeps bottom inset elsewhere', () => {
    expect(crmShellMainInnerClass(true)).toContain('h-full');
    expect(crmShellMainInnerClass(true)).not.toContain('pb-10');
    expect(crmShellMainInnerClass(false)).toContain('pb-10');
  });

  it('fills the record pane so fields sit on the bottom bar', () => {
    const cls = crmShellMainInnerClass(false, true);
    expect(cls).toContain('h-full');
    expect(cls).not.toContain('pb-10');
  });
});
