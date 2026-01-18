import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@crm-eco/ui';
import {
  ArrowLeft,
  Building2,
  Upload,
  RefreshCw,
  Settings2,
  Globe,
  Mail,
  Phone,
  User,
  Calendar,
  Clock,
  FileText,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronRight,
  Link as LinkIcon,
  Database,
} from 'lucide-react';
import { getVendorById, getRecentJobs, getRecentChanges, getConnectors } from '../actions';
import { formatDistanceToNow, format } from 'date-fns';

// Status Badge Component
function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { label: string; className: string }> = {
    active: { label: 'Active', className: 'bg-green-100 text-green-700' },
    inactive: { label: 'Inactive', className: 'bg-slate-100 text-slate-600' },
    pending: { label: 'Pending', className: 'bg-amber-100 text-amber-700' },
    suspended: { label: 'Suspended', className: 'bg-red-100 text-red-700' },
    completed: { label: 'Completed', className: 'bg-green-100 text-green-700' },
    processing: { label: 'Processing', className: 'bg-blue-100 text-blue-700' },
    failed: { label: 'Failed', className: 'bg-red-100 text-red-700' },
  };

  const config = statusConfig[status] || { label: status, className: 'bg-slate-100 text-slate-600' };

  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}

// Connection Type Badge
function ConnectionTypeBadge({ type }: { type: string }) {
  const config: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
    manual: { label: 'Manual', icon: <Upload className="w-3 h-3" />, className: 'bg-slate-100 text-slate-600' },
    sftp: { label: 'SFTP', icon: <Database className="w-3 h-3" />, className: 'bg-blue-100 text-blue-600' },
    api: { label: 'API', icon: <LinkIcon className="w-3 h-3" />, className: 'bg-purple-100 text-purple-600' },
    webhook: { label: 'Webhook', icon: <RefreshCw className="w-3 h-3" />, className: 'bg-green-100 text-green-600' },
  };

  const { label, icon, className } = config[type] || config.manual;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${className}`}>
      {icon}
      {label}
    </span>
  );
}

// File Status Icon
function FileStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    case 'processing':
    case 'validating':
      return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
    case 'failed':
      return <XCircle className="w-4 h-4 text-red-500" />;
    case 'pending':
      return <Clock className="w-4 h-4 text-amber-500" />;
    default:
      return <FileText className="w-4 h-4 text-slate-400" />;
  }
}

export default async function VendorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [vendorResult, jobsResult, changesResult, connectorsResult] = await Promise.all([
    getVendorById(id),
    getRecentJobs({ vendorId: id, limit: 10 }),
    getRecentChanges({ vendorId: id, limit: 10 }),
    getConnectors(id),
  ]);

  if (!vendorResult.success || !vendorResult.data) {
    notFound();
  }

  const vendor = vendorResult.data;
  const jobs = jobsResult.data || [];
  const changes = changesResult.data || [];
  const connectors = connectorsResult.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link href="/vendors">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-slate-100 rounded-xl border flex items-center justify-center">
              {vendor.logo_url ? (
                <img src={vendor.logo_url} alt={vendor.name} className="w-8 h-8" />
              ) : (
                <Building2 className="w-7 h-7 text-slate-400" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-900">{vendor.name}</h1>
                <StatusBadge status={vendor.status} />
              </div>
              <p className="text-slate-500 mt-0.5">
                {vendor.vendor_type.replace('_', ' ')} · {vendor.code}
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/vendors/upload?vendor=${vendor.id}`}>
            <Button variant="outline" className="gap-2">
              <Upload className="w-4 h-4" />
              Upload File
            </Button>
          </Link>
          {vendor.sync_enabled && (
            <Button variant="outline" className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Sync Now
            </Button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Sidebar - Vendor Info */}
        <div className="space-y-6">
          {/* Connection Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Connection</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Type</span>
                <ConnectionTypeBadge type={vendor.connection_type} />
              </div>
              {vendor.sync_enabled && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Auto-Sync</span>
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      Enabled
                    </Badge>
                  </div>
                  {vendor.last_sync_at && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-500">Last Sync</span>
                      <span className="text-sm text-slate-700">
                        {formatDistanceToNow(new Date(vendor.last_sync_at), { addSuffix: true })}
                      </span>
                    </div>
                  )}
                  {vendor.last_sync_status && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-500">Status</span>
                      <StatusBadge status={vendor.last_sync_status} />
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Contact Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {vendor.contact_name && (
                <div className="flex items-center gap-3">
                  <User className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-700">{vendor.contact_name}</span>
                </div>
              )}
              {vendor.contact_email && (
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <a href={`mailto:${vendor.contact_email}`} className="text-sm text-blue-600 hover:underline">
                    {vendor.contact_email}
                  </a>
                </div>
              )}
              {vendor.contact_phone && (
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-700">{vendor.contact_phone}</span>
                </div>
              )}
              {vendor.website_url && (
                <div className="flex items-center gap-3">
                  <Globe className="w-4 h-4 text-slate-400" />
                  <a
                    href={vendor.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Visit Website
                  </a>
                </div>
              )}
              {!vendor.contact_name && !vendor.contact_email && !vendor.contact_phone && !vendor.website_url && (
                <p className="text-sm text-slate-400">No contact information</p>
              )}
            </CardContent>
          </Card>

          {/* File Settings */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">File Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Format</span>
                <span className="text-sm text-slate-700 uppercase">{vendor.default_file_format}</span>
              </div>
              {vendor.file_delimiter && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Delimiter</span>
                  <code className="px-2 py-0.5 bg-slate-100 rounded text-xs">{vendor.file_delimiter}</code>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Header Row</span>
                <span className="text-sm text-slate-700">{vendor.has_header_row ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Date Format</span>
                <code className="px-2 py-0.5 bg-slate-100 rounded text-xs">{vendor.date_format}</code>
              </div>
            </CardContent>
          </Card>

          {/* Metadata */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Created</span>
                <span className="text-sm text-slate-700">
                  {format(new Date(vendor.created_at), 'MMM d, yyyy')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Updated</span>
                <span className="text-sm text-slate-700">
                  {formatDistanceToNow(new Date(vendor.updated_at), { addSuffix: true })}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Area */}
        <div className="lg:col-span-3">
          <Tabs defaultValue="files" className="space-y-4">
            <TabsList>
              <TabsTrigger value="files">Files ({jobs.length})</TabsTrigger>
              <TabsTrigger value="changes">Changes ({changes.length})</TabsTrigger>
              <TabsTrigger value="connectors">Connectors ({connectors.length})</TabsTrigger>
            </TabsList>

            {/* Files Tab */}
            <TabsContent value="files">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Uploaded Files</CardTitle>
                    <CardDescription>History of processed vendor files</CardDescription>
                  </div>
                  <Link href={`/vendors/upload?vendor=${vendor.id}`}>
                    <Button size="sm" className="gap-2">
                      <Upload className="w-4 h-4" />
                      Upload New
                    </Button>
                  </Link>
                </CardHeader>
                <CardContent>
                  {jobs.length === 0 ? (
                    <div className="text-center py-12">
                      <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-500 mb-2">No files uploaded yet</p>
                      <Link href={`/vendors/upload?vendor=${vendor.id}`}>
                        <Button variant="outline" size="sm" className="gap-2">
                          <Upload className="w-4 h-4" />
                          Upload Your First File
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {jobs.map((job) => (
                        <div key={job.id} className="py-4 flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <FileStatusIcon status={job.status} />
                            <div>
                              <p className="font-medium text-slate-900">{job.file_name}</p>
                              <p className="text-sm text-slate-500">
                                {job.file_type} · {job.processed_rows}/{job.total_rows} rows
                                {job.error_rows > 0 && (
                                  <span className="text-red-500 ml-2">({job.error_rows} errors)</span>
                                )}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-sm text-slate-400">
                              {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                            </span>
                            <StatusBadge status={job.status} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Changes Tab */}
            <TabsContent value="changes">
              <Card>
                <CardHeader>
                  <CardTitle>Detected Changes</CardTitle>
                  <CardDescription>Changes detected from file processing</CardDescription>
                </CardHeader>
                <CardContent>
                  {changes.length === 0 ? (
                    <div className="text-center py-12">
                      <CheckCircle className="w-12 h-12 text-green-300 mx-auto mb-3" />
                      <p className="text-slate-500">No changes detected</p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {changes.map((change) => (
                        <div key={change.id} className="py-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <span className="font-medium text-slate-900">
                                {change.change_type.replace(/_/g, ' ')}
                              </span>
                              <Badge variant="outline">{change.entity_type}</Badge>
                            </div>
                            <StatusBadge status={change.status} />
                          </div>
                          {change.field_changed && (
                            <p className="text-sm text-slate-600 mb-2">
                              <span className="font-medium">{change.field_changed}:</span>{' '}
                              <span className="text-red-500 line-through">{change.old_value || 'null'}</span>
                              {' → '}
                              <span className="text-green-600">{change.new_value || 'null'}</span>
                            </p>
                          )}
                          <p className="text-xs text-slate-400">
                            Detected {formatDistanceToNow(new Date(change.detected_at), { addSuffix: true })}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Connectors Tab */}
            <TabsContent value="connectors">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Connectors</CardTitle>
                    <CardDescription>Configured data connectors for this vendor</CardDescription>
                  </div>
                  <Link href={`/vendors/connectors/new?vendor=${vendor.id}`}>
                    <Button size="sm" className="gap-2">
                      <Settings2 className="w-4 h-4" />
                      Add Connector
                    </Button>
                  </Link>
                </CardHeader>
                <CardContent>
                  {connectors.length === 0 ? (
                    <div className="text-center py-12">
                      <Settings2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-500 mb-2">No connectors configured</p>
                      <Link href={`/vendors/connectors/new?vendor=${vendor.id}`}>
                        <Button variant="outline" size="sm" className="gap-2">
                          <Settings2 className="w-4 h-4" />
                          Configure First Connector
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {connectors.map((connector) => (
                        <Link
                          key={connector.id}
                          href={`/vendors/connectors/${connector.id}`}
                          className="py-4 flex items-center justify-between hover:bg-slate-50 -mx-6 px-6 transition-colors"
                        >
                          <div>
                            <p className="font-medium text-slate-900">{connector.name}</p>
                            <p className="text-sm text-slate-500">
                              {connector.connector_type.replace(/_/g, ' ')} · {connector.schedule_type}
                            </p>
                          </div>
                          <div className="flex items-center gap-4">
                            <Badge variant={connector.is_active ? 'default' : 'secondary'}>
                              {connector.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                            <ChevronRight className="w-4 h-4 text-slate-400" />
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
