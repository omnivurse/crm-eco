'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Upload,
  FileText,
  Image,
  File,
  X,
  Check,
  Loader2,
  ArrowLeft,
  FolderOpen,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
import { Textarea } from '@crm-eco/ui/components/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import { toast } from 'sonner';
import { createBrowserClient } from '@supabase/ssr';

interface UploadFile {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'complete' | 'error';
  error?: string;
}

const FILE_CATEGORIES = [
  { value: 'contract', label: 'Contract' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'receipt', label: 'Receipt' },
  { value: 'id_document', label: 'ID Document' },
  { value: 'medical', label: 'Medical Document' },
  { value: 'insurance', label: 'Insurance Document' },
  { value: 'other', label: 'Other' },
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
];

export default function DocumentUploadPage() {
  const router = useRouter();
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [category, setCategory] = useState('other');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return `File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'File type not supported';
    }
    return null;
  };

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles);
    const uploadFiles: UploadFile[] = fileArray.map((file) => ({
      file,
      progress: 0,
      status: 'pending' as const,
      error: validateFile(file) || undefined,
    }));
    setFiles((prev) => [...prev, ...uploadFiles]);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        addFiles(e.target.files);
      }
    },
    [addFiles]
  );

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <Image className="w-5 h-5" />;
    if (mimeType === 'application/pdf') return <FileText className="w-5 h-5" />;
    return <File className="w-5 h-5" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const uploadFiles = async () => {
    const validFiles = files.filter((f) => f.status === 'pending' && !f.error);
    if (validFiles.length === 0) {
      toast.error('No valid files to upload');
      return;
    }

    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Please sign in to upload files');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (!profile) {
        toast.error('Profile not found');
        return;
      }

      for (let i = 0; i < files.length; i++) {
        const uploadFile = files[i];
        if (uploadFile.status !== 'pending' || uploadFile.error) continue;

        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === i ? { ...f, status: 'uploading' as const, progress: 10 } : f
          )
        );

        try {
          const fileExt = uploadFile.file.name.split('.').pop();
          const fileName = `${profile.organization_id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

          // Upload to Supabase Storage
          const { error: uploadError } = await supabase.storage
            .from('crm-attachments')
            .upload(fileName, uploadFile.file);

          if (uploadError) throw uploadError;

          setFiles((prev) =>
            prev.map((f, idx) => (idx === i ? { ...f, progress: 60 } : f))
          );

          // Create attachment record
          const { error: dbError } = await supabase.from('crm_attachments').insert({
            org_id: profile.organization_id,
            file_name: uploadFile.file.name,
            file_path: fileName,
            file_size: uploadFile.file.size,
            mime_type: uploadFile.file.type,
            storage_bucket: 'crm-attachments',
            description: description || null,
            meta: { category },
            created_by: user.id,
          });

          if (dbError) throw dbError;

          setFiles((prev) =>
            prev.map((f, idx) =>
              idx === i ? { ...f, status: 'complete' as const, progress: 100 } : f
            )
          );
        } catch (error) {
          console.error('Upload error:', error);
          setFiles((prev) =>
            prev.map((f, idx) =>
              idx === i
                ? { ...f, status: 'error' as const, error: 'Upload failed' }
                : f
            )
          );
        }
      }

      const successCount = files.filter((f) => f.status === 'complete').length;
      if (successCount > 0) {
        toast.success(`${successCount} file(s) uploaded successfully`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload files');
    } finally {
      setUploading(false);
    }
  };

  const completedCount = files.filter((f) => f.status === 'complete').length;
  const pendingCount = files.filter((f) => f.status === 'pending' && !f.error).length;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/crm/documents">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Upload Documents
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            Upload files to your document library
          </p>
        </div>
      </div>

      {/* Upload Zone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-all ${
          dragActive
            ? 'border-teal-500 bg-teal-50 dark:bg-teal-500/10'
            : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600'
        }`}
      >
        <input
          type="file"
          multiple
          onChange={handleFileInput}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          accept={ALLOWED_TYPES.join(',')}
        />
        <div className="flex flex-col items-center gap-4">
          <div className="p-4 rounded-full bg-teal-100 dark:bg-teal-500/20">
            <Upload className="w-8 h-8 text-teal-600 dark:text-teal-400" />
          </div>
          <div>
            <p className="text-lg font-medium text-slate-900 dark:text-white">
              Drop files here or click to upload
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              PDF, Images, Word, Excel, CSV (max 50MB each)
            </p>
          </div>
        </div>
      </div>

      {/* File Options */}
      {files.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FILE_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description..."
            />
          </div>
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-200 dark:divide-slate-700">
          {files.map((uploadFile, index) => (
            <div
              key={index}
              className="flex items-center gap-4 p-4"
            >
              <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                {getFileIcon(uploadFile.file.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                  {uploadFile.file.name}
                </p>
                <p className="text-xs text-slate-500">
                  {formatFileSize(uploadFile.file.size)}
                </p>
                {uploadFile.status === 'uploading' && (
                  <div className="mt-2 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-teal-500 transition-all"
                      style={{ width: `${uploadFile.progress}%` }}
                    />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {uploadFile.error && (
                  <span className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {uploadFile.error}
                  </span>
                )}
                {uploadFile.status === 'complete' && (
                  <Check className="w-5 h-5 text-green-500" />
                )}
                {uploadFile.status === 'uploading' && (
                  <Loader2 className="w-5 h-5 text-teal-500 animate-spin" />
                )}
                {uploadFile.status === 'pending' && (
                  <button
                    onClick={() => removeFile(index)}
                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                  >
                    <X className="w-4 h-4 text-slate-400" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      {files.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            {completedCount > 0 && `${completedCount} uploaded`}
            {completedCount > 0 && pendingCount > 0 && ', '}
            {pendingCount > 0 && `${pendingCount} ready to upload`}
          </p>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => setFiles([])}
              disabled={uploading}
            >
              Clear All
            </Button>
            <Button
              onClick={uploadFiles}
              disabled={uploading || pendingCount === 0}
              className="bg-gradient-to-r from-teal-500 to-emerald-500"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload {pendingCount} File{pendingCount !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
