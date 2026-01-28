/**
 * Google Calendar Adapter
 * Implements CalendarAdapter for Google Calendar API v3
 */

import {
  CalendarAdapter,
  AdapterConfig,
  TestResult,
  ValidationResult,
  ProviderCapability,
  Calendar,
  CalendarEvent,
  CreateEventParams,
} from '../base';
import { decryptCredential } from '../credentials';
import { OAUTH_PROVIDERS, getOAuthCredentials } from '../../oauth/providers';

// ============================================================================
// Types
// ============================================================================

interface GoogleCalendar {
  id: string;
  summary: string;
  description?: string;
  timeZone?: string;
  backgroundColor?: string;
  foregroundColor?: string;
  accessRole: 'owner' | 'writer' | 'reader' | 'freeBusyReader';
  primary?: boolean;
}

interface GoogleEvent {
  id: string;
  status: 'confirmed' | 'tentative' | 'cancelled';
  htmlLink?: string;
  summary?: string;
  description?: string;
  location?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: 'needsAction' | 'declined' | 'tentative' | 'accepted';
    organizer?: boolean;
    self?: boolean;
  }>;
  organizer?: {
    email?: string;
    displayName?: string;
    self?: boolean;
  };
  conferenceData?: {
    entryPoints?: Array<{
      entryPointType: string;
      uri: string;
    }>;
    conferenceSolution?: {
      key?: { type?: string };
      name?: string;
    };
  };
  recurrence?: string[];
  recurringEventId?: string;
  etag?: string;
}

interface GoogleCalendarListResponse {
  kind: string;
  etag: string;
  items: GoogleCalendar[];
  nextPageToken?: string;
}

interface GoogleEventsListResponse {
  kind: string;
  etag: string;
  summary: string;
  items: GoogleEvent[];
  nextPageToken?: string;
  nextSyncToken?: string;
}

// ============================================================================
// Google Calendar Adapter
// ============================================================================

export class GoogleCalendarAdapter implements CalendarAdapter {
  readonly providerId = 'google_calendar';
  readonly providerName = 'Google Calendar';
  readonly authType = 'oauth' as const;

  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiresAt: Date | null = null;
  private connection: AdapterConfig['connection'] | null = null;

  private readonly baseUrl = 'https://www.googleapis.com/calendar/v3';

  // ============================================================================
  // Initialization
  // ============================================================================

  initialize(config: AdapterConfig): void {
    this.connection = config.connection;

    // Decrypt tokens
    if (config.connection.access_token_enc) {
      this.accessToken = decryptCredential(config.connection.access_token_enc);
    }
    if (config.connection.refresh_token_enc) {
      this.refreshToken = decryptCredential(config.connection.refresh_token_enc);
    }
    if (config.connection.token_expires_at) {
      this.tokenExpiresAt = new Date(config.connection.token_expires_at);
    }
  }

  // ============================================================================
  // Connection Management
  // ============================================================================

  async testConnection(): Promise<TestResult> {
    const startTime = Date.now();

    try {
      await this.ensureValidToken();

      // Try to get user info
      const response = await this.makeRequest<GoogleCalendarListResponse>('/users/me/calendarList', {
        maxResults: '1',
      });

      const calendars = response.items || [];
      const primaryCalendar = calendars.find((c: GoogleCalendar) => c.primary) || calendars[0];

      return {
        success: true,
        message: 'Successfully connected to Google Calendar',
        durationMs: Date.now() - startTime,
        accountInfo: {
          id: primaryCalendar?.id,
          email: primaryCalendar?.id,
          name: primaryCalendar?.summary || 'Google Calendar',
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Connection test failed',
        durationMs: Date.now() - startTime,
      };
    }
  }

  getCapabilities(): ProviderCapability[] {
    return ['calendar_read', 'calendar_write', 'create_meeting'];
  }

  validateConfig(config: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];

    if (!config.access_token_enc && !config.accessToken) {
      errors.push('Access token is required');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  // ============================================================================
  // Calendar Operations
  // ============================================================================

  async listCalendars(): Promise<Calendar[]> {
    await this.ensureValidToken();

    const response = await this.makeRequest<GoogleCalendarListResponse>(
      '/users/me/calendarList',
      { maxResults: '100' }
    );

    return (response.items || []).map((cal) => this.mapCalendar(cal));
  }

  async getEvents(
    calendarId: string,
    startDate: Date,
    endDate: Date
  ): Promise<CalendarEvent[]> {
    await this.ensureValidToken();

    const events: CalendarEvent[] = [];
    let pageToken: string | undefined;

    do {
      const params: Record<string, string> = {
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: '250',
      };

      if (pageToken) {
        params.pageToken = pageToken;
      }

      const response = await this.makeRequest<GoogleEventsListResponse>(
        `/calendars/${encodeURIComponent(calendarId)}/events`,
        params
      );

      const mappedEvents = (response.items || [])
        .filter((e) => e.status !== 'cancelled')
        .map((e) => this.mapEvent(e, calendarId));

      events.push(...mappedEvents);
      pageToken = response.nextPageToken;
    } while (pageToken);

    return events;
  }

  async createEvent(params: CreateEventParams): Promise<CalendarEvent> {
    await this.ensureValidToken();

    const calendarId = params.calendarId || 'primary';

    const eventBody: Record<string, unknown> = {
      summary: params.title,
      description: params.description,
      location: params.location,
    };

    if (params.allDay) {
      eventBody.start = { date: params.startTime.toISOString().split('T')[0] };
      eventBody.end = { date: params.endTime.toISOString().split('T')[0] };
    } else {
      eventBody.start = { dateTime: params.startTime.toISOString() };
      eventBody.end = { dateTime: params.endTime.toISOString() };
    }

    if (params.attendees && params.attendees.length > 0) {
      eventBody.attendees = params.attendees.map((email) => ({ email }));
    }

    // Add Google Meet conference if requested
    if (params.addConference) {
      eventBody.conferenceData = {
        createRequest: {
          requestId: `crm-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      };
    }

    const queryParams: Record<string, string> = {};
    if (params.sendNotifications) {
      queryParams.sendUpdates = 'all';
    }
    if (params.addConference) {
      queryParams.conferenceDataVersion = '1';
    }

    const response = await this.makeRequest<GoogleEvent>(
      `/calendars/${encodeURIComponent(calendarId)}/events`,
      queryParams,
      'POST',
      eventBody
    );

    return this.mapEvent(response, calendarId);
  }

  async updateEvent(
    eventId: string,
    updates: Partial<CreateEventParams>
  ): Promise<CalendarEvent> {
    await this.ensureValidToken();

    const calendarId = updates.calendarId || 'primary';

    const eventBody: Record<string, unknown> = {};

    if (updates.title !== undefined) {
      eventBody.summary = updates.title;
    }
    if (updates.description !== undefined) {
      eventBody.description = updates.description;
    }
    if (updates.location !== undefined) {
      eventBody.location = updates.location;
    }
    if (updates.startTime) {
      eventBody.start = updates.allDay
        ? { date: updates.startTime.toISOString().split('T')[0] }
        : { dateTime: updates.startTime.toISOString() };
    }
    if (updates.endTime) {
      eventBody.end = updates.allDay
        ? { date: updates.endTime.toISOString().split('T')[0] }
        : { dateTime: updates.endTime.toISOString() };
    }
    if (updates.attendees) {
      eventBody.attendees = updates.attendees.map((email) => ({ email }));
    }

    const response = await this.makeRequest<GoogleEvent>(
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      updates.sendNotifications ? { sendUpdates: 'all' } : {},
      'PATCH',
      eventBody
    );

    return this.mapEvent(response, calendarId);
  }

  async deleteEvent(
    eventId: string,
    calendarId: string = 'primary'
  ): Promise<{ success: boolean }> {
    await this.ensureValidToken();

    await this.makeRequest(
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      { sendUpdates: 'all' },
      'DELETE'
    );

    return { success: true };
  }

  async getFreeBusy(
    emails: string[],
    startDate: Date,
    endDate: Date
  ): Promise<Record<string, Array<{ start: Date; end: Date }>>> {
    await this.ensureValidToken();

    const response = await this.makeRequest<{ calendars?: Record<string, { busy?: Array<{ start: string; end: string }> }> }>(
      '/freeBusy',
      {},
      'POST',
      {
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        items: emails.map((email) => ({ id: email })),
      }
    );

    const result: Record<string, Array<{ start: Date; end: Date }>> = {};

    for (const [email, data] of Object.entries(response.calendars || {})) {
      result[email] = (data.busy || []).map((b) => ({
        start: new Date(b.start),
        end: new Date(b.end),
      }));
    }

    return result;
  }

  // ============================================================================
  // Sync Operations
  // ============================================================================

  async incrementalSync(
    calendarId: string,
    syncToken?: string
  ): Promise<{
    events: CalendarEvent[];
    deletedIds: string[];
    nextSyncToken?: string;
  }> {
    await this.ensureValidToken();

    const events: CalendarEvent[] = [];
    const deletedIds: string[] = [];
    let pageToken: string | undefined;
    let nextSyncToken: string | undefined;

    do {
      const params: Record<string, string> = {
        maxResults: '250',
        showDeleted: 'true',
      };

      if (syncToken && !pageToken) {
        params.syncToken = syncToken;
      }
      if (pageToken) {
        params.pageToken = pageToken;
      }

      try {
        const response = await this.makeRequest<GoogleEventsListResponse>(
          `/calendars/${encodeURIComponent(calendarId)}/events`,
          params
        );

        for (const event of response.items || []) {
          if (event.status === 'cancelled') {
            deletedIds.push(event.id);
          } else {
            events.push(this.mapEvent(event, calendarId));
          }
        }

        pageToken = response.nextPageToken;
        nextSyncToken = response.nextSyncToken;
      } catch (error) {
        // If sync token is invalid, fall back to full sync
        if (error instanceof Error && error.message.includes('410')) {
          return this.fullSync(calendarId);
        }
        throw error;
      }
    } while (pageToken);

    return { events, deletedIds, nextSyncToken };
  }

  async fullSync(calendarId: string): Promise<{
    events: CalendarEvent[];
    deletedIds: string[];
    nextSyncToken?: string;
  }> {
    // Full sync - get events from 6 months ago to 1 year in future
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 6);

    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + 1);

    const events = await this.getEvents(calendarId, startDate, endDate);

    // Get sync token for future incremental syncs
    const response = await this.makeRequest<GoogleEventsListResponse>(
      `/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        maxResults: '1',
      }
    );

    return {
      events,
      deletedIds: [],
      nextSyncToken: response.nextSyncToken,
    };
  }

  // ============================================================================
  // Token Management
  // ============================================================================

  private async ensureValidToken(): Promise<void> {
    if (!this.accessToken) {
      throw new Error('No access token available');
    }

    // Check if token is expired or will expire in 5 minutes
    if (this.tokenExpiresAt) {
      const expiresIn = this.tokenExpiresAt.getTime() - Date.now();
      if (expiresIn < 5 * 60 * 1000) {
        await this.refreshAccessToken();
      }
    }
  }

  private async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    const credentials = getOAuthCredentials('google_calendar');
    if (!credentials) {
      throw new Error('Google Calendar credentials not configured');
    }

    const provider = OAUTH_PROVIDERS.google_calendar;

    const response = await fetch(provider.tokenUrl!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.refreshToken,
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to refresh token: ${error}`);
    }

    const data = await response.json();

    this.accessToken = data.access_token;
    if (data.refresh_token) {
      this.refreshToken = data.refresh_token;
    }
    if (data.expires_in) {
      this.tokenExpiresAt = new Date(Date.now() + data.expires_in * 1000);
    }

    // Note: In a real implementation, you would update the database here
  }

  // ============================================================================
  // HTTP Client
  // ============================================================================

  private async makeRequest<T = any>(
    path: string,
    params: Record<string, string> = {},
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
    body?: Record<string, unknown>
  ): Promise<T> {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    const url = new URL(`${this.baseUrl}${path}`);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (body && (method === 'POST' || method === 'PATCH')) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url.toString(), options);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google Calendar API error: ${response.status} - ${error}`);
    }

    if (method === 'DELETE') {
      return {} as T;
    }

    return response.json() as Promise<T>;
  }

  // ============================================================================
  // Data Mapping
  // ============================================================================

  private mapCalendar(gcal: GoogleCalendar): Calendar {
    return {
      id: gcal.id,
      name: gcal.summary,
      isPrimary: gcal.primary,
      color: gcal.backgroundColor,
      accessRole: gcal.accessRole === 'freeBusyReader' ? 'reader' : gcal.accessRole,
    };
  }

  private mapEvent(event: GoogleEvent, calendarId: string): CalendarEvent {
    const startTime = event.start.dateTime
      ? new Date(event.start.dateTime)
      : new Date(event.start.date + 'T00:00:00');

    const endTime = event.end.dateTime
      ? new Date(event.end.dateTime)
      : new Date(event.end.date + 'T23:59:59');

    let conferenceData: CalendarEvent['conferenceData'];
    if (event.conferenceData?.entryPoints) {
      const videoEntry = event.conferenceData.entryPoints.find(
        (e) => e.entryPointType === 'video'
      );
      if (videoEntry) {
        let type: 'google_meet' | 'zoom' | 'microsoft_teams' = 'google_meet';
        if (event.conferenceData.conferenceSolution?.key?.type === 'hangoutsMeet') {
          type = 'google_meet';
        } else if (videoEntry.uri.includes('zoom.us')) {
          type = 'zoom';
        } else if (videoEntry.uri.includes('teams.microsoft')) {
          type = 'microsoft_teams';
        }

        conferenceData = {
          type,
          joinUrl: videoEntry.uri,
        };
      }
    }

    return {
      id: event.id,
      calendarId,
      title: event.summary || '(No title)',
      description: event.description,
      location: event.location,
      startTime,
      endTime,
      allDay: !event.start.dateTime,
      status: event.status,
      attendees: event.attendees?.map((a) => ({
        email: a.email,
        name: a.displayName,
        responseStatus: a.responseStatus,
      })),
      conferenceData,
      recurrence: event.recurrence,
    };
  }
}
