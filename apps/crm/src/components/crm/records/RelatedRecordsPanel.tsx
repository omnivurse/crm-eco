'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Link2,
  Plus,
  X,
  Users,
  UserPlus,
  Building2,
  DollarSign,
  Star,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Search,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Badge } from '@crm-eco/ui/components/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@crm-eco/ui/components/dialog';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import { cn } from '@crm-eco/ui/lib/utils';
import type { CrmLinkedRecord } from '@/lib/crm/types';

/** Minimal row used in “link record” search (also returned by global CRM search API). */
export interface LinkCandidate {
  id: string;
  title: string | null;
  subtitle?: string;
  module_key: string;
}

interface RelatedRecordsPanelProps {
  recordId: string;
  linkedRecords: CrmLinkedRecord[];
  isLoading?: boolean;
  onLinkRecord?: (targetRecordId: string, linkType: string, isPrimary?: boolean) => Promise<void>;
  onUnlink?: (linkId: string) => Promise<void>;
  onSetPrimary?: (linkId: string, isPrimary: boolean) => Promise<void>;
  availableRecords?: LinkCandidate[];
  onSearchRecords?: (query: string) => Promise<LinkCandidate[]>;
  className?: string;
}

const MODULE_ICONS: Record<string, React.ReactNode> = {
  contacts: <Users className="w-4 h-4" />,
  leads: <UserPlus className="w-4 h-4" />,
  deals: <DollarSign className="w-4 h-4" />,
  accounts: <Building2 className="w-4 h-4" />,
  members: <Users className="w-4 h-4" />,
  prospects: <UserPlus className="w-4 h-4" />,
};

const MODULE_COLORS: Record<string, { text: string; bg: string }> = {
  contacts: { text: 'text-teal-400', bg: 'bg-teal-500/10' },
  leads: { text: 'text-violet-400', bg: 'bg-violet-500/10' },
  deals: { text: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  accounts: { text: 'text-amber-400', bg: 'bg-amber-500/10' },
  members: { text: 'text-sky-400', bg: 'bg-sky-500/10' },
  prospects: { text: 'text-blue-400', bg: 'bg-blue-500/10' },
};

const LINK_TYPE_GROUPS: { label: string; items: { value: string; label: string }[] }[] = [
  {
    label: 'Family / household',
    items: [
      {
        value: 'family_parent',
        label: 'Parent / guardian → linked record is your child or dependent',
      },
      {
        value: 'family_child',
        label: 'Dependent / child → linked record is parent or guardian',
      },
      { value: 'family_spouse', label: 'Spouse / partner' },
      { value: 'family_sibling', label: 'Sibling' },
      { value: 'family_household', label: 'Household / family (unspecified)' },
    ],
  },
  {
    label: 'CRM relationships',
    items: [
      { value: 'contact_to_account', label: 'Contact → Account' },
      { value: 'deal_to_contact', label: 'Deal → Contact' },
      { value: 'deal_to_account', label: 'Deal → Account' },
      { value: 'lead_to_account', label: 'Lead → Account' },
      { value: 'related', label: 'Related (general)' },
    ],
  },
];

/** Human-readable phrase for linked card (direction + link_type semantics). */
function describeLinkRelationship(linkType: string, direction: 'outbound' | 'inbound'): string {
  switch (linkType) {
    case 'family_parent':
      return direction === 'outbound' ? 'Parent / guardian of' : 'Their parent/guardian';
    case 'family_child':
      return direction === 'outbound'
        ? 'Dependent → guardian on linked record'
        : 'Their dependent / child';
    case 'family_spouse':
      return 'Spouse / partner';
    case 'family_sibling':
      return 'Sibling';
    case 'family_household':
      return 'Household / family';
    default:
      return linkType.replace(/_/g, ' ');
  }
}

function LinkedRecordCard({
  record,
  onUnlink,
  onSetPrimary,
}: {
  record: CrmLinkedRecord;
  onUnlink?: () => Promise<void>;
  onSetPrimary?: (isPrimary: boolean) => Promise<void>;
}) {
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const icon = MODULE_ICONS[record.record_module_key] || <Link2 className="w-4 h-4" />;
  const colors = MODULE_COLORS[record.record_module_key] || {
    text: 'text-slate-400',
    bg: 'bg-slate-500/10',
  };

  const handleUnlink = async () => {
    if (!onUnlink) return;
    setIsUnlinking(true);
    try {
      await onUnlink();
    } finally {
      setIsUnlinking(false);
    }
  };

  const handleTogglePrimary = async () => {
    if (!onSetPrimary) return;
    setIsUpdating(true);
    try {
      await onSetPrimary(!record.is_primary);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10 transition-colors group">
      {/* Direction indicator */}
      <div className={cn('p-2 rounded-lg', colors.bg, colors.text)}>
        {record.direction === 'outbound' ? (
          <ArrowRight className="w-4 h-4" />
        ) : (
          <ArrowLeft className="w-4 h-4" />
        )}
      </div>

      {/* Record info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Link
            href={`/crm/r/${record.record_id}`}
            className="font-medium text-slate-900 dark:text-white hover:text-teal-600 dark:hover:text-teal-400 transition-colors truncate"
          >
            {record.record_title || 'Untitled'}
          </Link>
          {record.is_primary && (
            <Badge
              variant="outline"
              className="bg-amber-500/10 border-amber-500/30 text-amber-400 text-xs"
            >
              <Star className="w-3 h-3 mr-1" />
              Primary
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
          <span className={cn('flex items-center gap-1', colors.text)}>
            {icon}
            {record.record_module_name}
          </span>
          <span>•</span>
          <span className="text-slate-400">
            {describeLinkRelationship(record.link_type, record.direction)}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {onSetPrimary && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleTogglePrimary}
            disabled={isUpdating}
            className={cn(
              'h-8 text-xs',
              record.is_primary
                ? 'text-amber-400 hover:text-amber-300'
                : 'text-slate-400 hover:text-white'
            )}
          >
            {isUpdating ? (
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            ) : (
              <Star className="w-3 h-3 mr-1" />
            )}
            {record.is_primary ? 'Primary' : 'Set as primary'}
          </Button>
        )}

        {onUnlink && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleUnlink}
            disabled={isUnlinking}
            className="h-8 w-8 text-slate-400 hover:text-red-400 hover:bg-red-500/10"
          >
            {isUnlinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
          </Button>
        )}
      </div>
    </div>
  );
}

function LinkRecordDialog({
  onLink,
  availableRecords,
  onSearch,
}: {
  onLink: (recordId: string, linkType: string, isPrimary?: boolean) => Promise<void>;
  availableRecords?: LinkCandidate[];
  onSearch?: (query: string) => Promise<LinkCandidate[]>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<LinkCandidate | null>(null);
  const [linkType, setLinkType] = useState('family_household');
  const [isPrimary, setIsPrimary] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [searchResults, setSearchResults] = useState<LinkCandidate[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced auto-search as user types
  const runSearch = useCallback(
    async (q: string) => {
      if (!onSearch || !q.trim()) {
        setSearchResults([]);
        return;
      }
      setIsSearching(true);
      try {
        const results = await onSearch(q);
        setSearchResults(results);
      } finally {
        setIsSearching(false);
      }
    },
    [onSearch],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => void runSearch(searchQuery), 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, runSearch]);

  const handleLink = async () => {
    if (!selectedRecord) return;

    setIsLinking(true);
    try {
      await onLink(selectedRecord.id, linkType, isPrimary);
      setIsOpen(false);
      setSelectedRecord(null);
      setSearchQuery('');
      setLinkType('family_household');
      setIsPrimary(false);
    } finally {
      setIsLinking(false);
    }
  };

  const recordsToShow = searchQuery ? searchResults : availableRecords || [];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="w-full glass border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-white/20"
        >
          <Plus className="w-4 h-4 mr-2" />
          Link Record
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-slate-900 dark:text-white">Link a Record</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Search */}
          {onSearch && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Type a name, email, or phone…"
                className="pl-9 bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                autoFocus
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />
              )}
            </div>
          )}

          {/* Results List */}
          <div className="max-h-60 overflow-y-auto space-y-1.5">
            {recordsToShow.length > 0 ? (
              recordsToShow.map((record) => {
                const icon = MODULE_ICONS[record.module_key] || <Link2 className="w-4 h-4" />;
                const colors = MODULE_COLORS[record.module_key] || { text: 'text-slate-400', bg: 'bg-slate-500/10' };
                const isSelected = selectedRecord?.id === record.id;

                return (
                  <button
                    key={record.id}
                    onClick={() => setSelectedRecord(record)}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left',
                      isSelected
                        ? 'border-teal-500 bg-teal-50 dark:bg-teal-500/10 ring-1 ring-teal-500/40'
                        : 'border-slate-200 dark:border-white/10 hover:border-teal-300 dark:hover:border-teal-500/30 bg-white dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    )}
                  >
                    <div className={cn('p-1.5 rounded-lg', colors.bg, colors.text)}>{icon}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {record.title || 'Untitled'}
                      </p>
                      {record.subtitle ? (
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{record.subtitle}</p>
                      ) : null}
                    </div>
                    {isSelected && (
                      <div className="flex-shrink-0 w-5 h-5 rounded-full bg-teal-500 flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })
            ) : (
              <p className="text-center py-6 text-slate-500 dark:text-slate-400 text-sm">
                {searchQuery
                  ? isSearching
                    ? 'Searching…'
                    : 'No records found'
                  : 'Type above to search for records to link'
                }
              </p>
            )}
          </div>

          {selectedRecord && (
            <>
              {/* Link Type */}
              <div>
                <label className="text-sm text-slate-600 dark:text-slate-400 mb-1 block">Link Type</label>
                <Select value={linkType} onValueChange={setLinkType}>
                  <SelectTrigger className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 max-h-[min(60vh,22rem)]">
                    {LINK_TYPE_GROUPS.map((group) => (
                      <SelectGroup key={group.label}>
                        <SelectLabel className="text-[10px] uppercase tracking-wide text-slate-500 px-2 py-1.5">
                          {group.label}
                        </SelectLabel>
                        {group.items.map((type) => (
                          <SelectItem
                            key={type.value}
                            value={type.value}
                            title={type.label}
                            className="text-slate-700 dark:text-slate-300 focus:text-slate-900 dark:focus:text-white focus:bg-slate-100 dark:focus:bg-white/10"
                          >
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Primary Toggle */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPrimary}
                  onChange={(e) => setIsPrimary(e.target.checked)}
                  className="rounded border-slate-300 dark:border-white/20 bg-white dark:bg-slate-800/50 text-teal-500 focus:ring-teal-500/50"
                />
                <span className="text-sm text-slate-600 dark:text-slate-300">Mark as primary relationship</span>
              </label>
            </>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={() => setIsOpen(false)}
              className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleLink}
              disabled={!selectedRecord || isLinking}
              className="bg-teal-500 hover:bg-teal-400 text-white"
            >
              {isLinking ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Linking...
                </>
              ) : (
                <>
                  <Link2 className="w-4 h-4 mr-2" />
                  Link Record
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function RelatedRecordsPanel({
  recordId,
  linkedRecords,
  isLoading,
  onLinkRecord,
  onUnlink,
  onSetPrimary,
  availableRecords,
  onSearchRecords,
  className,
}: RelatedRecordsPanelProps) {
  // Group records by module
  const recordsByModule = linkedRecords.reduce(
    (acc, record) => {
      const key = record.record_module_key;
      if (!acc[key]) acc[key] = [];
      acc[key].push(record);
      return acc;
    },
    {} as Record<string, CrmLinkedRecord[]>
  );

  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 bg-slate-800/30 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Link Button */}
      {onLinkRecord && (
        <LinkRecordDialog
          onLink={onLinkRecord}
          availableRecords={availableRecords}
          onSearch={onSearchRecords}
        />
      )}

      {/* Grouped Records */}
      {Object.entries(recordsByModule).length > 0 ? (
        Object.entries(recordsByModule).map(([moduleKey, records]) => {
          const icon = MODULE_ICONS[moduleKey] || <Link2 className="w-4 h-4" />;
          const colors = MODULE_COLORS[moduleKey] || {
            text: 'text-slate-400',
            bg: 'bg-slate-500/10',
          };
          const moduleName = records[0]?.record_module_name || moduleKey;

          return (
            <div key={moduleKey}>
              <div className="flex items-center gap-2 mb-3">
                <div className={cn('p-1.5 rounded-lg', colors.bg, colors.text)}>{icon}</div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{moduleName}s</h3>
                <span className="text-xs text-slate-500">({records.length})</span>
              </div>

              <div className="space-y-2">
                {records.map((record) => (
                  <LinkedRecordCard
                    key={record.link_id}
                    record={record}
                    onUnlink={onUnlink ? () => onUnlink(record.link_id) : undefined}
                    onSetPrimary={
                      onSetPrimary
                        ? (isPrimary) => onSetPrimary(record.link_id, isPrimary)
                        : undefined
                    }
                  />
                ))}
              </div>
            </div>
          );
        })
      ) : (
        <div className="text-center py-12">
          <Link2 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-1">No linked records yet</h3>
          <p className="text-slate-400 max-w-md mx-auto px-4">
            Connect households and memberships: search for another lead, member, or contact — for
            example parent and child on separate memberships — choose a relationship, then jump
            between records anytime.
          </p>
        </div>
      )}
    </div>
  );
}
