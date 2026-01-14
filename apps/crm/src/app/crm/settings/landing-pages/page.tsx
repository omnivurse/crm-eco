'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
import { Textarea } from '@crm-eco/ui/components/textarea';
import { Switch } from '@crm-eco/ui/components/switch';
import { Badge } from '@crm-eco/ui/components/badge';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@crm-eco/ui/components/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@crm-eco/ui/components/tabs';
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  FileText,
  Globe,
  Eye,
  Copy,
  ExternalLink,
  Check,
  Loader2,
  Palette,
  Layout,
  BarChart3,
  MoreHorizontal,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';

interface LandingPage {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  page_type: 'enrollment' | 'lead_capture' | 'info';
  is_published: boolean;
  published_at: string | null;
  headline: string | null;
  subheadline: string | null;
  hero_image_url: string | null;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  background_style: 'gradient' | 'solid' | 'image';
  form_fields: string[];
  required_fields: string[];
  plan_ids: string[];
  default_plan_id: string | null;
  default_advisor_id: string | null;
  advisor_selection_enabled: boolean;
  utm_source: string | null;
  utm_campaign: string | null;
  views_count: number;
  submissions_count: number;
  conversion_rate: number;
  meta: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface Plan {
  id: string;
  name: string;
}

interface Advisor {
  id: string;
  name: string;
}

export default function LandingPagesPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [pages, setPages] = useState<LandingPage[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [advisors, setAdvisors] = useState<Advisor[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState('');
  const [orgSlug, setOrgSlug] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LandingPage | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState({
    name: '',
    slug: '',
    page_type: 'enrollment' as 'enrollment' | 'lead_capture' | 'info',
    is_published: false,
    headline: '',
    subheadline: '',
    hero_image_url: '',
    logo_url: '',
    primary_color: '#0d9488',
    secondary_color: '#1e3a5f',
    background_style: 'gradient' as 'gradient' | 'solid' | 'image',
    required_fields: ['first_name', 'last_name', 'email', 'phone'],
    plan_ids: [] as string[],
    default_plan_id: '',
    default_advisor_id: '',
    advisor_selection_enabled: false,
    utm_source: '',
    utm_campaign: '',
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

      const [pagesRes, plansRes, advisorsRes] = await Promise.all([
        supabase.from('landing_pages').select('*').eq('organization_id', profile.organization_id).order('name'),
        supabase.from('plans').select('id, name').eq('organization_id', profile.organization_id).eq('is_active', true),
        supabase.from('advisors').select('id, full_name').eq('organization_id', profile.organization_id).eq('status', 'active'),
      ]);

      setPages((pagesRes.data || []) as LandingPage[]);
      setPlans((plansRes.data || []).map((p: any) => ({ id: p.id, name: p.name })));
      setAdvisors((advisorsRes.data || []).map((a: any) => ({ id: a.id, name: a.full_name })));
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  };

  const openCreateDialog = () => {
    setEditing(null);
    setForm({
      name: '',
      slug: '',
      page_type: 'enrollment',
      is_published: false,
      headline: '',
      subheadline: '',
      hero_image_url: '',
      logo_url: '',
      primary_color: '#0d9488',
      secondary_color: '#1e3a5f',
      background_style: 'gradient',
      required_fields: ['first_name', 'last_name', 'email', 'phone'],
      plan_ids: [],
      default_plan_id: '',
      default_advisor_id: '',
      advisor_selection_enabled: false,
      utm_source: '',
      utm_campaign: '',
    });
    setDialogOpen(true);
  };

  const openEditDialog = (page: LandingPage) => {
    setEditing(page);
    setForm({
      name: page.name,
      slug: page.slug,
      page_type: page.page_type,
      is_published: page.is_published,
      headline: page.headline || '',
      subheadline: page.subheadline || '',
      hero_image_url: page.hero_image_url || '',
      logo_url: page.logo_url || '',
      primary_color: page.primary_color,
      secondary_color: page.secondary_color,
      background_style: page.background_style,
      required_fields: page.required_fields,
      plan_ids: page.plan_ids || [],
      default_plan_id: page.default_plan_id || '',
      default_advisor_id: page.default_advisor_id || '',
      advisor_selection_enabled: page.advisor_selection_enabled,
      utm_source: page.utm_source || '',
      utm_campaign: page.utm_campaign || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.slug) return;
    setSaving(true);

    try {
      const data = {
        organization_id: orgId,
        name: form.name,
        slug: form.slug,
        page_type: form.page_type,
        is_published: form.is_published,
        published_at: form.is_published && !editing?.is_published ? new Date().toISOString() : editing?.published_at,
        headline: form.headline || null,
        subheadline: form.subheadline || null,
        hero_image_url: form.hero_image_url || null,
        logo_url: form.logo_url || null,
        primary_color: form.primary_color,
        secondary_color: form.secondary_color,
        background_style: form.background_style,
        required_fields: form.required_fields,
        plan_ids: form.plan_ids,
        default_plan_id: form.default_plan_id || null,
        default_advisor_id: form.default_advisor_id || null,
        advisor_selection_enabled: form.advisor_selection_enabled,
        utm_source: form.utm_source || null,
        utm_campaign: form.utm_campaign || null,
      };

      if (editing) {
        await supabase.from('landing_pages').update(data).eq('id', editing.id);
      } else {
        await supabase.from('landing_pages').insert(data);
      }

      fetchData();
      setDialogOpen(false);
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await supabase.from('landing_pages').delete().eq('id', deleteId);
      setPages(pages.filter(p => p.id !== deleteId));
    } catch (error) {
      console.error('Failed to delete:', error);
    } finally {
      setDeleteId(null);
    }
  };

  const togglePublish = async (page: LandingPage) => {
    const newPublished = !page.is_published;
    await supabase
      .from('landing_pages')
      .update({
        is_published: newPublished,
        published_at: newPublished ? new Date().toISOString() : page.published_at,
      })
      .eq('id', page.id);
    setPages(pages.map(p => p.id === page.id ? { ...p, is_published: newPublished } : p));
  };

  const copyUrl = (slug: string, id: string) => {
    const url = `${window.location.origin}/enroll/${orgSlug}/${slug}`;
    navigator.clipboard.writeText(url);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const getPageUrl = (slug: string) => {
    return `${window.location.origin}/enroll/${orgSlug}/${slug}`;
  };

  const pageTypeLabels = {
    enrollment: 'Enrollment',
    lead_capture: 'Lead Capture',
    info: 'Information',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/crm/settings">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-500/10 rounded-lg">
              <Globe className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Landing Pages</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Create custom enrollment and lead capture pages
              </p>
            </div>
          </div>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="w-4 h-4 mr-2" />
          Create Page
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-4">
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-1">Total Pages</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{pages.length}</p>
        </div>
        <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-4">
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-1">Published</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {pages.filter(p => p.is_published).length}
          </p>
        </div>
        <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-4">
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-1">Total Views</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {pages.reduce((sum, p) => sum + p.views_count, 0).toLocaleString()}
          </p>
        </div>
        <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-4">
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-1">Total Submissions</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {pages.reduce((sum, p) => sum + p.submissions_count, 0).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Pages Table */}
      <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        {pages.length === 0 ? (
          <div className="text-center py-12">
            <Globe className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
              No landing pages yet
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mb-4">
              Create your first landing page to capture leads
            </p>
            <Button onClick={openCreateDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Create Page
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Views</TableHead>
                <TableHead>Submissions</TableHead>
                <TableHead>Conversion</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pages.map((page) => (
                <TableRow key={page.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium text-slate-900 dark:text-white">
                        {page.name}
                      </div>
                      <div className="text-sm text-slate-500 font-mono">/{page.slug}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{pageTypeLabels[page.page_type]}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={page.is_published ? 'default' : 'secondary'}>
                      {page.is_published ? 'Published' : 'Draft'}
                    </Badge>
                  </TableCell>
                  <TableCell>{page.views_count.toLocaleString()}</TableCell>
                  <TableCell>{page.submissions_count.toLocaleString()}</TableCell>
                  <TableCell>
                    {page.views_count > 0
                      ? `${((page.submissions_count / page.views_count) * 100).toFixed(1)}%`
                      : '-'}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(page)}>
                          <Pencil className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => copyUrl(page.slug, page.id)}>
                          {copied === page.id ? (
                            <Check className="w-4 h-4 mr-2 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4 mr-2" />
                          )}
                          Copy URL
                        </DropdownMenuItem>
                        {page.is_published && (
                          <DropdownMenuItem asChild>
                            <a href={getPageUrl(page.slug)} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="w-4 h-4 mr-2" />
                              View Page
                            </a>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => togglePublish(page)}>
                          <Eye className="w-4 h-4 mr-2" />
                          {page.is_published ? 'Unpublish' : 'Publish'}
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600" onClick={() => setDeleteId(page.id)}>
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
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit' : 'Create'} Landing Page</DialogTitle>
            <DialogDescription>
              Configure your landing page content and settings
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="content" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="content">Content</TabsTrigger>
              <TabsTrigger value="design">Design</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            {/* Content Tab */}
            <TabsContent value="content" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Page Name</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({
                      ...form,
                      name: e.target.value,
                      slug: form.slug || generateSlug(e.target.value),
                    })}
                    placeholder="e.g., Summer Enrollment 2026"
                  />
                </div>
                <div className="space-y-2">
                  <Label>URL Slug</Label>
                  <Input
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value })}
                    placeholder="summer-enrollment-2026"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Page Type</Label>
                <Select value={form.page_type} onValueChange={(v) => setForm({ ...form, page_type: v as any })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="enrollment">Enrollment - Full sign-up flow</SelectItem>
                    <SelectItem value="lead_capture">Lead Capture - Collect contact info</SelectItem>
                    <SelectItem value="info">Information - No form, just content</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Headline</Label>
                <Input
                  value={form.headline}
                  onChange={(e) => setForm({ ...form, headline: e.target.value })}
                  placeholder="e.g., Join Our Healthcare Sharing Community"
                />
              </div>

              <div className="space-y-2">
                <Label>Subheadline</Label>
                <Textarea
                  value={form.subheadline}
                  onChange={(e) => setForm({ ...form, subheadline: e.target.value })}
                  placeholder="e.g., Affordable healthcare for your whole family"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Hero Image URL</Label>
                  <Input
                    value={form.hero_image_url}
                    onChange={(e) => setForm({ ...form, hero_image_url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Logo URL</Label>
                  <Input
                    value={form.logo_url}
                    onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
              </div>
            </TabsContent>

            {/* Design Tab */}
            <TabsContent value="design" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Primary Color</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={form.primary_color}
                      onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                      className="w-12 h-10 p-1"
                    />
                    <Input
                      value={form.primary_color}
                      onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                      className="flex-1"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Secondary Color</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={form.secondary_color}
                      onChange={(e) => setForm({ ...form, secondary_color: e.target.value })}
                      className="w-12 h-10 p-1"
                    />
                    <Input
                      value={form.secondary_color}
                      onChange={(e) => setForm({ ...form, secondary_color: e.target.value })}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Background Style</Label>
                <Select value={form.background_style} onValueChange={(v) => setForm({ ...form, background_style: v as any })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gradient">Gradient</SelectItem>
                    <SelectItem value="solid">Solid Color</SelectItem>
                    <SelectItem value="image">Background Image</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Preview */}
              <div className="space-y-2">
                <Label>Preview</Label>
                <div
                  className="h-32 rounded-lg flex items-center justify-center text-white font-semibold"
                  style={{
                    background: form.background_style === 'gradient'
                      ? `linear-gradient(135deg, ${form.primary_color} 0%, ${form.secondary_color} 100%)`
                      : form.primary_color,
                  }}
                >
                  {form.headline || 'Your Headline Here'}
                </div>
              </div>
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings" className="space-y-4">
              {form.page_type === 'enrollment' && plans.length > 0 && (
                <div className="space-y-2">
                  <Label>Default Plan</Label>
                  <Select value={form.default_plan_id} onValueChange={(v) => setForm({ ...form, default_plan_id: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a plan..." />
                    </SelectTrigger>
                    <SelectContent>
                      {plans.map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>{plan.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {advisors.length > 0 && (
                <>
                  <div className="space-y-2">
                    <Label>Default Advisor</Label>
                    <Select value={form.default_advisor_id} onValueChange={(v) => setForm({ ...form, default_advisor_id: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Auto-assign..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Auto-assign</SelectItem>
                        {advisors.map((advisor) => (
                          <SelectItem key={advisor.id} value={advisor.id}>{advisor.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={form.advisor_selection_enabled}
                      onCheckedChange={(checked) => setForm({ ...form, advisor_selection_enabled: checked })}
                    />
                    <Label>Allow visitors to choose their advisor</Label>
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>UTM Source</Label>
                  <Input
                    value={form.utm_source}
                    onChange={(e) => setForm({ ...form, utm_source: e.target.value })}
                    placeholder="e.g., facebook"
                  />
                </div>
                <div className="space-y-2">
                  <Label>UTM Campaign</Label>
                  <Input
                    value={form.utm_campaign}
                    onChange={(e) => setForm({ ...form, utm_campaign: e.target.value })}
                    placeholder="e.g., summer_promo"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-4 border-t">
                <Switch
                  checked={form.is_published}
                  onCheckedChange={(checked) => setForm({ ...form, is_published: checked })}
                />
                <Label>Publish this page</Label>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.name || !form.slug}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {editing ? 'Save Changes' : 'Create Page'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Landing Page</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this landing page? This action cannot be undone.
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
