'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import {
  FileText,
  Search,
  Upload,
  Download,
  Trash2,
  MoreHorizontal,
  Eye,
  File,
  FileImage,
  FileSpreadsheet,
  Presentation,
  Grid3X3,
  List,
  Loader2,
  Cloud,
  HardDrive,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';
import { toast } from 'sonner';
import { cn } from '@crm-eco/ui/lib/utils';

// ============================================================================
// Type Definitions
// ============================================================================

interface Document {
  id: string;
  name: string;
  size: number;
  type: string;
  created_at: string;
  updated_at: string;
  metadata?: {
    mimetype?: string;
    lastModified?: string;
  };
}

// ============================================================================
// Components
// ============================================================================

function getFileIcon(type: string) {
  const mimeType = type.toLowerCase();
  if (mimeType.includes('image')) return FileImage;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) return FileSpreadsheet;
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return Presentation;
  if (mimeType.includes('pdf')) return FileText;
  return File;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function DocumentCard({
  doc,
  onDelete,
  onDownload,
  onPreview,
}: {
  doc: Document;
  onDelete: () => void;
  onDownload: () => void;
  onPreview: () => void;
}) {
  const FileIcon = getFileIcon(doc.type);

  return (
    <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-4 hover:border-teal-500/50 transition-all group">
      <div className="flex items-start justify-between mb-3">
        <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
          <FileIcon className="w-6 h-6 text-slate-600 dark:text-slate-400" />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 opacity-0 group-hover:opacity-100 transition-opacity">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={onPreview}>
              <Eye className="w-4 h-4 mr-2" />
              Preview
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDownload}>
              <Download className="w-4 h-4 mr-2" />
              Download
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-red-600">
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <h3 className="font-medium text-slate-900 dark:text-white mb-1 truncate" title={doc.name}>
        {doc.name}
      </h3>

      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>{formatFileSize(doc.size)}</span>
        <span suppressHydrationWarning>{new Date(doc.created_at).toLocaleDateString()}</span>
      </div>
    </div>
  );
}

function DocumentRow({
  doc,
  onDelete,
  onDownload,
  onPreview,
}: {
  doc: Document;
  onDelete: () => void;
  onDownload: () => void;
  onPreview: () => void;
}) {
  const FileIcon = getFileIcon(doc.type);

  return (
    <div className="flex items-center gap-4 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-teal-500/50 transition-all group">
      <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
        <FileIcon className="w-5 h-5 text-slate-600 dark:text-slate-400" />
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-slate-900 dark:text-white truncate">{doc.name}</h3>
      </div>

      <span className="text-sm text-slate-500 w-20 text-right">{formatFileSize(doc.size)}</span>
      <span className="text-sm text-slate-500 w-24 text-right" suppressHydrationWarning>
        {new Date(doc.created_at).toLocaleDateString()}
      </span>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onPreview}
          className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
        >
          <Eye className="w-4 h-4" />
        </button>
        <button
          onClick={onDownload}
          className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
        >
          <Download className="w-4 h-4" />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    teal: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  };

  return (
    <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-4">
      <div className="flex items-center gap-3">
        <div className={cn('p-2.5 rounded-lg', colorClasses[color])}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
          <p className="text-sm text-slate-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default function DocumentsPage() {
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    loadDocuments();
  }, []);

  async function loadDocuments() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (!profile) return;
      setOrganizationId(profile.organization_id);

      // List files from organization's document storage
      const { data, error } = await supabase.storage
        .from('documents')
        .list(`${profile.organization_id}`, {
          limit: 100,
          sortBy: { column: 'created_at', order: 'desc' },
        });

      if (error) {
        console.error('Storage error:', error);
        // Bucket might not exist or be empty
        setDocuments([]);
        return;
      }

      const docs: Document[] = (data || []).map(file => ({
        id: file.id,
        name: file.name,
        size: file.metadata?.size || 0,
        type: file.metadata?.mimetype || 'application/octet-stream',
        created_at: file.created_at,
        updated_at: file.updated_at,
        metadata: file.metadata,
      }));

      setDocuments(docs);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(doc: Document) {
    if (!organizationId) return;
    if (!confirm(`Are you sure you want to delete "${doc.name}"?`)) return;

    try {
      const { error } = await supabase.storage
        .from('documents')
        .remove([`${organizationId}/${doc.name}`]);

      if (error) throw error;
      toast.success('Document deleted successfully');
      await loadDocuments();
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Failed to delete document');
    }
  }

  async function handleDownload(doc: Document) {
    if (!organizationId) return;

    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .download(`${organizationId}/${doc.name}`);

      if (error) throw error;

      // Create download link
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading document:', error);
      toast.error('Failed to download document');
    }
  }

  async function handlePreview(doc: Document) {
    if (!organizationId) return;

    try {
      const { data } = await supabase.storage
        .from('documents')
        .getPublicUrl(`${organizationId}/${doc.name}`);

      if (data?.publicUrl) {
        window.open(data.publicUrl, '_blank');
      } else {
        toast.error('Unable to generate preview URL');
      }
    } catch (error) {
      console.error('Error previewing document:', error);
      toast.error('Failed to preview document');
    }
  }

  // Filter documents
  const filteredDocuments = documents.filter(doc =>
    doc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate stats
  const totalSize = documents.reduce((sum, d) => sum + d.size, 0);
  const imageCount = documents.filter(d => d.type.includes('image')).length;
  const pdfCount = documents.filter(d => d.type.includes('pdf')).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-teal-500/20 to-cyan-500/20 rounded-xl">
            <FileText className="w-6 h-6 text-teal-600 dark:text-teal-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Documents</h1>
            <p className="text-slate-500 dark:text-slate-400">
              Store and organize your proposals, contracts, and files
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/crm/integrations/cloud-storage">
            <Button variant="outline">
              <Cloud className="w-4 h-4 mr-2" />
              Connect Storage
            </Button>
          </Link>
          <Link href="/crm/documents/upload">
            <Button className="bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400">
              <Upload className="w-4 h-4 mr-2" />
              Upload
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Total Documents" value={documents.length} icon={FileText} color="teal" />
        <StatCard label="Total Size" value={formatFileSize(totalSize)} icon={HardDrive} color="blue" />
        <StatCard label="Images" value={imageCount} icon={FileImage} color="violet" />
        <StatCard label="PDFs" value={pdfCount} icon={FileText} color="amber" />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents..."
            className="pl-10"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
          <button
            onClick={() => setViewMode('grid')}
            className={cn(
              'p-2 rounded transition-colors',
              viewMode === 'grid'
                ? 'bg-white dark:bg-slate-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            )}
          >
            <Grid3X3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={cn(
              'p-2 rounded transition-colors',
              viewMode === 'list'
                ? 'bg-white dark:bg-slate-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            )}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Documents Grid/List */}
      {filteredDocuments.length > 0 ? (
        viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredDocuments.map((doc) => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                onDelete={() => handleDelete(doc)}
                onDownload={() => handleDownload(doc)}
                onPreview={() => handlePreview(doc)}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredDocuments.map((doc) => (
              <DocumentRow
                key={doc.id}
                doc={doc}
                onDelete={() => handleDelete(doc)}
                onDownload={() => handleDownload(doc)}
                onPreview={() => handlePreview(doc)}
              />
            ))}
          </div>
        )
      ) : (
        <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-12 text-center">
          <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800 w-fit mx-auto mb-4">
            <FileText className="w-8 h-8 text-slate-400" />
          </div>
          <p className="text-slate-900 dark:text-white font-medium mb-1">
            {searchQuery ? 'No matching documents' : 'No documents yet'}
          </p>
          <p className="text-slate-500 text-sm mb-4">
            {searchQuery
              ? 'Try adjusting your search'
              : 'Upload your first document to get started'
            }
          </p>
          {!searchQuery && (
            <Link href="/crm/documents/upload">
              <Button className="bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400">
                <Upload className="w-4 h-4 mr-2" />
                Upload Document
              </Button>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
