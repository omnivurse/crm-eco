'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Plus,
  Search,
  Edit,
  Trash2,
  CheckCircle2,
  Target,
  ListChecks,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface Playbook {
  id: string;
  name: string;
  description: string | null;
  target_modules: string[];
  is_active: boolean;
  content: Array<{
    section: string;
    items: Array<{ type: string; title: string }>;
  }>;
  created_at: string;
}

// ============================================================================
// Main Component
// ============================================================================

export default function PlaybooksPage() {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // Simulated data
    setPlaybooks([
      {
        id: '1',
        name: 'Enterprise Sales Playbook',
        description: 'Complete playbook for enterprise deal cycles',
        target_modules: ['Deals'],
        is_active: true,
        content: [
          { section: 'Discovery', items: [{ type: 'task', title: 'Identify decision makers' }] },
          { section: 'Demo', items: [{ type: 'task', title: 'Schedule product demo' }] },
          { section: 'Proposal', items: [{ type: 'task', title: 'Send proposal' }] },
        ],
        created_at: new Date().toISOString(),
      },
      {
        id: '2',
        name: 'SMB Qualification',
        description: 'Quick qualification process for SMB leads',
        target_modules: ['Leads'],
        is_active: true,
        content: [
          { section: 'Initial Contact', items: [{ type: 'task', title: 'Send intro email' }] },
          { section: 'Qualification', items: [{ type: 'question', title: 'Budget confirmed?' }] },
        ],
        created_at: new Date().toISOString(),
      },
    ]);
    setLoading(false);
  }, []);

  const filteredPlaybooks = playbooks.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getTotalItems = (playbook: Playbook) => {
    return playbook.content.reduce((acc, section) => acc + section.items.length, 0);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-xl">
            <BookOpen className="w-6 h-6 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Playbooks</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Sales playbooks and checklists for deal stages
            </p>
          </div>
        </div>
        <Link
          href="/crm/playbooks/new"
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Playbook
        </Link>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search playbooks..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400"
        />
      </div>

      {/* Playbooks List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          [...Array(2)].map((_, i) => (
            <div key={i} className="h-48 bg-slate-200 dark:bg-slate-800/50 rounded-xl animate-pulse" />
          ))
        ) : filteredPlaybooks.length === 0 ? (
          <div className="col-span-full text-center py-12 glass-card border border-slate-200 dark:border-slate-700 rounded-xl">
            <BookOpen className="w-12 h-12 mx-auto text-slate-400 mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
              No playbooks yet
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mb-4">
              Create playbooks to guide your sales process
            </p>
            <Link
              href="/crm/playbooks/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
            >
              <Plus className="w-4 h-4" />
              Create Playbook
            </Link>
          </div>
        ) : (
          filteredPlaybooks.map((playbook) => (
            <div
              key={playbook.id}
              className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-5"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-lg bg-amber-500/10">
                    <BookOpen className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">{playbook.name}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      {playbook.description}
                    </p>
                  </div>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  playbook.is_active
                    ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}>
                  {playbook.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              
              <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400 mb-4">
                <span className="flex items-center gap-1">
                  <Target className="w-4 h-4" />
                  {playbook.target_modules.join(', ')}
                </span>
                <span className="flex items-center gap-1">
                  <ListChecks className="w-4 h-4" />
                  {getTotalItems(playbook)} items
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  {playbook.content.length} sections
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <Link
                  href={`/crm/playbooks/${playbook.id}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  <Edit className="w-3.5 h-3.5" />
                  Edit
                </Link>
                <button className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
