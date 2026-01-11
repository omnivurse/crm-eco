'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Input,
  Label,
  Textarea,
  Switch,
  Badge,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@crm-eco/ui';
import { Mail, MessageSquare, Plus, Pencil, Trash2, Check, X, Eye } from 'lucide-react';
import type { CrmMessageProvider, CrmMessageTemplate } from '@/lib/comms/types';
import { generatePreview } from '@/lib/comms/mergeFields';

export default function CommsSettingsPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const [providers, setProviders] = useState<CrmMessageProvider[]>([]);
  const [templates, setTemplates] = useState<CrmMessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string>('');

  // Provider form state
  const [providerDialogOpen, setProviderDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<CrmMessageProvider | null>(null);
  const [providerForm, setProviderForm] = useState({
    type: 'sendgrid' as 'sendgrid' | 'twilio',
    name: '',
    from_email: '',
    from_name: '',
    from_phone: '',
    is_default: false,
  });

  // Template form state
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CrmMessageTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState({
    channel: 'email' as 'email' | 'sms',
    name: '',
    subject: '',
    body: '',
    is_active: true,
  });
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState('');

  // Load data
  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (!profile) return;
      setOrgId(profile.organization_id);

      const [providersRes, templatesRes] = await Promise.all([
        supabase.from('crm_message_providers').select('*').eq('org_id', profile.organization_id),
        supabase.from('crm_message_templates').select('*').eq('org_id', profile.organization_id).order('name'),
      ]);

      setProviders((providersRes.data || []) as CrmMessageProvider[]);
      setTemplates((templatesRes.data || []) as CrmMessageTemplate[]);
      setLoading(false);
    }

    loadData();
  }, [supabase]);

  // Provider CRUD
  const handleSaveProvider = async () => {
    const data = {
      org_id: orgId,
      type: providerForm.type,
      name: providerForm.name,
      config: {
        from_email: providerForm.from_email,
        from_name: providerForm.from_name,
        from_phone: providerForm.from_phone,
      },
      is_default: providerForm.is_default,
    };

    if (editingProvider) {
      await supabase.from('crm_message_providers').update(data).eq('id', editingProvider.id);
    } else {
      await supabase.from('crm_message_providers').insert(data);
    }

    // Reload
    const { data: updated } = await supabase.from('crm_message_providers').select('*').eq('org_id', orgId);
    setProviders((updated || []) as CrmMessageProvider[]);
    setProviderDialogOpen(false);
    setEditingProvider(null);
  };

  const handleDeleteProvider = async (id: string) => {
    if (!confirm('Delete this provider?')) return;
    await supabase.from('crm_message_providers').delete().eq('id', id);
    setProviders(providers.filter(p => p.id !== id));
  };

  const openEditProvider = (provider: CrmMessageProvider) => {
    setEditingProvider(provider);
    setProviderForm({
      type: provider.type,
      name: provider.name,
      from_email: provider.config.from_email || '',
      from_name: provider.config.from_name || '',
      from_phone: provider.config.from_phone || '',
      is_default: provider.is_default,
    });
    setProviderDialogOpen(true);
  };

  // Template CRUD
  const handleSaveTemplate = async () => {
    const data = {
      org_id: orgId,
      channel: templateForm.channel,
      name: templateForm.name,
      subject: templateForm.channel === 'email' ? templateForm.subject : null,
      body: templateForm.body,
      is_active: templateForm.is_active,
    };

    if (editingTemplate) {
      await supabase.from('crm_message_templates').update(data).eq('id', editingTemplate.id);
    } else {
      await supabase.from('crm_message_templates').insert(data);
    }

    const { data: updated } = await supabase
      .from('crm_message_templates')
      .select('*')
      .eq('org_id', orgId)
      .order('name');
    setTemplates((updated || []) as CrmMessageTemplate[]);
    setTemplateDialogOpen(false);
    setEditingTemplate(null);
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    await supabase.from('crm_message_templates').delete().eq('id', id);
    setTemplates(templates.filter(t => t.id !== id));
  };

  const openEditTemplate = (template: CrmMessageTemplate) => {
    setEditingTemplate(template);
    setTemplateForm({
      channel: template.channel,
      name: template.name,
      subject: template.subject || '',
      body: template.body,
      is_active: template.is_active,
    });
    setTemplateDialogOpen(true);
  };

  const handlePreview = () => {
    const content = templateForm.channel === 'email'
      ? `Subject: ${generatePreview(templateForm.subject)}\n\n${generatePreview(templateForm.body)}`
      : generatePreview(templateForm.body);
    setPreviewContent(content);
    setPreviewOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Communications Settings</h1>
        <p className="text-muted-foreground">
          Configure email and SMS providers, and manage message templates.
        </p>
      </div>

      <Tabs defaultValue="providers">
        <TabsList>
          <TabsTrigger value="providers">Providers</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        {/* Providers Tab */}
        <TabsContent value="providers" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Message Providers</CardTitle>
                <CardDescription>
                  Configure SendGrid for email and Twilio for SMS.
                </CardDescription>
              </div>
              <Dialog open={providerDialogOpen} onOpenChange={setProviderDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => {
                    setEditingProvider(null);
                    setProviderForm({ type: 'sendgrid', name: '', from_email: '', from_name: '', from_phone: '', is_default: false });
                  }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Provider
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingProvider ? 'Edit' : 'Add'} Provider</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Provider Type</Label>
                      <Select
                        value={providerForm.type}
                        onValueChange={(v) => setProviderForm({ ...providerForm, type: v as 'sendgrid' | 'twilio' })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sendgrid">SendGrid (Email)</SelectItem>
                          <SelectItem value="twilio">Twilio (SMS)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input
                        value={providerForm.name}
                        onChange={(e) => setProviderForm({ ...providerForm, name: e.target.value })}
                        placeholder="e.g., Production Email"
                      />
                    </div>
                    {providerForm.type === 'sendgrid' && (
                      <>
                        <div className="space-y-2">
                          <Label>From Email</Label>
                          <Input
                            type="email"
                            value={providerForm.from_email}
                            onChange={(e) => setProviderForm({ ...providerForm, from_email: e.target.value })}
                            placeholder="noreply@yourcompany.com"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>From Name</Label>
                          <Input
                            value={providerForm.from_name}
                            onChange={(e) => setProviderForm({ ...providerForm, from_name: e.target.value })}
                            placeholder="Your Company"
                          />
                        </div>
                      </>
                    )}
                    {providerForm.type === 'twilio' && (
                      <div className="space-y-2">
                        <Label>From Phone Number</Label>
                        <Input
                          value={providerForm.from_phone}
                          onChange={(e) => setProviderForm({ ...providerForm, from_phone: e.target.value })}
                          placeholder="+15551234567"
                        />
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={providerForm.is_default}
                        onCheckedChange={(checked) => setProviderForm({ ...providerForm, is_default: checked })}
                      />
                      <Label>Set as default</Label>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setProviderDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleSaveProvider}>Save</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>Default</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {providers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No providers configured
                      </TableCell>
                    </TableRow>
                  ) : (
                    providers.map((provider) => (
                      <TableRow key={provider.id}>
                        <TableCell className="font-medium">{provider.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="flex items-center gap-1 w-fit">
                            {provider.type === 'sendgrid' ? <Mail className="h-3 w-3" /> : <MessageSquare className="h-3 w-3" />}
                            {provider.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {provider.config.from_email || provider.config.from_phone || '-'}
                        </TableCell>
                        <TableCell>
                          {provider.is_default ? <Check className="h-4 w-4 text-green-500" /> : <X className="h-4 w-4 text-muted-foreground" />}
                        </TableCell>
                        <TableCell>
                          <Badge variant={provider.is_enabled ? 'default' : 'secondary'}>
                            {provider.is_enabled ? 'Enabled' : 'Disabled'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEditProvider(provider)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteProvider(provider.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>API Configuration</CardTitle>
              <CardDescription>
                API keys must be set as environment variables on the server.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm"><code>SENDGRID_API_KEY</code> - Your SendGrid API key</p>
              <p className="text-sm"><code>TWILIO_ACCOUNT_SID</code> - Your Twilio Account SID</p>
              <p className="text-sm"><code>TWILIO_AUTH_TOKEN</code> - Your Twilio Auth Token</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Message Templates</CardTitle>
                <CardDescription>
                  Create reusable templates with merge fields.
                </CardDescription>
              </div>
              <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => {
                    setEditingTemplate(null);
                    setTemplateForm({ channel: 'email', name: '', subject: '', body: '', is_active: true });
                  }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Template
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[700px]">
                  <DialogHeader>
                    <DialogTitle>{editingTemplate ? 'Edit' : 'Add'} Template</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Channel</Label>
                        <Select
                          value={templateForm.channel}
                          onValueChange={(v) => setTemplateForm({ ...templateForm, channel: v as 'email' | 'sms' })}
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
                        <Label>Template Name</Label>
                        <Input
                          value={templateForm.name}
                          onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                          placeholder="e.g., Welcome Email"
                        />
                      </div>
                    </div>
                    {templateForm.channel === 'email' && (
                      <div className="space-y-2">
                        <Label>Subject</Label>
                        <Input
                          value={templateForm.subject}
                          onChange={(e) => setTemplateForm({ ...templateForm, subject: e.target.value })}
                          placeholder="Hello {{data.first_name}}!"
                        />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>Body</Label>
                      <Textarea
                        value={templateForm.body}
                        onChange={(e) => setTemplateForm({ ...templateForm, body: e.target.value })}
                        placeholder="Dear {{data.first_name}},&#10;&#10;..."
                        rows={8}
                      />
                      <p className="text-xs text-muted-foreground">
                        Available merge fields: {'{{data.first_name}}'}, {'{{data.last_name}}'}, {'{{data.email}}'}, {'{{owner.name}}'}, {'{{system.date}}'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={templateForm.is_active}
                        onCheckedChange={(checked) => setTemplateForm({ ...templateForm, is_active: checked })}
                      />
                      <Label>Active</Label>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={handlePreview}>
                      <Eye className="h-4 w-4 mr-2" />
                      Preview
                    </Button>
                    <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleSaveTemplate}>Save</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No templates created
                      </TableCell>
                    </TableRow>
                  ) : (
                    templates.map((template) => (
                      <TableRow key={template.id}>
                        <TableCell className="font-medium">{template.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="flex items-center gap-1 w-fit">
                            {template.channel === 'email' ? <Mail className="h-3 w-3" /> : <MessageSquare className="h-3 w-3" />}
                            {template.channel}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {template.subject || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={template.is_active ? 'default' : 'secondary'}>
                            {template.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEditTemplate(template)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteTemplate(template.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Template Preview</DialogTitle>
            <DialogDescription>Preview with sample data</DialogDescription>
          </DialogHeader>
          <pre className="whitespace-pre-wrap bg-muted p-4 rounded-lg text-sm max-h-[400px] overflow-auto">
            {previewContent}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
