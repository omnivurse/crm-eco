'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Pencil,
  Search,
  Check,
  X,
  Loader2,
  CheckSquare,
  Square,
  ChevronLeft,
  ChevronRight,
  User,
  Tag,
  ArrowRightLeft,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@crm-eco/ui/components/dialog';
import { toast } from 'sonner';

interface CrmRecord {
  id: string;
  title: string | null;
  email: string | null;
  status: string | null;
  stage: string | null;
  owner_id: string | null;
  created_at: string;
  data: Record<string, unknown>;
}

interface CrmModule {
  id: string;
  key: string;
  name: string;
  name_plural: string | null;
}

interface CrmField {
  id: string;
  key: string;
  label: string;
  type: string;
  options: string[];
}

interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

type UpdateType = 'owner' | 'status' | 'stage' | 'field';

export default function BulkUpdatePage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const moduleKey = params.moduleKey as string;

  // Pre-selected record IDs from URL
  const preselectedIds = searchParams.get('ids')?.split(',').filter(Boolean) || [];

  const [module, setModule] = useState<CrmModule | null>(null);
  const [records, setRecords] = useState<CrmRecord[]>([]);
  const [fields, setFields] = useState<CrmField[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(preselectedIds));
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const pageSize = 50;

  // Update form state
  const [updateType, setUpdateType] = useState<UpdateType>('owner');
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedStage, setSelectedStage] = useState<string>('');
  const [selectedFieldKey, setSelectedFieldKey] = useState<string>('');
  const [fieldValue, setFieldValue] = useState<string>('');

  // Get status and stage options from records
  const statusOptions = Array.from(new Set(records.map(r => r.status).filter(Boolean))) as string[];
  const stageOptions = Array.from(new Set(records.map(r => r.stage).filter(Boolean))) as string[];

  // Get select fields that can be bulk updated
  const selectFields = fields.filter(f => f.type === 'select' && f.options.length > 0);

  // Fetch module, records, fields, and profiles
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch module info
      const moduleRes = await fetch(`/api/crm/modules`);
      if (!moduleRes.ok) throw new Error('Failed to fetch module');
      const moduleData = await moduleRes.json();

      // API returns array directly
      const modules = Array.isArray(moduleData) ? moduleData : moduleData.modules || [];
      if (modules.length === 0) {
        throw new Error('No modules found');
      }
      const foundModule = modules.find((m: CrmModule) => m.key === moduleKey);
      if (!foundModule) {
        throw new Error('Module not found');
      }
      setModule(foundModule);

      // Fetch records
      const recordsRes = await fetch(
        `/api/crm/records?module_key=${moduleKey}&page=${page}&page_size=${pageSize}${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ''}`
      );
      if (!recordsRes.ok) throw new Error('Failed to fetch records');
      const recordsData = await recordsRes.json();

      setRecords(recordsData.records || []);
      setTotalRecords(recordsData.total || 0);
      setTotalPages(Math.ceil((recordsData.total || 0) / pageSize));

      // Fetch fields if we have a module
      if (foundModule) {
        const fieldsRes = await fetch(`/api/crm/modules/${foundModule.id}/fields`);
        if (fieldsRes.ok) {
          const fieldsData = await fieldsRes.json();
          setFields(fieldsData.fields || []);
        }
      }

      // Fetch team members for owner assignment
      const profilesRes = await fetch('/api/team/members?crmOnly=true');
      if (profilesRes.ok) {
        const profilesData = await profilesRes.json();
        // API returns array directly
        setProfiles(Array.isArray(profilesData) ? profilesData : profilesData.members || []);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load data';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [moduleKey, page, searchQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Toggle single record selection
  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  // Select/deselect all visible records
  const toggleSelectAll = () => {
    if (records.every(r => selectedIds.has(r.id))) {
      const newSelected = new Set(selectedIds);
      records.forEach(r => newSelected.delete(r.id));
      setSelectedIds(newSelected);
    } else {
      const newSelected = new Set(selectedIds);
      records.forEach(r => newSelected.add(r.id));
      setSelectedIds(newSelected);
    }
  };

  // Handle bulk update
  const handleUpdate = async () => {
    if (selectedIds.size === 0) return;

    try {
      setUpdating(true);
      setError(null);

      const updates: Record<string, unknown> = {};

      switch (updateType) {
        case 'owner':
          if (!selectedOwnerId) {
            setError('Please select an owner');
            return;
          }
          updates.owner_id = selectedOwnerId;
          break;
        case 'status':
          if (!selectedStatus) {
            setError('Please select a status');
            return;
          }
          updates.status = selectedStatus;
          break;
        case 'stage':
          if (!selectedStage) {
            setError('Please select a stage');
            return;
          }
          updates.stage = selectedStage;
          break;
        case 'field':
          if (!selectedFieldKey || !fieldValue) {
            setError('Please select a field and enter a value');
            return;
          }
          updates.data = { [selectedFieldKey]: fieldValue };
          break;
      }

      const response = await fetch('/api/crm/records/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          record_ids: Array.from(selectedIds),
          updates,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update records');
      }

      const data = await response.json();
      const successMessage = `Successfully updated ${data.updated_count} record${data.updated_count !== 1 ? 's' : ''}`;
      setSuccess(successMessage);
      toast.success(successMessage);
      setShowUpdateDialog(false);

      // Reset form
      setSelectedOwnerId('');
      setSelectedStatus('');
      setSelectedStage('');
      setSelectedFieldKey('');
      setFieldValue('');

      // Refresh the list
      await fetchData();

      // Clear selection after successful update
      setSelectedIds(new Set());
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update records';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setUpdating(false);
    }
  };

  const getRecordTitle = (record: CrmRecord) => {
    return record.title ||
      record.data?.name as string ||
      record.data?.full_name as string ||
      record.email ||
      'Untitled';
  };

  const getOwnerName = (ownerId: string | null) => {
    if (!ownerId) return 'Unassigned';
    const profile = profiles.find(p => p.id === ownerId);
    return profile?.full_name || 'Unknown';
  };

  if (loading && !module) {
    return (
      <div className="max-w-5xl mx-auto space-y-6 animate-pulse">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-slate-200 dark:bg-slate-800 rounded-lg" />
          <div className="space-y-2">
            <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded" />
            <div className="h-4 w-72 bg-slate-200 dark:bg-slate-800 rounded" />
          </div>
        </div>
        <div className="h-96 bg-slate-100 dark:bg-slate-800/50 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/crm/modules/${moduleKey}`}
          className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Pencil className="w-6 h-6 text-teal-500" />
            Bulk Update {module?.name_plural || module?.name || 'Records'}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Select records and apply changes to all of them at once.
          </p>
        </div>
      </div>

      {/* Success message */}
      {success && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl">
          <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <p className="text-sm text-emerald-800 dark:text-emerald-300">{success}</p>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl">
          <X className="w-5 h-5 text-red-600 dark:text-red-400" />
          <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Search and selection info */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Search records..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="pl-9 h-10"
          />
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {selectedIds.size} of {totalRecords} selected
          </span>
          <Button
            onClick={() => setShowUpdateDialog(true)}
            disabled={selectedIds.size === 0 || updating}
            className="gap-2 bg-teal-600 hover:bg-teal-500"
          >
            <Pencil className="w-4 h-4" />
            Update {selectedIds.size} Record{selectedIds.size !== 1 ? 's' : ''}
          </Button>
        </div>
      </div>

      {/* Records table */}
      <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <th className="w-12 px-4 py-3 text-left">
                  <button
                    onClick={toggleSelectAll}
                    className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
                  >
                    {records.length > 0 && records.every(r => selectedIds.has(r.id)) ? (
                      <CheckSquare className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                    ) : (
                      <Square className="w-5 h-5 text-slate-400" />
                    )}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Owner
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Stage
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    <td colSpan={5} className="px-4 py-4">
                      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-500 dark:text-slate-400">
                    No records found
                  </td>
                </tr>
              ) : (
                records.map((record) => (
                  <tr
                    key={record.id}
                    onClick={() => toggleSelect(record.id)}
                    className={`cursor-pointer transition-colors ${
                      selectedIds.has(record.id)
                        ? 'bg-teal-50 dark:bg-teal-500/10'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <td className="px-4 py-3">
                      {selectedIds.has(record.id) ? (
                        <CheckSquare className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                      ) : (
                        <Square className="w-5 h-5 text-slate-400" />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-900 dark:text-white">
                        {getRecordTitle(record)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {getOwnerName(record.owner_id)}
                    </td>
                    <td className="px-4 py-3">
                      {record.status ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                          {record.status}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {record.stage ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300">
                          {record.stage}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-700">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Page {page} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
        <Link
          href={`/crm/modules/${moduleKey}`}
          className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 rounded-lg transition-colors"
        >
          Cancel
        </Link>
        <Button
          onClick={() => setShowUpdateDialog(true)}
          disabled={selectedIds.size === 0 || updating}
          className="gap-2 bg-teal-600 hover:bg-teal-500"
        >
          <Pencil className="w-4 h-4" />
          Update {selectedIds.size} Record{selectedIds.size !== 1 ? 's' : ''}
        </Button>
      </div>

      {/* Update dialog */}
      <Dialog open={showUpdateDialog} onOpenChange={setShowUpdateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk Update {selectedIds.size} Record{selectedIds.size !== 1 ? 's' : ''}</DialogTitle>
            <DialogDescription>
              Choose what to update and the new value. This will apply to all selected records.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Update type selector */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setUpdateType('owner')}
                className={`flex items-center gap-2 p-3 rounded-lg border transition-colors ${
                  updateType === 'owner'
                    ? 'border-teal-500 bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-300'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <User className="w-4 h-4" />
                <span className="text-sm font-medium">Change Owner</span>
              </button>
              <button
                type="button"
                onClick={() => setUpdateType('status')}
                className={`flex items-center gap-2 p-3 rounded-lg border transition-colors ${
                  updateType === 'status'
                    ? 'border-teal-500 bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-300'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Tag className="w-4 h-4" />
                <span className="text-sm font-medium">Change Status</span>
              </button>
              <button
                type="button"
                onClick={() => setUpdateType('stage')}
                className={`flex items-center gap-2 p-3 rounded-lg border transition-colors ${
                  updateType === 'stage'
                    ? 'border-teal-500 bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-300'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <ArrowRightLeft className="w-4 h-4" />
                <span className="text-sm font-medium">Change Stage</span>
              </button>
              {selectFields.length > 0 && (
                <button
                  type="button"
                  onClick={() => setUpdateType('field')}
                  className={`flex items-center gap-2 p-3 rounded-lg border transition-colors ${
                    updateType === 'field'
                      ? 'border-teal-500 bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-300'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <Pencil className="w-4 h-4" />
                  <span className="text-sm font-medium">Update Field</span>
                </button>
              )}
            </div>

            {/* Value selector based on update type */}
            {updateType === 'owner' && (
              <div className="space-y-2">
                <Label>New Owner</Label>
                <Select value={selectedOwnerId} onValueChange={setSelectedOwnerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select owner" />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {updateType === 'status' && (
              <div className="space-y-2">
                <Label>New Status</Label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.length > 0 ? (
                      statusOptions.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))
                    ) : (
                      <>
                        <SelectItem value="New">New</SelectItem>
                        <SelectItem value="Open">Open</SelectItem>
                        <SelectItem value="In Progress">In Progress</SelectItem>
                        <SelectItem value="Closed">Closed</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {updateType === 'stage' && (
              <div className="space-y-2">
                <Label>New Stage</Label>
                <Select value={selectedStage} onValueChange={setSelectedStage}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select stage" />
                  </SelectTrigger>
                  <SelectContent>
                    {stageOptions.length > 0 ? (
                      stageOptions.map((stage) => (
                        <SelectItem key={stage} value={stage}>
                          {stage}
                        </SelectItem>
                      ))
                    ) : (
                      <>
                        <SelectItem value="Qualification">Qualification</SelectItem>
                        <SelectItem value="Proposal">Proposal</SelectItem>
                        <SelectItem value="Negotiation">Negotiation</SelectItem>
                        <SelectItem value="Closed Won">Closed Won</SelectItem>
                        <SelectItem value="Closed Lost">Closed Lost</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {updateType === 'field' && selectFields.length > 0 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Field to Update</Label>
                  <Select value={selectedFieldKey} onValueChange={setSelectedFieldKey}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select field" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectFields.map((field) => (
                        <SelectItem key={field.key} value={field.key}>
                          {field.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedFieldKey && (
                  <div className="space-y-2">
                    <Label>New Value</Label>
                    <Select value={fieldValue} onValueChange={setFieldValue}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select value" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectFields
                          .find(f => f.key === selectedFieldKey)
                          ?.options.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowUpdateDialog(false)}
              disabled={updating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={updating}
              className="bg-teal-600 hover:bg-teal-500"
            >
              {updating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Records'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
