'use client';

import { useState } from 'react';
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import { cn } from '@crm-eco/ui/lib/utils';
import type { CrmLinkedRecord, CrmRecord } from '@/lib/crm/types';

interface RelatedRecordsPanelProps {
  recordId: string;
  linkedRecords: CrmLinkedRecord[];
  isLoading?: boolean;
  onLinkRecord?: (targetRecordId: string, linkType: string, isPrimary?: boolean) => Promise<void>;
  onUnlink?: (linkId: string) => Promise<void>;
  onSetPrimary?: (linkId: string, isPrimary: boolean) => Promise<void>;
  availableRecords?: CrmRecord[]; // For the link dialog
  onSearchRecords?: (query: string) => Promise<CrmRecord[]>;
  className?: string;
}

const MODULE_ICONS: Record<string, React.ReactNode> = {
  contacts: <Users className="w-4 h-4" />,
  leads: <UserPlus className="w-4 h-4" />,
  deals: <DollarSign className="w-4 h-4" />,
  accounts: <Building2 className="w-4 h-4" />,
};

const MODULE_COLORS: Record<string, { text: string; bg: string }> = {
  contacts: { text: 'text-teal-400', bg: 'bg-teal-500/10' },
  leads: { text: 'text-violet-400', bg: 'bg-violet-500/10' },
  deals: { text: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  accounts: { text: 'text-amber-400', bg: 'bg-amber-500/10' },
};

const LINK_TYPES = [
  { value: 'contact_to_account', label: 'Contact → Account' },
  { value: 'deal_to_contact', label: 'Deal → Contact' },
  { value: 'deal_to_account', label: 'Deal → Account' },
  { value: 'lead_to_account', label: 'Lead → Account' },
  { value: 'related', label: 'Related' },
];

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
  const colors = MODULE_COLORS[record.record_module_key] || { text: 'text-slate-400', bg: 'bg-slate-500/10' };

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
    <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-900/30 border border-white/5 hover:border-white/10 transition-colors group">
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
            className="font-medium text-white hover:text-teal-400 transition-colors truncate"
          >
            {record.record_title || 'Untitled'}
          </Link>
          {record.is_primary && (
            <Badge variant="outline" className="bg-amber-500/10 border-amber-500/30 text-amber-400 text-xs">
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
          <span className="capitalize">{record.link_type.replace(/_/g, ' ')}</span>
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
            {isUnlinking ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <X className="w-4 h-4" />
            )}
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
  availableRecords?: CrmRecord[];
  onSearch?: (query: string) => Promise<CrmRecord[]>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<CrmRecord | null>(null);
  const [linkType, setLinkType] = useState('related');
  const [isPrimary, setIsPrimary] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [searchResults, setSearchResults] = useState<CrmRecord[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async () => {
    if (!onSearch || !searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      const results = await onSearch(searchQuery);
      setSearchResults(results);
    } finally {
      setIsSearching(false);
    }
  };

  const handleLink = async () => {
    if (!selectedRecord) return;
    
    setIsLinking(true);
    try {
      await onLink(selectedRecord.id, linkType, isPrimary);
      setIsOpen(false);
      setSelectedRecord(null);
      setSearchQuery('');
      setLinkType('related');
      setIsPrimary(false);
    } finally {
      setIsLinking(false);
    }
  };

  const recordsToShow = searchQuery ? searchResults : (availableRecords || []);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="w-full glass border-white/10 text-slate-300 hover:text-white hover:border-white/20"
        >
          <Plus className="w-4 h-4 mr-2" />
          Link Record
        </Button>
      </DialogTrigger>
      <DialogContent className="glass-card border-white/10 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white">Link a Record</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Search */}
          {onSearch && (
            <div className="flex gap-2">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search for a record..."
                className="flex-1 bg-slate-900/50 border-white/10 text-white placeholder:text-slate-500"
              />
              <Button
                variant="outline"
                onClick={handleSearch}
                disabled={isSearching}
                className="glass border-white/10 text-slate-300 hover:text-white"
              >
                {isSearching ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
              </Button>
            </div>
          )}

          {/* Results List */}
          <div className="max-h-48 overflow-y-auto space-y-2">
            {recordsToShow.length > 0 ? (
              recordsToShow.map((record) => {
                const icon = MODULE_ICONS[record.module_id] || <Link2 className="w-4 h-4" />;
                const isSelected = selectedRecord?.id === record.id;
                
                return (
                  <button
                    key={record.id}
                    onClick={() => setSelectedRecord(record)}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left',
                      isSelected
                        ? 'border-teal-500 bg-teal-500/10'
                        : 'border-white/5 hover:border-white/10 bg-slate-900/30'
                    )}
                  >
                    <div className="p-1.5 rounded bg-slate-800/50 text-slate-400">
                      {icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {record.title || 'Untitled'}
                      </p>
                      {record.email && (
                        <p className="text-xs text-slate-500 truncate">{record.email}</p>
                      )}
                    </div>
                  </button>
                );
              })
            ) : (
              <p className="text-center py-4 text-slate-500 text-sm">
                {searchQuery ? 'No records found' : 'Search for records to link'}
              </p>
            )}
          </div>

          {selectedRecord && (
            <>
              {/* Link Type */}
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Link Type</label>
                <Select value={linkType} onValueChange={setLinkType}>
                  <SelectTrigger className="bg-slate-900/50 border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="glass-card border-white/10">
                    {LINK_TYPES.map((type) => (
                      <SelectItem 
                        key={type.value} 
                        value={type.value}
                        className="text-slate-300 focus:text-white focus:bg-white/10"
                      >
                        {type.label}
                      </SelectItem>
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
                  className="rounded border-white/20 bg-slate-900/50 text-teal-500 focus:ring-teal-500/50"
                />
                <span className="text-sm text-slate-300">Mark as primary relationship</span>
              </label>
            </>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white"
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
  const recordsByModule = linkedRecords.reduce((acc, record) => {
    const key = record.record_module_key;
    if (!acc[key]) acc[key] = [];
    acc[key].push(record);
    return acc;
  }, {} as Record<string, CrmLinkedRecord[]>);

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
          const colors = MODULE_COLORS[moduleKey] || { text: 'text-slate-400', bg: 'bg-slate-500/10' };
          const moduleName = records[0]?.record_module_name || moduleKey;

          return (
            <div key={moduleKey}>
              <div className="flex items-center gap-2 mb-3">
                <div className={cn('p-1.5 rounded-lg', colors.bg, colors.text)}>
                  {icon}
                </div>
                <h3 className="text-sm font-semibold text-white">
                  {moduleName}s
                </h3>
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
          <h3 className="text-lg font-medium text-white mb-1">No linked records</h3>
          <p className="text-slate-400">
            Link this record to contacts, accounts, or deals
          </p>
        </div>
      )}
    </div>
  );
}
