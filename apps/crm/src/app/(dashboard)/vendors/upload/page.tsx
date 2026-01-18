'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from '@crm-eco/ui';
import {
  ArrowLeft,
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { createClient } from '@crm-eco/lib/supabase/client';
import { getVendors, createVendorFile } from '../actions';
import type { Vendor } from '@crm-eco/lib/types';

const FILE_TYPES = [
  { value: 'enrollment', label: 'Enrollment' },
  { value: 'pricing', label: 'Pricing' },
  { value: 'roster', label: 'Roster' },
  { value: 'termination', label: 'Termination' },
  { value: 'change', label: 'Change Report' },
  { value: 'other', label: 'Other' },
];

const DUPLICATE_STRATEGIES = [
  { value: 'update', label: 'Update existing records' },
  { value: 'skip', label: 'Skip duplicates' },
  { value: 'error', label: 'Report as errors' },
];

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

export default function VendorUploadPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedVendorId = searchParams.get('vendor');

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loadingVendors, setLoadingVendors] = useState(true);

  const [selectedVendorId, setSelectedVendorId] = useState<string>(preselectedVendorId || '');
  const [fileType, setFileType] = useState<string>('enrollment');
  const [duplicateStrategy, setDuplicateStrategy] = useState<'skip' | 'update' | 'error'>('update');
  const [detectChanges, setDetectChanges] = useState(true);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedFileId, setUploadedFileId] = useState<string | null>(null);

  const [isDragging, setIsDragging] = useState(false);

  // Fetch vendors on mount
  useEffect(() => {
    async function loadVendors() {
      const result = await getVendors({ status: 'active' });
      if (result.success && result.data) {
        setVendors(result.data);
      }
      setLoadingVendors(false);
    }
    loadVendors();
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, []);

  const handleFileSelect = (file: File) => {
    // Validate file type
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/json',
      'text/xml',
      'application/xml',
    ];

    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(csv|xlsx|xls|json|xml)$/i)) {
      setUploadError('Please upload a CSV, Excel, JSON, or XML file');
      return;
    }

    // Validate file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      setUploadError('File size must be less than 50MB');
      return;
    }

    setSelectedFile(file);
    setUploadError(null);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const getFileFormat = (file: File): string => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'csv':
        return 'csv';
      case 'xlsx':
      case 'xls':
        return 'xlsx';
      case 'json':
        return 'json';
      case 'xml':
        return 'xml';
      default:
        return 'csv';
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !selectedVendorId) {
      setUploadError('Please select a vendor and file');
      return;
    }

    setUploadStatus('uploading');
    setUploadError(null);

    try {
      const supabase = createClient();

      // Generate unique file path
      const timestamp = Date.now();
      const safeFileName = selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `vendors/${selectedVendorId}/${timestamp}_${safeFileName}`;

      // Upload to Supabase Storage
      const { error: storageError } = await supabase.storage
        .from('vendor-files')
        .upload(filePath, selectedFile);

      if (storageError) {
        throw new Error(`Storage upload failed: ${storageError.message}`);
      }

      // Create database record
      const result = await createVendorFile({
        vendorId: selectedVendorId,
        fileName: selectedFile.name,
        fileType: fileType as 'enrollment' | 'pricing' | 'roster' | 'termination' | 'change' | 'other',
        fileFormat: getFileFormat(selectedFile),
        fileSizeBytes: selectedFile.size,
        storagePath: filePath,
        duplicateStrategy,
        detectChanges,
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to create file record');
      }

      setUploadedFileId(result.data?.fileId || null);
      setUploadStatus('success');
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Upload failed');
      setUploadStatus('error');
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setUploadStatus('idle');
    setUploadError(null);
    setUploadedFileId(null);
  };

  const selectedVendor = vendors.find((v) => v.id === selectedVendorId);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/vendors">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Upload Vendor File</h1>
          <p className="text-slate-500 mt-0.5">
            Upload enrollment, pricing, or roster files from vendors
          </p>
        </div>
      </div>

      {/* Upload Success */}
      {uploadStatus === 'success' && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="text-center py-4">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-green-800 mb-2">File Uploaded Successfully</h3>
              <p className="text-sm text-green-700 mb-4">
                Your file has been uploaded and is queued for processing.
              </p>
              <div className="flex justify-center gap-3">
                <Button variant="outline" onClick={handleReset}>
                  Upload Another
                </Button>
                <Link href={`/vendors/${selectedVendorId}`}>
                  <Button>View Vendor Files</Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {uploadStatus !== 'success' && (
        <>
          {/* Vendor Selection */}
          <Card>
            <CardHeader>
              <CardTitle>1. Select Vendor</CardTitle>
              <CardDescription>Choose the vendor this file is from</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingVendors ? (
                <div className="flex items-center gap-2 text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading vendors...
                </div>
              ) : vendors.length === 0 ? (
                <div className="text-center py-4">
                  <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                  <p className="text-slate-500">No active vendors available</p>
                  <p className="text-sm text-slate-400">Contact your administrator to add vendors</p>
                </div>
              ) : (
                <Select value={selectedVendorId} onValueChange={setSelectedVendorId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a vendor..." />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map((vendor) => (
                      <SelectItem key={vendor.id} value={vendor.id}>
                        {vendor.name} ({vendor.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </CardContent>
          </Card>

          {/* File Selection */}
          <Card>
            <CardHeader>
              <CardTitle>2. Upload File</CardTitle>
              <CardDescription>Drag and drop or click to select a file</CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                  isDragging
                    ? 'border-blue-400 bg-blue-50'
                    : selectedFile
                    ? 'border-green-400 bg-green-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {selectedFile ? (
                  <div className="space-y-3">
                    <FileText className="w-12 h-12 text-green-500 mx-auto" />
                    <div>
                      <p className="font-medium text-slate-900">{selectedFile.name}</p>
                      <p className="text-sm text-slate-500">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB · {getFileFormat(selectedFile).toUpperCase()}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleReset}>
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Upload className="w-12 h-12 text-slate-300 mx-auto" />
                    <div>
                      <p className="font-medium text-slate-600">
                        Drag and drop your file here
                      </p>
                      <p className="text-sm text-slate-400">or</p>
                    </div>
                    <label>
                      <input
                        type="file"
                        className="hidden"
                        accept=".csv,.xlsx,.xls,.json,.xml"
                        onChange={handleFileInputChange}
                      />
                      <Button variant="outline" size="sm" asChild>
                        <span className="cursor-pointer">Browse Files</span>
                      </Button>
                    </label>
                    <p className="text-xs text-slate-400">
                      Supports CSV, Excel, JSON, XML (max 50MB)
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Upload Options */}
          <Card>
            <CardHeader>
              <CardTitle>3. Configure Options</CardTitle>
              <CardDescription>Set file type and processing options</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>File Type</Label>
                  <Select value={fileType} onValueChange={setFileType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FILE_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Duplicate Handling</Label>
                  <Select value={duplicateStrategy} onValueChange={(v) => setDuplicateStrategy(v as 'skip' | 'update' | 'error')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DUPLICATE_STRATEGIES.map((strategy) => (
                        <SelectItem key={strategy.value} value={strategy.value}>
                          {strategy.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div>
                  <Label htmlFor="detectChanges" className="text-base font-medium">
                    Detect Changes
                  </Label>
                  <p className="text-sm text-slate-500">
                    Compare with existing records and log differences
                  </p>
                </div>
                <Switch
                  id="detectChanges"
                  checked={detectChanges}
                  onCheckedChange={setDetectChanges}
                />
              </div>
            </CardContent>
          </Card>

          {/* Error Display */}
          {uploadError && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-800">Upload Failed</p>
                    <p className="text-sm text-red-700">{uploadError}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Upload Button */}
          <div className="flex justify-end gap-3">
            <Link href="/vendors">
              <Button variant="outline">Cancel</Button>
            </Link>
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || !selectedVendorId || uploadStatus === 'uploading'}
              className="gap-2"
            >
              {uploadStatus === 'uploading' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Upload File
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
