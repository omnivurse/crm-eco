import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: moduleId } = await params;
  
  const supabase = await createClient();
  
  const profile = await getAuthProfile();
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch fields for the module
  const { data: fields, error } = await supabase
    .from('crm_fields')
    .select('*')
    .eq('module_id', moduleId)
    .order('display_order');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ fields });
}
