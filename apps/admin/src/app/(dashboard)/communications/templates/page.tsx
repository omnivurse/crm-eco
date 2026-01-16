'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@crm-eco/lib/supabase/client';
import {
  Plus,
  FileText,
  MoreHorizontal,
  Search,
  Edit,
  Trash2,
  Copy,
  Eye,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Card, CardContent, CardHeader, CardTitle } from '@crm-eco/ui/components/card';
import { Badge } from '@crm-eco/ui/components/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import { toast } from 'sonner';

interface EmailTemplate {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  body_html: string;
  subject: string;
  is_active: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = [
  { value: 'all', label: 'All Categories' },
  { value: 'general', label: 'General' },
  { value: 'enrollment', label: 'Enrollment' },
  { value: 'billing', label: 'Billing' },
  { value: 'welcome', label: 'Welcome' },
  { value: 'notification', label: 'Notification' },
  { value: 'marketing', label: 'Marketing' },
];

export default function EmailTemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<EmailTemplate[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadTemplates();
  }, []);

  useEffect(() => {
    filterTemplates();
  }, [searchQuery, categoryFilter, templates]);

  async function loadTemplates() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single() as { data: { organization_id: string } | null };

    if (!profile) return;

    const { data } = await (supabase as any)
      .from('email_templates')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .order('category')
      .order('name');

    if (data) {
      setTemplates(data);
      setFilteredTemplates(data);
    }

    setLoading(false);
  }

  function filterTemplates() {
    let filtered = [...templates];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.name.toLowerCase().includes(query) ||
        t.slug.toLowerCase().includes(query) ||
        t.subject.toLowerCase().includes(query)
      );
    }

    if (categoryFilter !== 'all') {
      filtered = filtered.filter(t => t.category === categoryFilter);
    }

    setFilteredTemplates(filtered);
  }

  async function duplicateTemplate(template: EmailTemplate) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, organization_id')
      .eq('user_id', user.id)
      .single() as { data: { id: string; organization_id: string } | null };

    if (!profile) return;

    const { error } = await (supabase as any)
      .from('email_templates')
      .insert({
        organization_id: profile.organization_id,
        name: `${template.name} (Copy)`,
        slug: `${template.slug}-copy-${Date.now()}`,
        description: template.description,
        category: template.category,
        subject: template.subject,
        body_html: template.body_html,
        is_active: false,
        is_system: false,
        created_by: profile.id,
      });

    if (error) {
      toast.error('Failed to duplicate template');
    } else {
      toast.success('Template duplicated');
      loadTemplates();
    }
  }

  async function deleteTemplate(template: EmailTemplate) {
    if (template.is_system) {
      toast.error('System templates cannot be deleted');
      return;
    }

    if (!confirm(`Delete template "${template.name}"? This cannot be undone.`)) {
      return;
    }

    const { error } = await (supabase as any)
      .from('email_templates')
      .delete()
      .eq('id', template.id);

    if (error) {
      toast.error('Failed to delete template');
    } else {
      toast.success('Template deleted');
      loadTemplates();
    }
  }

  async function toggleActive(template: EmailTemplate) {
    const { error } = await (supabase as any)
      .from('email_templates')
      .update({ is_active: !template.is_active })
      .eq('id', template.id);

    if (error) {
      toast.error('Failed to update template');
    } else {
      toast.success(template.is_active ? 'Template deactivated' : 'Template activated');
      loadTemplates();
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-1/3"></div>
          <div className="h-64 bg-slate-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Email Templates</h1>
          <p className="text-slate-600 mt-1">
            Create and manage reusable email templates
          </p>
        </div>
        <Link href="/communications/templates/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Create Template
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-48">
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

      {/* Templates Grid */}
      {filteredTemplates.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">No templates found</h3>
            <p className="text-slate-600 mb-6">
              {templates.length === 0
                ? 'Create your first email template to get started.'
                : 'Try adjusting your search or filter.'}
            </p>
            {templates.length === 0 && (
              <Link href="/communications/templates/new">
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Template
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((template) => (
            <Card key={template.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      {template.is_system && (
                        <Badge variant="outline" className="text-xs">System</Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 font-mono">{template.slug}</p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/communications/templates/${template.id}`}>
                          <Edit className="w-4 h-4 mr-2" />
                          Edit
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/communications/templates/${template.id}/preview`}>
                          <Eye className="w-4 h-4 mr-2" />
                          Preview
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => duplicateTemplate(template)}>
                        <Copy className="w-4 h-4 mr-2" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toggleActive(template)}>
                        {template.is_active ? 'Deactivate' : 'Activate'}
                      </DropdownMenuItem>
                      {!template.is_system && (
                        <DropdownMenuItem
                          onClick={() => deleteTemplate(template)}
                          className="text-red-600"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600 mb-3 line-clamp-2">
                  {template.description || 'No description'}
                </p>
                <p className="text-sm font-medium text-slate-900 mb-3 line-clamp-1">
                  Subject: {template.subject}
                </p>
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="capitalize">
                    {template.category}
                  </Badge>
                  <Badge variant={template.is_active ? 'default' : 'outline'}>
                    {template.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
