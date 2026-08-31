/**
 * Local source of truth for the calendar tables (`calendar_events`,
 * `calendar_attendees`). The tables are new and not yet present in the
 * generated Supabase types, so column names here MUST match the migration
 * exactly.
 */

export interface CalendarEventRow {
  id: string;
  organization_id: string;
  owner_id: string;
  created_by: string | null;
  title: string;
  description: string | null;
  location: string | null;
  meeting_url: string | null;
  /** ISO timestamptz */
  start_at: string;
  /** ISO timestamptz */
  end_at: string;
  all_day: boolean;
  /** IANA name, e.g. 'America/New_York' */
  timezone: string;
  status: 'confirmed' | 'tentative' | 'cancelled';
  ical_uid: string;
  ical_sequence: number;
  /** RFC 5545 RRULE — stored but not yet expanded; invites refuse recurring events. */
  recurrence_rule: string | null;
  recurrence_parent_id: string | null;
  original_start_at: string | null;
  record_id: string | null;
  conversation_id: string | null;
  source: 'crm' | 'inbox' | 'booking' | 'import';
  reminder_minutes: number | null;
  metadata: Record<string, unknown>;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CalendarAttendeeRow {
  id: string;
  organization_id: string;
  event_id: string;
  profile_id: string | null;
  record_id: string | null;
  email: string;
  name: string | null;
  role: 'organizer' | 'required' | 'optional';
  rsvp_status: 'needs_action' | 'accepted' | 'declined' | 'tentative';
  rsvp_at: string | null;
  response_source: 'itip_reply' | 'link' | 'manual' | 'provider' | null;
  rsvp_token: string;
  invited_sequence: number | null;
  invited_at: string | null;
  reminder_sent_at: string | null;
  created_at: string;
  updated_at: string;
}
