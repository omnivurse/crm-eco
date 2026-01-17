'use client';

import { useState, useEffect, use, useMemo } from 'react';
import {
  Calendar,
  Clock,
  Video,
  Phone,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Check,
  Loader2,
  User,
  Mail,
  MessageSquare,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';

interface SchedulingLink {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  duration_minutes: number;
  meeting_type: 'video' | 'call' | 'in_person';
  location: string | null;
  availability: Record<string, { start: string; end: string }[]>;
  timezone: string;
  min_notice_hours: number;
  max_days_in_advance: number;
  owner: { full_name: string; avatar_url: string | null };
  organization: { name: string; logo_url: string | null };
}

const DAYS_OF_WEEK = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export default function BookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [link, setLink] = useState<SchedulingLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Booking state
  const [step, setStep] = useState<'date' | 'time' | 'details' | 'confirmed'>('date');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchLink();
  }, [slug]);

  async function fetchLink() {
    try {
      const res = await fetch(`/api/scheduling/public/${slug}`);
      if (!res.ok) {
        throw new Error('Scheduling link not found');
      }
      const data = await res.json();
      setLink(data);
    } catch (err) {
      setError('This scheduling link is not available');
    } finally {
      setLoading(false);
    }
  }

  const availableDates = useMemo(() => {
    if (!link) return new Set<string>();

    const dates = new Set<string>();
    const today = new Date();
    const minDate = new Date(today.getTime() + (link.min_notice_hours * 60 * 60 * 1000));
    const maxDate = new Date(today.getTime() + (link.max_days_in_advance * 24 * 60 * 60 * 1000));

    let current = new Date(minDate);
    while (current <= maxDate) {
      const dayName = DAYS_OF_WEEK[current.getDay()];
      if (link.availability[dayName]) {
        dates.add(current.toISOString().split('T')[0]);
      }
      current.setDate(current.getDate() + 1);
    }

    return dates;
  }, [link]);

  const availableTimes = useMemo(() => {
    if (!link || !selectedDate) return [];

    const dayName = DAYS_OF_WEEK[selectedDate.getDay()];
    const slots = link.availability[dayName];
    if (!slots || slots.length === 0) return [];

    const times: string[] = [];
    const duration = link.duration_minutes;

    slots.forEach(slot => {
      const [startHour, startMin] = slot.start.split(':').map(Number);
      const [endHour, endMin] = slot.end.split(':').map(Number);

      let current = startHour * 60 + startMin;
      const end = endHour * 60 + endMin;

      while (current + duration <= end) {
        const hour = Math.floor(current / 60);
        const min = current % 60;
        times.push(`${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`);
        current += 30; // 30-minute increments
      }
    });

    return times;
  }, [link, selectedDate]);

  const handleSubmit = async () => {
    if (!link || !selectedDate || !selectedTime || !name || !email) return;

    setSubmitting(true);
    try {
      const [hours, minutes] = selectedTime.split(':').map(Number);
      const startTime = new Date(selectedDate);
      startTime.setHours(hours, minutes, 0, 0);

      const res = await fetch('/api/scheduling/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          link_id: link.id,
          invitee_name: name,
          invitee_email: email,
          start_time: startTime.toISOString(),
          notes: notes || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to book');
      }

      setStep('confirmed');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to book meeting');
    } finally {
      setSubmitting(false);
    }
  };

  const getMeetingIcon = () => {
    switch (link?.meeting_type) {
      case 'video': return <Video className="w-5 h-5" />;
      case 'call': return <Phone className="w-5 h-5" />;
      case 'in_person': return <MapPin className="w-5 h-5" />;
      default: return <Calendar className="w-5 h-5" />;
    }
  };

  const renderCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = firstDay.getDay();

    const days: (Date | null)[] = [];
    for (let i = 0; i < startDay; i++) days.push(null);
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCurrentMonth(new Date(year, month - 1, 1))}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
          >
            <ChevronLeft className="w-5 h-5 text-slate-500" />
          </button>
          <h3 className="font-semibold text-slate-900 dark:text-white">
            {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h3>
          <button
            onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
          >
            <ChevronRight className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-sm">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
            <div key={d} className="p-2 font-medium text-slate-500">{d}</div>
          ))}
          {days.map((day, i) => {
            if (!day) return <div key={i} className="p-2" />;

            const dateStr = day.toISOString().split('T')[0];
            const isAvailable = availableDates.has(dateStr);
            const isSelected = selectedDate?.toISOString().split('T')[0] === dateStr;

            return (
              <button
                key={i}
                disabled={!isAvailable}
                onClick={() => {
                  setSelectedDate(day);
                  setSelectedTime(null);
                  setStep('time');
                }}
                className={`p-2 rounded-lg transition-colors ${
                  isSelected
                    ? 'bg-teal-600 text-white'
                    : isAvailable
                    ? 'hover:bg-teal-100 dark:hover:bg-teal-900/20 text-slate-900 dark:text-white'
                    : 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                }`}
              >
                {day.getDate()}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
      </div>
    );
  }

  if (error || !link) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <Calendar className="w-16 h-16 mx-auto text-slate-400 mb-4" />
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            Link Not Found
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            {error || 'This scheduling link is not available'}
          </p>
        </div>
      </div>
    );
  }

  if (step === 'confirmed') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 mx-auto bg-green-100 dark:bg-green-500/20 rounded-full flex items-center justify-center mb-6">
            <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            Booking Confirmed!
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mb-6">
            Your meeting has been scheduled. A confirmation email has been sent to {email}.
          </p>
          <div className="p-4 bg-slate-100 dark:bg-slate-700 rounded-lg text-left">
            <div className="flex items-center gap-3 mb-2">
              <Calendar className="w-5 h-5 text-slate-500" />
              <span className="text-slate-900 dark:text-white font-medium">
                {selectedDate?.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-slate-500" />
              <span className="text-slate-900 dark:text-white font-medium">
                {selectedTime} ({link.duration_minutes} min)
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="grid md:grid-cols-5">
            {/* Left Panel - Info */}
            <div className="md:col-span-2 p-6 bg-slate-50 dark:bg-slate-800/50 border-r border-slate-200 dark:border-slate-700">
              <div className="mb-6">
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                  {link.organization.name}
                </p>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                  {link.owner.full_name}
                </h1>
              </div>

              <div className="space-y-4">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                  {link.name}
                </h2>

                {link.description && (
                  <p className="text-slate-600 dark:text-slate-400">
                    {link.description}
                  </p>
                )}

                <div className="space-y-3 pt-4">
                  <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                    <Clock className="w-5 h-5" />
                    <span>{link.duration_minutes} minutes</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                    {getMeetingIcon()}
                    <span className="capitalize">{link.meeting_type.replace('_', ' ')}</span>
                  </div>
                  {link.location && (
                    <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                      <MapPin className="w-5 h-5" />
                      <span>{link.location}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Panel - Booking */}
            <div className="md:col-span-3 p-6">
              {step === 'date' && (
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                    Select a Date
                  </h3>
                  {renderCalendar()}
                </div>
              )}

              {step === 'time' && selectedDate && (
                <div>
                  <button
                    onClick={() => setStep('date')}
                    className="flex items-center gap-1 text-sm text-teal-600 dark:text-teal-400 mb-4"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Back to calendar
                  </button>

                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                    {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 mb-4">
                    Select a time slot
                  </p>

                  <div className="grid grid-cols-3 gap-2 max-h-80 overflow-y-auto">
                    {availableTimes.map(time => (
                      <button
                        key={time}
                        onClick={() => {
                          setSelectedTime(time);
                          setStep('details');
                        }}
                        className={`p-3 text-sm font-medium rounded-lg border transition-colors ${
                          selectedTime === time
                            ? 'border-teal-500 bg-teal-50 dark:bg-teal-500/10 text-teal-600'
                            : 'border-slate-200 dark:border-slate-700 hover:border-teal-500 text-slate-900 dark:text-white'
                        }`}
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 'details' && selectedDate && selectedTime && (
                <div>
                  <button
                    onClick={() => setStep('time')}
                    className="flex items-center gap-1 text-sm text-teal-600 dark:text-teal-400 mb-4"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Back to times
                  </button>

                  <div className="mb-6 p-4 bg-slate-100 dark:bg-slate-700 rounded-lg">
                    <div className="flex items-center gap-3 mb-2">
                      <Calendar className="w-5 h-5 text-slate-500" />
                      <span className="text-slate-900 dark:text-white font-medium">
                        {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5 text-slate-500" />
                      <span className="text-slate-900 dark:text-white font-medium">
                        {selectedTime} ({link.duration_minutes} min)
                      </span>
                    </div>
                  </div>

                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                    Enter Your Details
                  </h3>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Name *
                      </label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <Input
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Your name"
                          className="pl-10 bg-white dark:bg-slate-900"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Email *
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <Input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@example.com"
                          className="pl-10 bg-white dark:bg-slate-900"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Additional Notes
                      </label>
                      <div className="relative">
                        <MessageSquare className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Any additional information..."
                          rows={3}
                          className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                      </div>
                    </div>

                    <Button
                      onClick={handleSubmit}
                      disabled={submitting || !name || !email}
                      className="w-full bg-teal-600 hover:bg-teal-700 text-white"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Booking...
                        </>
                      ) : (
                        'Confirm Booking'
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-6">
          Powered by CRM Ecosystem
        </p>
      </div>
    </div>
  );
}
