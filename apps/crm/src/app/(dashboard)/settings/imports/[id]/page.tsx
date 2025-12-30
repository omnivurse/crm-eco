import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle, Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@crm-eco/ui';
import { FileSpreadsheet, ArrowLeft, CheckCircle, XCircle, RefreshCw, AlertCircle } from 'lucide-react';
import { getRoleQueryContext } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';

interface ImportDetailPageProps {
  params: Promise<{ id: string }>;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  processing: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
};

const rowStatusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  inserted: 'bg-green-100 text-green-700',
  updated: 'bg-blue-100 text-blue-700',
  skipped: 'bg-slate-100 text-slate-700',
  error: 'bg-red-100 text-red-700',
};

const rowStatusIcons: Record<string, React.ReactNode> = {
  inserted: <CheckCircle className="w-4 h-4 text-green-600" />,
  updated: <RefreshCw className="w-4 h-4 text-blue-600" />,
  skipped: <AlertCircle className="w-4 h-4 text-slate-500" />,
  error: <XCircle className="w-4 h-4 text-red-600" />,
};

const entityTypeLabels: Record<string, string> = {
  member: 'Members',
  advisor: 'Advisors',
  lead: 'Leads',
};

export default async function ImportDetailPage({ params }: ImportDetailPageProps) {
  const { id } = await params;
  const context = await getRoleQueryContext();
  
  if (!context || !['owner', 'admin'].includes(context.role)) {
    redirect('/dashboard');
  }
  
  // Note: Using type assertion due to @supabase/ssr 0.5.x type inference limitations
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createServerSupabaseClient() as any;
  
  // Fetch import job
  const { data: job, error: jobError } = await supabase
    .from('import_jobs')
    .select('*')
    .eq('id', id)
    .eq('organization_id', context.organizationId)
    .single();
  
  if (jobError || !job) {
    notFound();
  }
  
  // Fetch import rows
  interface ImportRow {
    id: string;
    row_index: number;
    status: string;
    error_message: string | null;
    raw_data: Record<string, unknown>;
    normalized_data: Record<string, string> | null;
    entity_id: string | null;
  }
  const { data: rowsData, error: rowsError } = await supabase
    .from('import_job_rows')
    .select('*')
    .eq('import_job_id', id)
    .order('row_index', { ascending: true })
    .limit(100);
  const rows = rowsData as ImportRow[] | null;
  
  if (rowsError) {
    console.error('Error fetching import rows:', rowsError);
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/settings/imports"
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Imports
      </Link>
      
      {/* Job Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-slate-400" />
              Import Job Details
            </span>
            <Badge
              variant="secondary"
              className={statusColors[job.status] || 'bg-slate-100 text-slate-700'}
            >
              {job.status}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-slate-500">Entity Type</p>
              <p className="font-medium">{entityTypeLabels[job.entity_type] || job.entity_type}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Source</p>
              <p className="font-medium">{job.source_name || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">File</p>
              <p className="font-medium truncate">{job.file_name || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Created</p>
              <p className="font-medium">
                {format(new Date(job.created_at), 'MMM d, yyyy h:mm a')}
              </p>
            </div>
          </div>
          
          {/* Summary Stats */}
          <div className="mt-6 pt-6 border-t grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center p-4 bg-slate-50 rounded-lg">
              <p className="text-2xl font-bold text-slate-700">{job.total_rows}</p>
              <p className="text-sm text-slate-500">Total</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{job.inserted_count}</p>
              <p className="text-sm text-green-600">Inserted</p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">{job.updated_count}</p>
              <p className="text-sm text-blue-600">Updated</p>
            </div>
            <div className="text-center p-4 bg-slate-50 rounded-lg">
              <p className="text-2xl font-bold text-slate-500">{job.skipped_count}</p>
              <p className="text-sm text-slate-500">Skipped</p>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <p className="text-2xl font-bold text-red-600">{job.error_count}</p>
              <p className="text-sm text-red-600">Errors</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Import Rows */}
      <Card>
        <CardHeader>
          <CardTitle>Row Results</CardTitle>
        </CardHeader>
        <CardContent>
          {!rows || rows.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <p>No row data available</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Row</TableHead>
                    <TableHead className="w-24">Status</TableHead>
                    <TableHead>Name/Email</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row: any) => {
                    const normalized = row.normalized_data as Record<string, string> | null;
                    const name = normalized 
                      ? `${normalized.first_name || ''} ${normalized.last_name || ''}`.trim() 
                      : '—';
                    const email = normalized?.email || '—';
                    
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="font-mono text-sm">
                          #{row.row_index}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {rowStatusIcons[row.status]}
                            <Badge
                              variant="secondary"
                              className={rowStatusColors[row.status] || 'bg-slate-100'}
                            >
                              {row.status}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{name}</p>
                            <p className="text-sm text-slate-500">{email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-red-600">
                          {row.error_message || '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              
              {rows.length >= 100 && (
                <p className="text-sm text-slate-500 text-center mt-4">
                  Showing first 100 rows
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

