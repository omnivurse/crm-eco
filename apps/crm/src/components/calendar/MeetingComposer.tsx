'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent, type JSX } from 'react';
import { fromZonedTime } from 'date-fns-tz';
import { toast } from 'sonner';
import { toastCopy } from '@/lib/crm/toast-copy';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@crm-eco/ui/components/dialog';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
import { Textarea } from '@crm-eco/ui/components/textarea';
import { Checkbox } from '@crm-eco/ui/components/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import { Badge } from '@crm-eco/ui/components/badge';
import { CalendarPlus, Loader2, X } from 'lucide-react';

export interface MeetingComposerDefaults {
  title?: string;
  attendees?: Array<{ email: string; name?: string }>;
  recordId?: string;
  conversationId?: string;
}

export interface MeetingComposerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaults?: MeetingComposerDefaults;
  onCreated?: (result: { eventId: string; invitesSent: number; invitesFailed: number }) => void;
}

interface Attendee {
  email: string;
  name?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_ATTENDEES = 50;

const CURATED_TIMEZONES: Array<{ value: string; label: string }> = [
  { value: 'America/New_York', label: 'Eastern Time — America/New_York' },
  { value: 'America/Chicago', label: 'Central Time — America/Chicago' },
  { value: 'America/Denver', label: 'Mountain Time — America/Denver' },
  { value: 'America/Los_Angeles', label: 'Pacific Time — America/Los_Angeles' },
  { value: 'America/Phoenix', label: 'Arizona — America/Phoenix' },
  { value: 'Pacific/Honolulu', label: 'Hawaii — Pacific/Honolulu' },
  { value: 'America/Anchorage', label: 'Alaska — America/Anchorage' },
  { value: 'UTC', label: 'UTC' },
  { value: 'Europe/London', label: 'London — Europe/London' },
  { value: 'Europe/Paris', label: 'Paris — Europe/Paris' },
];

const REMINDER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'none', label: 'None' },
  { value: '10', label: '10 minutes before' },
  { value: '30', label: '30 minutes before' },
  { value: '60', label: '1 hour before' },
  { value: '1440', label: '1 day before' },
];

function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** Next round half-hour from now (e.g. 10:04 -> 10:30, 10:42 -> 11:00). */
function nextHalfHour(): Date {
  const d = new Date();
  d.setSeconds(0, 0);
  if (d.getMinutes() < 30) {
    d.setMinutes(30);
  } else {
    d.setMinutes(0);
    d.setHours(d.getHours() + 1);
  }
  return d;
}

function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toTimeInputValue(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** yyyy-MM-dd of the calendar day after `date` (pure date math, no timezone involved). */
function nextCalendarDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

export function MeetingComposer({
  open,
  onOpenChange,
  defaults,
  onCreated,
}: MeetingComposerProps): JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            Schedule meeting
          </DialogTitle>
          <DialogDescription>
            Create a calendar event and optionally email invitations to attendees.
          </DialogDescription>
        </DialogHeader>
        <MeetingComposerForm
          key={open ? 'open' : 'closed'}
          defaults={defaults}
          onOpenChange={onOpenChange}
          onCreated={onCreated}
        />
      </DialogContent>
    </Dialog>
  );
}

function MeetingComposerForm({
  defaults,
  onOpenChange,
  onCreated,
}: {
  defaults?: MeetingComposerDefaults;
  onOpenChange: (open: boolean) => void;
  onCreated?: (result: { eventId: string; invitesSent: number; invitesFailed: number }) => void;
}): JSX.Element {
  const seedStart = useMemo(() => nextHalfHour(), []);
  const browserTimezone = useMemo(() => getBrowserTimezone(), []);

  const [title, setTitle] = useState(defaults?.title ?? '');
  const [date, setDate] = useState(() => toDateInputValue(seedStart));
  const [startTime, setStartTime] = useState(() => toTimeInputValue(seedStart));
  const [endTime, setEndTime] = useState(() =>
    toTimeInputValue(new Date(seedStart.getTime() + 30 * 60 * 1000)),
  );
  const [allDay, setAllDay] = useState(false);
  const [timezone, setTimezone] = useState(browserTimezone);
  const [location, setLocation] = useState('');
  const [meetingUrl, setMeetingUrl] = useState('');
  const [description, setDescription] = useState('');
  const [attendees, setAttendees] = useState<Attendee[]>(() =>
    (defaults?.attendees ?? [])
      .filter((a) => EMAIL_RE.test(a.email))
      .slice(0, MAX_ATTENDEES)
      .map((a) => ({ email: a.email, name: a.name })),
  );
  const [attendeeInput, setAttendeeInput] = useState('');
  const [reminder, setReminder] = useState('none');
  const [sendInvites, setSendInvites] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timezoneOptions = useMemo(() => {
    const options = [...CURATED_TIMEZONES];
    if (!options.some((z) => z.value === browserTimezone)) {
      options.unshift({ value: browserTimezone, label: `${browserTimezone} (your timezone)` });
    }
    return options;
  }, [browserTimezone]);

  const handleStartTimeChange = (value: string) => {
    setStartTime(value);
    if (value && endTime && timeToMinutes(endTime) <= timeToMinutes(value)) {
      // Keep the end after the start: shift it to +30 min (clamped to the last
      // 15-minute step of the day).
      setEndTime(minutesToTime(Math.min(timeToMinutes(value) + 30, 23 * 60 + 45)));
    }
  };

  const addAttendee = (raw: string): boolean => {
    const email = raw.trim().replace(/,$/, '');
    if (!email) return true;
    if (!EMAIL_RE.test(email)) {
      toast.error(toastCopy.failed('add that attendee', 'enter a valid email address'));
      return false;
    }
    if (attendees.some((a) => a.email.toLowerCase() === email.toLowerCase())) {
      toast.error(toastCopy.failed('add that attendee', 'already on the list'));
      setAttendeeInput('');
      return true;
    }
    if (attendees.length >= MAX_ATTENDEES) {
      toast.error(
        toastCopy.failed(
          'add that attendee',
          `a meeting can have at most ${MAX_ATTENDEES} attendees`,
        ),
      );
      return false;
    }
    setAttendees((prev) => [...prev, { email }]);
    setAttendeeInput('');
    return true;
  };

  const removeAttendee = (email: string) => {
    setAttendees((prev) => prev.filter((a) => a.email !== email));
  };

  const handleAttendeeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addAttendee(attendeeInput);
    } else if (e.key === 'Backspace' && !attendeeInput && attendees.length > 0) {
      removeAttendee(attendees[attendees.length - 1].email);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    // Commit any email still sitting in the attendee input.
    let attendeeList = attendees;
    const pending = attendeeInput.trim().replace(/,$/, '');
    if (pending) {
      if (!EMAIL_RE.test(pending)) {
        setError(`"${pending}" is not a valid attendee email address.`);
        return;
      }
      if (!attendeeList.some((a) => a.email.toLowerCase() === pending.toLowerCase())) {
        if (attendeeList.length >= MAX_ATTENDEES) {
          setError(`A meeting can have at most ${MAX_ATTENDEES} attendees.`);
          return;
        }
        attendeeList = [...attendeeList, { email: pending }];
        setAttendees(attendeeList);
      }
      setAttendeeInput('');
    }

    if (!title.trim()) {
      setError('Please give the meeting a title.');
      return;
    }
    if (!date) {
      setError('Please pick a date.');
      return;
    }
    if (!allDay && (!startTime || !endTime)) {
      setError('Please pick a start and end time.');
      return;
    }

    const trimmedUrl = meetingUrl.trim();
    if (trimmedUrl) {
      try {
        new URL(trimmedUrl);
      } catch {
        setError('Meeting link must be a valid URL, including https://');
        return;
      }
    }

    let startAt: string;
    let endAt: string;
    try {
      if (allDay) {
        // All-day: midnight to midnight (start of the next day) in the chosen zone.
        startAt = fromZonedTime(`${date}T00:00:00`, timezone).toISOString();
        endAt = fromZonedTime(`${nextCalendarDay(date)}T00:00:00`, timezone).toISOString();
      } else {
        const startUtc = fromZonedTime(`${date}T${startTime}:00`, timezone);
        const endUtc = fromZonedTime(`${date}T${endTime}:00`, timezone);
        if (endUtc.getTime() <= startUtc.getTime()) {
          setError('End time must be after the start time.');
          return;
        }
        startAt = startUtc.toISOString();
        endAt = endUtc.toISOString();
      }
    } catch {
      setError('Could not compute the meeting time for the selected timezone.');
      return;
    }

    const payload = {
      title: title.trim(),
      description: description.trim() || undefined,
      location: location.trim() || undefined,
      meeting_url: trimmedUrl || undefined,
      start_at: startAt,
      end_at: endAt,
      all_day: allDay,
      timezone,
      record_id: defaults?.recordId || undefined,
      conversation_id: defaults?.conversationId || undefined,
      reminder_minutes: reminder === 'none' ? undefined : Number(reminder),
      attendees: attendeeList.map((a) => (a.name ? { email: a.email, name: a.name } : { email: a.email })),
      send_invites: sendInvites,
      source: defaults?.conversationId ? ('inbox' as const) : ('crm' as const),
    };

    setSubmitting(true);
    try {
      const res = await fetch('/api/crm/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 401) {
          setError('Your session has expired. Please sign in again and retry.');
        } else {
          setError(
            (json && typeof json.error === 'string' && json.error) ||
              'Failed to schedule the meeting. Please try again.',
          );
        }
        return;
      }

      const invites = json?.invites ?? null;
      const invitesSent: number = invites?.sent ?? 0;
      const failed: Array<{ email: string; error: string }> = invites?.failed ?? [];

      toast.success(
        toastCopy.added('Meeting'),
        invitesSent > 0
          ? { description: toastCopy.counted('invitation', invitesSent, 'Sent') }
          : undefined,
      );
      if (failed.length > 0) {
        toast.warning(
          toastCopy.failed(
            'send some invitations',
            `${failed[0].email} did not go out`,
            'The meeting is still on the calendar',
          ),
        );
      }

      onCreated?.({
        eventId: json?.event?.id ?? '',
        invitesSent,
        invitesFailed: failed.length,
      });
      onOpenChange(false);
    } catch {
      setError('Network error — please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="meeting-title">
          Title <span className="text-red-500">*</span>
        </Label>
        <Input
          id="meeting-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Enrollment review call"
          maxLength={300}
          required
          disabled={submitting}
        />
      </div>

      {/* Date + times */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="meeting-date">
            Date <span className="text-red-500">*</span>
          </Label>
          <Input
            id="meeting-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            disabled={submitting}
          />
        </div>
        {!allDay && (
          <>
            <div className="space-y-2">
              <Label htmlFor="meeting-start-time">
                Start time <span className="text-red-500">*</span>
              </Label>
              <Input
                id="meeting-start-time"
                type="time"
                step={900}
                value={startTime}
                onChange={(e) => handleStartTimeChange(e.target.value)}
                required
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="meeting-end-time">
                End time <span className="text-red-500">*</span>
              </Label>
              <Input
                id="meeting-end-time"
                type="time"
                step={900}
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
                disabled={submitting}
              />
            </div>
          </>
        )}
      </div>

      {/* All day */}
      <div className="flex items-center gap-2">
        <Checkbox
          id="meeting-all-day"
          checked={allDay}
          onCheckedChange={(checked) => setAllDay(checked === true)}
          disabled={submitting}
        />
        <Label htmlFor="meeting-all-day" className="text-sm font-normal cursor-pointer">
          All day
        </Label>
      </div>

      {/* Timezone */}
      <div className="space-y-2">
        <Label htmlFor="meeting-timezone">Timezone</Label>
        <Select value={timezone} onValueChange={setTimezone} disabled={submitting}>
          <SelectTrigger id="meeting-timezone">
            <SelectValue placeholder="Select timezone" />
          </SelectTrigger>
          <SelectContent>
            {timezoneOptions.map((tz) => (
              <SelectItem key={tz.value} value={tz.value}>
                {tz.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Location + meeting link */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="meeting-location">Location</Label>
          <Input
            id="meeting-location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Main office, Conference room B"
            disabled={submitting}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="meeting-url">Meeting link</Label>
          <Input
            id="meeting-url"
            type="url"
            value={meetingUrl}
            onChange={(e) => setMeetingUrl(e.target.value)}
            placeholder="https://meet.example.com/..."
            disabled={submitting}
          />
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="meeting-description">Description</Label>
        <Textarea
          id="meeting-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Agenda, context, or notes for attendees..."
          rows={3}
          disabled={submitting}
        />
      </div>

      {/* Attendees */}
      <div className="space-y-2">
        <Label htmlFor="meeting-attendees">Attendees</Label>
        <Input
          id="meeting-attendees"
          type="email"
          value={attendeeInput}
          onChange={(e) => setAttendeeInput(e.target.value)}
          onKeyDown={handleAttendeeKeyDown}
          placeholder="Type an email and press Enter"
          disabled={submitting}
          aria-describedby="meeting-attendees-hint"
        />
        <p id="meeting-attendees-hint" className="text-xs text-slate-500 dark:text-slate-400">
          Press Enter or comma to add each attendee.
        </p>
        {attendees.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {attendees.map((attendee) => (
              <Badge key={attendee.email} variant="secondary" className="gap-1 py-1">
                {attendee.name ? `${attendee.name} <${attendee.email}>` : attendee.email}
                <button
                  type="button"
                  onClick={() => removeAttendee(attendee.email)}
                  className="ml-1 hover:text-red-500"
                  disabled={submitting}
                  aria-label={`Remove ${attendee.email}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Reminder + invitations */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
        <div className="space-y-2">
          <Label htmlFor="meeting-reminder">Reminder</Label>
          <Select value={reminder} onValueChange={setReminder} disabled={submitting}>
            <SelectTrigger id="meeting-reminder">
              <SelectValue placeholder="Reminder" />
            </SelectTrigger>
            <SelectContent>
              {REMINDER_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 pb-2.5">
          <Checkbox
            id="meeting-send-invites"
            checked={sendInvites}
            onCheckedChange={(checked) => setSendInvites(checked === true)}
            disabled={submitting}
          />
          <Label htmlFor="meeting-send-invites" className="text-sm font-normal cursor-pointer">
            Send email invitations
          </Label>
        </div>
      </div>

      {/* Inline error */}
      {error && (
        <div
          role="alert"
          className="p-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg"
        >
          {error}
        </div>
      )}

      <DialogFooter className="gap-2 sm:gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={submitting}
          className="h-10"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={submitting}
          className="h-10 gap-1.5 bg-teal-600 hover:bg-teal-700 text-white"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Scheduling...
            </>
          ) : (
            <>
              <CalendarPlus className="w-4 h-4" />
              Schedule meeting
            </>
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}

export default MeetingComposer;
