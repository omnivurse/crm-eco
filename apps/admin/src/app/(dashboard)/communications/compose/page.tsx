'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@crm-eco/lib/supabase/client';
import Link from 'next/link';
import {
  ArrowLeft,
  Send,
  FileText,
  Users,
  Search,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
import { Textarea } from '@crm-eco/ui/components/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@crm-eco/ui/components/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@crm-eco/ui/components/tabs';
import { toast } from 'sonner';

interface EmailTemplate {
  id: string;
  name: string;
  slug: string;
  subject: string;
  body_html: string;
  body_text: string | null;
  variables: { name: string }[];
}

interface Member {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

export default function ComposeEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [sending, setSending] = useState(false);
  const [mode, setMode] = useState<'template' | 'custom'>('template');
  const [memberSearch, setMemberSearch] = useState('');
  
  const [formData, setFormData] = useState({
    templateId: '',
    toEmail: searchParams.get('to') || '',
    toName: '',
    recipientType: 'member' as 'member' | 'advisor' | 'lead' | 'other',
    recipientId: searchParams.get('recipientId') || '',
    subject: '',
    bodyHtml: '',
    bodyText: '',
    variables: {} as Record<string, string>,
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (formData.templateId) {
      const template = templates.find(t => t.id === formData.templateId);
      if (template) {
        setFormData(prev => ({
          ...prev,
          subject: template.subject,
          bodyHtml: template.body_html,
          bodyText: template.body_text || '',
        }));
      }
    }
  }, [formData.templateId, templates]);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single() as { data: { organization_id: string } | null };

    if (!profile) return;

    // Load templates
    const { data: templatesData } = await (supabase as any)
      .from('email_templates')
      .select('id, name, slug, subject, body_html, body_text, variables')
      .eq('organization_id', profile.organization_id)
      .eq('is_active', true)
      .order('name');

    if (templatesData) {
      setTemplates(templatesData);
    }

    // Load some members for quick selection
    const { data: membersData } = await supabase
      .from('members')
      .select('id, first_name, last_name, email')
      .eq('organization_id', profile.organization_id)
      .limit(100);

    if (membersData) {
      setMembers(membersData);
    }
  }

  function selectMember(member: Member) {
    setFormData(prev => ({
      ...prev,
      toEmail: member.email,
      toName: `${member.first_name} ${member.last_name}`,
      recipientType: 'member',
      recipientId: member.id,
      variables: {
        ...prev.variables,
        firstName: member.first_name,
        lastName: member.last_name,
        email: member.email,
      },
    }));
    setMemberSearch('');
  }

  async function handleSend() {
    if (!formData.toEmail) {
      toast.error('Please enter a recipient email');
      return;
    }

    if (mode === 'template' && !formData.templateId) {
      toast.error('Please select a template');
      return;
    }

    if (mode === 'custom' && (!formData.subject || !formData.bodyHtml)) {
      toast.error('Please enter a subject and message');
      return;
    }

    setSending(true);

    try {
      const response = await fetch('/api/communications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: formData.toEmail,
          toName: formData.toName,
          recipientType: formData.recipientType,
          recipientId: formData.recipientId || null,
          templateId: mode === 'template' ? formData.templateId : null,
          subject: mode === 'custom' ? formData.subject : undefined,
          html: mode === 'custom' ? formData.bodyHtml : undefined,
          text: mode === 'custom' ? formData.bodyText : undefined,
          variables: formData.variables,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send email');
      }

      toast.success('Email sent successfully');
      router.push('/communications/history');
    } catch (error) {
      console.error('Send error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to send email');
    } finally {
      setSending(false);
    }
  }

  const filteredMembers = memberSearch
    ? members.filter(m =>
        m.email.toLowerCase().includes(memberSearch.toLowerCase()) ||
        m.first_name.toLowerCase().includes(memberSearch.toLowerCase()) ||
        m.last_name.toLowerCase().includes(memberSearch.toLowerCase())
      ).slice(0, 5)
    : [];

  const selectedTemplate = templates.find(t => t.id === formData.templateId);

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/communications">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Compose Email</h1>
          <p className="text-slate-600">Send an email to a member or contact</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recipient */}
          <Card>
            <CardHeader>
              <CardTitle>Recipient</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Label htmlFor="toEmail">Email Address *</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="toEmail"
                      type="email"
                      value={formData.toEmail}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, toEmail: e.target.value }));
                        setMemberSearch(e.target.value);
                      }}
                      placeholder="recipient@example.com"
                    />
                    {filteredMembers.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg">
                        {filteredMembers.map((member) => (
                          <button
                            key={member.id}
                            type="button"
                            className="w-full px-4 py-2 text-left hover:bg-slate-50"
                            onClick={() => selectMember(member)}
                          >
                            <p className="font-medium">{member.first_name} {member.last_name}</p>
                            <p className="text-sm text-slate-500">{member.email}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="toName">Recipient Name</Label>
                <Input
                  id="toName"
                  value={formData.toName}
                  onChange={(e) => setFormData(prev => ({ ...prev, toName: e.target.value }))}
                  placeholder="John Doe"
                />
              </div>
            </CardContent>
          </Card>

          {/* Email Content */}
          <Card>
            <CardHeader>
              <CardTitle>Email Content</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
                <TabsList className="mb-4">
                  <TabsTrigger value="template">
                    <FileText className="w-4 h-4 mr-2" />
                    Use Template
                  </TabsTrigger>
                  <TabsTrigger value="custom">
                    <Send className="w-4 h-4 mr-2" />
                    Custom Message
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="template" className="space-y-4">
                  <div>
                    <Label>Select Template *</Label>
                    <Select
                      value={formData.templateId}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, templateId: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a template" />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedTemplate && selectedTemplate.variables && selectedTemplate.variables.length > 0 && (
                    <div className="p-4 bg-slate-50 rounded-lg">
                      <p className="text-sm font-medium mb-3">Template Variables</p>
                      <div className="grid grid-cols-2 gap-3">
                        {selectedTemplate.variables.map((v: any) => (
                          <div key={v.name}>
                            <Label className="text-xs">{v.name}</Label>
                            <Input
                              size={1}
                              value={formData.variables[v.name] || ''}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                variables: { ...prev.variables, [v.name]: e.target.value },
                              }))}
                              placeholder={`Enter ${v.name}`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedTemplate && (
                    <div>
                      <Label>Preview Subject</Label>
                      <p className="p-2 bg-slate-50 rounded text-sm">
                        {replaceVars(selectedTemplate.subject, formData.variables)}
                      </p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="custom" className="space-y-4">
                  <div>
                    <Label htmlFor="subject">Subject *</Label>
                    <Input
                      id="subject"
                      value={formData.subject}
                      onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                      placeholder="Email subject"
                    />
                  </div>

                  <div>
                    <Label htmlFor="bodyHtml">Message (HTML) *</Label>
                    <Textarea
                      id="bodyHtml"
                      value={formData.bodyHtml}
                      onChange={(e) => setFormData(prev => ({ ...prev, bodyHtml: e.target.value }))}
                      placeholder="<p>Your message here...</p>"
                      rows={10}
                      className="font-mono text-sm"
                    />
                  </div>

                  <div>
                    <Label htmlFor="bodyText">Plain Text Version (Optional)</Label>
                    <Textarea
                      id="bodyText"
                      value={formData.bodyText}
                      onChange={(e) => setFormData(prev => ({ ...prev, bodyText: e.target.value }))}
                      placeholder="Plain text version for email clients that don't support HTML"
                      rows={5}
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Send Button */}
          <Card>
            <CardContent className="pt-6">
              <Button
                className="w-full"
                size="lg"
                onClick={handleSend}
                disabled={sending}
              >
                <Send className="w-4 h-4 mr-2" />
                {sending ? 'Sending...' : 'Send Email'}
              </Button>
            </CardContent>
          </Card>

          {/* Quick Select Members */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Quick Select
              </CardTitle>
              <CardDescription>
                Select a member to populate their info
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search members..."
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="max-h-64 overflow-y-auto space-y-1">
                {(memberSearch ? filteredMembers : members.slice(0, 10)).map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    className="w-full p-2 text-left rounded hover:bg-slate-50"
                    onClick={() => selectMember(member)}
                  >
                    <p className="font-medium text-sm">{member.first_name} {member.last_name}</p>
                    <p className="text-xs text-slate-500">{member.email}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function replaceVars(text: string, variables: Record<string, string>): string {
  let result = text;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), value || `{{${key}}}`);
  }
  return result;
}
