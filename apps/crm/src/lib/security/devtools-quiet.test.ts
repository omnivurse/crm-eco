import { describe, expect, it } from 'vitest';
import {
  DEVTOOLS_QUIET_SCRIPT,
  devtoolsQuietScriptIsNeutral,
} from '@crm-eco/ui/lib/devtools-quiet';

describe('devtools quiet script', () => {
  it('mutes console and React DevTools without naming the product', () => {
    expect(DEVTOOLS_QUIET_SCRIPT).toContain('console');
    expect(DEVTOOLS_QUIET_SCRIPT).toContain('__REACT_DEVTOOLS_GLOBAL_HOOK__');
    expect(devtoolsQuietScriptIsNeutral()).toBe(true);
  });
});
