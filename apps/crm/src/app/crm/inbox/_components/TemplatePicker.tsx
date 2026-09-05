'use client';

import { useState, useEffect, useMemo } from 'react';
import { Search, FileText, Loader2, X } from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';

interface EmailTemplate {
  id: string;
  name: string;
  slug: string;
  category: string;
  subject: string;
  body_html: string;
  body_text: string | null;
  description: string | null;
}

interface TemplatePickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (template: { subject: string; body_html: string }) => void;
  /** Skip the dimming backdrop when the surface behind stays live, like the compose dock. */
  nonModal?: boolean;
}

export function TemplatePicker({ open, onClose, onSelect, nonModal = false }: TemplatePickerProps) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch('/api/comms/templates?active=true');
        if (res.ok) {
          const data = await res.json();
          setTemplates(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error('Failed to load templates:', err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [open]);

  const categories = useMemo(() => {
    const cats = new Set(templates.map(t => t.category));
    return Array.from(cats).sort();
  }, [templates]);

  const filtered = useMemo(() => {
    let result = templates;
    if (selectedCategory) {
      result = result.filter(t => t.category === selectedCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        t => t.name.toLowerCase().includes(q) ||
          t.subject.toLowerCase().includes(q) ||
          (t.description || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [templates, selectedCategory, search]);

  if (!open) return null;

  return (
    <>
      <div
        className={cn('fixed inset-0 z-50', !nonModal && 'bg-black/30')}
        onClick={onClose}
      />
      <div className="fixed inset-y-4 right-4 w-[380px] max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-teal-600" />
            <h3 className="font-semibold text-slate-900 dark:text-white">Email Templates</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search templates..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-slate-900 dark:text-white"
            />
          </div>
        </div>

        {/* Category tabs */}
        {categories.length > 1 && (
          <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 flex gap-1 overflow-x-auto">
            <button
              onClick={() => setSelectedCategory(null)}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap transition-colors',
                selectedCategory === null
                  ? 'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-400'
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              )}
            >
              All
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  'px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap transition-colors capitalize',
                  selectedCategory === cat
                    ? 'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-400'
                    : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Template list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-teal-500" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 px-4">
              <FileText className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p className="text-sm text-slate-500">
                {templates.length === 0 ? 'No templates created yet' : 'No templates match your search'}
              </p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {filtered.map(template => (
                <button
                  key={template.id}
                  onClick={() => {
                    onSelect({
                      subject: template.subject,
                      body_html: template.body_html,
                    });
                    onClose();
                  }}
                  className="w-full text-left p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                        {template.name}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        Subject: {template.subject}
                      </p>
                      {template.description && (
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                          {template.description}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full capitalize flex-shrink-0">
                      {template.category}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
