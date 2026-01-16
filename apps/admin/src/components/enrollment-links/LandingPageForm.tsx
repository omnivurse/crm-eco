'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@crm-eco/lib/supabase/client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowLeft,
  Save,
  Trash2,
  Eye,
  Palette,
  Settings,
  FileText,
  Users,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
import { Textarea } from '@crm-eco/ui/components/textarea';
import { Switch } from '@crm-eco/ui/components/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@crm-eco/ui/components/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@crm-eco/ui/components/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@crm-eco/ui/components/alert-dialog';
import { toast } from 'sonner';

const landingPageSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  slug: z.string().min(1, 'URL slug is required').regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers, and hyphens allowed'),
  headline: z.string().optional(),
  subheadline: z.string().optional(),
  hero_image_url: z.string().url().optional().or(z.literal('')),
  logo_url: z.string().url().optional().or(z.literal('')),
  primary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format'),
  secondary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format'),
  background_style: z.enum(['gradient', 'solid', 'image']),
  default_advisor_id: z.string().uuid().optional().nullable(),
  advisor_selection_enabled: z.boolean(),
  is_published: z.boolean(),
  utm_source: z.string().optional(),
  utm_medium: z.string().optional(),
  utm_campaign: z.string().optional(),
  thank_you_redirect_url: z.string().url().optional().or(z.literal('')),
});

type LandingPageFormData = z.infer<typeof landingPageSchema>;

interface Advisor {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
}

interface Plan {
  id: string;
  name: string;
  code: string;
}

interface LandingPageFormProps {
  landingPage?: any;
}

export function LandingPageForm({ landingPage }: LandingPageFormProps) {
  const router = useRouter();
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [advisors, setAdvisors] = useState<Advisor[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlans, setSelectedPlans] = useState<string[]>(landingPage?.plan_ids || []);
  const isEditing = !!landingPage;

  const form = useForm<LandingPageFormData>({
    resolver: zodResolver(landingPageSchema),
    defaultValues: {
      name: landingPage?.name || '',
      slug: landingPage?.slug || '',
      headline: landingPage?.headline || '',
      subheadline: landingPage?.subheadline || '',
      hero_image_url: landingPage?.hero_image_url || '',
      logo_url: landingPage?.logo_url || '',
      primary_color: landingPage?.primary_color || '#0d9488',
      secondary_color: landingPage?.secondary_color || '#14b8a6',
      background_style: landingPage?.background_style || 'gradient',
      default_advisor_id: landingPage?.default_advisor_id || null,
      advisor_selection_enabled: landingPage?.advisor_selection_enabled ?? false,
      is_published: landingPage?.is_published ?? false,
      utm_source: landingPage?.utm_source || '',
      utm_medium: landingPage?.utm_medium || '',
      utm_campaign: landingPage?.utm_campaign || '',
      thank_you_redirect_url: landingPage?.thank_you_redirect_url || '',
    },
  });

  useEffect(() => {
    loadRelatedData();
  }, []);

  async function loadRelatedData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single() as { data: { organization_id: string } | null };

    if (!profile) return;

    // Load advisors
    const { data: advisorsData } = await supabase
      .from('advisors')
      .select('id, first_name, last_name, email')
      .eq('organization_id', profile.organization_id)
      .eq('is_active', true)
      .order('last_name');

    if (advisorsData) {
      setAdvisors(advisorsData);
    }

    // Load plans
    const { data: plansData } = await supabase
      .from('plans')
      .select('id, name, code')
      .eq('organization_id', profile.organization_id)
      .eq('is_active', true)
      .order('name');

    if (plansData) {
      setPlans(plansData);
    }
  }

  async function onSubmit(data: LandingPageFormData) {
    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, organization_id')
        .eq('user_id', user.id)
        .single() as { data: { id: string; organization_id: string } | null };

      if (!profile) throw new Error('Profile not found');

      const pageData = {
        ...data,
        hero_image_url: data.hero_image_url || null,
        logo_url: data.logo_url || null,
        thank_you_redirect_url: data.thank_you_redirect_url || null,
        plan_ids: selectedPlans,
        organization_id: profile.organization_id,
        created_by: isEditing ? undefined : profile.id,
      };

      if (isEditing) {
        const { error } = await (supabase as any)
          .from('landing_pages')
          .update(pageData)
          .eq('id', landingPage.id);

        if (error) throw error;

        // Log activity
        await (supabase as any).rpc('log_admin_activity', {
          p_actor_profile_id: profile.id,
          p_entity_type: 'landing_page',
          p_entity_id: landingPage.id,
          p_action: 'update',
          p_metadata: { name: data.name },
        }).catch(() => {});

        toast.success('Landing page updated');
      } else {
        const { data: newPage, error } = await (supabase as any)
          .from('landing_pages')
          .insert(pageData)
          .select('id')
          .single();

        if (error) throw error;

        // Log activity
        await (supabase as any).rpc('log_admin_activity', {
          p_actor_profile_id: profile.id,
          p_entity_type: 'landing_page',
          p_entity_id: newPage.id,
          p_action: 'create',
          p_metadata: { name: data.name },
        }).catch(() => {});

        toast.success('Landing page created');
        router.push(`/enrollment-links/${newPage.id}`);
      }
    } catch (error: any) {
      console.error('Error saving landing page:', error);
      if (error.code === '23505') {
        toast.error('This URL slug is already in use');
      } else {
        toast.error(error.message || 'Failed to save landing page');
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single() as { data: { id: string } | null };

      const { error } = await (supabase as any)
        .from('landing_pages')
        .delete()
        .eq('id', landingPage.id);

      if (error) throw error;

      // Log activity
      if (profile) {
        await (supabase as any).rpc('log_admin_activity', {
          p_actor_profile_id: profile.id,
          p_entity_type: 'landing_page',
          p_entity_id: landingPage.id,
          p_action: 'delete',
          p_metadata: { name: landingPage.name },
        }).catch(() => {});
      }

      toast.success('Landing page deleted');
      router.push('/enrollment-links');
    } catch (error) {
      console.error('Error deleting landing page:', error);
      toast.error('Failed to delete landing page');
    }
  }

  function generateSlug(name: string) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  function togglePlan(planId: string) {
    setSelectedPlans(prev => 
      prev.includes(planId)
        ? prev.filter(id => id !== planId)
        : [...prev, planId]
    );
  }

  const watchedColors = form.watch(['primary_color', 'secondary_color']);

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/enrollment-links">
            <Button type="button" variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {isEditing ? 'Edit Landing Page' : 'Create Landing Page'}
            </h1>
            <p className="text-slate-600">
              {isEditing ? 'Update your enrollment landing page' : 'Create a new enrollment landing page'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isEditing && (
            <>
              <Button
                type="button"
                variant="outline"
                asChild
              >
                <a 
                  href={`${process.env.NEXT_PUBLIC_PORTAL_URL || ''}/enroll/${landingPage.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  Preview
                </a>
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="outline" className="text-red-600">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Landing Page</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete this landing page? This action cannot be undone.
                      All analytics data will also be deleted.
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
            </>
          )}

          <Button type="submit" disabled={saving} className="gap-2">
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Page'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="content" className="space-y-6">
        <TabsList>
          <TabsTrigger value="content" className="gap-2">
            <FileText className="w-4 h-4" />
            Content
          </TabsTrigger>
          <TabsTrigger value="design" className="gap-2">
            <Palette className="w-4 h-4" />
            Design
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="w-4 h-4" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="plans" className="gap-2">
            <Users className="w-4 h-4" />
            Plans
          </TabsTrigger>
        </TabsList>

        {/* Content Tab */}
        <TabsContent value="content">
          <Card>
            <CardHeader>
              <CardTitle>Page Content</CardTitle>
              <CardDescription>Configure the main content of your landing page</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Page Name *</Label>
                  <Input
                    id="name"
                    {...form.register('name')}
                    placeholder="Summer 2026 Campaign"
                    onChange={(e) => {
                      form.setValue('name', e.target.value);
                      if (!isEditing && !form.getValues('slug')) {
                        form.setValue('slug', generateSlug(e.target.value));
                      }
                    }}
                  />
                  {form.formState.errors.name && (
                    <p className="text-sm text-red-600 mt-1">{form.formState.errors.name.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="slug">URL Slug *</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500">/enroll/</span>
                    <Input
                      id="slug"
                      {...form.register('slug')}
                      placeholder="summer-2026"
                    />
                  </div>
                  {form.formState.errors.slug && (
                    <p className="text-sm text-red-600 mt-1">{form.formState.errors.slug.message}</p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="headline">Headline</Label>
                <Input
                  id="headline"
                  {...form.register('headline')}
                  placeholder="Join Our Healthcare Community Today"
                />
              </div>

              <div>
                <Label htmlFor="subheadline">Subheadline</Label>
                <Textarea
                  id="subheadline"
                  {...form.register('subheadline')}
                  placeholder="Affordable healthcare sharing for you and your family"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="logo_url">Logo URL</Label>
                  <Input
                    id="logo_url"
                    {...form.register('logo_url')}
                    placeholder="https://example.com/logo.png"
                  />
                </div>

                <div>
                  <Label htmlFor="hero_image_url">Hero Image URL</Label>
                  <Input
                    id="hero_image_url"
                    {...form.register('hero_image_url')}
                    placeholder="https://example.com/hero.jpg"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Design Tab */}
        <TabsContent value="design">
          <Card>
            <CardHeader>
              <CardTitle>Design & Branding</CardTitle>
              <CardDescription>Customize the look and feel of your landing page</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="primary_color">Primary Color</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="color"
                      id="primary_color"
                      {...form.register('primary_color')}
                      className="w-12 h-10 p-1 cursor-pointer"
                    />
                    <Input
                      {...form.register('primary_color')}
                      placeholder="#0d9488"
                      className="flex-1"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="secondary_color">Secondary Color</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="color"
                      id="secondary_color"
                      {...form.register('secondary_color')}
                      className="w-12 h-10 p-1 cursor-pointer"
                    />
                    <Input
                      {...form.register('secondary_color')}
                      placeholder="#14b8a6"
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="background_style">Background Style</Label>
                <Select
                  value={form.watch('background_style')}
                  onValueChange={(value) => form.setValue('background_style', value as any)}
                >
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
              <div>
                <Label>Preview</Label>
                <div 
                  className="h-32 rounded-lg mt-2 flex items-center justify-center"
                  style={{
                    background: `linear-gradient(135deg, ${watchedColors[1]} 0%, ${watchedColors[0]} 100%)`,
                  }}
                >
                  <p className="text-white text-lg font-semibold">Your headline here</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Publishing</CardTitle>
                <CardDescription>Control the visibility of your landing page</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="is_published">Published</Label>
                    <p className="text-sm text-slate-500">
                      Make this page publicly accessible
                    </p>
                  </div>
                  <Switch
                    id="is_published"
                    checked={form.watch('is_published')}
                    onCheckedChange={(checked) => form.setValue('is_published', checked)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Agent Assignment</CardTitle>
                <CardDescription>Configure how agents are assigned to leads</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="default_advisor_id">Default Agent</Label>
                  <Select
                    value={form.watch('default_advisor_id') || ''}
                    onValueChange={(value) => form.setValue('default_advisor_id', value || null)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select an agent (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No default agent</SelectItem>
                      {advisors.map((advisor) => (
                        <SelectItem key={advisor.id} value={advisor.id}>
                          {advisor.first_name} {advisor.last_name} ({advisor.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-slate-500 mt-1">
                    All leads from this page will be assigned to this agent
                  </p>
                </div>

                <div className="flex items-center justify-between pt-4 border-t">
                  <div>
                    <Label htmlFor="advisor_selection_enabled">Allow Agent Selection</Label>
                    <p className="text-sm text-slate-500">
                      Let visitors choose their agent during enrollment
                    </p>
                  </div>
                  <Switch
                    id="advisor_selection_enabled"
                    checked={form.watch('advisor_selection_enabled')}
                    onCheckedChange={(checked) => form.setValue('advisor_selection_enabled', checked)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>UTM Tracking</CardTitle>
                <CardDescription>Track the source of your leads</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="utm_source">UTM Source</Label>
                    <Input
                      id="utm_source"
                      {...form.register('utm_source')}
                      placeholder="facebook"
                    />
                  </div>
                  <div>
                    <Label htmlFor="utm_medium">UTM Medium</Label>
                    <Input
                      id="utm_medium"
                      {...form.register('utm_medium')}
                      placeholder="social"
                    />
                  </div>
                  <div>
                    <Label htmlFor="utm_campaign">UTM Campaign</Label>
                    <Input
                      id="utm_campaign"
                      {...form.register('utm_campaign')}
                      placeholder="summer-promo"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>After Submission</CardTitle>
                <CardDescription>Configure what happens after form submission</CardDescription>
              </CardHeader>
              <CardContent>
                <div>
                  <Label htmlFor="thank_you_redirect_url">Redirect URL (Optional)</Label>
                  <Input
                    id="thank_you_redirect_url"
                    {...form.register('thank_you_redirect_url')}
                    placeholder="https://example.com/thank-you"
                  />
                  <p className="text-sm text-slate-500 mt-1">
                    Leave empty to show the default thank you message
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Plans Tab */}
        <TabsContent value="plans">
          <Card>
            <CardHeader>
              <CardTitle>Available Plans</CardTitle>
              <CardDescription>Select which plans to show on this landing page</CardDescription>
            </CardHeader>
            <CardContent>
              {plans.length === 0 ? (
                <p className="text-slate-500 text-center py-8">
                  No plans available. Create plans in the Products section first.
                </p>
              ) : (
                <div className="space-y-2">
                  {plans.map((plan) => (
                    <div
                      key={plan.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedPlans.includes(plan.id)
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                      onClick={() => togglePlan(plan.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{plan.name}</p>
                          <p className="text-sm text-slate-500">Code: {plan.code}</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={selectedPlans.includes(plan.id)}
                          onChange={() => togglePlan(plan.id)}
                          className="h-4 w-4 text-blue-600 rounded"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-sm text-slate-500 mt-4">
                {selectedPlans.length === 0
                  ? 'All active plans will be shown if none are selected.'
                  : `${selectedPlans.length} plan(s) selected`}
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </form>
  );
}
