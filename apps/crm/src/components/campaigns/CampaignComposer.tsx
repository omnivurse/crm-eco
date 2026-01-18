'use client';

import { useState, useCallback } from 'react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@crm-eco/ui/components/popover';
import { cn } from '@crm-eco/ui/lib/utils';
import { Braces, Eye, Sparkles } from 'lucide-react';
import { EmailEditor } from '@/components/email/EmailEditor';
import {
  MERGE_FIELDS,
  MERGE_FIELD_CATEGORIES,
  MergeFieldCategory,
  getMergeFieldsByCategory,
  replaceMergeFields,
} from '@/components/email/types';

// ============================================================================
// Types
// ============================================================================

interface CampaignComposerProps {
  subject: string;
  bodyHtml: string;
  onSubjectChange: (subject: string) => void;
  onBodyChange: (html: string) => void;
  className?: string;
}

// ============================================================================
// Merge Field Selector (for subject line)
// ============================================================================

function SubjectMergeFieldSelector({ onSelect }: { onSelect: (fieldKey: string) => void }) {
  const groupedFields = MERGE_FIELDS.reduce((acc, field) => {
    if (!acc[field.category]) {
      acc[field.category] = [];
    }
    acc[field.category].push(field);
    return acc;
  }, {} as Record<MergeFieldCategory, typeof MERGE_FIELDS>);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs gap-1 bg-teal-50 dark:bg-teal-500/10 border-teal-200 dark:border-teal-500/30 text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-500/20"
        >
          <Sparkles className="w-3 h-3" />
          Merge Field
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-2 max-h-80 overflow-y-auto">
        <div className="text-xs font-medium text-slate-500 dark:text-slate-400 px-2 py-1 mb-2">
          Insert Personalization Field
        </div>
        {(Object.keys(groupedFields) as MergeFieldCategory[]).map((category) => (
          <div key={category} className="mb-3">
            <div className="text-xs font-semibold text-slate-900 dark:text-white px-2 py-1">
              {MERGE_FIELD_CATEGORIES[category]}
            </div>
            <div className="space-y-0.5">
              {groupedFields[category].map((field) => (
                <button
                  key={field.key}
                  type="button"
                  onClick={() => onSelect(field.key)}
                  className="w-full flex items-center justify-between px-2 py-1.5 rounded text-sm
                    hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
                >
                  <span className="text-slate-700 dark:text-slate-300">{field.label}</span>
                  <code className="text-[10px] text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-500/10 px-1.5 py-0.5 rounded font-mono">
                    {`{{${field.key}}}`}
                  </code>
                </button>
              ))}
            </div>
          </div>
        ))}
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
  const [isPreviewSubject, setIsPreviewSubject] = useState(false);

  // Insert merge field into subject at cursor position or end
  const insertMergeFieldInSubject = useCallback((fieldKey: string) => {
    const mergeTag = `{{${fieldKey}}}`;
    onSubjectChange(subject + mergeTag);
  }, [subject, onSubjectChange]);

  // Preview data for merge field replacement
  const previewData: Record<string, string> = {
    'contact.first_name': 'John',
    'contact.last_name': 'Smith',
    'contact.full_name': 'John Smith',
    'contact.email': 'john@example.com',
    'contact.phone': '(555) 123-4567',
    'contact.title': 'Sales Manager',
    'contact.company': 'Acme Corp',
    'company.name': 'Acme Corporation',
    'company.industry': 'Technology',
    'company.website': 'www.acme.com',
    'company.address': '123 Main St',
    'company.city': 'San Francisco',
    'company.state': 'CA',
    'company.zip': '94102',
    'deal.name': 'Enterprise License',
    'deal.amount': '$50,000',
    'deal.stage': 'Negotiation',
    'deal.close_date': 'March 15, 2026',
    'deal.probability': '75%',
    'owner.name': 'Jane Doe',
    'owner.email': 'jane@company.com',
    'owner.phone': '(555) 987-6543',
    'owner.title': 'Account Executive',
    'system.today': new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    'system.current_year': new Date().getFullYear().toString(),
    'system.unsubscribe_link': '[Unsubscribe]',
    'system.view_in_browser_link': '[View in Browser]',
  };

  // Preview the subject with merge fields replaced
  const getPreviewSubject = (text: string): string => {
    return replaceMergeFields(text, previewData);
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Subject Line */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="subject" className="text-sm font-medium">
            Subject Line
          </Label>
          <div className="flex items-center gap-2">
            <SubjectMergeFieldSelector onSelect={insertMergeFieldInSubject} />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsPreviewSubject(!isPreviewSubject)}
              className={cn(
                'h-7 px-2 text-xs gap-1',
                isPreviewSubject && 'bg-slate-100 dark:bg-slate-800'
              )}
            >
              <Eye className="w-3 h-3" />
              {isPreviewSubject ? 'Edit' : 'Preview'}
            </Button>
          </div>
        </div>
        <Input
          id="subject"
          value={subject}
          onChange={(e) => onSubjectChange(e.target.value)}
          placeholder="Enter your email subject..."
          className="text-base h-11"
        />
        {isPreviewSubject && subject && (
          <div className="flex items-center gap-2 text-sm px-3 py-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
            <span className="text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Preview:</span>
            <span className="text-slate-900 dark:text-white">{getPreviewSubject(subject)}</span>
          </div>
        )}
      </div>

      {/* Email Body with TipTap Editor */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Email Body</Label>
        <EmailEditor
          content={bodyHtml}
          onChange={onBodyChange}
          placeholder="Start typing your email content..."
          minHeight={350}
          showSourceToggle={true}
          previewData={previewData}
        />
      </div>

      {/* Merge Field Tips */}
      <div className="flex items-start gap-3 p-4 bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-500/10 dark:to-emerald-500/10 rounded-xl border border-teal-200/50 dark:border-teal-500/20">
        <div className="p-2 rounded-lg bg-teal-100 dark:bg-teal-500/20">
          <Braces className="w-4 h-4 text-teal-600 dark:text-teal-400" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium text-teal-800 dark:text-teal-300 mb-1">
            Personalize with Merge Fields
          </div>
          <div className="text-sm text-teal-700 dark:text-teal-400">
            Use the <span className="font-medium">Merge Fields</span> button in the toolbar to insert personalization tags like{' '}
            <code className="text-xs bg-teal-100 dark:bg-teal-500/20 px-1.5 py-0.5 rounded font-mono">
              {'{{contact.first_name}}'}
            </code>
            . These will be replaced with actual recipient data when sent.
          </div>
        </div>
      </div>
    </div>
  );
}
