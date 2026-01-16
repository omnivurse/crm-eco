'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import { Button } from '@crm-eco/ui/components/button';
import { Switch } from '@crm-eco/ui/components/switch';
import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
import { Textarea } from '@crm-eco/ui/components/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@crm-eco/ui/components/table';
import { Badge } from '@crm-eco/ui/components/badge';
import {
  FileText,
  Plus,
  ArrowLeft,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  Copy,
  ExternalLink,
  Code,
  Check,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@crm-eco/ui/components/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@crm-eco/ui/components/alert-dialog';
import type { CrmWebform } from '@/lib/automation/types';

interface Module {
  id: string;
  key: string;
  name: string;
}

interface Field {
  id: string;
  key: string;
  label: string;
  type: string;
  is_required: boolean;
}

export default function WebformsPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const [webforms, setWebforms] = useState<CrmWebform[]>([]);
  const [loading, setLoading] = useState(true);
  const [modules, setModules] = useState<Module[]>([]);
  const [fields, setFields] = useState<Record<string, Field[]>>({});
  const [orgId, setOrgId] = useState('');
  const [orgSlug, setOrgSlug] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CrmWebform | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [embedDialogOpen, setEmbedDialogOpen] = useState(false);
  const [selectedWebform, setSelectedWebform] = useState<CrmWebform | null>(null);

  // Form state
  const [form, setForm] = useState({
    module_id: '',
    name: '',
    slug: '',
    description: '',
    success_message: 'Thank you for your submission!',
    redirect_url: '',
    is_enabled: true,
    selectedFields: [] as string[],
  });

  const fetchData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();
      
      if (!profile) return;
      setOrgId(profile.organization_id);

      // Get org slug
      const { data: org } = await supabase
        .from('organizations')
        .select('slug')
        .eq('id', profile.organization_id)
        .single();
      setOrgSlug(org?.slug || '');

      const [modulesRes, webformsRes] = await Promise.all([
        supabase.from('crm_modules').select('id, key, name').eq('org_id', profile.organization_id).eq('is_enabled', true),
        supabase.from('crm_webforms').select('*').eq('org_id', profile.organization_id),
      ]);

      setModules((modulesRes.data || []) as Module[]);
      setWebforms((webformsRes.data || []) as CrmWebform[]);

      // Load fields for each module
      const fieldsByModule: Record<string, Field[]> = {};
      for (const mod of modulesRes.data || []) {
        const { data: moduleFields } = await supabase
          .from('crm_fields')
          .select('id, key, label, type, is_required')
          .eq('module_id', mod.id)
          .order('position');
        fieldsByModule[mod.id] = (moduleFields || []) as Field[];
      }
      setFields(fieldsByModule);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreateDialog = () => {
    setEditing(null);
    setForm({
      module_id: modules[0]?.id || '',
      name: '',
      slug: '',
      description: '',
      success_message: 'Thank you for your submission!',
      redirect_url: '',
      is_enabled: true,
      selectedFields: [],
    });
    setDialogOpen(true);
  };

  const openEditDialog = (webform: CrmWebform) => {
    setEditing(webform);
    const selectedFields = webform.layout.sections?.flatMap(s => s.fields.map(f => f.fieldKey)) || [];
    setForm({
      module_id: webform.module_id,
      name: webform.name,
      slug: webform.slug,
      description: webform.description || '',
      success_message: webform.success_message,
      redirect_url: webform.redirect_url || '',
      is_enabled: webform.is_enabled,
      selectedFields,
    });
    setDialogOpen(true);
  };

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const layout = {
        sections: [{
          key: 'main',
          label: 'Main',
          fields: form.selectedFields.map(fieldKey => ({
            fieldKey,
            required: fields[form.module_id]?.find(f => f.key === fieldKey)?.is_required || false,
          })),
        }],
      };

      const data = {
        org_id: orgId,
        module_id: form.module_id,
        name: form.name,
        slug: form.slug || generateSlug(form.name),
        description: form.description || null,
        success_message: form.success_message,
        redirect_url: form.redirect_url || null,
        is_enabled: form.is_enabled,
        layout,
        hidden_fields: {},
        dedupe_config: { enabled: false, fields: [], strategy: 'create_duplicate' },
      };

      if (editing) {
        await supabase.from('crm_webforms').update(data).eq('id', editing.id);
      } else {
        await supabase.from('crm_webforms').insert(data);
      }

      fetchData();
      setDialogOpen(false);
    } catch (error) {
      console.error('Failed to save webform:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await supabase.from('crm_webforms').delete().eq('id', deleteId);
      setWebforms(webforms.filter(w => w.id !== deleteId));
    } catch (error) {
      console.error('Failed to delete:', error);
    } finally {
      setDeleteId(null);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const getModuleName = (moduleId: string) => modules.find(m => m.id === moduleId)?.name || 'Unknown';
  const getModuleFields = () => fields[form.module_id] || [];

  const getWebformUrl = (webform: CrmWebform) => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    return `${baseUrl}/api/public/webforms/${orgSlug}/${webform.slug}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/crm/settings/automations">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Webforms</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Create public forms for lead capture
              </p>
            </div>
          </div>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="w-4 h-4 mr-2" />
          Create Webform
        </Button>
      </div>

      {/* How it works */}
      <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          How Webforms Work
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
              <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h4 className="font-medium text-slate-900 dark:text-white">1. Create Form</h4>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Design your form with fields from your CRM module
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
              <Code className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h4 className="font-medium text-slate-900 dark:text-white">2. Embed</h4>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Copy the embed code or share the direct URL
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
              <ExternalLink className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h4 className="font-medium text-slate-900 dark:text-white">3. Capture Leads</h4>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Submissions create records and trigger workflows
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Webforms Table */}
      <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : webforms.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
              No webforms yet
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mb-4">
              Create public forms to capture leads from your website
            </p>
            <Button onClick={openCreateDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Create Webform
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Submissions</TableHead>
                <TableHead>Enabled</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {webforms.map((webform) => (
                <TableRow key={webform.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium text-slate-900 dark:text-white">
                        {webform.name}
                      </div>
                      {webform.description && (
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                          {webform.description}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {getModuleName(webform.module_id)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <code className="text-sm bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                        /{webform.slug}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(webform.slug, webform.id)}
                      >
                        {copied === webform.id ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-slate-600 dark:text-slate-400">
                      {webform.submit_count.toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Switch 
                      checked={webform.is_enabled}
                      onCheckedChange={async (checked) => {
                        await supabase.from('crm_webforms').update({ is_enabled: checked }).eq('id', webform.id);
                        setWebforms(webforms.map(w => w.id === webform.id ? { ...w, is_enabled: checked } : w));
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(webform)}>
                          <Pencil className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setSelectedWebform(webform); setEmbedDialogOpen(true); }}>
                          <Code className="w-4 h-4 mr-2" />
                          Get Embed Code
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <a href={getWebformUrl(webform)} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-4 h-4 mr-2" />
                            Preview
                          </a>
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600" onClick={() => setDeleteId(webform.id)}>
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit' : 'Create'} Webform</DialogTitle>
            <DialogDescription>
              Create a public form to capture leads from your website.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Module</Label>
                <Select value={form.module_id} onValueChange={(v) => setForm({ ...form, module_id: v, selectedFields: [] })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select module" />
                  </SelectTrigger>
                  <SelectContent>
                    {modules.map((mod) => (
                      <SelectItem key={mod.id} value={mod.id}>{mod.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Form Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value, slug: form.slug || generateSlug(e.target.value) })}
                  placeholder="e.g., Contact Form"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>URL Slug</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500">/api/public/webforms/{orgSlug}/</span>
                <Input
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  placeholder="contact-form"
                  className="flex-1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Internal description..."
                rows={2}
              />
            </div>

            {/* Field Selection */}
            <div className="space-y-2">
              <Label>Form Fields</Label>
              <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
                {getModuleFields().map((field) => (
                  <label key={field.key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.selectedFields.includes(field.key)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setForm({ ...form, selectedFields: [...form.selectedFields, field.key] });
                        } else {
                          setForm({ ...form, selectedFields: form.selectedFields.filter(f => f !== field.key) });
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-sm">{field.label}</span>
                    {field.is_required && <Badge variant="secondary" className="text-xs">Required</Badge>}
                  </label>
                ))}
                {getModuleFields().length === 0 && (
                  <p className="text-sm text-slate-500">Select a module to see available fields</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Success Message</Label>
              <Textarea
                value={form.success_message}
                onChange={(e) => setForm({ ...form, success_message: e.target.value })}
                placeholder="Thank you for your submission!"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Redirect URL (optional)</Label>
              <Input
                value={form.redirect_url}
                onChange={(e) => setForm({ ...form, redirect_url: e.target.value })}
                placeholder="https://yoursite.com/thank-you"
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={form.is_enabled}
                onCheckedChange={(checked) => setForm({ ...form, is_enabled: checked })}
              />
              <Label>{form.is_enabled ? 'Enabled' : 'Disabled'}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.name || !form.module_id}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {editing ? 'Save Changes' : 'Create Webform'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Embed Code Dialog */}
      <Dialog open={embedDialogOpen} onOpenChange={setEmbedDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Embed Code</DialogTitle>
            <DialogDescription>
              Copy the embed code to add this form to your website.
            </DialogDescription>
          </DialogHeader>
          {selectedWebform && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Direct URL</Label>
                <div className="flex gap-2">
                  <Input value={getWebformUrl(selectedWebform)} readOnly className="font-mono text-sm" />
                  <Button variant="outline" onClick={() => copyToClipboard(getWebformUrl(selectedWebform), 'url')}>
                    {copied === 'url' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Embed Code (iframe)</Label>
                <div className="flex gap-2">
                  <Textarea
                    value={`<iframe src="${getWebformUrl(selectedWebform)}" width="100%" height="500" frameborder="0"></iframe>`}
                    readOnly
                    className="font-mono text-sm"
                    rows={3}
                  />
                  <Button 
                    variant="outline" 
                    onClick={() => copyToClipboard(`<iframe src="${getWebformUrl(selectedWebform)}" width="100%" height="500" frameborder="0"></iframe>`, 'embed')}
                  >
                    {copied === 'embed' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Webform</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this webform? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
