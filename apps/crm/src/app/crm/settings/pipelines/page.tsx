import { redirect } from 'next/navigation';

/**
 * PHASE 2A — DEFERRED FEATURE: CRM Pipelines settings.
 *
 * The customizable-pipelines feature is deferred until after enrollment
 * season (see docs/audit/PHASE_2A_TRIAGE.md, section 3B). The page now
 * redirects back to the settings hub with a banner; the original
 * `PipelineSettingsClient` component remains on disk so we can restore
 * the page without rewriting it.
 */
export const dynamic = 'force-dynamic';

export default function PipelinesSettingsPage(): never {
  redirect('/crm/settings?notice=pipelines_deferred');
}
