/**
 * DE-M1: the bottom-bar Quick Actions hide every create shortcut from
 * crm_viewer and the Import tile from anyone /crm/import would bounce.
 */
import { describe, expect, it } from 'vitest';
import { commandsPopupActionAllowed } from './CommandsPopup';

describe('commandsPopupActionAllowed', () => {
  it('offers create shortcuts only to creating roles', () => {
    for (const href of ['/crm/modules/leads/new', '/crm/modules/contacts/new', '/crm/tasks/new']) {
      expect(commandsPopupActionAllowed(href, 'crm_viewer')).toBe(false);
      expect(commandsPopupActionAllowed(href, null)).toBe(false);
      expect(commandsPopupActionAllowed(href, 'crm_agent')).toBe(true);
      expect(commandsPopupActionAllowed(href, 'crm_admin')).toBe(true);
    }
  });

  it('offers Import only to manager / admin (the page redirects everyone else)', () => {
    expect(commandsPopupActionAllowed('/crm/import', 'crm_agent')).toBe(false);
    expect(commandsPopupActionAllowed('/crm/import', 'crm_viewer')).toBe(false);
    expect(commandsPopupActionAllowed('/crm/import', 'crm_manager')).toBe(true);
    expect(commandsPopupActionAllowed('/crm/import', 'crm_admin')).toBe(true);
  });

  it('never hides a non-create, non-import action', () => {
    for (const href of ['/crm/activities?type=call', '/crm/inbox?compose=true']) {
      expect(commandsPopupActionAllowed(href, 'crm_viewer')).toBe(true);
      expect(commandsPopupActionAllowed(href, undefined)).toBe(true);
    }
  });
});
