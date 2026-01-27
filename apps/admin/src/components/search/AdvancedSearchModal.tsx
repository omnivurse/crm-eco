'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@crm-eco/lib/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Label,
  Badge,
} from '@crm-eco/ui';
import {
  Search,
  Plus,
  X,
  Save,
  Trash2,
  Calendar,
  Filter,
} from 'lucide-react';
import { toast } from 'sonner';

type EntityType = 'member' | 'agent';
type OperatorType = 'equals' | 'not_equals' | 'contains' | 'starts_with' | 'ends_with' | 'greater_than' | 'less_than' | 'between' | 'is_empty' | 'is_not_empty';

interface SearchFilter {
  id: string;
  field: string;
  operator: OperatorType;
  value: string;
  value2?: string; // For 'between' operator
}

interface SavedSearch {
  id: string;
  name: string;
  filters: SearchFilter[];
}

interface AdvancedSearchModalProps {
  entityType: EntityType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSearch: (filters: SearchFilter[]) => void;
  currentFilters?: SearchFilter[];
}

// Field definitions for each entity type
const fieldDefinitions: Record<EntityType, { field: string; label: string; type: 'text' | 'number' | 'date' | 'select'; options?: string[] }[]> = {
  member: [
    { field: 'first_name', label: 'First Name', type: 'text' },
    { field: 'last_name', label: 'Last Name', type: 'text' },
    { field: 'email', label: 'Email', type: 'text' },
    { field: 'phone', label: 'Phone', type: 'text' },
    { field: 'status', label: 'Status', type: 'select', options: ['active', 'inactive', 'pending', 'terminated'] },
    { field: 'state', label: 'State', type: 'text' },
    { field: 'city', label: 'City', type: 'text' },
    { field: 'zip_code', label: 'Zip Code', type: 'text' },
    { field: 'plan_name', label: 'Plan', type: 'text' },
    { field: 'effective_date', label: 'Effective Date', type: 'date' },
    { field: 'termination_date', label: 'Termination Date', type: 'date' },
    { field: 'created_at', label: 'Created Date', type: 'date' },
    { field: 'member_id', label: 'Member ID', type: 'text' },
  ],
  agent: [
    { field: 'first_name', label: 'First Name', type: 'text' },
    { field: 'last_name', label: 'Last Name', type: 'text' },
    { field: 'email', label: 'Email', type: 'text' },
    { field: 'phone', label: 'Phone', type: 'text' },
    { field: 'status', label: 'Status', type: 'select', options: ['active', 'inactive', 'pending', 'terminated'] },
    { field: 'license_number', label: 'License Number', type: 'text' },
    { field: 'license_states', label: 'License States', type: 'text' },
    { field: 'npn', label: 'NPN', type: 'text' },
    { field: 'commission_tier', label: 'Commission Tier', type: 'text' },
    { field: 'agency_name', label: 'Agency Name', type: 'text' },
    { field: 'state', label: 'State', type: 'text' },
    { field: 'created_at', label: 'Created Date', type: 'date' },
  ],
};

const operatorLabels: Record<OperatorType, string> = {
  equals: 'Equals',
  not_equals: 'Does not equal',
  contains: 'Contains',
  starts_with: 'Starts with',
  ends_with: 'Ends with',
  greater_than: 'Greater than',
  less_than: 'Less than',
  between: 'Between',
  is_empty: 'Is empty',
  is_not_empty: 'Is not empty',
};

const operatorsByType: Record<string, OperatorType[]> = {
  text: ['equals', 'not_equals', 'contains', 'starts_with', 'ends_with', 'is_empty', 'is_not_empty'],
  number: ['equals', 'not_equals', 'greater_than', 'less_than', 'between', 'is_empty', 'is_not_empty'],
  date: ['equals', 'not_equals', 'greater_than', 'less_than', 'between', 'is_empty', 'is_not_empty'],
  select: ['equals', 'not_equals', 'is_empty', 'is_not_empty'],
};

export function AdvancedSearchModal({
  entityType,
  open,
  onOpenChange,
  onSearch,
  currentFilters = [],
}: AdvancedSearchModalProps) {
  const [filters, setFilters] = useState<SearchFilter[]>(currentFilters);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [saveSearchName, setSaveSearchName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);

  const fields = fieldDefinitions[entityType];
  const supabase = createClient();

  // Load saved searches from localStorage
  useEffect(() => {
    const key = `saved_searches_${entityType}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        setSavedSearches(JSON.parse(saved));
      } catch (e) {
        console.error('Error loading saved searches:', e);
      }
    }
  }, [entityType]);

  // Initialize with current filters or one empty filter
  useEffect(() => {
    if (currentFilters.length > 0) {
      setFilters(currentFilters);
    } else if (filters.length === 0) {
      addFilter();
    }
  }, [currentFilters]);

  const addFilter = () => {
    const newFilter: SearchFilter = {
      id: crypto.randomUUID(),
      field: fields[0].field,
      operator: 'contains',
      value: '',
    };
    setFilters([...filters, newFilter]);
  };

  const removeFilter = (id: string) => {
    setFilters(filters.filter(f => f.id !== id));
  };

  const updateFilter = (id: string, updates: Partial<SearchFilter>) => {
    setFilters(filters.map(f => {
      if (f.id !== id) return f;
      const updated = { ...f, ...updates };
      // Reset value when field changes
      if (updates.field) {
        updated.value = '';
        updated.value2 = undefined;
        // Set default operator for new field type
        const fieldDef = fields.find(field => field.field === updates.field);
        if (fieldDef) {
          const allowedOps = operatorsByType[fieldDef.type];
          if (!allowedOps.includes(updated.operator)) {
            updated.operator = allowedOps[0];
          }
        }
      }
      return updated;
    }));
  };

  const handleSearch = () => {
    // Remove empty filters
    const validFilters = filters.filter(f =>
      f.operator === 'is_empty' ||
      f.operator === 'is_not_empty' ||
      f.value.trim()
    );
    onSearch(validFilters);
    onOpenChange(false);
  };

  const handleClear = () => {
    setFilters([{
      id: crypto.randomUUID(),
      field: fields[0].field,
      operator: 'contains',
      value: '',
    }]);
  };

  const handleSaveSearch = () => {
    if (!saveSearchName.trim()) {
      toast.error('Please enter a name for this search');
      return;
    }

    const newSearch: SavedSearch = {
      id: crypto.randomUUID(),
      name: saveSearchName.trim(),
      filters: filters.filter(f =>
        f.operator === 'is_empty' ||
        f.operator === 'is_not_empty' ||
        f.value.trim()
      ),
    };

    const updated = [...savedSearches, newSearch];
    setSavedSearches(updated);
    localStorage.setItem(`saved_searches_${entityType}`, JSON.stringify(updated));

    setSaveSearchName('');
    setShowSaveInput(false);
    toast.success('Search saved');
  };

  const loadSavedSearch = (search: SavedSearch) => {
    setFilters(search.filters.map(f => ({ ...f, id: crypto.randomUUID() })));
  };

  const deleteSavedSearch = (id: string) => {
    const updated = savedSearches.filter(s => s.id !== id);
    setSavedSearches(updated);
    localStorage.setItem(`saved_searches_${entityType}`, JSON.stringify(updated));
    toast.success('Search deleted');
  };

  const getFieldType = (fieldName: string): string => {
    return fields.find(f => f.field === fieldName)?.type || 'text';
  };

  const getFieldOptions = (fieldName: string): string[] | undefined => {
    return fields.find(f => f.field === fieldName)?.options;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Advanced Search - {entityType === 'member' ? 'Members' : 'Agents'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Saved Searches */}
          {savedSearches.length > 0 && (
            <div className="pb-4 border-b">
              <Label className="text-xs text-slate-500 mb-2 block">Saved Searches</Label>
              <div className="flex flex-wrap gap-2">
                {savedSearches.map(search => (
                  <div key={search.id} className="flex items-center gap-1">
                    <Badge
                      className="cursor-pointer hover:bg-slate-200"
                      variant="secondary"
                      onClick={() => loadSavedSearch(search)}
                    >
                      {search.name}
                    </Badge>
                    <button
                      onClick={() => deleteSavedSearch(search.id)}
                      className="text-slate-400 hover:text-red-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="space-y-3">
            {filters.map((filter, index) => {
              const fieldType = getFieldType(filter.field);
              const fieldOptions = getFieldOptions(filter.field);
              const allowedOperators = operatorsByType[fieldType];
              const needsValue = !['is_empty', 'is_not_empty'].includes(filter.operator);
              const needsSecondValue = filter.operator === 'between';

              return (
                <div key={filter.id} className="flex items-start gap-2">
                  {index > 0 && (
                    <span className="text-xs text-slate-400 pt-2.5 w-8">AND</span>
                  )}
                  {index === 0 && <div className="w-8" />}

                  {/* Field Select */}
                  <Select
                    value={filter.field}
                    onValueChange={(value) => updateFilter(filter.id, { field: value })}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {fields.map(field => (
                        <SelectItem key={field.field} value={field.field}>
                          {field.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Operator Select */}
                  <Select
                    value={filter.operator}
                    onValueChange={(value) => updateFilter(filter.id, { operator: value as OperatorType })}
                  >
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {allowedOperators.map(op => (
                        <SelectItem key={op} value={op}>
                          {operatorLabels[op]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Value Input */}
                  {needsValue && (
                    <>
                      {fieldOptions ? (
                        <Select
                          value={filter.value}
                          onValueChange={(value) => updateFilter(filter.id, { value })}
                        >
                          <SelectTrigger className="w-36">
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                          <SelectContent>
                            {fieldOptions.map(opt => (
                              <SelectItem key={opt} value={opt}>
                                {opt.charAt(0).toUpperCase() + opt.slice(1)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : fieldType === 'date' ? (
                        <Input
                          type="date"
                          value={filter.value}
                          onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                          className="w-36"
                        />
                      ) : (
                        <Input
                          type={fieldType === 'number' ? 'number' : 'text'}
                          value={filter.value}
                          onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                          placeholder="Value"
                          className="w-36"
                        />
                      )}

                      {needsSecondValue && (
                        <>
                          <span className="text-slate-400 pt-2">to</span>
                          <Input
                            type={fieldType === 'date' ? 'date' : fieldType === 'number' ? 'number' : 'text'}
                            value={filter.value2 || ''}
                            onChange={(e) => updateFilter(filter.id, { value2: e.target.value })}
                            placeholder="Value"
                            className="w-36"
                          />
                        </>
                      )}
                    </>
                  )}

                  {/* Remove Button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeFilter(filter.id)}
                    disabled={filters.length === 1}
                    className="shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              );
            })}
          </div>

          {/* Add Filter Button */}
          <Button variant="outline" size="sm" onClick={addFilter}>
            <Plus className="w-4 h-4 mr-1" />
            Add Filter
          </Button>

          {/* Save Search */}
          {showSaveInput ? (
            <div className="flex items-center gap-2 pt-2">
              <Input
                value={saveSearchName}
                onChange={(e) => setSaveSearchName(e.target.value)}
                placeholder="Search name..."
                className="flex-1"
                onKeyDown={(e) => e.key === 'Enter' && handleSaveSearch()}
              />
              <Button size="sm" onClick={handleSaveSearch}>
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowSaveInput(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSaveInput(true)}
              className="text-slate-500"
            >
              <Save className="w-4 h-4 mr-1" />
              Save this search
            </Button>
          )}
        </div>

        <DialogFooter className="flex justify-between">
          <Button variant="ghost" onClick={handleClear}>
            Clear All
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSearch}>
              <Search className="w-4 h-4 mr-2" />
              Search
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
