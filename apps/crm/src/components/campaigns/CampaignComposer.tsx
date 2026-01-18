'use client';

import { useState, useCallback } from 'react';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@crm-eco/ui/components/popover';
import { cn } from '@crm-eco/ui/lib/utils';
import {
  Bold,
  Italic,
  Underline,
  Link as LinkIcon,
  List,
  ListOrdered,
  Image,
  Code,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Braces,
  Eye,
  Undo,
  Redo,
  Plus,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface MergeField {
  key: string;
  label: string;
  example: string;
}

interface CampaignComposerProps {
  subject: string;
  bodyHtml: string;
  onSubjectChange: (subject: string) => void;
  onBodyChange: (html: string) => void;
  className?: string;
}

// ============================================================================
// Merge Fields
// ============================================================================

const MERGE_FIELDS: MergeField[] = [
  { key: 'first_name', label: 'First Name', example: 'John' },
  { key: 'last_name', label: 'Last Name', example: 'Doe' },
  { key: 'full_name', label: 'Full Name', example: 'John Doe' },
  { key: 'email', label: 'Email', example: 'john@example.com' },
  { key: 'company', label: 'Company', example: 'Acme Inc' },
  { key: 'title', label: 'Job Title', example: 'CEO' },
  { key: 'phone', label: 'Phone', example: '+1 555-0123' },
  { key: 'city', label: 'City', example: 'New York' },
  { key: 'state', label: 'State', example: 'NY' },
  { key: 'unsubscribe_link', label: 'Unsubscribe Link', example: '[Unsubscribe]' },
];

// ============================================================================
// Toolbar Button
// ============================================================================

function ToolbarButton({
  icon,
  title,
  onClick,
  active,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  onClick: () => void;
  active?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        'p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors',
        active && 'bg-slate-100 dark:bg-slate-800 text-teal-600 dark:text-teal-400',
        className
      )}
    >
      {icon}
    </button>
  );
}

// ============================================================================
// Merge Field Selector
// ============================================================================

function MergeFieldSelector({ onSelect }: { onSelect: (field: MergeField) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Insert Merge Field"
          className="flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium
            text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-500/10 transition-colors"
        >
          <Braces className="w-4 h-4" />
          Merge Fields
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        <div className="text-xs font-medium text-slate-500 dark:text-slate-400 px-2 py-1 mb-1">
          Personalization Fields
        </div>
        <div className="space-y-0.5">
          {MERGE_FIELDS.map((field) => (
            <button
              key={field.key}
              type="button"
              onClick={() => onSelect(field)}
              className="w-full flex items-center justify-between px-2 py-1.5 rounded text-sm
                hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
            >
              <span className="text-slate-700 dark:text-slate-300">{field.label}</span>
              <code className="text-xs text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-500/10 px-1.5 py-0.5 rounded">
                {`{{${field.key}}}`}
              </code>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function CampaignComposer({
  subject,
  bodyHtml,
  onSubjectChange,
  onBodyChange,
  className,
}: CampaignComposerProps) {
  const [isPreview, setIsPreview] = useState(false);

  const insertMergeField = useCallback((field: MergeField, target: 'subject' | 'body') => {
    const mergeTag = `{{${field.key}}}`;
    if (target === 'subject') {
      onSubjectChange(subject + mergeTag);
    } else {
      onBodyChange(bodyHtml + mergeTag);
    }
  }, [subject, bodyHtml, onSubjectChange, onBodyChange]);

  const execCommand = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
  }, []);

  const handleContentChange = useCallback((e: React.FormEvent<HTMLDivElement>) => {
    onBodyChange(e.currentTarget.innerHTML);
  }, [onBodyChange]);

  const getPreviewContent = (content: string): string => {
    let preview = content;
    MERGE_FIELDS.forEach((field) => {
      const regex = new RegExp(`\\{\\{${field.key}\\}\\}`, 'g');
      preview = preview.replace(regex, `<span class="text-teal-600 dark:text-teal-400 font-medium">${field.example}</span>`);
    });
    return preview;
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Subject Line */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="subject">Subject Line</Label>
          <MergeFieldSelector onSelect={(field) => insertMergeField(field, 'subject')} />
        </div>
        <Input
          id="subject"
          value={subject}
          onChange={(e) => onSubjectChange(e.target.value)}
          placeholder="Enter your email subject..."
          className="text-base"
        />
        {isPreview && subject && (
          <div
            className="text-sm text-slate-600 dark:text-slate-400 px-3 py-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg"
            dangerouslySetInnerHTML={{ __html: `Preview: ${getPreviewContent(subject)}` }}
          />
        )}
      </div>

      {/* Email Body */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Email Body</Label>
          <div className="flex items-center gap-2">
            <MergeFieldSelector onSelect={(field) => insertMergeField(field, 'body')} />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsPreview(!isPreview)}
              className={cn(
                'h-7 px-2 text-xs',
                isPreview && 'bg-slate-100 dark:bg-slate-800'
              )}
            >
              <Eye className="w-3.5 h-3.5 mr-1" />
              {isPreview ? 'Edit' : 'Preview'}
            </Button>
          </div>
        </div>

        {/* Toolbar */}
        {!isPreview && (
          <div className="flex items-center gap-0.5 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-t-lg border border-b-0 border-slate-200 dark:border-slate-700">
            <ToolbarButton
              icon={<Bold className="w-4 h-4" />}
              title="Bold"
              onClick={() => execCommand('bold')}
            />
            <ToolbarButton
              icon={<Italic className="w-4 h-4" />}
              title="Italic"
              onClick={() => execCommand('italic')}
            />
            <ToolbarButton
              icon={<Underline className="w-4 h-4" />}
              title="Underline"
              onClick={() => execCommand('underline')}
            />

            <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />

            <ToolbarButton
              icon={<List className="w-4 h-4" />}
              title="Bullet List"
              onClick={() => execCommand('insertUnorderedList')}
            />
            <ToolbarButton
              icon={<ListOrdered className="w-4 h-4" />}
              title="Numbered List"
              onClick={() => execCommand('insertOrderedList')}
            />

            <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />

            <ToolbarButton
              icon={<AlignLeft className="w-4 h-4" />}
              title="Align Left"
              onClick={() => execCommand('justifyLeft')}
            />
            <ToolbarButton
              icon={<AlignCenter className="w-4 h-4" />}
              title="Align Center"
              onClick={() => execCommand('justifyCenter')}
            />
            <ToolbarButton
              icon={<AlignRight className="w-4 h-4" />}
              title="Align Right"
              onClick={() => execCommand('justifyRight')}
            />

            <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />

            <ToolbarButton
              icon={<LinkIcon className="w-4 h-4" />}
              title="Insert Link"
              onClick={() => {
                const url = prompt('Enter URL:');
                if (url) execCommand('createLink', url);
              }}
            />

            <div className="flex-1" />

            <Select defaultValue="paragraph">
              <SelectTrigger className="h-7 w-32 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="paragraph">Paragraph</SelectItem>
                <SelectItem value="h1">Heading 1</SelectItem>
                <SelectItem value="h2">Heading 2</SelectItem>
                <SelectItem value="h3">Heading 3</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Editor / Preview */}
        {isPreview ? (
          <div
            className="min-h-[300px] p-4 border border-slate-200 dark:border-slate-700 rounded-lg
              bg-white dark:bg-slate-900/50 prose dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: getPreviewContent(bodyHtml) || '<p class="text-slate-400">No content yet...</p>' }}
          />
        ) : (
          <div
            contentEditable
            onInput={handleContentChange}
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
            className={cn(
              'min-h-[300px] p-4 border border-slate-200 dark:border-slate-700 rounded-b-lg',
              'bg-white dark:bg-slate-900/50 outline-none focus:ring-2 focus:ring-teal-500/20',
              'prose dark:prose-invert max-w-none',
              '[&[contenteditable]]:focus:outline-none'
            )}
            placeholder="Start typing your email content..."
          />
        )}
      </div>

      {/* Tips */}
      <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-500/10 rounded-lg text-sm">
        <div className="text-blue-600 dark:text-blue-400 font-medium">Tip:</div>
        <div className="text-blue-700 dark:text-blue-300">
          Use merge fields like <code className="text-xs bg-blue-100 dark:bg-blue-500/20 px-1 py-0.5 rounded">{`{{first_name}}`}</code> to
          personalize your emails. They will be replaced with actual recipient data when sent.
        </div>
      </div>
    </div>
  );
}
