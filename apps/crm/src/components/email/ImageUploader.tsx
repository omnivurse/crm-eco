'use client';

import { useState, useCallback, useRef } from 'react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@crm-eco/ui/components/dialog';
import { cn } from '@crm-eco/ui/lib/utils';
import {
  Upload,
  Image as ImageIcon,
  Link,
  X,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import imageCompression from 'browser-image-compression';

interface ImageUploaderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImageInsert: (url: string, alt?: string) => void;
  uploadEndpoint?: string;
}

interface UploadedImage {
  url: string;
  alt: string;
  width?: number;
  height?: number;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export function ImageUploader({
  open,
  onOpenChange,
  onImageInsert,
  uploadEndpoint = '/api/email/assets',
}: ImageUploaderProps) {
  const [mode, setMode] = useState<'upload' | 'url'>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<UploadedImage | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [altText, setAltText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = useCallback(() => {
    setMode('upload');
    setIsDragging(false);
    setIsUploading(false);
    setUploadProgress(0);
    setError(null);
    setPreviewImage(null);
    setUrlInput('');
    setAltText('');
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onOpenChange(false);
  }, [resetState, onOpenChange]);

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'Please upload a JPEG, PNG, GIF, or WebP image.';
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'File size must be less than 5MB.';
    }
    return null;
  };

  const compressImage = async (file: File): Promise<File> => {
    const options = {
      maxSizeMB: 1,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
    };

    try {
      const compressedFile = await imageCompression(file, options);
      return compressedFile;
    } catch {
      return file;
    }
  };

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      // Validate
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        setIsUploading(false);
        return;
      }

      // Compress if needed
      setUploadProgress(20);
      const processedFile = file.size > 1024 * 1024 ? await compressImage(file) : file;

      // Create form data
      setUploadProgress(40);
      const formData = new FormData();
      formData.append('file', processedFile);
      formData.append('folder', 'email-images');

      // Upload
      setUploadProgress(60);
      const response = await fetch(uploadEndpoint, {
        method: 'POST',
        body: formData,
      });

      setUploadProgress(80);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Upload failed');
      }

      const data = await response.json();
      setUploadProgress(100);

      // Set preview
      setPreviewImage({
        url: data.public_url || data.url,
        alt: altText || file.name.replace(/\.[^/.]+$/, ''),
        width: data.width,
        height: data.height,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

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

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0 && files[0].type.startsWith('image/')) {
      uploadFile(files[0]);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      uploadFile(files[0]);
    }
  }, []);

  const handleUrlSubmit = useCallback(() => {
    if (!urlInput.trim()) {
      setError('Please enter an image URL');
      return;
    }

    // Validate URL
    try {
      new URL(urlInput);
    } catch {
      setError('Please enter a valid URL');
      return;
    }

    setPreviewImage({
      url: urlInput,
      alt: altText || 'Image',
    });
  }, [urlInput, altText]);

  const handleInsert = useCallback(() => {
    if (previewImage) {
      onImageInsert(previewImage.url, previewImage.alt || altText);
      handleClose();
    }
  }, [previewImage, altText, onImageInsert, handleClose]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Insert Image</DialogTitle>
          <DialogDescription>
            Upload an image or enter a URL to insert into your email.
          </DialogDescription>
        </DialogHeader>

        {/* Mode Tabs */}
        <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700 pb-4">
          <Button
            type="button"
            variant={mode === 'upload' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setMode('upload')}
            className="gap-2"
          >
            <Upload className="w-4 h-4" />
            Upload
          </Button>
          <Button
            type="button"
            variant={mode === 'url' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setMode('url')}
            className="gap-2"
          >
            <Link className="w-4 h-4" />
            From URL
          </Button>
        </div>

        <div className="space-y-4">
          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {!previewImage ? (
            <>
              {mode === 'upload' ? (
                /* Upload Zone */
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    'relative flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl cursor-pointer transition-all',
                    isDragging
                      ? 'border-teal-500 bg-teal-50 dark:bg-teal-500/10'
                      : 'border-slate-300 dark:border-slate-700 hover:border-teal-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                  )}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    onChange={handleFileSelect}
                    className="hidden"
                  />

                  {isUploading ? (
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
                      <div className="text-sm text-slate-600 dark:text-slate-400">
                        Uploading... {uploadProgress}%
                      </div>
                      <div className="w-48 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-teal-500 transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
                        <ImageIcon className="w-8 h-8 text-slate-400" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium text-slate-900 dark:text-white mb-1">
                          Drag & drop an image here
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          or click to browse (JPEG, PNG, GIF, WebP up to 5MB)
                        </p>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                /* URL Input */
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="imageUrl">Image URL</Label>
                    <Input
                      id="imageUrl"
                      type="url"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="https://example.com/image.jpg"
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={handleUrlSubmit}
                    className="w-full"
                  >
                    Load Image
                  </Button>
                </div>
              )}
            </>
          ) : (
            /* Preview */
            <div className="space-y-4">
              <div className="relative">
                <img
                  src={previewImage.url}
                  alt={previewImage.alt}
                  className="w-full max-h-64 object-contain rounded-lg border border-slate-200 dark:border-slate-700"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8 bg-white/80 dark:bg-slate-900/80 hover:bg-white dark:hover:bg-slate-900"
                  onClick={() => setPreviewImage(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="altText">Alt Text (for accessibility)</Label>
                <Input
                  id="altText"
                  value={altText || previewImage.alt}
                  onChange={(e) => setAltText(e.target.value)}
                  placeholder="Describe the image..."
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleInsert}
            disabled={!previewImage}
          >
            Insert Image
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ImageUploader;
