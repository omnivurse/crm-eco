'use client';

import { Editor } from '@tiptap/react';
import { cn } from '@crm-eco/ui/lib/utils';
import { Button } from '@crm-eco/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@crm-eco/ui/components/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@crm-eco/ui/components/popover';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Link,
  Image,
  Table,
  Undo,
  Redo,
  Code,
  Quote,
  Minus,
  ChevronDown,
  Palette,
  Highlighter,
  Type,
  Heading1,
  Heading2,
  Heading3,
  Pilcrow,
  Sparkles,
} from 'lucide-react';
import { useState, useCallback } from 'react';
import {
  MERGE_FIELDS,
  MERGE_FIELD_CATEGORIES,
  MergeFieldCategory,
  COLOR_PRESETS,
} from './types';

interface EmailToolbarProps {
  editor: Editor | null;
  onImageUpload?: () => void;
}

export function EmailToolbar({ editor, onImageUpload }: EmailToolbarProps) {
  const [linkUrl, setLinkUrl] = useState('');
  const [showLinkInput, setShowLinkInput] = useState(false);

  if (!editor) {
    return null;
  }

  const ToolbarButton = ({
    onClick,
    isActive,
    disabled,
    children,
    title,
  }: {
    onClick: () => void;
    isActive?: boolean;
    disabled?: boolean;
    children: React.ReactNode;
    title?: string;
  }) => (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        'h-8 w-8 rounded',
        isActive && 'bg-slate-200 dark:bg-slate-700 text-teal-600 dark:text-teal-400'
      )}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </Button>
  );

  const ToolbarDivider = () => (
    <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />
  );

  const setLink = useCallback(() => {
    if (linkUrl) {
      editor
        .chain()
        .focus()
        .extendMarkRange('link')
        .setLink({ href: linkUrl })
        .run();
    } else {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    }
    setShowLinkInput(false);
    setLinkUrl('');
  }, [editor, linkUrl]);

  const insertMergeField = (fieldKey: string, label: string) => {
    editor.chain().focus().insertMergeField(fieldKey, label).run();
  };

  const groupedMergeFields = MERGE_FIELDS.reduce((acc, field) => {
    if (!acc[field.category]) {
      acc[field.category] = [];
    }
    acc[field.category].push(field);
    return acc;
  }, {} as Record<MergeFieldCategory, typeof MERGE_FIELDS>);

  return (
    <div className="flex flex-wrap items-center gap-0.5 p-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 rounded-t-lg">
      {/* Undo/Redo */}
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Undo (Ctrl+Z)"
      >
        <Undo className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Redo (Ctrl+Y)"
      >
        <Redo className="w-4 h-4" />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Text Style Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 gap-1"
          >
            <Type className="w-4 h-4" />
            <span className="text-xs">Style</span>
            <ChevronDown className="w-3 h-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-40">
          <DropdownMenuItem
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={cn(editor.isActive('heading', { level: 1 }) && 'bg-slate-100 dark:bg-slate-800')}
          >
            <Heading1 className="w-4 h-4 mr-2" />
            Heading 1
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={cn(editor.isActive('heading', { level: 2 }) && 'bg-slate-100 dark:bg-slate-800')}
          >
            <Heading2 className="w-4 h-4 mr-2" />
            Heading 2
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={cn(editor.isActive('heading', { level: 3 }) && 'bg-slate-100 dark:bg-slate-800')}
          >
            <Heading3 className="w-4 h-4 mr-2" />
            Heading 3
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => editor.chain().focus().setParagraph().run()}
            className={cn(editor.isActive('paragraph') && 'bg-slate-100 dark:bg-slate-800')}
          >
            <Pilcrow className="w-4 h-4 mr-2" />
            Paragraph
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ToolbarDivider />

      {/* Basic Formatting */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
        title="Bold (Ctrl+B)"
      >
        <Bold className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
        title="Italic (Ctrl+I)"
      >
        <Italic className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive('underline')}
        title="Underline (Ctrl+U)"
      >
        <Underline className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive('strike')}
        title="Strikethrough"
      >
        <Strikethrough className="w-4 h-4" />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Lists */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive('bulletList')}
        title="Bullet List"
      >
        <List className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive('orderedList')}
        title="Numbered List"
      >
        <ListOrdered className="w-4 h-4" />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Alignment */}
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        isActive={editor.isActive({ textAlign: 'left' })}
        title="Align Left"
      >
        <AlignLeft className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        isActive={editor.isActive({ textAlign: 'center' })}
        title="Align Center"
      >
        <AlignCenter className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        isActive={editor.isActive({ textAlign: 'right' })}
        title="Align Right"
      >
        <AlignRight className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('justify').run()}
        isActive={editor.isActive({ textAlign: 'justify' })}
        title="Justify"
      >
        <AlignJustify className="w-4 h-4" />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Text Color */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded"
            title="Text Color"
          >
            <Palette className="w-4 h-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start">
          <div className="grid grid-cols-4 gap-1">
            {COLOR_PRESETS.map((color) => (
              <button
                key={color}
                type="button"
                className="w-6 h-6 rounded border border-slate-200 dark:border-slate-700 hover:scale-110 transition-transform"
                style={{ backgroundColor: color }}
                onClick={() => editor.chain().focus().setColor(color).run()}
                title={color}
              />
            ))}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full mt-2 text-xs"
            onClick={() => editor.chain().focus().unsetColor().run()}
          >
            Remove Color
          </Button>
        </PopoverContent>
      </Popover>

      {/* Highlight */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded"
            title="Highlight"
          >
            <Highlighter className="w-4 h-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start">
          <div className="grid grid-cols-4 gap-1">
            {['#FEF08A', '#BBF7D0', '#BAE6FD', '#DDD6FE', '#FECACA', '#FED7AA', '#E5E7EB', '#FFFFFF'].map((color) => (
              <button
                key={color}
                type="button"
                className="w-6 h-6 rounded border border-slate-200 dark:border-slate-700 hover:scale-110 transition-transform"
                style={{ backgroundColor: color }}
                onClick={() => editor.chain().focus().toggleHighlight({ color }).run()}
                title={color}
              />
            ))}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full mt-2 text-xs"
            onClick={() => editor.chain().focus().unsetHighlight().run()}
          >
            Remove Highlight
          </Button>
        </PopoverContent>
      </Popover>

      <ToolbarDivider />

      {/* Link */}
      <Popover open={showLinkInput} onOpenChange={setShowLinkInput}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              'h-8 w-8 rounded',
              editor.isActive('link') && 'bg-slate-200 dark:bg-slate-700 text-teal-600 dark:text-teal-400'
            )}
            title="Insert Link"
          >
            <Link className="w-4 h-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-3" align="start">
          <div className="space-y-2">
            <label className="text-sm font-medium">URL</label>
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full px-3 py-2 text-sm border rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  setLink();
                }
              }}
            />
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={setLink} className="flex-1">
                {editor.isActive('link') ? 'Update Link' : 'Insert Link'}
              </Button>
              {editor.isActive('link') && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    editor.chain().focus().unsetLink().run();
                    setShowLinkInput(false);
                  }}
                >
                  Remove
                </Button>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Image */}
      <ToolbarButton
        onClick={() => onImageUpload?.()}
        title="Insert Image"
      >
        <Image className="w-4 h-4" />
      </ToolbarButton>

      {/* Table */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded"
            title="Insert Table"
          >
            <Table className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem
            onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
          >
            Insert 3x3 Table
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => editor.chain().focus().insertTable({ rows: 4, cols: 4, withHeaderRow: true }).run()}
          >
            Insert 4x4 Table
          </DropdownMenuItem>
          {editor.isActive('table') && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => editor.chain().focus().addColumnAfter().run()}>
                Add Column
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => editor.chain().focus().addRowAfter().run()}>
                Add Row
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => editor.chain().focus().deleteColumn().run()}>
                Delete Column
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => editor.chain().focus().deleteRow().run()}>
                Delete Row
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => editor.chain().focus().deleteTable().run()}
                className="text-red-600"
              >
                Delete Table
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ToolbarDivider />

      {/* More Options */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive('blockquote')}
        title="Blockquote"
      >
        <Quote className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Horizontal Rule"
      >
        <Minus className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        isActive={editor.isActive('codeBlock')}
        title="Code Block"
      >
        <Code className="w-4 h-4" />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Merge Fields */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 px-3 gap-1 bg-teal-50 dark:bg-teal-500/10 border-teal-200 dark:border-teal-500/30 text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-500/20"
          >
            <Sparkles className="w-4 h-4" />
            <span className="text-xs">Merge Fields</span>
            <ChevronDown className="w-3 h-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 max-h-80 overflow-y-auto">
          {(Object.keys(groupedMergeFields) as MergeFieldCategory[]).map((category) => (
            <DropdownMenuSub key={category}>
              <DropdownMenuSubTrigger>
                {MERGE_FIELD_CATEGORIES[category]}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-48">
                {groupedMergeFields[category].map((field) => (
                  <DropdownMenuItem
                    key={field.key}
                    onClick={() => insertMergeField(field.key, field.label)}
                  >
                    <div className="flex flex-col">
                      <span className="text-sm">{field.label}</span>
                      <span className="text-xs text-slate-500">{`{{${field.key}}}`}</span>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export default EmailToolbar;
