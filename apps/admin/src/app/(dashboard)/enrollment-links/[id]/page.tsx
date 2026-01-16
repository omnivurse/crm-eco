import { notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { LandingPageForm } from '@/components/enrollment-links/LandingPageForm';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditLandingPagePage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: landingPage, error } = await (supabase as any)
    .from('landing_pages')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !landingPage) {
    notFound();
  }

  return (
    <div className="p-8">
      <LandingPageForm landingPage={landingPage} />
    </div>
  );
}
