'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { cn } from '@crm-eco/ui/lib/utils';
import { useEffect, useCallback, useState } from 'react';
import { EmailToolbar } from './EmailToolbar';
import { MergeFieldExtension } from './extensions/MergeFieldExtension';
import { Button } from '@crm-eco/ui/components/button';
import { Code, Eye } from 'lucide-react';
import { replaceMergeFields } from './types';

interface EmailEditorProps {
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

export function EmailEditor({
  content = '',
  onChange,
  placeholder = 'Start typing your email...',
  className,
  minHeight = 300,
  showSourceToggle = true,
  previewData = {},
  onImageUpload,
  editable = true,
}: EmailEditorProps) {
  const [showSource, setShowSource] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [sourceContent, setSourceContent] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'email-image',
        },
        allowBase64: true,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'email-link',
          rel: 'noopener noreferrer',
        },
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({
        multicolor: true,
      }),
      Placeholder.configure({
        placeholder,
      }),
      Typography,
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'email-table',
        },
      }),
      TableRow,
      TableCell,
      TableHeader,
      MergeFieldExtension,
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange?.(html);
      setSourceContent(html);
    },
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm dark:prose-invert max-w-none focus:outline-none',
          'prose-headings:font-semibold prose-headings:text-slate-900 dark:prose-headings:text-white',
          'prose-p:text-slate-700 dark:prose-p:text-slate-300',
          'prose-a:text-teal-600 dark:prose-a:text-teal-400 prose-a:no-underline hover:prose-a:underline',
          'prose-strong:text-slate-900 dark:prose-strong:text-white',
          'prose-blockquote:border-l-teal-500 prose-blockquote:text-slate-600 dark:prose-blockquote:text-slate-400',
          'prose-code:bg-slate-100 dark:prose-code:bg-slate-800 prose-code:px-1 prose-code:rounded',
          '[&_.merge-field-pill]:inline-flex [&_.merge-field-pill]:items-center [&_.merge-field-pill]:px-2 [&_.merge-field-pill]:py-0.5',
          '[&_.merge-field-pill]:bg-teal-100 dark:[&_.merge-field-pill]:bg-teal-500/20',
          '[&_.merge-field-pill]:text-teal-700 dark:[&_.merge-field-pill]:text-teal-300',
          '[&_.merge-field-pill]:rounded-full [&_.merge-field-pill]:text-xs [&_.merge-field-pill]:font-medium',
          '[&_.merge-field-pill]:border [&_.merge-field-pill]:border-teal-200 dark:[&_.merge-field-pill]:border-teal-500/30',
          '[&_table]:border-collapse [&_table]:w-full',
          '[&_th]:border [&_th]:border-slate-300 dark:[&_th]:border-slate-600 [&_th]:bg-slate-100 dark:[&_th]:bg-slate-800 [&_th]:p-2',
          '[&_td]:border [&_td]:border-slate-300 dark:[&_td]:border-slate-600 [&_td]:p-2'
        ),
      },
    },
  });

  // Update editor content when prop changes
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
      setSourceContent(content);
    }
  }, [content, editor]);

  // Handle source code editing
  const handleSourceChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newContent = e.target.value;
      setSourceContent(newContent);
    },
    []
  );

  const applySourceChanges = useCallback(() => {
    if (editor) {
      editor.commands.setContent(sourceContent);
      onChange?.(sourceContent);
    }
    setShowSource(false);
  }, [editor, sourceContent, onChange]);

  // Generate preview content with merge fields replaced
  const getPreviewContent = useCallback(() => {
    if (!editor) return '';
    return replaceMergeFields(editor.getHTML(), previewData);
  }, [editor, previewData]);

  const handleImageUploadClick = useCallback(() => {
    if (onImageUpload) {
      onImageUpload();
    } else {
      // Default image insertion via URL prompt
      const url = window.prompt('Enter image URL:');
      if (url && editor) {
        editor.chain().focus().setImage({ src: url }).run();
      }
    }
  }, [editor, onImageUpload]);

  return (
    <div className={cn('email-editor rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900', className)}>
      {/* Toolbar */}
      {editable && !showSource && !showPreview && (
        <EmailToolbar editor={editor} onImageUpload={handleImageUploadClick} />
      )}

      {/* Mode Toggle Bar */}
      {showSourceToggle && (
        <div className="flex items-center justify-end gap-2 px-3 py-1.5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <Button
            type="button"
            variant={!showSource && !showPreview ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              setShowSource(false);
              setShowPreview(false);
            }}
          >
            Editor
          </Button>
          <Button
            type="button"
            variant={showPreview ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => {
              setShowSource(false);
              setShowPreview(true);
            }}
          >
            <Eye className="w-3 h-3" />
            Preview
          </Button>
          <Button
            type="button"
            variant={showSource ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => {
              setShowPreview(false);
              setShowSource(true);
              setSourceContent(editor?.getHTML() || '');
            }}
          >
            <Code className="w-3 h-3" />
            Source
          </Button>
        </div>
      )}

      {/* Editor Content */}
      <div style={{ minHeight }}>
        {showSource ? (
          <div className="p-3">
            <textarea
              value={sourceContent}
              onChange={handleSourceChange}
              className="w-full font-mono text-sm p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white resize-none"
              style={{ minHeight: minHeight - 50 }}
              spellCheck={false}
            />
            <div className="flex justify-end gap-2 mt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowSource(false);
                  setSourceContent(editor?.getHTML() || '');
                }}
              >
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={applySourceChanges}>
                Apply Changes
              </Button>
            </div>
          </div>
        ) : showPreview ? (
          <div
            className="p-4 prose prose-sm dark:prose-invert max-w-none"
            style={{ minHeight }}
            dangerouslySetInnerHTML={{ __html: getPreviewContent() }}
          />
        ) : (
          <EditorContent
            editor={editor}
            className="p-4"
            style={{ minHeight }}
          />
        )}
      </div>

      {/* Editor Styles */}
      <style jsx global>{`
        .ProseMirror {
          min-height: ${minHeight - 100}px;
        }
        .ProseMirror p.is-editor-empty:first-child::before {
          color: #9ca3af;
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
        .ProseMirror:focus {
          outline: none;
        }
        .ProseMirror img.email-image {
          max-width: 100%;
          height: auto;
          border-radius: 0.5rem;
        }
        .ProseMirror img.ProseMirror-selectednode {
          outline: 2px solid #14b8a6;
          outline-offset: 2px;
        }
        .email-table {
          border-collapse: collapse;
          margin: 1rem 0;
          overflow: hidden;
          table-layout: fixed;
          width: 100%;
        }
        .email-table td,
        .email-table th {
          border: 1px solid #e2e8f0;
          box-sizing: border-box;
          min-width: 1em;
          padding: 0.5rem;
          position: relative;
          vertical-align: top;
        }
        .email-table th {
          background-color: #f1f5f9;
          font-weight: 600;
        }
        .dark .email-table td,
        .dark .email-table th {
          border-color: #475569;
        }
        .dark .email-table th {
          background-color: #1e293b;
        }
        .selectedCell:after {
          background: rgba(20, 184, 166, 0.1);
          content: "";
          left: 0;
          right: 0;
          top: 0;
          bottom: 0;
          pointer-events: none;
          position: absolute;
          z-index: 2;
        }
        .column-resize-handle {
          background-color: #14b8a6;
          bottom: -2px;
          pointer-events: none;
          position: absolute;
          right: -2px;
          top: 0;
          width: 4px;
        }
      `}</style>
    </div>
  );
}

export default EmailEditor;
