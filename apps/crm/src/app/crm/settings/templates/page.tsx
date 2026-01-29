'use client';

import { useState, useEffect, useMemo } from 'react';
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
import { Badge } from '@crm-eco/ui/components/badge';
import { Textarea } from '@crm-eco/ui/components/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@crm-eco/ui/components/tabs';
import { cn } from '@crm-eco/ui/lib/utils';
import {
  FileText,
  Plus,
  Search,
  Mail,
  MessageSquare,
  Pencil,
  Trash2,
  Copy,
  Eye,
  Loader2,
  Tag,
  Clock,
  TrendingUp,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { EmailEditor } from '@/components/email';

// ============================================================================
// Types
// ============================================================================

interface Template {
  id: string;
  name: string;
  subject: string | null;
  body: string;
  channel: 'email' | 'sms';
  category: string | null;
  is_system: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = [
  { value: 'sales', label: 'Sales', color: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' },
  { value: 'marketing', label: 'Marketing', color: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400' },
  { value: 'support', label: 'Support', color: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' },
  { value: 'follow-up', label: 'Follow-up', color: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' },
  { value: 'onboarding', label: 'Onboarding', color: 'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-400' },
];

// ============================================================================
// Components
// ============================================================================

function CategoryBadge({ category }: { category: string | null }) {
  if (!category) return null;

  const cat = CATEGORIES.find(c => c.value === category);
  return (
    <Badge variant="secondary" className={cn('text-xs', cat?.color)}>
      {cat?.label || category}
    </Badge>
  );
}

function TemplateCard({
  template,
  onEdit,
  onDelete,
  onDuplicate,
  onPreview,
}: {
  template: Template;
  onEdit: (template: Template) => void;
  onDelete: (id: string) => void;
  onDuplicate: (template: Template) => void;
  onPreview: (template: Template) => void;
}) {
  return (
    <div className="group bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className={cn(
            'p-2 rounded-lg flex-shrink-0',
            template.channel === 'email'
              ? 'bg-blue-100 dark:bg-blue-500/20'
              : 'bg-green-100 dark:bg-green-500/20'
          )}>
            {template.channel === 'email' ? (
              <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            ) : (
              <MessageSquare className="w-5 h-5 text-green-600 dark:text-green-400" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-slate-900 dark:text-white truncate">
                {template.name}
              </h3>
              {template.is_system && (
                <Badge variant="secondary" className="text-xs bg-slate-100 dark:bg-slate-800">
                  <Sparkles className="w-3 h-3 mr-1" />
                  System
                </Badge>
              )}
              <CategoryBadge category={template.category} />
            </div>
            {template.subject && (
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 truncate">
                {template.subject}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPreview(template)}
            className="h-8 w-8 p-0"
          >
            <Eye className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDuplicate(template)}
            className="h-8 w-8 p-0"
          >
            <Copy className="w-4 h-4" />
          </Button>
          {!template.is_system && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(template)}
                className="h-8 w-8 p-0"
              >
                <Pencil className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(template.id)}
                className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      <p className="text-sm text-slate-600 dark:text-slate-300 mt-3 line-clamp-2">
        {stripHtml(template.body)}
      </p>

      <div className="flex items-center gap-4 mt-4 text-xs text-slate-500">
        <div className="flex items-center gap-1">
          <TrendingUp className="w-3 h-3" />
          {template.usage_count || 0} uses
        </div>
        <div className="flex items-center gap-1" suppressHydrationWarning>
          <Clock className="w-3 h-3" />
          {new Date(template.updated_at || template.created_at).toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

// ============================================================================
// Main Page
// ============================================================================

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChannel, setSelectedChannel] = useState<string>('all');

  // Live search with debounce
  const { query: searchQuery, setQuery: setSearchQuery, debouncedQuery } = useDebouncedSearch({ delay: 200 });
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formSubject, setFormSubject] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formChannel, setFormChannel] = useState<'email' | 'sms'>('email');
  const [formCategory, setFormCategory] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    try {
      const response = await fetch('/api/settings/templates');
      const data = await response.json();
      setTemplates(data.templates || []);
    } catch (error) {
      console.error('Error loading templates:', error);
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  }

  function openCreateDialog() {
    setEditingTemplate(null);
    setFormName('');
    setFormSubject('');
    setFormBody('');
    setFormChannel('email');
    setFormCategory('');
    setDialogOpen(true);
  }

  function openEditDialog(template: Template) {
    setEditingTemplate(template);
    setFormName(template.name);
    setFormSubject(template.subject || '');
    setFormBody(template.body);
    setFormChannel(template.channel);
    setFormCategory(template.category || '');
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!formName.trim() || !formBody.trim()) {
      toast.error('Name and body are required');
      return;
    }

    if (formChannel === 'email' && !formSubject.trim()) {
      toast.error('Subject is required for email templates');
      return;
    }

    setSaving(true);

    try {
      const url = editingTemplate
        ? `/api/settings/templates/${editingTemplate.id}`
        : '/api/settings/templates';
      const method = editingTemplate ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          subject: formSubject.trim() || null,
          body: formBody,
          channel: formChannel,
          category: formCategory || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save template');
      }

      toast.success(editingTemplate ? 'Template updated' : 'Template created');
      setDialogOpen(false);
      await loadTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save template');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      const response = await fetch(`/api/settings/templates/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete template');
      }

      toast.success('Template deleted');
      await loadTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete template');
    }
  }

  async function handleDuplicate(template: Template) {
    try {
      const response = await fetch('/api/settings/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${template.name} (Copy)`,
          subject: template.subject,
          body: template.body,
          channel: template.channel,
          category: template.category,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to duplicate template');
      }

      toast.success('Template duplicated');
      await loadTemplates();
    } catch (error) {
      console.error('Error duplicating template:', error);
      toast.error('Failed to duplicate template');
    }
  }

  // Filter templates with debounced search
  const filteredTemplates = useMemo(() => {
    const searchLower = debouncedQuery.toLowerCase();
    return templates.filter(t => {
      if (selectedChannel !== 'all' && t.channel !== selectedChannel) return false;
      if (selectedCategory !== 'all' && t.category !== selectedCategory) return false;
      if (searchLower) {
        return (
          t.name.toLowerCase().includes(searchLower) ||
          t.subject?.toLowerCase().includes(searchLower) ||
          t.body.toLowerCase().includes(searchLower)
        );
      }
      return true;
    });
  }, [templates, debouncedQuery, selectedChannel, selectedCategory]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
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
            Email Templates
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Create and manage reusable message templates
          </p>
        </div>

        <Button onClick={openCreateDialog} className="gap-2">
          <Plus className="w-4 h-4" />
          New Template
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={selectedChannel} onValueChange={setSelectedChannel}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Channels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Channels</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="sms">SMS</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map(cat => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Templates Grid */}
      {filteredTemplates.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl">
          <FileText className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
            {searchQuery || selectedChannel !== 'all' || selectedCategory !== 'all'
              ? 'No templates match your filters'
              : 'No templates yet'}
          </h3>
          <p className="text-slate-500 dark:text-slate-400 mb-6">
            Create your first template to get started
          </p>
          <Button onClick={openCreateDialog}>
            <Plus className="w-4 h-4 mr-2" />
            Create Template
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map(template => (
            <TemplateCard
              key={template.id}
              template={template}
              onEdit={openEditDialog}
              onDelete={handleDelete}
              onDuplicate={handleDuplicate}
              onPreview={setPreviewTemplate}
            />
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Edit Template' : 'Create Template'}
            </DialogTitle>
            <DialogDescription>
              {editingTemplate
                ? 'Update your template content and settings'
                : 'Create a reusable template for emails or SMS'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="channel">Channel</Label>
                <Select
                  value={formChannel}
                  onValueChange={(v) => setFormChannel(v as 'email' | 'sms')}
                  disabled={!!editingTemplate}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Template Name</Label>
              <Input
                id="name"
                placeholder="e.g., Welcome Email, Follow-up Message"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            {formChannel === 'email' && (
              <div className="space-y-2">
                <Label htmlFor="subject">Subject Line</Label>
                <Input
                  id="subject"
                  placeholder="e.g., Welcome to {{company.name}}!"
                  value={formSubject}
                  onChange={(e) => setFormSubject(e.target.value)}
                />
                <p className="text-xs text-slate-500">
                  Use {'{{field}}'} for merge fields
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="body">
                {formChannel === 'email' ? 'Email Body' : 'Message'}
              </Label>
              {formChannel === 'email' ? (
                <EmailEditor
                  content={formBody}
                  onChange={setFormBody}
                  placeholder="Start composing your email template..."
                  minHeight={300}
                  showSourceToggle={true}
                />
              ) : (
                <Textarea
                  id="body"
                  placeholder="Hi {{contact.first_name}}, your message here..."
                  value={formBody}
                  onChange={(e) => setFormBody(e.target.value)}
                  rows={6}
                  className="font-mono text-sm"
                />
              )}
              <p className="text-xs text-slate-500">
                Available merge fields: {'{{contact.first_name}}'}, {'{{contact.last_name}}'}, {'{{contact.email}}'}, {'{{company.name}}'}, {'{{owner.name}}'}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {editingTemplate ? 'Save Changes' : 'Create Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewTemplate} onOpenChange={() => setPreviewTemplate(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {previewTemplate?.channel === 'email' ? (
                <Mail className="w-5 h-5 text-blue-600" />
              ) : (
                <MessageSquare className="w-5 h-5 text-green-600" />
              )}
              {previewTemplate?.name}
            </DialogTitle>
            <DialogDescription>
              Template preview with sample data
            </DialogDescription>
          </DialogHeader>

          {previewTemplate && (
            <div className="space-y-4 py-4">
              {previewTemplate.channel === 'email' && previewTemplate.subject && (
                <div>
                  <Label className="text-xs text-slate-500">Subject</Label>
                  <p className="font-medium text-slate-900 dark:text-white">
                    {replaceMergeFields(previewTemplate.subject)}
                  </p>
                </div>
              )}

              <div>
                <Label className="text-xs text-slate-500">Body</Label>
                <div
                  className="mt-2 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg prose prose-sm dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: replaceMergeFields(previewTemplate.body),
                  }}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewTemplate(null)}>
              Close
            </Button>
            <Button onClick={() => {
              if (previewTemplate) {
                handleDuplicate(previewTemplate);
                setPreviewTemplate(null);
              }
            }}>
              <Copy className="w-4 h-4 mr-2" />
              Use Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Help Section */}
      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-6">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-3">
          Merge Fields
        </h3>
        <p className="text-sm text-slate-500 mb-4">
          Use these placeholders in your templates to personalize messages:
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { field: '{{contact.first_name}}', desc: 'First name' },
            { field: '{{contact.last_name}}', desc: 'Last name' },
            { field: '{{contact.email}}', desc: 'Email address' },
            { field: '{{contact.phone}}', desc: 'Phone number' },
            { field: '{{company.name}}', desc: 'Company name' },
            { field: '{{owner.name}}', desc: 'Record owner' },
            { field: '{{owner.email}}', desc: 'Owner email' },
            { field: '{{today}}', desc: 'Current date' },
          ].map(({ field, desc }) => (
            <div key={field} className="flex items-center gap-2 text-sm">
              <code className="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded font-mono text-xs">
                {field}
              </code>
              <span className="text-slate-500">{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function replaceMergeFields(text: string): string {
  const sampleData: Record<string, string> = {
    '{{contact.first_name}}': 'John',
    '{{contact.last_name}}': 'Doe',
    '{{contact.email}}': 'john.doe@example.com',
    '{{contact.phone}}': '(555) 123-4567',
    '{{company.name}}': 'Acme Corp',
    '{{owner.name}}': 'Jane Smith',
    '{{owner.email}}': 'jane@company.com',
    '{{today}}': new Date().toLocaleDateString(),
  };

  let result = text;
  for (const [field, value] of Object.entries(sampleData)) {
    result = result.replace(new RegExp(field.replace(/[{}]/g, '\\$&'), 'g'), value);
  }
  return result;
}
