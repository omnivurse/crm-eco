'use client';

import { useState, useEffect, useMemo } from 'react';
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';
import Link from 'next/link';
import {
  MessageSquare,
  Plus,
  Search,
  Edit,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Clock,
  Mail,
  Phone,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';

interface AutoResponse {
  id: string;
  name: string;
  trigger: string;
  channel: 'email' | 'sms' | 'both';
  message: string;
  delay_minutes: number;
  is_active: boolean;
  created_at: string;
}

export default function AutoResponsesPage() {
  const [responses, setResponses] = useState<AutoResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Live search with debounce
  const { query: searchQuery, setQuery: setSearchQuery, debouncedQuery } = useDebouncedSearch({ delay: 200 });
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<{
    name: string;
    trigger: string;
    channel: 'email' | 'sms' | 'both';
    message: string;
    delay_minutes: number;
    is_active: boolean;
  }>({
    name: '',
    trigger: 'new_lead',
    channel: 'email',
    message: '',
    delay_minutes: 0,
    is_active: true,
  });

  useEffect(() => {
    // Load from localStorage for now (in production would be API)
    const saved = localStorage.getItem('crm_auto_responses');
    if (saved) {
      setResponses(JSON.parse(saved));
    }
    setLoading(false);
  }, []);

  const saveResponses = (newResponses: AutoResponse[]) => {
    setResponses(newResponses);
    localStorage.setItem('crm_auto_responses', JSON.stringify(newResponses));
  };

  const handleSave = () => {
    if (!formData.name || !formData.message) return;

    if (editingId) {
      const updated = responses.map(r =>
        r.id === editingId ? { ...r, ...formData } : r
      );
      saveResponses(updated);
    } else {
      const newResponse: AutoResponse = {
        id: Date.now().toString(),
        ...formData,
        created_at: new Date().toISOString(),
      };
      saveResponses([...responses, newResponse]);
    }

    setShowForm(false);
    setEditingId(null);
    setFormData({
      name: '',
      trigger: 'new_lead',
      channel: 'email',
      message: '',
      delay_minutes: 0,
      is_active: true,
    });
  };

  const handleEdit = (response: AutoResponse) => {
    setFormData({
      name: response.name,
      trigger: response.trigger,
      channel: response.channel,
      message: response.message,
      delay_minutes: response.delay_minutes,
      is_active: response.is_active,
    });
    setEditingId(response.id);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    if (!confirm('Delete this auto-response?')) return;
    saveResponses(responses.filter(r => r.id !== id));
  };

  const toggleActive = (id: string) => {
    const updated = responses.map(r =>
      r.id === id ? { ...r, is_active: !r.is_active } : r
    );
    saveResponses(updated);
  };

  const filteredResponses = useMemo(() => {
    const searchLower = debouncedQuery.toLowerCase();
    if (!searchLower) return responses;
    return responses.filter(r => r.name.toLowerCase().includes(searchLower));
  }, [responses, debouncedQuery]);

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'email': return <Mail className="w-4 h-4" />;
      case 'sms': return <Phone className="w-4 h-4" />;
      default: return <MessageSquare className="w-4 h-4" />;
    }
  };

  const TRIGGERS = [
    { value: 'new_lead', label: 'New Lead Created' },
    { value: 'new_contact', label: 'New Contact Created' },
    { value: 'form_submission', label: 'Web Form Submission' },
    { value: 'deal_won', label: 'Deal Won' },
    { value: 'deal_lost', label: 'Deal Lost' },
    { value: 'meeting_booked', label: 'Meeting Booked' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/crm/settings/automations"
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5 text-slate-500" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-500/10 rounded-lg">
              <MessageSquare className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Auto-Responses</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Automatic replies for leads and contacts
              </p>
            </div>
          </div>
        </div>
        <Button
          onClick={() => setShowForm(true)}
          className="bg-teal-600 hover:bg-teal-700 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Auto-Response
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search auto-responses..."
          className="pl-10 bg-white dark:bg-slate-900"
        />
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-lg w-full p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              {editingId ? 'Edit' : 'New'} Auto-Response
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Name
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Welcome Email"
                  className="bg-white dark:bg-slate-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Trigger
                </label>
                <select
                  value={formData.trigger}
                  onChange={(e) => setFormData({ ...formData, trigger: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  {TRIGGERS.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Channel
                </label>
                <select
                  value={formData.channel}
                  onChange={(e) => setFormData({ ...formData, channel: e.target.value as 'email' | 'sms' | 'both' })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                  <option value="both">Both</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Delay (minutes)
                </label>
                <Input
                  type="number"
                  value={formData.delay_minutes}
                  onChange={(e) => setFormData({ ...formData, delay_minutes: parseInt(e.target.value) || 0 })}
                  min={0}
                  className="bg-white dark:bg-slate-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Message
                </label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Hi {{first_name}}, thank you for reaching out..."
                  rows={4}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => { setShowForm(false); setEditingId(null); }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  className="bg-teal-600 hover:bg-teal-700 text-white"
                >
                  {editingId ? 'Update' : 'Create'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      <div className="space-y-3">
        {filteredResponses.length === 0 ? (
          <div className="text-center py-12 glass-card border border-slate-200 dark:border-slate-700 rounded-xl">
            <MessageSquare className="w-12 h-12 mx-auto text-slate-400 mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
              No auto-responses yet
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mb-4">
              Create automated replies for your leads and contacts
            </p>
            <Button onClick={() => setShowForm(true)} className="bg-teal-600 hover:bg-teal-700 text-white">
              <Plus className="w-4 h-4 mr-2" />
              Create First Response
            </Button>
          </div>
        ) : (
          filteredResponses.map(response => (
            <div
              key={response.id}
              className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${response.is_active ? 'bg-teal-500/10' : 'bg-slate-500/10'}`}>
                    {getChannelIcon(response.channel)}
                  </div>
                  <div>
                    <h3 className="font-medium text-slate-900 dark:text-white">{response.name}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      Trigger: {TRIGGERS.find(t => t.value === response.trigger)?.label}
                    </p>
                    {response.delay_minutes > 0 && (
                      <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3" />
                        {response.delay_minutes} min delay
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleActive(response.id)}
                    className={`p-1.5 rounded-lg ${response.is_active ? 'text-teal-600' : 'text-slate-400'}`}
                  >
                    {response.is_active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                  </button>
                  <button
                    onClick={() => handleEdit(response)}
                    className="p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(response.id)}
                    className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
