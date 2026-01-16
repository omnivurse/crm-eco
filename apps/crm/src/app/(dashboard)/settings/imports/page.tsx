import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle, Button } from '@crm-eco/ui';
import { Upload, FileSpreadsheet, Wand2, ArrowRight } from 'lucide-react';
import { getRoleQueryContext } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
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
      {/* Import Wizard Banner */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Wand2 className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Import Wizard</h3>
                <p className="text-sm text-slate-600">
                  Use our guided import wizard with field mapping, validation preview, and rollback support.
                  Perfect for migrating data from Zoho CRM or other systems.
                </p>
              </div>
            </div>
            <Link href="/settings/imports/wizard">
              <Button className="gap-2">
                Start Wizard
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
      
      {/* Quick Import Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-slate-400" />
            Quick Import
          </CardTitle>
          <p className="text-sm text-slate-500 mt-1">
            Simple import with automatic field matching. For more control, use the Import Wizard above.
          </p>
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

