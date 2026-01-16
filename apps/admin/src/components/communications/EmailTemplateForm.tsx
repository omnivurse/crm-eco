'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@crm-eco/lib/supabase/client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import {
  ArrowLeft,
  Save,
  Trash2,
  Eye,
  Code,
  FileText,
  Variable,
} from 'lucide-react';
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

const templateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  slug: z.string().min(1, 'Slug is required').regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers, and hyphens'),
  description: z.string().optional(),
  category: z.string().min(1, 'Category is required'),
  subject: z.string().min(1, 'Subject is required'),
  body_html: z.string().min(1, 'HTML body is required'),
  body_text: z.string().optional(),
  from_name: z.string().optional(),
  from_email: z.string().email().optional().or(z.literal('')),
  reply_to: z.string().email().optional().or(z.literal('')),
  is_active: z.boolean(),
});

type TemplateFormData = z.infer<typeof templateSchema>;

const CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'enrollment', label: 'Enrollment' },
  { value: 'billing', label: 'Billing' },
  { value: 'welcome', label: 'Welcome' },
  { value: 'notification', label: 'Notification' },
  { value: 'marketing', label: 'Marketing' },
];

const COMMON_VARIABLES = [
  { name: 'firstName', description: 'Recipient first name' },
  { name: 'lastName', description: 'Recipient last name' },
  { name: 'email', description: 'Recipient email' },
  { name: 'organizationName', description: 'Organization name' },
  { name: 'planName', description: 'Plan name' },
  { name: 'amount', description: 'Amount (formatted)' },
  { name: 'date', description: 'Current date' },
  { name: 'memberNumber', description: 'Member ID number' },
];

interface EmailTemplateFormProps {
  template?: any;
}

export function EmailTemplateForm({ template }: EmailTemplateFormProps) {
  const router = useRouter();
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const isEditing = !!template;

  const form = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: template?.name || '',
      slug: template?.slug || '',
      description: template?.description || '',
      category: template?.category || 'general',
      subject: template?.subject || '',
      body_html: template?.body_html || getDefaultHtml(),
      body_text: template?.body_text || '',
      from_name: template?.from_name || '',
      from_email: template?.from_email || '',
      reply_to: template?.reply_to || '',
      is_active: template?.is_active ?? true,
    },
  });

  useEffect(() => {
    // Update preview when body_html changes
    const html = form.watch('body_html');
    setPreviewHtml(replaceWithSampleData(html));
  }, [form.watch('body_html')]);

  function getDefaultHtml() {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{subject}}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #0d9488; padding: 24px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px;">{{organizationName}}</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <h2 style="color: #1e293b; margin: 0 0 16px 0;">Hello {{firstName}},</h2>
              <p style="color: #475569; line-height: 1.6; margin: 0 0 16px 0;">
                Your email content goes here. Use {{variables}} to personalize the message.
              </p>
              <p style="color: #475569; line-height: 1.6; margin: 0;">
                Best regards,<br>
                The Team
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                © ${new Date().getFullYear()} {{organizationName}}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  function replaceWithSampleData(html: string): string {
    const sampleData: Record<string, string> = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      organizationName: 'HealthShare',
      planName: 'Premium Family Plan',
      amount: '$299.00',
      date: new Date().toLocaleDateString(),
      memberNumber: 'MBR-12345',
      subject: form.watch('subject') || 'Email Subject',
    };

    let result = html;
    for (const [key, value] of Object.entries(sampleData)) {
      result = result.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), value);
    }
    return result;
  }

  function generateSlug(name: string) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  function insertVariable(variable: string) {
    const currentHtml = form.getValues('body_html');
    form.setValue('body_html', currentHtml + `{{${variable}}}`);
  }

  async function onSubmit(data: TemplateFormData) {
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

      const templateData = {
        ...data,
        from_email: data.from_email || null,
        reply_to: data.reply_to || null,
        organization_id: profile.organization_id,
        variables: COMMON_VARIABLES.filter(v => 
          data.body_html.includes(`{{${v.name}}}`) || 
          data.subject.includes(`{{${v.name}}}`)
        ),
      };

      if (isEditing) {
        const { error } = await (supabase as any)
          .from('email_templates')
          .update(templateData)
          .eq('id', template.id);

        if (error) throw error;

        await (supabase as any).rpc('log_admin_activity', {
          p_actor_profile_id: profile.id,
          p_entity_type: 'email_template',
          p_entity_id: template.id,
          p_action: 'update',
          p_metadata: { name: data.name },
        }).catch(() => {});

        toast.success('Template updated');
      } else {
        const { data: newTemplate, error } = await (supabase as any)
          .from('email_templates')
          .insert({
            ...templateData,
            created_by: profile.id,
          })
          .select('id')
          .single();

        if (error) throw error;

        await (supabase as any).rpc('log_admin_activity', {
          p_actor_profile_id: profile.id,
          p_entity_type: 'email_template',
          p_entity_id: newTemplate.id,
          p_action: 'create',
          p_metadata: { name: data.name },
        }).catch(() => {});

        toast.success('Template created');
        router.push(`/communications/templates/${newTemplate.id}`);
      }
    } catch (error: any) {
      console.error('Error saving template:', error);
      if (error.code === '23505') {
        toast.error('A template with this slug already exists');
      } else {
        toast.error(error.message || 'Failed to save template');
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (template?.is_system) {
      toast.error('System templates cannot be deleted');
      return;
    }

    try {
      const { error } = await (supabase as any)
        .from('email_templates')
        .delete()
        .eq('id', template.id);

      if (error) throw error;

      toast.success('Template deleted');
      router.push('/communications/templates');
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('Failed to delete template');
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/communications/templates">
            <Button type="button" variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {isEditing ? 'Edit Template' : 'Create Template'}
            </h1>
            <p className="text-slate-600">
              {isEditing ? 'Update your email template' : 'Create a reusable email template'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isEditing && !template?.is_system && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="outline" className="text-red-600">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Template</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this template? This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-red-600">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          <Button type="submit" disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Template'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Template Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Template Name *</Label>
                  <Input
                    id="name"
                    {...form.register('name')}
                    placeholder="Welcome Email"
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
                  <Label htmlFor="slug">Slug *</Label>
                  <Input
                    id="slug"
                    {...form.register('slug')}
                    placeholder="welcome-email"
                  />
                  {form.formState.errors.slug && (
                    <p className="text-sm text-red-600 mt-1">{form.formState.errors.slug.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="category">Category *</Label>
                  <Select
                    value={form.watch('category')}
                    onValueChange={(value) => form.setValue('category', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-4 pt-6">
                  <Switch
                    id="is_active"
                    checked={form.watch('is_active')}
                    onCheckedChange={(checked) => form.setValue('is_active', checked)}
                  />
                  <Label htmlFor="is_active">Active</Label>
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  {...form.register('description')}
                  placeholder="Brief description of when this template is used"
                  rows={2}
                />
              </div>

              <div>
                <Label htmlFor="subject">Subject Line *</Label>
                <Input
                  id="subject"
                  {...form.register('subject')}
                  placeholder="Welcome to {{organizationName}}!"
                />
                {form.formState.errors.subject && (
                  <p className="text-sm text-red-600 mt-1">{form.formState.errors.subject.message}</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Email Content</CardTitle>
              <CardDescription>
                Use {"{{variableName}}"} syntax for dynamic content
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="html">
                <TabsList>
                  <TabsTrigger value="html">
                    <Code className="w-4 h-4 mr-2" />
                    HTML
                  </TabsTrigger>
                  <TabsTrigger value="text">
                    <FileText className="w-4 h-4 mr-2" />
                    Plain Text
                  </TabsTrigger>
                  <TabsTrigger value="preview">
                    <Eye className="w-4 h-4 mr-2" />
                    Preview
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="html" className="mt-4">
                  <Textarea
                    {...form.register('body_html')}
                    className="font-mono text-sm"
                    rows={20}
                    placeholder="Enter HTML content..."
                  />
                  {form.formState.errors.body_html && (
                    <p className="text-sm text-red-600 mt-1">{form.formState.errors.body_html.message}</p>
                  )}
                </TabsContent>

                <TabsContent value="text" className="mt-4">
                  <Textarea
                    {...form.register('body_text')}
                    className="font-mono text-sm"
                    rows={20}
                    placeholder="Plain text version (optional, for email clients that don't support HTML)"
                  />
                </TabsContent>

                <TabsContent value="preview" className="mt-4">
                  <div className="border rounded-lg overflow-hidden">
                    <iframe
                      srcDoc={previewHtml}
                      className="w-full h-[500px]"
                      title="Email Preview"
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Variable className="w-5 h-5" />
                Variables
              </CardTitle>
              <CardDescription>
                Click to insert into HTML
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {COMMON_VARIABLES.map((variable) => (
                  <button
                    key={variable.name}
                    type="button"
                    onClick={() => insertVariable(variable.name)}
                    className="w-full text-left p-2 rounded hover:bg-slate-100 transition-colors"
                  >
                    <code className="text-sm text-blue-600">{`{{${variable.name}}}`}</code>
                    <p className="text-xs text-slate-500">{variable.description}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sender Options</CardTitle>
              <CardDescription>
                Override default sender (optional)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="from_name">From Name</Label>
                <Input
                  id="from_name"
                  {...form.register('from_name')}
                  placeholder="HealthShare Team"
                />
              </div>

              <div>
                <Label htmlFor="from_email">From Email</Label>
                <Input
                  id="from_email"
                  type="email"
                  {...form.register('from_email')}
                  placeholder="team@example.com"
                />
              </div>

              <div>
                <Label htmlFor="reply_to">Reply-To</Label>
                <Input
                  id="reply_to"
                  type="email"
                  {...form.register('reply_to')}
                  placeholder="support@example.com"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  );
}
