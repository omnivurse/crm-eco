import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@crm-eco/ui';
import { Layers } from 'lucide-react';
import { getRoleQueryContext } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { PlansTable } from './plans-table';
import { AddPlanDialog } from './add-plan-dialog';

export default async function PlansPage() {
  const context = await getRoleQueryContext();
  
  if (!context || !['owner', 'admin'].includes(context.role)) {
    redirect('/dashboard');
  }
  
  const supabase = await createServerSupabaseClient();
  
  // Fetch plans
  const { data: plans, error } = await supabase
    .from('plans')
    .select('*')
    .eq('organization_id', context.organizationId)
    .order('name', { ascending: true });
  
  if (error) {
    console.error('Error fetching plans:', error);
  }
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-slate-400" />
            Plans
          </CardTitle>
          <AddPlanDialog />
        </CardHeader>
        <CardContent>
          <PlansTable plans={plans || []} />
        </CardContent>
      </Card>
    </div>
  );
}

