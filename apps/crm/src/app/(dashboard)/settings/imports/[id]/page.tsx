import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle, Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Button } from '@crm-eco/ui';
import { FileSpreadsheet, ArrowLeft, CheckCircle, XCircle, RefreshCw, AlertCircle, RotateCcw, Shield, AlertTriangle, ExternalLink } from 'lucide-react';
import { getRoleQueryContext } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { RollbackButton } from './rollback-button';

interface ImportDetailPageProps {
  params: Promise<{ id: string }>;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  processing: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
};

const rollbackStatusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  in_progress: 'bg-blue-100 text-blue-700',
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
  pending: <AlertCircle className="w-4 h-4 text-yellow-600" />,
  inserted: <CheckCircle className="w-4 h-4 text-green-600" />,
  updated: <RefreshCw className="w-4 h-4 text-blue-600" />,
  skipped: <AlertCircle className="w-4 h-4 text-slate-500" />,
  error: <XCircle className="w-4 h-4 text-red-600" />,
};

const entityTypeLabels: Record<string, string> = {
  member: 'Members',
  advisor: 'Advisors',
  lead: 'Leads',
  plan: 'Plans',
  membership: 'Memberships',
};

const entityPathMap: Record<string, string> = {
  member: 'members',
  advisor: 'advisors',
  lead: 'leads',
  plan: 'settings/plans',
  membership: 'memberships',
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
    validation_errors: Array<{ field: string; message: string }> | null;
    warnings: Array<{ field: string; message: string }> | null;
    match_type: string | null;
  }
  const { data: rowsData, error: rowsError } = await supabase
    .from('import_job_rows')
    .select('*')
    .eq('import_job_id', id)
    .order('row_index', { ascending: true })
    .limit(200);
  const rows = rowsData as ImportRow[] | null;
  
  if (rowsError) {
    console.error('Error fetching import rows:', rowsError);
  }
  
  // Fetch snapshot count for rollback info
  const { count: snapshotCount } = await supabase
    .from('import_snapshots')
    .select('*', { count: 'exact', head: true })
    .eq('import_job_id', id)
    .eq('is_rolled_back', false);
  
  const canRollback = job.can_rollback && !job.rollback_status && (snapshotCount || 0) > 0;

  // Group rows by status for filtering
  const errorRows = rows?.filter(r => r.status === 'error') || [];
  const insertedRows = rows?.filter(r => r.status === 'inserted') || [];
  const updatedRows = rows?.filter(r => r.status === 'updated') || [];
  const skippedRows = rows?.filter(r => r.status === 'skipped') || [];

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
            <div className="flex items-center gap-2">
              {job.rollback_status && (
                <Badge
                  variant="secondary"
                  className={rollbackStatusColors[job.rollback_status] || 'bg-slate-100 text-slate-700'}
                >
                  Rollback: {job.rollback_status}
                </Badge>
              )}
              <Badge
                variant="secondary"
                className={statusColors[job.status] || 'bg-slate-100 text-slate-700'}
              >
                {job.status}
              </Badge>
            </div>
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
          
          {/* Additional Info */}
          <div className="mt-4 pt-4 border-t grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-slate-500">Duplicate Strategy</p>
              <p className="font-medium capitalize">{job.duplicate_strategy || 'update'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Incremental</p>
              <p className="font-medium">{job.is_incremental ? 'Yes' : 'No'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Started</p>
              <p className="font-medium">
                {job.started_at ? format(new Date(job.started_at), 'h:mm:ss a') : '—'}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Completed</p>
              <p className="font-medium">
                {job.completed_at ? format(new Date(job.completed_at), 'h:mm:ss a') : '—'}
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
      
      {/* Rollback Section */}
      {job.status === 'completed' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-slate-400" />
              Rollback Protection
            </CardTitle>
          </CardHeader>
          <CardContent>
            {canRollback ? (
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-emerald-50 rounded-lg">
                    <Shield className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">Rollback Available</p>
                    <p className="text-sm text-slate-500 mt-1">
                      {snapshotCount} change{snapshotCount !== 1 ? 's' : ''} can be reverted. 
                      This will restore all modified records to their previous state and delete any newly inserted records.
                    </p>
                  </div>
                </div>
                <RollbackButton importJobId={id} snapshotCount={snapshotCount || 0} />
              </div>
            ) : job.rollback_status === 'completed' ? (
              <div className="flex items-center gap-3 text-emerald-700 bg-emerald-50 p-4 rounded-lg">
                <CheckCircle className="w-5 h-5" />
                <div>
                  <p className="font-medium">Rollback Completed</p>
                  <p className="text-sm">
                    This import was rolled back on {job.rollback_at ? format(new Date(job.rollback_at), 'MMM d, yyyy h:mm a') : 'Unknown date'}
                  </p>
                </div>
              </div>
            ) : job.rollback_status === 'failed' ? (
              <div className="flex items-center gap-3 text-red-700 bg-red-50 p-4 rounded-lg">
                <XCircle className="w-5 h-5" />
                <div>
                  <p className="font-medium">Rollback Failed</p>
                  <p className="text-sm">The rollback process encountered errors. Some changes may not have been reverted.</p>
                </div>
              </div>
            ) : job.rollback_status === 'in_progress' ? (
              <div className="flex items-center gap-3 text-blue-700 bg-blue-50 p-4 rounded-lg">
                <RefreshCw className="w-5 h-5 animate-spin" />
                <div>
                  <p className="font-medium">Rollback In Progress</p>
                  <p className="text-sm">Changes are being reverted. Please wait...</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-slate-500 bg-slate-50 p-4 rounded-lg">
                <AlertCircle className="w-5 h-5" />
                <div>
                  <p className="font-medium">Rollback Not Available</p>
                  <p className="text-sm">No snapshots were recorded for this import.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      
      {/* Error Summary */}
      {errorRows.length > 0 && (
        <Card className="border-red-200">
          <CardHeader className="bg-red-50">
            <CardTitle className="flex items-center gap-2 text-red-800">
              <XCircle className="w-5 h-5" />
              Error Details ({errorRows.length} rows)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[300px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Row</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {errorRows.slice(0, 50).map((row) => {
                    const normalized = row.normalized_data as Record<string, string> | null;
                    const name = normalized 
                      ? `${normalized.first_name || ''} ${normalized.last_name || ''}`.trim() 
                      : '—';
                    const email = normalized?.email || '—';
                    
                    return (
                      <TableRow key={row.id} className="bg-red-50/50">
                        <TableCell className="font-mono text-sm">
                          #{row.row_index}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{name || '—'}</p>
                            <p className="text-xs text-slate-500">{email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm text-red-600">{row.error_message}</p>
                          {row.validation_errors && Array.isArray(row.validation_errors) && row.validation_errors.length > 0 && (
                            <div className="mt-1 space-y-1">
                              {row.validation_errors.map((err, i) => (
                                <p key={i} className="text-xs text-red-500">
                                  {err.field}: {err.message}
                                </p>
                              ))}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {errorRows.length > 50 && (
                <p className="text-sm text-slate-500 text-center py-3 bg-red-50">
                  Showing first 50 of {errorRows.length} errors
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Import Rows */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>All Row Results</span>
            <div className="flex items-center gap-2 text-sm font-normal">
              <Badge variant="secondary" className="bg-green-100 text-green-700">
                {insertedRows.length} inserted
              </Badge>
              <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                {updatedRows.length} updated
              </Badge>
              <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                {skippedRows.length} skipped
              </Badge>
            </div>
          </CardTitle>
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
                    <TableHead className="w-28">Status</TableHead>
                    <TableHead className="w-24">Match</TableHead>
                    <TableHead>Name/Email</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.filter(r => r.status !== 'error').slice(0, 100).map((row) => {
                    const normalized = row.normalized_data as Record<string, string> | null;
                    const name = normalized 
                      ? `${normalized.first_name || ''} ${normalized.last_name || ''}`.trim() 
                      : '—';
                    const email = normalized?.email || '—';
                    const entityPath = entityPathMap[job.entity_type] || job.entity_type;
                    
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
                          <span className="text-xs text-slate-500 capitalize">
                            {row.match_type?.replace('_', ' ') || '—'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{name}</p>
                            <p className="text-xs text-slate-500">{email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {row.entity_id ? (
                            <Link 
                              href={`/${entityPath}/${row.entity_id}`}
                              className="text-blue-600 hover:underline text-sm inline-flex items-center gap-1"
                            >
                              View
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          ) : '—'}
                        </TableCell>
                        <TableCell className="text-sm text-slate-500">
                          {row.warnings && Array.isArray(row.warnings) && row.warnings.length > 0 && (
                            <span className="text-amber-600 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              {row.warnings.length} warning(s)
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              
              {(rows?.filter(r => r.status !== 'error').length || 0) > 100 && (
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
