'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@crm-eco/ui/components/dialog';
import { RecordTable } from '@/components/crm/records';
import { DynamicRecordForm } from '@/components/crm/records';
import type { CrmModule, CrmField, CrmView, CrmRecord, CrmProfile, CrmLayout } from '@/lib/crm/types';
import { Plus, Search, Filter, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

interface ModuleListClientProps {
  module: CrmModule;
  fields: CrmField[];
  views: CrmView[];
  activeView: CrmView | null;
  records: CrmRecord[];
  totalRecords: number;
  currentPage: number;
  totalPages: number;
  profile: CrmProfile;
}

export function ModuleListClient({
  module,
  fields,
  views,
  activeView,
  records,
  totalRecords,
  currentPage,
  totalPages,
  profile,
}: ModuleListClientProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const searchParams = useSearchParams();

  const canCreate = ['crm_admin', 'crm_manager', 'crm_agent'].includes(profile.crm_role || '');
  const canDelete = ['crm_admin', 'crm_manager'].includes(profile.crm_role || '');

  const handleSearch = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (searchQuery) {
      params.set('search', searchQuery);
    } else {
      params.delete('search');
    }
    params.set('page', '1');
    router.push(`/crm/modules/${module.key}?${params.toString()}`);
  };

  const handleViewChange = (viewId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (viewId === 'default') {
      params.delete('view');
    } else {
      params.set('view', viewId);
    }
    params.set('page', '1');
    router.push(`/crm/modules/${module.key}?${params.toString()}`);
  };

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', page.toString());
    router.push(`/crm/modules/${module.key}?${params.toString()}`);
  };

  const handleSort = (field: string, direction: 'asc' | 'desc') => {
    // In a full implementation, would update URL or view settings
    startTransition(() => {
      router.refresh();
    });
  };

  const handleBulkDelete = async (ids: string[]) => {
    if (!confirm(`Are you sure you want to delete ${ids.length} record(s)?`)) {
      return;
    }

    try {
      const response = await fetch('/api/crm/records/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete records');
      }

      toast.success(`${ids.length} record(s) deleted successfully`);
      router.refresh();
    } catch (error) {
      console.error('Failed to delete records:', error);
      toast.error('Failed to delete records');
    }
  };

  const handleCreateRecord = async (data: Record<string, unknown>) => {
    setIsCreating(true);
    try {
      const response = await fetch('/api/crm/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: profile.organization_id,
          module_id: module.id,
          data,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create record');
      }

      const record = await response.json();
      toast.success(`${module.name} created successfully`);
      setShowCreateDialog(false);
      router.push(`/crm/r/${record.id}`);
    } catch (error) {
      console.error('Failed to create record:', error);
      toast.error('Failed to create record');
    } finally {
      setIsCreating(false);
    }
  };

  // Create a default layout if none exists
  const defaultLayout: CrmLayout = {
    id: 'default',
    org_id: profile.organization_id,
    module_id: module.id,
    name: 'Default',
    is_default: true,
    config: {
      sections: [
        { key: 'main', label: 'General Information', columns: 2 },
      ],
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy-800">
            {module.name_plural || module.name + 's'}
          </h1>
          <p className="text-muted-foreground">
            {totalRecords.toLocaleString()} record{totalRecords !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => toast.info('Export functionality coming soon')}
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          {canCreate && (
            <Button onClick={() => setShowCreateDialog(true)} className="bg-brand-teal-600 hover:bg-brand-teal-700">
              <Plus className="w-4 h-4 mr-2" />
              New {module.name}
            </Button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-4 flex-wrap">
        {/* Search */}
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={`Search ${module.name_plural?.toLowerCase() || module.name.toLowerCase() + 's'}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-9"
            />
          </div>
          <Button variant="outline" onClick={handleSearch}>
            Search
          </Button>
        </div>

        {/* View Selector */}
        <Select
          value={activeView?.id || 'default'}
          onValueChange={handleViewChange}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select view" />
          </SelectTrigger>
          <SelectContent>
            {views.map((view) => (
              <SelectItem key={view.id} value={view.id}>
                {view.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Filter Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => toast.info('Filter functionality coming soon')}
        >
          <Filter className="w-4 h-4 mr-2" />
          Filters
        </Button>
      </div>

      {/* Records Table */}
      {activeView && (
        <RecordTable
          records={records}
          fields={fields}
          view={activeView}
          moduleKey={module.key}
          onSort={handleSort}
          onBulkDelete={canDelete ? handleBulkDelete : undefined}
          isLoading={isPending}
        />
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {((currentPage - 1) * 25) + 1} to {Math.min(currentPage * 25, totalRecords)} of {totalRecords.toLocaleString()}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1}
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground px-2">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New {module.name}</DialogTitle>
          </DialogHeader>
          <DynamicRecordForm
            fields={fields}
            layout={defaultLayout}
            onSubmit={handleCreateRecord}
            onCancel={() => setShowCreateDialog(false)}
            isLoading={isCreating}
            mode="create"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
