'use client';

/**
 * The density store was promoted to `@crm-eco/ui/lib/density` so the CRM and
 * Admin consoles share one scale and one persisted preference. The token scale
 * it drives now lives in `@crm-eco/ui/styles/theme.css` as `--ui-*`, aliased
 * back to `--crm-*` in apps/crm/src/app/globals.css.
 *
 * This module re-exports the shared store under the original CRM names so
 * existing `@/lib/crm/density` imports keep working unchanged.
 */
export {
  DENSITY_STORAGE_KEY as CRM_DENSITY_STORAGE_KEY,
  readStoredDensity,
  setDensity as setCrmDensity,
  useDensity as useCrmDensity,
  type Density,
} from '@crm-eco/ui/lib/density';
