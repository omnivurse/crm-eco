import { notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { EmailTemplateForm } from '@/components/communications/EmailTemplateForm';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditTemplatePage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: template, error } = await (supabase as any)
    .from('email_templates')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !template) {
    notFound();
  }

  return (
    <div className="p-8">
      <EmailTemplateForm template={template} />
    </div>
  );
}
