import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentProfile, getAllModules, getFieldsForModule } from '@/lib/crm/queries';
import { isCrmManagerOrAdminRole } from '@/lib/crm/nav-profile';
import type { CrmField, CrmModule } from '@/lib/crm/types';
import {
  DropdownListsClient,
  type FieldChoice,
  type ModuleChoice,
} from './DropdownListsClient';

/**
 * Dropdown lists — the settings screen for curating a field's pick list
 * (stored on crm_fields.options; read/written via /api/crm/field-options).
 *
 * Deep-linkable: /crm/settings/field-options?module=contacts&field=product
 * opens the Membership / Plan list directly — that one URL is what the owner
 * sends his client. Bad params never crash: an unknown module or field key
 * simply falls back to the picker with a gentle notice.
 *
 * Admin/manager only (isCrmManagerOrAdminRole — same predicate the sidebar
 * uses), so nobody is shown a link the page refuses. An agent who pastes the
 * URL anyway gets a friendly explanation, not a dead end.
 */

interface PageProps {
  searchParams: Promise<{
    module?: string;
    field?: string;
  }>;
}

/** Field types whose values a person picks (or should pick) from a list. */
const CURATABLE_TYPES = new Set(['text', 'select', 'picklist', 'multiselect']);

function toFieldChoice(f: CrmField): FieldChoice {
  return { id: f.id, key: f.key, label: f.label, type: f.type };
}

function toModuleChoice(m: CrmModule): ModuleChoice {
  return { id: m.id, key: m.key, name: m.name };
}

async function DropdownListsContent({ searchParams }: PageProps) {
  const { module: moduleParam, field: fieldParam } = await searchParams;

  let profile;
  try {
    profile = await getCurrentProfile();
  } catch (err) {
    console.error('[DropdownLists] Failed to get profile:', err);
    redirect('/crm-login');
  }
  if (!profile) {
    redirect('/crm-login');
  }

  if (!isCrmManagerOrAdminRole(profile.crm_role)) {
    return (
      <DropdownListsClient
        canManage={false}
        modules={[]}
        selectedModuleKey={null}
        fields={[]}
        selectedField={null}
        badParams={false}
      />
    );
  }

  let modules: CrmModule[];
  try {
    modules = await getAllModules(profile.organization_id);
  } catch (err) {
    console.error('[DropdownLists] Failed to load modules:', err);
    modules = [];
  }

  const wantedModuleKey = moduleParam?.trim().toLowerCase() || null;
  const selectedModule = wantedModuleKey
    ? modules.find((m) => m.key === wantedModuleKey) ?? null
    : null;
  let badParams = Boolean(wantedModuleKey && !selectedModule);

  let fields: CrmField[] = [];
  if (selectedModule) {
    try {
      fields = await getFieldsForModule(selectedModule.id);
    } catch (err) {
      console.error('[DropdownLists] Failed to load fields:', err);
      fields = [];
    }
  }
  const curatable = fields
    .filter((f) => CURATABLE_TYPES.has(f.type) || (Array.isArray(f.options) && f.options.length > 0))
    .sort((a, b) => a.display_order - b.display_order);

  const wantedFieldKey = fieldParam?.trim().toLowerCase() || null;
  const selectedField = selectedModule && wantedFieldKey
    ? curatable.find((f) => f.key === wantedFieldKey) ?? null
    : null;
  if (selectedModule && wantedFieldKey && !selectedField) badParams = true;

  return (
    <DropdownListsClient
      canManage
      modules={modules.map(toModuleChoice)}
      selectedModuleKey={selectedModule?.key ?? null}
      fields={curatable.map(toFieldChoice)}
      selectedField={selectedField ? toFieldChoice(selectedField) : null}
      badParams={badParams}
    />
  );
}

export default function DropdownListsPage(props: PageProps) {
  return (
    <Suspense fallback={<DropdownListsSkeleton />}>
      <DropdownListsContent {...props} />
    </Suspense>
  );
}

function DropdownListsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-slate-200 dark:bg-slate-800 rounded-lg" />
        <div className="space-y-2">
          <div className="h-7 w-48 bg-slate-200 dark:bg-slate-800 rounded" />
          <div className="h-4 w-72 bg-slate-200 dark:bg-slate-800 rounded" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
        <div className="h-16 bg-slate-200 dark:bg-slate-800/50 rounded-lg" />
        <div className="h-16 bg-slate-200 dark:bg-slate-800/50 rounded-lg" />
      </div>
      <div className="space-y-2 max-w-3xl">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-14 bg-slate-200 dark:bg-slate-800/50 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
