'use client';

/**
 * Lightweight rich notes editor: Bold / Italic / Underline / text color
 * (contenteditable + execCommand — matches existing paste-heavy flow).
 */

import { useCallback, useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import { Bold, Italic, Underline, Palette } from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { cn } from '@crm-eco/ui/lib/utils';
import { SANITIZE_NOTE_HTML_CONFIG } from '@/lib/crm/note-sanitize';

interface NoteToolbarProps {
  editorRef: React.RefObject<HTMLDivElement | null>;
  flushFromEditor: () => void;
}

function NoteFormattingToolbar({ editorRef, flushFromEditor }: NoteToolbarProps) {
  const run = useCallback(
    (commandId: string, cmdValue?: string) => {
      const el = editorRef.current;
      if (!el) return;
      el.focus();
      document.execCommand(commandId, false, cmdValue);
      flushFromEditor();
    },
    [editorRef, flushFromEditor]
  );

  const onPickColor = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const hex = e.target.value;
      if (hex) run('foreColor', hex);
    },
    [run]
  );

  return (
    <div
      className="flex flex-wrap items-center gap-1 pb-2 border-b border-slate-200 dark:border-white/10"
      role="toolbar"
      aria-label="Note formatting"
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 px-2 border-slate-200 dark:border-white/10"
        onMouseDown={(e) => {
          e.preventDefault();
          run('bold');
        }}
        aria-label="Bold"
        title="Bold"
      >
        <Bold className="w-4 h-4" />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 px-2 border-slate-200 dark:border-white/10"
        onMouseDown={(e) => {
          e.preventDefault();
          run('italic');
        }}
        aria-label="Italic"
        title="Italic"
      >
        <Italic className="w-4 h-4" />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 px-2 border-slate-200 dark:border-white/10"
        onMouseDown={(e) => {
          e.preventDefault();
          run('underline');
        }}
        aria-label="Underline"
        title="Underline"
      >
        <Underline className="w-4 h-4" />
      </Button>
      <label
        className="relative inline-flex h-8 items-center rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5"
        title="Text color"
      >
        <Palette className="w-4 h-4 text-slate-600 dark:text-slate-400" />
        <input
          type="color"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          defaultValue="#1e293b"
          aria-label="Text color"
          onMouseDown={(e) => e.preventDefault()}
          onChange={onPickColor}
        />
      </label>
    </div>
  );
}

export interface NoteRichAreaProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

export function NoteRichArea({ value, onChange, placeholder, className }: NoteRichAreaProps) {
  const editorRef = useRef<HTMLDivElement>(null);

  const flushFromEditor = useCallback(() => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  /* Seed + parent-driven resets (open dialog / SSR) without destroying caret while typing */
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (document.activeElement === el) return;
    const next = value ?? '';
    if (el.innerHTML !== next) el.innerHTML = next;
  }, [value]);

  const handleInput = useCallback(() => {
    flushFromEditor();
  }, [flushFromEditor]);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      const clipboardData = e.clipboardData;

      const items = clipboardData.items;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = () => {
              const dataUrl = reader.result as string;
              editorRef.current?.focus();
              document.execCommand(
                'insertHTML',
                false,
                `<img src="${dataUrl}" style="max-width:100%;height:auto;" />`
              );
              flushFromEditor();
            };
            reader.readAsDataURL(file);
            return;
          }
        }
      }

      const html = clipboardData.getData('text/html');
      if (html) {
        const sanitized = DOMPurify.sanitize(html, SANITIZE_NOTE_HTML_CONFIG);
        editorRef.current?.focus();
        document.execCommand('insertHTML', false, sanitized);
      } else {
        const text = clipboardData.getData('text/plain');
        editorRef.current?.focus();
        document.execCommand('insertText', false, text);
      }

      flushFromEditor();
    },
    [flushFromEditor]
  );

  return (
    <div className={cn('flex flex-col', className)}>
      <NoteFormattingToolbar editorRef={editorRef} flushFromEditor={flushFromEditor} />
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={
          placeholder ?? 'Write a note… Use Bold / Italic / Underline / color above.'
        }
        onInput={handleInput}
        onPaste={handlePaste}
        className={cn(
          'flex-1 min-h-[280px] max-h-[60vh] overflow-y-auto resize-y whitespace-pre-wrap break-words rounded-b-lg rounded-t-none border border-t-0 border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/50 p-4 text-sm text-slate-900 dark:text-white leading-relaxed outline-none ring-1 ring-transparent focus:ring-teal-500/30 dark:focus:ring-teal-500/40',
          'focus:border-teal-500/50',
          'prose prose-sm max-w-none dark:prose-invert',
          '[&_table]:border-collapse [&_table]:w-full [&_td]:border [&_td]:border-slate-200 dark:[&_td]:border-slate-700 [&_td]:px-2 [&_td]:py-1 [&_td]:text-sm',
          '[&_th]:border [&_th]:border-slate-200 dark:[&_th]:border-slate-700 [&_th]:px-2 [&_th]:py-1 [&_th]:text-sm [&_th]:font-semibold [&_th]:bg-slate-100 dark:[&_th]:bg-slate-800',
          '[&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-md [&_img]:my-2',
          '[&_b]:font-semibold [&_strong]:font-semibold [&_font]:leading-relaxed',
          'empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400 dark:empty:before:text-slate-500 empty:before:pointer-events-none'
        )}
      />
    </div>
  );
}
