'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@crm-eco/lib/supabase/client';
import {
  Button,
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Textarea,
  Separator,
} from '@crm-eco/ui';
import { Plus, Pencil, Trash2, Layers, GripVertical, Check, X } from 'lucide-react';
import type { Database } from '@crm-eco/lib/types';

type CustomFieldDefinition = Database['public']['Tables']['custom_field_definitions']['Row'];

interface CustomFieldsManagerProps {
  definitions: CustomFieldDefinition[];
  organizationId: string;
}

const ENTITY_TYPES = [
  { value: 'all', label: 'All Entities' },
  { value: 'lead', label: 'Leads' },
  { value: 'member', label: 'Members' },
  { value: 'advisor', label: 'Advisors' },
  { value: 'ticket', label: 'Tickets' },
  { value: 'need', label: 'Needs' },
];

const DATA_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'boolean', label: 'Yes/No' },
  { value: 'select', label: 'Dropdown' },
  { value: 'multiselect', label: 'Multi-Select' },
];

const dataTypeColors: Record<string, string> = {
  text: 'bg-slate-100 text-slate-700',
  number: 'bg-blue-100 text-blue-700',
  date: 'bg-purple-100 text-purple-700',
  boolean: 'bg-amber-100 text-amber-700',
  select: 'bg-emerald-100 text-emerald-700',
  multiselect: 'bg-cyan-100 text-cyan-700',
};

function toSnakeCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

export function CustomFieldsManager({ definitions, organizationId }: CustomFieldsManagerProps) {
  const router = useRouter();
  const [selectedEntityType, setSelectedEntityType] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<CustomFieldDefinition | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    entityType: 'member',
    fieldLabel: '',
    fieldName: '',
    fieldKey: '',
    description: '',
    fieldType: 'text',
    isRequired: false,
    isFilterable: false,
    isVisible: true,
    options: '',
    orderIndex: 0,
    displayOrder: 0,
  });

  // Filter definitions by entity type
  const filteredDefinitions = selectedEntityType === 'all'
    ? definitions
    : definitions.filter(d => d.entity_type === selectedEntityType);

  const openAddDialog = () => {
    setEditingField(null);
    setFormData({
      entityType: selectedEntityType === 'all' ? 'member' : selectedEntityType,
      fieldLabel: '',
      fieldName: '',
      fieldKey: '',
      description: '',
      fieldType: 'text',
      isRequired: false,
      isFilterable: false,
      isVisible: true,
      options: '',
      orderIndex: definitions.length,
      displayOrder: definitions.length,
    });
    setError(null);
    setDialogOpen(true);
  };

  const openEditDialog = (field: CustomFieldDefinition) => {
    setEditingField(field);
    setFormData({
      entityType: field.entity_type,
      fieldLabel: field.field_label,
      fieldName: field.field_name,
      fieldKey: field.field_key || '',
      description: field.description || '',
      fieldType: field.field_type,
      isRequired: field.is_required ?? false,
      isFilterable: field.is_filterable ?? false,
      isVisible: field.is_visible ?? true,
      options: Array.isArray(field.options) ? (field.options as string[]).join(', ') : '',
      orderIndex: field.order_index ?? 0,
      displayOrder: field.display_order ?? 0,
    });
    setError(null);
    setDialogOpen(true);
  };

  const handleLabelChange = (label: string) => {
    const fieldName = editingField ? formData.fieldName : toSnakeCase(label);
    const fieldKey = editingField ? formData.fieldKey : toSnakeCase(label);
    setFormData({ ...formData, fieldLabel: label, fieldName, fieldKey });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();

      // Parse options for select/multiselect
      const options = formData.fieldType === 'select' || formData.fieldType === 'multiselect'
        ? formData.options.split(',').map(o => o.trim()).filter(Boolean)
        : [];

      const fieldData = {
        organization_id: organizationId,
        entity_type: formData.entityType,
        field_name: formData.fieldName,
        field_label: formData.fieldLabel,
        field_key: formData.fieldKey,
        description: formData.description || null,
        field_type: formData.fieldType,
        is_required: formData.isRequired,
        is_filterable: formData.isFilterable,
        is_visible: formData.isVisible,
        options,
        order_index: formData.orderIndex,
        display_order: formData.displayOrder,
      };

      if (editingField) {
        const { error: updateError } = await (supabase
          .from('custom_field_definitions') as any)
          .update(fieldData)
          .eq('id', editingField.id);
        
        if (updateError) throw updateError;
      } else {
        // Check for duplicate field_name
        const existing = definitions.find(
          d => d.entity_type === formData.entityType && d.field_name === formData.fieldName
        );
        if (existing) {
          throw new Error(`Field name "${formData.fieldName}" already exists for ${formData.entityType}`);
        }

        const { error: insertError } = await (supabase
          .from('custom_field_definitions') as any)
          .insert(fieldData);
        
        if (insertError) throw insertError;
      }

      setDialogOpen(false);
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save custom field';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (field: CustomFieldDefinition) => {
    if (!confirm(`Are you sure you want to delete the "${field.field_label}" field? This action cannot be undone.`)) {
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('custom_field_definitions')
        .delete()
        .eq('id', field.id);
      
      if (error) throw error;
      router.refresh();
    } catch (err) {
      console.error('Error deleting field:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters and Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label className="text-sm text-slate-500">Entity Type:</Label>
            <Select
              value={selectedEntityType}
              onValueChange={setSelectedEntityType}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENTITY_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Badge variant="secondary" className="bg-slate-100">
            {filteredDefinitions.length} field{filteredDefinitions.length !== 1 ? 's' : ''}
          </Badge>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={openAddDialog}>
              <Plus className="w-4 h-4" />
              Add Field
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                {editingField ? 'Edit Custom Field' : 'Add Custom Field'}
              </DialogTitle>
              <DialogDescription>
                {editingField 
                  ? 'Update the custom field configuration' 
                  : 'Create a new custom field for capturing additional data'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              {error && (
                <div className="mb-4 p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
                  {error}
                </div>
              )}

              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="entityType">Entity Type *</Label>
                    <Select
                      value={formData.entityType}
                      onValueChange={(value) => setFormData({ ...formData, entityType: value })}
                      disabled={!!editingField}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ENTITY_TYPES.filter(t => t.value !== 'all').map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fieldType">Data Type *</Label>
                    <Select
                      value={formData.fieldType}
                      onValueChange={(value) => setFormData({ ...formData, fieldType: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DATA_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fieldLabel">Field Label *</Label>
                  <Input
                    id="fieldLabel"
                    value={formData.fieldLabel}
                    onChange={(e) => handleLabelChange(e.target.value)}
                    placeholder="e.g., Preferred Contact Time"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fieldName">Field Name</Label>
                  <Input
                    id="fieldName"
                    value={formData.fieldName}
                    onChange={(e) => setFormData({ ...formData, fieldName: e.target.value })}
                    placeholder="e.g., preferred_contact_time"
                    disabled={!!editingField}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-slate-500">
                    Unique identifier used in the database (auto-generated from label)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Optional help text for this field"
                    rows={2}
                  />
                </div>

                {(formData.fieldType === 'select' || formData.fieldType === 'multiselect') && (
                  <div className="space-y-2">
                    <Label htmlFor="options">Options</Label>
                    <Textarea
                      id="options"
                      value={formData.options}
                      onChange={(e) => setFormData({ ...formData, options: e.target.value })}
                      placeholder="Morning, Afternoon, Evening"
                      rows={2}
                    />
                    <p className="text-xs text-slate-500">
                      Comma-separated list of options
                    </p>
                  </div>
                )}

                <Separator />

                <div className="grid grid-cols-3 gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isRequired}
                      onChange={(e) => setFormData({ ...formData, isRequired: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300"
                    />
                    <span className="text-sm">Required</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isFilterable}
                      onChange={(e) => setFormData({ ...formData, isFilterable: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300"
                    />
                    <span className="text-sm">Filterable</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isVisible}
                      onChange={(e) => setFormData({ ...formData, isVisible: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300"
                    />
                    <span className="text-sm">Visible</span>
                  </label>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="orderIndex">Display Order</Label>
                  <Input
                    id="orderIndex"
                    type="number"
                    min="0"
                    value={formData.orderIndex}
                    onChange={(e) => setFormData({ ...formData, orderIndex: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Saving...' : editingField ? 'Update Field' : 'Add Field'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Fields Table */}
      {filteredDefinitions.length === 0 ? (
        <div className="text-center py-12 text-slate-500 border border-dashed border-slate-300 rounded-lg">
          <Layers className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <p className="font-medium">No custom fields defined</p>
          <p className="text-sm text-slate-400 mt-1">
            Create custom fields to capture additional data for your entities
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Label</TableHead>
              <TableHead>Field Key</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Flags</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredDefinitions.map((field, index) => (
              <TableRow key={field.id}>
                <TableCell className="text-slate-400">
                  {index + 1}
                </TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium">{field.field_label}</p>
                    {field.description && (
                      <p className="text-xs text-slate-400 truncate max-w-[200px]">
                        {field.description}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <code className="text-xs bg-slate-100 px-2 py-1 rounded font-mono">
                    {field.field_name}
                  </code>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">
                    {field.entity_type}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge className={dataTypeColors[field.field_type] || 'bg-slate-100 text-slate-700'}>
                    {field.field_type}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {field.is_required && (
                      <Badge variant="outline" className="text-xs">Required</Badge>
                    )}
                    {field.is_filterable && (
                      <Badge variant="outline" className="text-xs">Filterable</Badge>
                    )}
                    {field.is_visible === false && (
                      <Badge variant="outline" className="text-xs text-slate-400">Hidden</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(field)}
                      className="h-8 w-8 p-0"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(field)}
                      className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

