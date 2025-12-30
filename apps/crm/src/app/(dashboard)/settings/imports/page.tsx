import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@crm-eco/ui';
import { Upload, FileSpreadsheet } from 'lucide-react';
import { getRoleQueryContext } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { ImportForm } from './import-form';
import { RecentImportsTable } from './recent-imports-table';

export default async function ImportsPage() {
  const context = await getRoleQueryContext();
  
  if (!context || !['owner', 'admin'].includes(context.role)) {
    redirect('/dashboard');
  }
  
  const supabase = await createServerSupabaseClient();
  
  // Fetch recent import jobs
  const { data: importJobs, error } = await supabase
    .from('import_jobs')
    .select('*')
    .eq('organization_id', context.organizationId)
    .order('created_at', { ascending: false })
    .limit(20);
  
  if (error) {
    console.error('Error fetching import jobs:', error);
  }
  
  return (
    <div className="space-y-6">
      {/* Import Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-slate-400" />
            New Import
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ImportForm />
        </CardContent>
      </Card>
      
      {/* Recent Imports */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-slate-400" />
            Recent Imports
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RecentImportsTable imports={importJobs || []} />
        </CardContent>
      </Card>
    </div>
  );
}

