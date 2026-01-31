'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';

// Lazy load the EmailEditor component to reduce initial bundle size
// Tiptap and its extensions add ~200KB to the bundle
const EmailEditor = dynamic(
  () => import('./EmailEditor').then((mod) => mod.EmailEditor),
  {
    loading: () => (
      <div className="flex items-center justify-center p-8 min-h-[300px] bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
        <div className="flex flex-col items-center gap-2 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="text-sm">Loading editor...</span>
        </div>
      </div>
    ),
    ssr: false, // Tiptap requires browser APIs
  }
);

interface LazyEmailEditorProps {
  content?: string;
  onChange?: (html: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: number;
  showSourceToggle?: boolean;
  previewData?: Record<string, string>;
  onImageUpload?: () => void;
  editable?: boolean;
}

export function LazyEmailEditor(props: LazyEmailEditorProps) {
  return <EmailEditor {...props} />;
}

export default LazyEmailEditor;
