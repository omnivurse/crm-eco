'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Calendar,
  ArrowLeft,
  Save,
  Video,
  Phone,
  MapPin,
  Trash2,
  Loader2,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { toast } from 'sonner';

interface SchedulingLink {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  duration_minutes: number;
  meeting_type: 'video' | 'call' | 'in_person';
  location: string | null;
  availability: Record<string, { start: string; end: string }[]>;
  is_active: boolean;
}

const MEETING_TYPES = [
  { value: 'video', label: 'Video Call', icon: Video, description: 'Zoom, Google Meet, etc.' },
  { value: 'call', label: 'Phone Call', icon: Phone, description: 'Standard phone call' },
  { value: 'in_person', label: 'In Person', icon: MapPin, description: 'Meet at a location' },
];

const DURATION_OPTIONS = [
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 45, label: '45 minutes' },
  { value: 60, label: '1 hour' },
  { value: 90, label: '1.5 hours' },
  { value: 120, label: '2 hours' },
];

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export default function EditSchedulingLinkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState(30);
  const [meetingType, setMeetingType] = useState<'video' | 'call' | 'in_person'>('video');
  const [location, setLocation] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [availability, setAvailability] = useState<Record<string, { start: string; end: string }[]>>({});

  useEffect(() => {
    fetchLink();
  }, [id]);

  async function fetchLink() {
    try {
      const res = await fetch(`/api/scheduling/${id}`);
      if (!res.ok) throw new Error('Not found');
      const link: SchedulingLink = await res.json();
      setName(link.name);
      setSlug(link.slug);
      setDescription(link.description || '');
      setDuration(link.duration_minutes);
      setMeetingType(link.meeting_type);
      setLocation(link.location || '');
      setIsActive(link.is_active);
      setAvailability(link.availability || {});
    } catch (error) {
      console.error('Failed to fetch scheduling link:', error);
      toast.error('Failed to load scheduling link');
      router.push('/crm/scheduling');
    } finally {
      setLoading(false);
    }
  }

  const toggleDay = (day: string) => {
    if (availability[day]) {
      const newAvail = { ...availability };
      delete newAvail[day];
      setAvailability(newAvail);
    } else {
      setAvailability({
        ...availability,
        [day]: [{ start: '09:00', end: '17:00' }],
      });
    }
  };

  const updateDayTime = (day: string, field: 'start' | 'end', value: string) => {
    setAvailability({
      ...availability,
      [day]: [{ ...availability[day][0], [field]: value }],
    });
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Please enter a name');
      return;
    }
    if (!slug.trim()) {
      toast.error('Please enter a URL slug');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/scheduling/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          slug,
          description: description || null,
          duration_minutes: duration,
          meeting_type: meetingType,
          location: location || null,
          availability,
          is_active: isActive,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(typeof error.error === 'string' ? error.error : 'Failed to update');
      }

      toast.success('Scheduling link updated');
      router.push('/crm/scheduling');
    } catch (error) {
      console.error('Failed to update scheduling link:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this scheduling link?')) return;

    try {
      const res = await fetch(`/api/scheduling/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Scheduling link deleted');
      router.push('/crm/scheduling');
    } catch (error) {
      toast.error('Failed to delete scheduling link');
    }
  };

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
            href="/crm/scheduling"
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-500" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-500/10 rounded-lg">
              <Calendar className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Edit Scheduling Link</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Update your booking link settings
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleDelete}
            className="border-red-200 dark:border-red-800 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push('/crm/scheduling')}
            className="border-slate-200 dark:border-slate-700"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-teal-600 hover:bg-teal-700 text-white"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Basic Information
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Link Name *
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., 30 Minute Meeting"
                  className="bg-white dark:bg-slate-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  URL Slug *
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-500 dark:text-slate-400">/book/</span>
                  <Input
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder="30min"
                    className="bg-white dark:bg-slate-900"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Quick sync call..."
                  rows={2}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>
          </div>

          {/* Meeting Type */}
          <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Meeting Type
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {MEETING_TYPES.map((type) => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.value}
                    onClick={() => setMeetingType(type.value as typeof meetingType)}
                    className={`p-4 rounded-lg border text-left transition-all ${
                      meetingType === type.value
                        ? 'border-teal-500 bg-teal-50 dark:bg-teal-500/10'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <Icon className={`w-5 h-5 mb-2 ${
                      meetingType === type.value
                        ? 'text-teal-600 dark:text-teal-400'
                        : 'text-slate-500'
                    }`} />
                    <div className="font-medium text-slate-900 dark:text-white">{type.label}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{type.description}</div>
                  </button>
                );
              })}
            </div>

            {meetingType === 'in_person' && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Location
                </label>
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="123 Main St, City..."
                  className="bg-white dark:bg-slate-900"
                />
              </div>
            )}
          </div>

          {/* Availability */}
          <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Availability
            </h2>
            <div className="space-y-3">
              {DAYS.map((day) => (
                <div key={day} className="flex items-center gap-4">
                  <label className="flex items-center gap-2 w-32">
                    <input
                      type="checkbox"
                      checked={!!availability[day]}
                      onChange={() => toggleDay(day)}
                      className="rounded border-slate-300 dark:border-slate-600 text-teal-600 focus:ring-teal-500"
                    />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300 capitalize">
                      {day}
                    </span>
                  </label>
                  {availability[day] && (
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={availability[day][0].start}
                        onChange={(e) => updateDayTime(day, 'start', e.target.value)}
                        className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-sm"
                      />
                      <span className="text-slate-500">to</span>
                      <input
                        type="time"
                        value={availability[day][0].end}
                        onChange={(e) => updateDayTime(day, 'end', e.target.value)}
                        className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-sm"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Settings</h3>
            <label className="flex items-center gap-2 mb-4">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-600 text-teal-600 focus:ring-teal-500"
              />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Active
              </span>
            </label>
          </div>

          <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Duration</h3>
            <div className="space-y-2">
              {DURATION_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="duration"
                    checked={duration === opt.value}
                    onChange={() => setDuration(opt.value)}
                    className="border-slate-300 dark:border-slate-600 text-teal-600 focus:ring-teal-500"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Booking URL</h3>
            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <code className="text-sm text-slate-600 dark:text-slate-400 break-all">
                /book/{slug}
              </code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
