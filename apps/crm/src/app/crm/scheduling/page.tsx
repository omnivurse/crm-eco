'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Plus,
  Copy,
  ExternalLink,
  Settings,
  Clock,
  Video,
  Phone,
  MapPin,
  Users,
  Trash2,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

// ============================================================================
// Types
// ============================================================================

interface SchedulingLink {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  duration_minutes: number;
  meeting_type: 'call' | 'video' | 'in_person';
  is_active: boolean;
  created_at: string;
}

// ============================================================================
// Main Component
// ============================================================================

export default function SchedulingPage() {
  const [links, setLinks] = useState<SchedulingLink[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLinks = useCallback(async () => {
    try {
      const res = await fetch('/api/scheduling');
      if (!res.ok) {
        throw new Error('Failed to fetch');
      }
      const data = await res.json();
      setLinks(data || []);
    } catch (error) {
      console.error('Failed to fetch scheduling links:', error);
      toast.error('Failed to load scheduling links');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this scheduling link?')) return;

    try {
      const res = await fetch(`/api/scheduling/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Scheduling link deleted');
        fetchLinks();
      } else {
        throw new Error('Failed to delete');
      }
    } catch (error) {
      toast.error('Failed to delete scheduling link');
    }
  };

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/book/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copied to clipboard!');
  };

  const getMeetingIcon = (type: string) => {
    switch (type) {
      case 'video': return <Video className="w-4 h-4" />;
      case 'call': return <Phone className="w-4 h-4" />;
      case 'in_person': return <MapPin className="w-4 h-4" />;
      default: return <Calendar className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl">
            <Calendar className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Scheduling</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Manage booking links and appointments
            </p>
          </div>
        </div>
        <Link
          href="/crm/scheduling/new"
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Link
        </Link>
      </div>

      {/* Links Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
          </div>
        ) : links.length === 0 ? (
          <div className="col-span-full text-center py-12 glass-card border border-slate-200 dark:border-slate-700 rounded-xl">
            <Calendar className="w-12 h-12 mx-auto text-slate-400 mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
              No scheduling links yet
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mb-4">
              Create a booking link to let others schedule time with you
            </p>
            <Link
              href="/crm/scheduling/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
            >
              <Plus className="w-4 h-4" />
              Create Link
            </Link>
          </div>
        ) : (
          links.map((link) => (
            <div
              key={link.id}
              className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-5"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-purple-500/10">
                    {getMeetingIcon(link.meeting_type)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">{link.name}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {link.duration_minutes} minutes
                    </p>
                  </div>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  link.is_active
                    ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}>
                  {link.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              
              {link.description && (
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                  {link.description}
                </p>
              )}
              
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-4">
                <span className="font-mono">/book/{link.slug}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => copyLink(link.slug)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copy
                </button>
                <a
                  href={`/book/${link.slug}`}
                  target="_blank"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Preview
                </a>
                <Link
                  href={`/crm/scheduling/${link.id}`}
                  className="p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg ml-auto"
                >
                  <Settings className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
      
      {/* Upcoming Bookings */}
      <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
        <h2 className="font-semibold text-slate-900 dark:text-white mb-4">Upcoming Bookings</h2>
        <div className="text-center py-8 text-slate-500 dark:text-slate-400">
          <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No upcoming bookings</p>
        </div>
      </div>
    </div>
  );
}
