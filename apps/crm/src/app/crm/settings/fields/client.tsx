'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@crm-eco/ui/components/button';
import { Card, CardContent } from '@crm-eco/ui/components/card';
import { Badge } from '@crm-eco/ui/components/badge';
import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
import { Switch } from '@crm-eco/ui/components/switch';
import { Textarea } from '@crm-eco/ui/components/textarea';
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
  DialogTrigger,
} from '@crm-eco/ui/components/dialog';
import type { CrmModule, CrmField, CrmProfile, FieldType } from '@/lib/crm/types';
import {
  ArrowLeft,
  Plus,
  GripVertical,
  Pencil,
  Trash2,
  Type,
  Hash,
  Calendar,
  ToggleLeft,
  List,
  Mail,
  Phone,
  Link as LinkIcon,
  User,
} from 'lucide-react';

const fieldTypeIcons: Record<FieldType, React.ElementType> = {
  text: Type,
  textarea: Type,
  number: Hash,
  currency: Hash,
  date: Calendar,
  datetime: Calendar,
  boolean: ToggleLeft,
  select: List,
  multiselect: List,
  email: Mail,
  phone: Phone,
  url: LinkIcon,
  lookup: User,
  user: User,
};

const fieldTypeLabels: Record<FieldType, string> = {
  text: 'Text',
  textarea: 'Long Text',
  number: 'Number',
  currency: 'Currency',
  date: 'Date',
  datetime: 'Date & Time',
  boolean: 'Yes/No',
  select: 'Dropdown',
  multiselect: 'Multi-Select',
  email: 'Email',
  phone: 'Phone',
  url: 'URL',
  lookup: 'Lookup',
  user: 'User',
};

interface FieldsSettingsClientProps {
  modules: CrmModule[];
  selectedModule: CrmModule | null;
  fields: CrmField[];
  profile: CrmProfile;
}

export function FieldsSettingsClient({
  modules,
  selectedModule,
  fields: initialFields,
  profile,
}: FieldsSettingsClientProps) {
  const [fields, setFields] = useState(initialFields);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newField, setNewField] = useState({
    label: '',
    key: '',
    type: 'text' as FieldType,
    required: false,
    options: '',
    section: 'main',
  });
  const [isCreating, setIsCreating] = useState(false);
  const router = useRouter();

  const handleModuleChange = (moduleId: string) => {
    router.push(`/settings/fields?module=${moduleId}`);
  };

  const handleCreateField = async () => {
    if (!newField.label.trim() || !newField.key.trim() || !selectedModule) return;

    setIsCreating(true);
    try {
      const options = newField.options
        .split('\n')
        .map((o) => o.trim())
        .filter(Boolean);

      const response = await fetch('/api/crm/fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: profile.organization_id,
          module_id: selectedModule.id,
          label: newField.label,
          key: newField.key.toLowerCase().replace(/[^a-z0-9]/g, '_'),
          type: newField.type,
          required: newField.required,
          options: ['select', 'multiselect'].includes(newField.type) ? options : [],
          section: newField.section,
        }),
      });

      if (response.ok) {
        const field = await response.json();
        setFields((prev) => [...prev, field]);
        setShowCreateDialog(false);
        setNewField({
          label: '',
          key: '',
          type: 'text',
          required: false,
          options: '',
          section: 'main',
        });
      }
    } catch (error) {
      console.error('Failed to create field:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteField = async (fieldId: string) => {
    if (!confirm('Are you sure you want to delete this field? This cannot be undone.')) {
      return;
    }

    try {
      await fetch(`/api/crm/fields/${fieldId}`, { method: 'DELETE' });
      setFields((prev) => prev.filter((f) => f.id !== fieldId));
    } catch (error) {
      console.error('Failed to delete field:', error);
    }
  };

  // Group fields by section
  const fieldsBySection = fields.reduce((acc, field) => {
    const section = field.section || 'main';
    if (!acc[section]) acc[section] = [];
    acc[section].push(field);
    return acc;
  }, {} as Record<string, CrmField[]>);

  const sections = Object.keys(fieldsBySection).sort();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/settings"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Settings
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-brand-navy-800">Fields</h1>
            <p className="text-muted-foreground">
              Configure custom fields for each module
            </p>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button
                className="bg-brand-teal-600 hover:bg-brand-teal-700"
                disabled={!selectedModule}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Field
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Field</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label>Field Label</Label>
                  <Input
                    placeholder="e.g., Annual Revenue"
                    value={newField.label}
                    onChange={(e) => {
                      setNewField((prev) => ({
                        ...prev,
                        label: e.target.value,
                        key: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '_'),
                      }));
                    }}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Field Key</Label>
                  <Input
                    placeholder="e.g., annual_revenue"
                    value={newField.key}
                    onChange={(e) => setNewField((prev) => ({ ...prev, key: e.target.value }))}
                    className="mt-1 font-mono"
                  />
                </div>
                <div>
                  <Label>Field Type</Label>
                  <Select
                    value={newField.type}
                    onValueChange={(value) =>
                      setNewField((prev) => ({ ...prev, type: value as FieldType }))
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(fieldTypeLabels) as FieldType[]).map((type) => (
                        <SelectItem key={type} value={type}>
                          {fieldTypeLabels[type]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {['select', 'multiselect'].includes(newField.type) && (
                  <div>
                    <Label>Options (one per line)</Label>
                    <Textarea
                      placeholder="Option 1&#10;Option 2&#10;Option 3"
                      value={newField.options}
                      onChange={(e) =>
                        setNewField((prev) => ({ ...prev, options: e.target.value }))
                      }
                      rows={4}
                      className="mt-1"
                    />
                  </div>
                )}
                <div>
                  <Label>Section</Label>
                  <Input
                    placeholder="e.g., financial"
                    value={newField.section}
                    onChange={(e) =>
                      setNewField((prev) => ({ ...prev, section: e.target.value }))
                    }
                    className="mt-1"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="required"
                    checked={newField.required}
                    onCheckedChange={(checked) =>
                      setNewField((prev) => ({ ...prev, required: checked }))
                    }
                  />
                  <Label htmlFor="required">Required field</Label>
                </div>
                <Button
                  onClick={handleCreateField}
                  disabled={!newField.label.trim() || !newField.key.trim() || isCreating}
                  className="w-full"
                >
                  Create Field
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Module Selector */}
      <div className="mb-6">
        <Label>Module</Label>
        <Select value={selectedModule?.id || ''} onValueChange={handleModuleChange}>
          <SelectTrigger className="w-64 mt-1">
            <SelectValue placeholder="Select a module" />
          </SelectTrigger>
          <SelectContent>
            {modules.map((module) => (
              <SelectItem key={module.id} value={module.id}>
                {module.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Fields List */}
      {selectedModule ? (
        <div className="space-y-6">
          {sections.map((section) => (
            <div key={section}>
              <h3 className="text-sm font-medium text-muted-foreground mb-3 capitalize">
                {section.replace(/_/g, ' ')} Section
              </h3>
              <div className="space-y-2">
                {fieldsBySection[section]
                  .sort((a, b) => a.display_order - b.display_order)
                  .map((field) => {
                    const Icon = fieldTypeIcons[field.type] || Type;
                    return (
                      <Card key={field.id}>
                        <CardContent className="p-3">
                          <div className="flex items-center gap-3">
                            <div className="cursor-move text-muted-foreground">
                              <GripVertical className="w-4 h-4" />
                            </div>
                            <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                              <Icon className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{field.label}</span>
                                {field.required && (
                                  <Badge variant="destructive" className="text-xs">
                                    Required
                                  </Badge>
                                )}
                                {field.is_system && (
                                  <Badge variant="secondary" className="text-xs">
                                    System
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                <span className="font-mono">{field.key}</span>
                                <span>•</span>
                                <span>{fieldTypeLabels[field.type]}</span>
                              </div>
                            </div>
                            {!field.is_system && (
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive"
                                  onClick={() => handleDeleteField(field.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          Select a module to manage its fields
        </div>
      )}
    </div>
  );
}
