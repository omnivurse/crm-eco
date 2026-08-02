import { EnvelopeSimple, PencilSimple } from '@phosphor-icons/react/dist/ssr';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { Button } from '@crm-eco/ui/components/button';
import { Badge } from '@crm-eco/ui/components/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@crm-eco/ui/components/card';
import { EntityPageHeader } from '@/components/ui/EntityPageHeader';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PreviewTemplatePage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  // Auth-gate: fail closed if there is no signed-in user.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Org-scoping is enforced by RLS on email_templates (mirrors the edit page).
  const { data: template, error } = await (supabase as any)
    .from('email_templates')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !template) {
    notFound();
  }

  const category: string = template.template_type || 'general';
  const fromName: string | null = template.from_name;
  const fromEmail: string | null = template.from_email;

  return (
    <div className="p-8 space-y-6">
      <EntityPageHeader
        backHref="/communications/templates"
        backLabel="Templates"
        title={template.name}
        subtitle={<span className="font-mono">{template.slug}</span>}
        badges={
          <>
            {template.is_system && (
              <Badge variant="outline" className="text-xs">
                System
              </Badge>
            )}
            <Badge variant={template.is_active ? 'default' : 'outline'}>
              {template.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </>
        }
        primaryAction={
          <Link href={`/communications/templates/${id}`}>
            <Button variant="outline" size="sm">
              <PencilSimple weight="light" className="mr-1.5 h-4 w-4" aria-hidden />
              Edit
            </Button>
          </Link>
        }
      />

      {/* Email envelope metadata */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <EnvelopeSimple weight="light" className="w-4 h-4 text-slate-500" />
            Email Preview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-[80px_1fr] gap-x-4 gap-y-2 text-sm">
            {(fromName || fromEmail) && (
              <>
                <span className="text-slate-500">From</span>
                <span className="text-slate-900">
                  {fromName ? `${fromName} ` : ''}
                  {fromEmail ? `<${fromEmail}>` : ''}
                </span>
              </>
            )}
            <span className="text-slate-500">Subject</span>
            <span className="font-medium text-slate-900">{template.subject}</span>
            <span className="text-slate-500">Category</span>
            <span>
              <Badge variant="secondary" className="capitalize">
                {category}
              </Badge>
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Rendered HTML body in a clean isolated frame */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            Rendered Body
          </div>
          <iframe
            title={`Preview of ${template.name}`}
            sandbox=""
            srcDoc={template.body_html || '<p style="color:#94a3b8;font-family:sans-serif">No HTML body</p>'}
            className="w-full min-h-[600px] bg-white"
          />
        </CardContent>
      </Card>
    </div>
  );
}
