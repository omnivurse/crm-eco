import type { GizmoAppId, GizmoHowto, GizmoPlace } from '../types';
import { hrefAllowed } from '../href-guard';
import { ADMIN_HOWTO, ADMIN_PLACES } from './admin';
import { ADVISOR_PORTAL_HOWTO, ADVISOR_PORTAL_PLACES } from './advisor-portal';
import { CRM_HOWTO, CRM_PLACES } from './crm';
import { MEMBER_PORTAL_HOWTO, MEMBER_PORTAL_PLACES } from './member-portal';

export {
  ADMIN_HOWTO,
  ADMIN_PLACES,
  ADVISOR_PORTAL_HOWTO,
  ADVISOR_PORTAL_PLACES,
  CRM_HOWTO,
  CRM_PLACES,
  MEMBER_PORTAL_HOWTO,
  MEMBER_PORTAL_PLACES,
};

export function staticPlacesForApp(app: GizmoAppId): GizmoPlace[] {
  switch (app) {
    case 'crm':
      return CRM_PLACES.filter((p) => hrefAllowed('crm', p.href));
    case 'admin':
      return ADMIN_PLACES.filter((p) => hrefAllowed('admin', p.href));
    case 'member_portal':
      return MEMBER_PORTAL_PLACES.filter((p) => hrefAllowed('member_portal', p.href));
    case 'advisor_portal':
      return ADVISOR_PORTAL_PLACES.filter((p) => hrefAllowed('advisor_portal', p.href));
    default:
      return [];
  }
}

export function staticHowtoForApp(app: GizmoAppId): GizmoHowto[] {
  switch (app) {
    case 'crm':
      return CRM_HOWTO.filter((p) => hrefAllowed('crm', p.href));
    case 'admin':
      return ADMIN_HOWTO.filter((p) => hrefAllowed('admin', p.href));
    case 'member_portal':
      return MEMBER_PORTAL_HOWTO.filter((p) => hrefAllowed('member_portal', p.href));
    case 'advisor_portal':
      return ADVISOR_PORTAL_HOWTO.filter((p) => hrefAllowed('advisor_portal', p.href));
    default:
      return [];
  }
}
