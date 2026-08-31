'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Calendar,
  CalendarX,
  Check,
  Clock,
  HelpCircle,
  Loader2,
  MapPin,
  Video,
  X,
} from 'lucide-react';

type RsvpResponse = 'accepted' | 'declined' | 'tentative';
type RsvpStatus = RsvpResponse | 'needs_action';

interface RsvpEvent {
  title: string;
  description: string | null;
  location: string | null;
  meeting_url: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  timezone: string | null;
  status: 'confirmed' | 'tentative' | 'cancelled';
}

interface RsvpAttendee {
  email: string;
  name: string | null;
  rsvp_status: RsvpStatus;
}

const RESPONSE_OPTIONS: Array<{
  value: RsvpResponse;
  label: string;
  icon: typeof Check;
  selectedClasses: string;
  intentClasses: string;
}> = [
  {
    value: 'accepted',
    label: 'Accept',
    icon: Check,
    selectedClasses: 'border-teal-600 bg-teal-600 text-white',
    intentClasses:
      'border-teal-500 ring-2 ring-teal-500/30 bg-white dark:bg-slate-900 text-slate-900 dark:text-white',
  },
  {
    value: 'tentative',
    label: 'Maybe',
    icon: HelpCircle,
    selectedClasses: 'border-amber-500 bg-amber-500 text-white',
    intentClasses:
      'border-amber-500 ring-2 ring-amber-500/30 bg-white dark:bg-slate-900 text-slate-900 dark:text-white',
  },
  {
    value: 'declined',
    label: 'Decline',
    icon: X,
    selectedClasses: 'border-rose-600 bg-rose-600 text-white',
    intentClasses:
      'border-rose-500 ring-2 ring-rose-500/30 bg-white dark:bg-slate-900 text-slate-900 dark:text-white',
  },
];

const JUST_RESPONDED_MESSAGES: Record<RsvpResponse, string> = {
  accepted: 'You accepted — see you there.',
  tentative: 'You replied maybe — you can update this any time.',
  declined: 'You declined — thanks for letting us know.',
};

const EXISTING_RESPONSE_MESSAGES: Record<RsvpResponse, string> = {
  accepted: "You've accepted this invitation.",
  tentative: "You've replied maybe to this invitation.",
  declined: "You've declined this invitation.",
};

const BANNER_CLASSES: Record<RsvpResponse, string> = {
  accepted:
    'bg-green-100 dark:bg-green-500/20 text-green-800 dark:text-green-300',
  tentative:
    'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300',
  declined: 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300',
};

function formatInZone(
  iso: string,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
): string {
  const date = new Date(iso);
  try {
    return new Intl.DateTimeFormat('en-US', { ...options, timeZone }).format(date);
  } catch {
    // Unknown IANA zone — fall back to the viewer's local time.
    return new Intl.DateTimeFormat('en-US', options).format(date);
  }
}

export default function RsvpPage() {
  const { token } = useParams<{ token: string }>();

  const [status, setStatus] = useState<'loading' | 'not_found' | 'error' | 'ready'>(
    'loading',
  );
  const [event, setEvent] = useState<RsvpEvent | null>(null);
  const [attendee, setAttendee] = useState<RsvpAttendee | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const [intent, setIntent] = useState<RsvpResponse | null>(null);
  const [current, setCurrent] = useState<RsvpResponse | null>(null);
  const [justResponded, setJustResponded] = useState(false);
  const [submitting, setSubmitting] = useState<RsvpResponse | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ?intent=accepted|declined|tentative pre-highlights a button. It never
  // auto-submits — mail scanners prefetch links, and a tap must stay the only
  // thing that records a response.
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get('intent');
    if (raw === 'accepted' || raw === 'declined' || raw === 'tentative') {
      setIntent(raw);
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    let active = true;

    (async () => {
      try {
        const res = await fetch(`/api/rsvp/${token}`);
        if (!active) return;

        if (res.status === 404) {
          setStatus('not_found');
          return;
        }
        if (!res.ok) {
          setStatus('error');
          return;
        }

        const data: { event: RsvpEvent; attendee: RsvpAttendee } = await res.json();
        if (!active) return;

        setEvent(data.event);
        setAttendee(data.attendee);
        if (data.event.status === 'cancelled') {
          setCancelled(true);
        }
        if (data.attendee.rsvp_status !== 'needs_action') {
          setCurrent(data.attendee.rsvp_status);
        }
        setStatus('ready');
      } catch {
        if (active) setStatus('error');
      }
    })();

    return () => {
      active = false;
    };
  }, [token]);

  const when = useMemo(() => {
    if (!event) return null;

    const tz = event.timezone || 'UTC';
    const dateOptions: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    };
    const startDate = formatInZone(event.start_at, tz, dateOptions);
    const endDate = formatInZone(event.end_at, tz, dateOptions);

    if (event.all_day) {
      return {
        date: startDate === endDate ? startDate : `${startDate} – ${endDate}`,
        time: 'All day',
        zone: null as string | null,
      };
    }

    const startTime = formatInZone(event.start_at, tz, {
      hour: 'numeric',
      minute: '2-digit',
    });
    // timeZoneName on the end time labels the range, e.g. "2:30 PM EDT".
    const endTime = formatInZone(event.end_at, tz, {
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    });

    return {
      date: startDate,
      time:
        startDate === endDate
          ? `${startTime} – ${endTime}`
          : `${startTime} – ${endDate}, ${endTime}`,
      zone: tz,
    };
  }, [event]);

  const respond = async (response: RsvpResponse) => {
    if (submitting) return;
    setSubmitting(response);
    setSubmitError(null);

    try {
      const res = await fetch(`/api/rsvp/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response }),
      });

      if (res.status === 409) {
        setCancelled(true);
        return;
      }
      if (res.status === 429) {
        setSubmitError('Too many attempts — please wait a minute and try again.');
        return;
      }
      if (!res.ok) {
        throw new Error('Failed to record response');
      }

      const data: { rsvp_status?: RsvpResponse } = await res.json();
      setCurrent(data.rsvp_status ?? response);
      setJustResponded(true);
    } catch {
      setSubmitError('Something went wrong — please try again.');
    } finally {
      setSubmitting(null);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
      </div>
    );
  }

  if (status === 'not_found' || status === 'error' || !event || !attendee) {
    const isNotFound = status === 'not_found';
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-4">
        <div className="text-center">
          <CalendarX className="w-16 h-16 mx-auto text-slate-400 mb-4" />
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            {isNotFound ? 'Invitation not found' : 'Something went wrong'}
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            {isNotFound
              ? 'This RSVP link is invalid or no longer active. Check the link in your email, or reach out to the organizer.'
              : 'We could not load this invitation. Please try again in a moment.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center px-4 py-8">
      <div className="max-w-md w-full">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="p-6 sm:p-8 space-y-6">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                Meeting invitation
              </p>
              <div className="flex items-start gap-2">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                  {event.title}
                </h1>
                {event.status === 'tentative' && !cancelled && (
                  <span className="mt-1.5 shrink-0 px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300">
                    Tentative
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Invitation for {attendee.name || attendee.email}
              </p>
            </div>

            <div className="space-y-3">
              {when && (
                <>
                  <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                    <Calendar className="w-5 h-5 shrink-0" />
                    <span className="text-slate-900 dark:text-white font-medium">
                      {when.date}
                    </span>
                  </div>
                  <div className="flex items-start gap-3 text-slate-600 dark:text-slate-400">
                    <Clock className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-slate-900 dark:text-white font-medium">
                        {when.time}
                      </span>
                      {when.zone && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Times shown in {when.zone}
                        </p>
                      )}
                    </div>
                  </div>
                </>
              )}
              {event.location && (
                <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                  <MapPin className="w-5 h-5 shrink-0" />
                  <span>{event.location}</span>
                </div>
              )}
            </div>

            {event.meeting_url && !cancelled && (
              <a
                href={event.meeting_url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full min-h-[48px] flex items-center justify-center gap-2 rounded-xl border-2 border-slate-200 dark:border-slate-700 px-4 py-3 text-base font-semibold text-teal-600 dark:text-teal-400 hover:border-teal-500 transition-colors"
              >
                <Video className="w-5 h-5" />
                Join meeting
              </a>
            )}

            {event.description && (
              <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                {event.description}
              </p>
            )}

            <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
              {cancelled ? (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-100 dark:bg-slate-700">
                  <CalendarX className="w-5 h-5 shrink-0 text-slate-500 dark:text-slate-400" />
                  <p className="text-slate-700 dark:text-slate-300 font-medium">
                    This meeting was cancelled.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Will you attend?
                  </p>

                  {current && (
                    <div className={`p-4 rounded-xl ${BANNER_CLASSES[current]}`}>
                      <p className="font-medium">
                        {justResponded
                          ? JUST_RESPONDED_MESSAGES[current]
                          : EXISTING_RESPONSE_MESSAGES[current]}
                      </p>
                      <p className="text-xs mt-1 opacity-80">
                        Changed your mind? Pick a different option below.
                      </p>
                    </div>
                  )}

                  {RESPONSE_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const isSelected = current === option.value;
                    const isIntent = !current && intent === option.value;
                    const isSubmitting = submitting === option.value;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={isSelected}
                        disabled={submitting !== null}
                        onClick={() => respond(option.value)}
                        className={`w-full min-h-[48px] flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-base font-semibold transition-colors disabled:opacity-60 ${
                          isSelected
                            ? option.selectedClasses
                            : isIntent
                              ? option.intentClasses
                              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white hover:border-teal-500'
                        }`}
                      >
                        {isSubmitting ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Icon className="w-5 h-5" />
                        )}
                        {option.label}
                      </button>
                    );
                  })}

                  {submitError && (
                    <p
                      role="alert"
                      className="text-sm text-rose-600 dark:text-rose-400"
                    >
                      {submitError}
                    </p>
                  )}
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
