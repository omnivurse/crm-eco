'use client';

import { useState, useEffect, useMemo } from 'react';
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@crm-eco/ui/components/button';
import { Badge } from '@crm-eco/ui/components/badge';
import { Input } from '@crm-eco/ui/components/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';
import { cn } from '@crm-eco/ui/lib/utils';
import {
  Plus,
  Search,
  Play,
  Pause,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  Copy,
  Users,
  Mail,
  Clock,
  TrendingUp,
  Loader2,
  Zap,
  Archive,
} from 'lucide-react';
import { toast } from 'sonner';
import type { EmailSequence, SequenceStatus } from '@/lib/sequences/types';

// ============================================================================
// Types
// ============================================================================

interface SequenceWithStats extends Omit<EmailSequence, 'steps'> {
  steps?: { count: number }[];
  enrollments?: { count: number }[];
}

// ============================================================================
// Components
// ============================================================================

function StatusBadge({ status }: { status: SequenceStatus }) {
  const config = {
    draft: { label: 'Draft', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
    active: { label: 'Active', color: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' },
    paused: { label: 'Paused', color: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' },
    archived: { label: 'Archived', color: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500' },
  };

  const { label, color } = config[status];

  return (
    <Badge variant="secondary" className={cn('font-medium', color)}>
      {label}
    </Badge>
  );
}

function SequenceCard({
  sequence,
  onActivate,
  onPause,
  onDuplicate,
  onDelete,
}: {
  sequence: SequenceWithStats;
  onActivate: (id: string) => void;
  onPause: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const router = useRouter();
  const stepsCount = sequence.steps?.[0]?.count || 0;
  const enrollmentsCount = sequence.enrollments?.[0]?.count || 0;

  return (
    <div className="group bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-5 hover:shadow-lg transition-all">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          <div className="p-3 bg-violet-100 dark:bg-violet-500/20 rounded-xl">
            <Zap className="w-6 h-6 text-violet-600 dark:text-violet-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={`/crm/sequences/${sequence.id}`}
                className="font-semibold text-slate-900 dark:text-white hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
              >
                {sequence.name}
              </Link>
              <StatusBadge status={sequence.status} />
            </div>
            {sequence.description && (
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                {sequence.description}
              </p>
            )}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => router.push(`/crm/sequences/${sequence.id}`)}>
              <Eye className="w-4 h-4 mr-2" />
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push(`/crm/sequences/${sequence.id}?edit=true`)}>
              <Pencil className="w-4 h-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {sequence.status === 'active' ? (
              <DropdownMenuItem onClick={() => onPause(sequence.id)}>
                <Pause className="w-4 h-4 mr-2" />
                Pause Sequence
              </DropdownMenuItem>
            ) : sequence.status !== 'archived' ? (
              <DropdownMenuItem onClick={() => onActivate(sequence.id)}>
                <Play className="w-4 h-4 mr-2" />
                Activate
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onClick={() => onDuplicate(sequence.id)}>
              <Copy className="w-4 h-4 mr-2" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(sequence.id)}
              className="text-red-600 dark:text-red-400"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid grid-cols-4 gap-4 mt-6">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1.5 text-slate-500 dark:text-slate-400 mb-1">
            <Mail className="w-4 h-4" />
          </div>
          <p className="text-lg font-semibold text-slate-900 dark:text-white">
            {stepsCount}
          </p>
          <p className="text-xs text-slate-500">Steps</p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1.5 text-slate-500 dark:text-slate-400 mb-1">
            <Users className="w-4 h-4" />
          </div>
          <p className="text-lg font-semibold text-slate-900 dark:text-white">
            {enrollmentsCount}
          </p>
          <p className="text-xs text-slate-500">Enrolled</p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1.5 text-slate-500 dark:text-slate-400 mb-1">
            <TrendingUp className="w-4 h-4" />
          </div>
          <p className="text-lg font-semibold text-slate-900 dark:text-white">
            {sequence.total_completed}
          </p>
          <p className="text-xs text-slate-500">Completed</p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1.5 text-slate-500 dark:text-slate-400 mb-1">
            <Clock className="w-4 h-4" />
          </div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300" suppressHydrationWarning>
            {new Date(sequence.updated_at).toLocaleDateString()}
          </p>
          <p className="text-xs text-slate-500">Updated</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default function SequencesPage() {
  const router = useRouter();
  const [sequences, setSequences] = useState<SequenceWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Live search with debounce
  const { query: searchQuery, setQuery: setSearchQuery, debouncedQuery } = useDebouncedSearch({ delay: 200 });

  useEffect(() => {
    loadSequences();
  }, []);

  async function loadSequences() {
    try {
      const response = await fetch('/api/sequences');
      const data = await response.json();
      setSequences(data.sequences || []);
    } catch (error) {
      console.error('Error loading sequences:', error);
      toast.error('Failed to load sequences');
    } finally {
      setLoading(false);
    }
  }

  async function handleActivate(id: string) {
    try {
      const response = await fetch(`/api/sequences/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' }),
      });

      if (!response.ok) throw new Error('Failed to activate');

      toast.success('Sequence activated');
      loadSequences();
    } catch (error) {
      toast.error('Failed to activate sequence');
    }
  }

  async function handlePause(id: string) {
    try {
      const response = await fetch(`/api/sequences/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'paused' }),
      });

      if (!response.ok) throw new Error('Failed to pause');

      toast.success('Sequence paused');
      loadSequences();
    } catch (error) {
      toast.error('Failed to pause sequence');
    }
  }

  async function handleDuplicate(id: string) {
    try {
      const sequence = sequences.find(s => s.id === id);
      if (!sequence) return;

      const response = await fetch('/api/sequences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${sequence.name} (Copy)`,
          description: sequence.description,
          trigger_type: sequence.trigger_type,
          trigger_config: sequence.trigger_config,
          exit_conditions: sequence.exit_conditions,
          settings: sequence.settings,
        }),
      });

      if (!response.ok) throw new Error('Failed to duplicate');

      toast.success('Sequence duplicated');
      loadSequences();
    } catch (error) {
      toast.error('Failed to duplicate sequence');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this sequence?')) return;

    try {
      const response = await fetch(`/api/sequences/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete');
      }

      toast.success('Sequence deleted');
      loadSequences();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete sequence');
    }
  }

  // Filter sequences with debounced search
  const filteredSequences = useMemo(() => {
    const searchLower = debouncedQuery.toLowerCase();
    return sequences.filter(s => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (searchLower) {
        return (
          s.name.toLowerCase().includes(searchLower) ||
          s.description?.toLowerCase().includes(searchLower)
        );
      }
      return true;
    });
  }, [sequences, debouncedQuery, statusFilter]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded" />
        <div className="grid gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Email Sequences
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Automate multi-step email campaigns
          </p>
        </div>

        <Button
          onClick={() => router.push('/crm/sequences/new')}
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          New Sequence
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search sequences..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Sequences List */}
      {filteredSequences.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl">
          <Zap className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
            {searchQuery || statusFilter !== 'all'
              ? 'No sequences match your filters'
              : 'No sequences yet'}
          </h3>
          <p className="text-slate-500 dark:text-slate-400 mb-6">
            Create automated email sequences to nurture leads
          </p>
          <Button onClick={() => router.push('/crm/sequences/new')}>
            <Plus className="w-4 h-4 mr-2" />
            Create Your First Sequence
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredSequences.map(sequence => (
            <SequenceCard
              key={sequence.id}
              sequence={sequence}
              onActivate={handleActivate}
              onPause={handlePause}
              onDuplicate={handleDuplicate}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Stats Summary */}
      {sequences.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {sequences.filter(s => s.status === 'active').length}
            </p>
            <p className="text-sm text-slate-500">Active Sequences</p>
          </div>
          <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {sequences.reduce((sum, s) => sum + (s.enrollments?.[0]?.count || 0), 0)}
            </p>
            <p className="text-sm text-slate-500">Total Enrolled</p>
          </div>
          <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {sequences.reduce((sum, s) => sum + s.total_completed, 0)}
            </p>
            <p className="text-sm text-slate-500">Total Completed</p>
          </div>
          <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {sequences.reduce((sum, s) => sum + (s.steps?.[0]?.count || 0), 0)}
            </p>
            <p className="text-sm text-slate-500">Total Steps</p>
          </div>
        </div>
      )}
    </div>
  );
}
