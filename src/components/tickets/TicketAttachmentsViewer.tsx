import { useEffect, useState } from 'react';
import { Download, FileIcon, Image as ImageIcon, FileText, AlertCircle, Loader } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { formatFileSize } from '../../lib/fileUpload';

interface TicketFile {
  id: string;
  filename: string;
  storage_path: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
  uploader: {
    full_name: string;
    email: string;
  } | null;
}

interface TicketAttachmentsViewerProps {
  ticketId: string;
}

export function TicketAttachmentsViewer({ ticketId }: TicketAttachmentsViewerProps) {
  const [files, setFiles] = useState<TicketFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);

  useEffect(() => {
    fetchFiles();
  }, [ticketId]);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('ticket_files')
        .select(`
          id,
          filename,
          storage_path,
          file_size,
          mime_type,
          created_at,
          uploader:profiles!ticket_files_uploaded_by_fkey(
            full_name,
            email
          )
        `)
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      const mappedFiles = (data || []).map((file: any) => ({
        ...file,
        uploader: Array.isArray(file.uploader) ? file.uploader[0] : file.uploader
      }));

      setFiles(mappedFiles as TicketFile[]);
    } catch (err: any) {
      console.error('Error fetching ticket files:', err);
      setError(err.message || 'Failed to load attachments');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (file: TicketFile) => {
    try {
      setDownloadingFileId(file.id);

      const { data, error: downloadError } = await supabase.storage
        .from('ticket-attachments')
        .download(file.storage_path);

      if (downloadError) throw downloadError;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Error downloading file:', err);
      alert(`Failed to download file: ${err.message}`);
    } finally {
      setDownloadingFileId(null);
    }
  };

  const getFileIcon = (mimeType: string | null) => {
    if (!mimeType) return <FileIcon size={20} className="text-neutral-500" />;

    if (mimeType.startsWith('image/')) {
      return <ImageIcon size={20} className="text-primary-600" />;
    }
    if (mimeType.includes('pdf')) {
      return <FileText size={20} className="text-red-600" />;
    }
    if (mimeType.includes('word') || mimeType.includes('document')) {
      return <FileText size={20} className="text-primary-800" />;
    }
    if (mimeType.includes('sheet') || mimeType.includes('excel')) {
      return <FileText size={20} className="text-green-600" />;
    }

    return <FileIcon size={20} className="text-neutral-500" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader className="animate-spin text-primary-600" size={24} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
        <div className="flex items-start gap-3">
          <AlertCircle className="text-accent-600 dark:text-red-400 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <h4 className="text-sm font-semibold text-red-800 dark:text-red-200 mb-1">
              Error Loading Attachments
            </h4>
            <p className="text-sm text-accent-700 dark:text-red-300">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="text-center py-8 px-4">
        <FileIcon className="mx-auto text-neutral-400 dark:text-neutral-600 mb-3" size={32} />
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          No attachments on this ticket
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {files.map((file) => (
        <div
          key={file.id}
          className="flex items-center justify-between p-4 bg-gradient-to-br from-neutral-50 to-neutral-100/50 dark:from-neutral-800 dark:to-neutral-700/50 rounded-xl border border-neutral-200/50 dark:border-neutral-600/30 hover:shadow-md transition-all duration-200"
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex-shrink-0">
              {getFileIcon(file.mime_type)}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-neutral-900 dark:text-white truncate">
                {file.filename}
              </p>
              <div className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                {file.file_size && (
                  <>
                    <span>{formatFileSize(file.file_size)}</span>
                    <span>•</span>
                  </>
                )}
                <span>{format(new Date(file.created_at), 'MMM d, yyyy')}</span>
                {file.uploader && (
                  <>
                    <span>•</span>
                    <span className="truncate">
                      by {file.uploader.full_name || file.uploader.email}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={() => handleDownload(file)}
            disabled={downloadingFileId === file.id}
            className="flex-shrink-0 ml-3 flex items-center gap-2 px-4 py-2 bg-primary-800 hover:bg-primary-900 disabled:bg-neutral-400 text-white text-sm font-medium rounded-lg transition-colors disabled:cursor-not-allowed"
          >
            {downloadingFileId === file.id ? (
              <>
                <Loader size={16} className="animate-spin" />
                <span>Downloading...</span>
              </>
            ) : (
              <>
                <Download size={16} />
                <span>Download</span>
              </>
            )}
          </button>
        </div>
      ))}
    </div>
  );
}
