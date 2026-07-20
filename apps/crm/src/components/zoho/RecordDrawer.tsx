'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@crm-eco/ui/components/button';
import { Badge } from '@crm-eco/ui/components/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@crm-eco/ui/components/sheet';
import {
  X,
  ExternalLink,
  Phone,
  Mail,
  CheckSquare,
  MessageSquare,
  User,
  Clock,
  Loader2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';
import { useRecordDrawer } from './RecordDrawerContext';
import { InlineField } from './InlineField';
import { RecordMiniTimeline } from './RecordMiniTimeline';
import { useRecordDrawerData } from '@/hooks/useRecordDrawerData';
import { queryKeys } from '@/lib/query-keys';
import type { CrmField, CrmRecord } from '@/lib/crm/types';
import { mergeCrmRecordRowIntoFormDefaults } from '@/lib/crm/record-form-defaults';
import { patchCrmRecord } from '@/lib/crm/patch-record-client';
import {
  isPersonCoverageSectionKey,
  isPersonModuleKey,
  isRecordFormExcludedField,
} from '@/components/crm/records/section-utils';

// Readable labels for section keys
const SECTION_LABELS: Record<string, string> = {
  core: 'Contact Information',
  management: 'Contact Management',
  address: 'Address',
  family_spouse: 'Spouse Information',
  family_children: 'Children',
  family: 'Family',
  insurance: 'HealthShare',
  health_sharing: 'Health Share',
  health_insurance: 'Health Insurance',
  dental_coverage: 'Dental Coverage',
  vision_coverage: 'Vision Coverage',
  other_coverage: 'Other Coverage',
  life_coverage: 'Life Insurance',
  product: 'Product Interest',
  commissions: 'Commissions & Referrals',
  payment: 'Payment Information',
  identifiers: 'Codes & Identifiers',
  portal: 'Portal Access',
  compliance: 'Compliance',
  fulfillment: 'Welcome & Fulfillment',
  business: 'Business Information',
  preferences: 'Communication Preferences',
  conversion: 'Conversion',
  system: 'System Information',
};

// Section display order
const SECTION_ORDER = [
  'core', 'management', 'address', 'health_sharing', 'health_insurance', 'insurance', 'business',
  'family_spouse', 'family', 'family_children', 'product',
  'dental_coverage', 'vision_coverage', 'other_coverage', 'life_coverage',
  'commissions', 'payment', 'identifiers', 'portal',
  'compliance', 'fulfillment', 'preferences', 'conversion', 'system',
];

function getSectionLabel(key: string): string {
  return SECTION_LABELS[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

interface FieldSection {
  key: string;
  label: string;
  fields: CrmField[];
}

export function RecordDrawer() {
  const { isOpen, recordId, closeDrawer } = useRecordDrawer();
  const queryClient = useQueryClient();

  // Use TanStack Query for cached data fetching
  const { data, isLoading } = useRecordDrawerData(isOpen ? recordId : null);

  // Local state for optimistic updates
  const [localRecordData, setLocalRecordData] = useState<Record<string, unknown> | null>(null);
  // Track which sections are collapsed
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLocalRecordData(null);
  }, [recordId]);
  // Toggle to show all fields including empty sections. Defaults to true so
  // empty sections (e.g. Address) stay visible and editable instead of
  // disappearing — keeping the quick drawer consistent with the always-visible
  // record detail view. Reps can still collapse empties via "Hide empty fields".
  const [showAllFields, setShowAllFields] = useState(true);

  const handleFieldUpdate = async (fieldKey: string, value: unknown) => {
    if (!data?.record) return;

    const currentData = localRecordData || data.record.data || {};
    const updatedData = { ...currentData, [fieldKey]: value };

    // Optimistic update
    setLocalRecordData(updatedData);

    try {
      await patchCrmRecord(data.record.id, { data: updatedData });

      // Invalidate caches to refetch fresh data (including module lists)
      queryClient.invalidateQueries({ queryKey: queryKeys.records.detail(data.record.id) });
      queryClient.invalidateQueries({ queryKey: ['edit-record', data.record.id] });
      queryClient.invalidateQueries({ queryKey: queryKeys.records.drawer(data.record.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.records.lists() });
    } catch (error) {
      // Rollback on error
      setLocalRecordData(null);
      console.error('Error updating field:', error);
      throw error;
    }
  };

  // Merge full row + JSONB so lane/carrier fields from crm_records columns display correctly
  const effectiveRecordData = useMemo(() => {
    if (!data?.record) return null;
    const dataOnly = localRecordData ?? (data.record.data as Record<string, unknown>) ?? {};
    const recordRow = data.record as CrmRecord & { module?: { key: string } | null };
    return mergeCrmRecordRowIntoFormDefaults({
      ...(recordRow as unknown as Record<string, unknown>),
      data: dataOnly,
    }, { moduleKey: recordRow.module?.key });
  }, [data?.record, localRecordData]);

  // Build display name — prefer `preferred_name` (nickname) over legal first_name
  // so the drawer header surfaces what the contact actually goes by. Legal
  // first_name is kept on the record for enrollment / carrier compliance.
  const getDisplayName = () => {
    if (!data?.record) return 'Loading...';
    const preferredName = (effectiveRecordData?.preferred_name as string) || '';
    const firstName = (effectiveRecordData?.first_name as string) || '';
    const lastName = (effectiveRecordData?.last_name as string) || '';
    const displayFirst = preferredName || firstName;
    return [displayFirst, lastName].filter(Boolean).join(' ') || data.record.title || 'Untitled';
  };

  const toggleSection = (sectionKey: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionKey)) {
        next.delete(sectionKey);
      } else {
        next.add(sectionKey);
      }
      return next;
    });
  };

  // Smart field selection: group by section, only show sections with data
  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- deps are correct; data?.fields is the intended granularity
  const fieldSections = useMemo<FieldSection[]>(() => {
    if (!data?.fields || !effectiveRecordData) return [];

    // Exclude fields already shown in header and internal audit/system fields.
    // Keep business-relevant system fields (contact_status, date_of_birth, etc.)
    const DRAWER_EXCLUDED_KEYS = new Set([
      'first_name', 'last_name', 'contact_name',
      'created_by_name', 'modified_by_name',
      'zoho_created_time', 'zoho_modified_time',
      'change_log_time', 'last_enriched_time', 'enrich_status',
      'connected_to_module', 'connected_to_id',
      'locked', 'admin123',
    ]);
    const candidates = data.fields.filter(
      (f) => !DRAWER_EXCLUDED_KEYS.has(f.key) && !isRecordFormExcludedField(f.key),
    );

    // Group fields by section
    const grouped = new Map<string, CrmField[]>();
    for (const field of candidates) {
      const section = field.section || 'other';
      if (!grouped.has(section)) grouped.set(section, []);
      grouped.get(section)!.push(field);
    }

    // Build section list, only including sections with at least one populated field
    const sections: FieldSection[] = [];
    const orderedKeys = [
      ...SECTION_ORDER,
      ...Array.from(grouped.keys()).filter(k => !SECTION_ORDER.includes(k)),
    ];

    const recordRow = data.record as CrmRecord & { module?: { key: string } | null };
    const moduleKey = recordRow.module?.key;
    const alwaysShowCoverage = isPersonModuleKey(moduleKey);

    for (const sectionKey of orderedKeys) {
      const fields = grouped.get(sectionKey);
      if (!fields) continue;

      // Prioritize populated fields, then show remaining empty fields
      const withData = fields.filter(f => effectiveRecordData[f.key] != null);
      const withoutData = fields.filter(f => effectiveRecordData[f.key] == null);
      const sortedFields = [...withData, ...withoutData];

      const isCoverageSection = isPersonCoverageSectionKey(sectionKey);
      // Person modules: always show coverage sections so reps can add insurance
      // after lead conversion, even when "Hide empty fields" is on.
      if (withData.length > 0 || showAllFields || (alwaysShowCoverage && isCoverageSection)) {
        sections.push({
          key: sectionKey,
          label: getSectionLabel(sectionKey),
          fields: sortedFields,
        });
      }
    }

    return sections;
  }, [data?.fields, data?.record, effectiveRecordData, showAllFields]);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && closeDrawer()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg p-0 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-white/10"
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
          </div>
        ) : data ? (
          <div className="flex flex-col h-full">
            {/* Header */}
            <SheetHeader className="p-4 border-b border-slate-200 dark:border-white/10">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <SheetTitle className="text-lg font-semibold text-slate-900 dark:text-white truncate">
                    {getDisplayName()}
                  </SheetTitle>
                  <div className="flex items-center gap-2 mt-1">
                    {data.record.status && (
                      <Badge variant="outline" className="text-xs">
                        {data.record.status}
                      </Badge>
                    )}
                    {data.record.owner_id && (
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <User className="w-3 h-3" />
                        Assigned
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-xs text-slate-500" suppressHydrationWarning>
                      <Clock className="w-3 h-3" />
                      {new Date(data.record.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    asChild
                    className="h-8 w-8 text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  >
                    <Link href={`/crm/r/${data.record.id}`}>
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={closeDrawer}
                    className="h-8 w-8 text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </SheetHeader>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 p-4 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-9 text-xs border-slate-200 dark:border-white/10"
              >
                <CheckSquare className="w-3.5 h-3.5 mr-1.5" />
                Add Task
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-9 text-xs border-slate-200 dark:border-white/10"
              >
                <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
                Add Note
              </Button>
              {data.record.phone && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 text-xs border-slate-200 dark:border-white/10"
                  asChild
                >
                  <a href={`tel:${data.record.phone}`}>
                    <Phone className="w-3.5 h-3.5" />
                  </a>
                </Button>
              )}
              {data.record.email && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 text-xs border-slate-200 dark:border-white/10"
                  asChild
                >
                  <a href={`mailto:${data.record.email}`}>
                    <Mail className="w-3.5 h-3.5" />
                  </a>
                </Button>
              )}
            </div>

            {/* Sectioned Fields */}
            <div className="flex-1 overflow-y-auto">
              {fieldSections.length > 0 ? (
                <div className="divide-y divide-slate-200 dark:divide-white/10">
                  {fieldSections.map((section) => {
                    const isCollapsed = collapsedSections.has(section.key);
                    const populatedCount = section.fields.filter(
                      f => effectiveRecordData?.[f.key] != null
                    ).length;

                    return (
                      <div key={section.key}>
                        {/* Section Header */}
                        <button
                          type="button"
                          onClick={() => toggleSection(section.key)}
                          className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-left bg-slate-50/80 dark:bg-slate-800/30 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {isCollapsed ? (
                              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            )}
                            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider truncate">
                              {section.label}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 tabular-nums shrink-0">
                            {populatedCount}/{section.fields.length}
                          </span>
                        </button>

                        {/* Section Fields */}
                        {!isCollapsed && (
                          <div className="px-4 py-3 space-y-2.5">
                            {section.fields.map((field) => (
                              <InlineField
                                key={field.id}
                                field={field}
                                value={effectiveRecordData?.[field.key]}
                                onSave={(value) => handleFieldUpdate(field.key, value)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 text-center text-sm text-slate-400">
                  No field data available
                </div>
              )}

              {/* Show all fields toggle */}
              <div className="px-4 py-2 border-t border-slate-200 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setShowAllFields(prev => !prev)}
                  className="text-xs text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium transition-colors"
                >
                  {showAllFields ? 'Hide empty fields' : 'Show all fields'}
                </button>
              </div>

              {/* Mini Timeline */}
              <div className="p-4 border-t border-slate-200 dark:border-white/10">
                <h3 className="text-sm font-medium text-slate-900 dark:text-white mb-3">
                  Recent Activity
                </h3>
                <RecordMiniTimeline events={data.timeline} />
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50">
              <Button
                className="w-full"
                asChild
              >
                <Link href={`/crm/r/${data.record.id}`}>
                  View Full Record
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-500">
            No record selected
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
