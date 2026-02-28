'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';
import { Input } from '@crm-eco/ui/components/input';
import { Button } from '@crm-eco/ui/components/button';
import { cn } from '@crm-eco/ui/lib/utils';
import {
  Search,
  ChevronRight,
  Clock,
  CheckCircle,
} from 'lucide-react';

interface Article {
  title: string;
  href: string;
  time: string;
}

interface Category {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  articles: Article[];
}

export function LearnSearch({ categories }: { categories: Category[] }) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { query: searchQuery, setQuery: setSearchQuery, debouncedQuery } = useDebouncedSearch({ delay: 200 });

  const filteredCategories = useMemo(() => {
    const searchLower = debouncedQuery.toLowerCase();
    if (!searchLower) return categories;
    return categories.filter(cat => (
      cat.title.toLowerCase().includes(searchLower) ||
      cat.description.toLowerCase().includes(searchLower) ||
      cat.articles.some(a => a.title.toLowerCase().includes(searchLower))
    ));
  }, [debouncedQuery, categories]);

  return (
    <>
      {/* Search Bar */}
      <div className="relative max-w-xl">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <Input
          placeholder="Search tutorials, guides, and features..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-12 h-14 text-lg bg-white/95 dark:bg-slate-900/95 border-0 shadow-xl"
        />
      </div>

      {/* Category Grid — rendered outside the hero by the parent, so we use a portal-like approach */}
      {/* This section is rendered below by LearnCategoryGrid */}
    </>
  );
}

export function LearnCategoryGrid({ categories }: { categories: Category[] }) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { query: searchQuery, setQuery: setSearchQuery, debouncedQuery } = useDebouncedSearch({ delay: 200 });

  const filteredCategories = useMemo(() => {
    const searchLower = debouncedQuery.toLowerCase();
    if (!searchLower) return categories;
    return categories.filter(cat => (
      cat.title.toLowerCase().includes(searchLower) ||
      cat.description.toLowerCase().includes(searchLower) ||
      cat.articles.some(a => a.title.toLowerCase().includes(searchLower))
    ));
  }, [debouncedQuery, categories]);

  return (
    <>
      {/* Search Bar (in hero) */}
      <div className="relative max-w-xl mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <Input
          placeholder="Search tutorials, guides, and features..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-12 h-14 text-lg bg-white/95 dark:bg-slate-900/95 border-0 shadow-xl"
        />
      </div>

      {/* Feature Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {filteredCategories.map((category) => (
          <button
            key={category.id}
            onClick={() => setSelectedCategory(
              selectedCategory === category.id ? null : category.id
            )}
            className={cn(
              'text-left p-5 rounded-2xl border transition-all',
              selectedCategory === category.id
                ? 'bg-teal-50 dark:bg-teal-500/10 border-teal-500'
                : 'bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
            )}
          >
            <div className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center mb-3',
              category.color === 'teal' && 'bg-teal-100 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400',
              category.color === 'blue' && 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400',
              category.color === 'violet' && 'bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400',
              category.color === 'emerald' && 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400',
              category.color === 'amber' && 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400',
              category.color === 'rose' && 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400',
              category.color === 'slate' && 'bg-slate-200 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400',
            )}>
              {category.icon}
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white mb-1">
              {category.title}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {category.articles.length} articles
            </p>
          </button>
        ))}
      </div>

      {/* Selected Category Articles */}
      {selectedCategory && (() => {
        const category = categories.find(c => c.id === selectedCategory);
        if (!category) return null;
        return (
          <div className="mt-6 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center',
                  category.color === 'teal' && 'bg-teal-100 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400',
                  category.color === 'blue' && 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400',
                  category.color === 'violet' && 'bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400',
                  category.color === 'emerald' && 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400',
                  category.color === 'amber' && 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400',
                  category.color === 'rose' && 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400',
                  category.color === 'slate' && 'bg-slate-200 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400',
                )}>
                  {category.icon}
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                    {category.title}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {category.description}
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/crm/learn/${category.id}`}>
                  View All
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Link>
              </Button>
            </div>
            <div className="grid gap-3">
              {category.articles.map((article) => (
                <Link
                  key={article.href}
                  href={article.href}
                  className="flex items-center justify-between p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-slate-300 dark:text-slate-600 group-hover:text-teal-500 transition-colors" />
                    <span className="font-medium text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                      {article.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Clock className="w-4 h-4" />
                    {article.time}
                    <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        );
      })()}
    </>
  );
}
