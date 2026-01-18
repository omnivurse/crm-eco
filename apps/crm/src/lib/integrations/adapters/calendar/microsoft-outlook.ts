/**
 * Microsoft Outlook Calendar Adapter
 * Implements CalendarAdapter for Microsoft Graph API
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

interface MicrosoftCalendar {
  id: string;
  name: string;
  color?: string;
  isDefaultCalendar?: boolean;
  canEdit: boolean;
  canShare: boolean;
  owner?: {
    name?: string;
    address?: string;
  };
}

interface MicrosoftEvent {
  id: string;
  subject?: string;
  bodyPreview?: string;
  body?: {
    contentType: 'text' | 'html';
    content: string;
  };
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  location?: {
    displayName?: string;
    address?: Record<string, unknown>;
  };
  isAllDay?: boolean;
  isCancelled?: boolean;
  attendees?: Array<{
    emailAddress: {
      name?: string;
      address: string;
    };
    status?: {
      response?: 'none' | 'organizer' | 'tentativelyAccepted' | 'accepted' | 'declined' | 'notResponded';
    };
    type: 'required' | 'optional' | 'resource';
  }>;
  organizer?: {
    emailAddress: {
      name?: string;
      address: string;
    };
  };
  onlineMeeting?: {
    joinUrl?: string;
  };
  onlineMeetingProvider?: 'teamsForBusiness' | 'skypeForBusiness' | 'skypeForConsumer' | 'unknown';
  recurrence?: {
    pattern: Record<string, unknown>;
    range: Record<string, unknown>;
  };
  seriesMasterId?: string;
  showAs?: 'free' | 'tentative' | 'busy' | 'oof' | 'workingElsewhere' | 'unknown';
  '@odata.etag'?: string;
}

interface MicrosoftCalendarListResponse {
  '@odata.context'?: string;
  '@odata.nextLink'?: string;
  value: MicrosoftCalendar[];
}

interface MicrosoftEventsListResponse {
  '@odata.context'?: string;
  '@odata.nextLink'?: string;
  '@odata.deltaLink'?: string;
  value: MicrosoftEvent[];
}

// ============================================================================
// Microsoft Outlook Calendar Adapter
// ============================================================================

export class MicrosoftOutlookAdapter implements CalendarAdapter {
  readonly providerId = 'microsoft_outlook';
  readonly providerName = 'Microsoft Outlook';
  readonly authType = 'oauth' as const;

  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiresAt: Date | null = null;
  private connection: AdapterConfig['connection'] | null = null;

  private readonly baseUrl = 'https://graph.microsoft.com/v1.0';

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
      const response = await this.makeRequest('/me');

      return {
        success: true,
        message: 'Successfully connected to Microsoft Outlook',
        durationMs: Date.now() - startTime,
        accountInfo: {
          id: response.id,
          email: response.mail || response.userPrincipalName,
          name: response.displayName,
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

    const calendars: Calendar[] = [];
    let nextLink: string | undefined = '/me/calendars';

    while (nextLink) {
      const response: MicrosoftCalendarListResponse = await this.makeRequest(nextLink);

      for (const cal of response.value) {
        calendars.push(this.mapCalendar(cal));
      }

      nextLink = response['@odata.nextLink']?.replace(this.baseUrl, '');
    }

    return calendars;
  }

  async getEvents(
    calendarId: string,
    startDate: Date,
    endDate: Date
  ): Promise<CalendarEvent[]> {
    await this.ensureValidToken();

    const events: CalendarEvent[] = [];
    const filter = `start/dateTime ge '${startDate.toISOString()}' and end/dateTime le '${endDate.toISOString()}'`;
    let nextLink: string | undefined = `/me/calendars/${encodeURIComponent(calendarId)}/events?$filter=${encodeURIComponent(filter)}&$orderby=start/dateTime&$top=100`;

    while (nextLink) {
      const response: MicrosoftEventsListResponse = await this.makeRequest(nextLink);

      for (const event of response.value) {
        if (!event.isCancelled) {
          events.push(this.mapEvent(event, calendarId));
        }
      }

      nextLink = response['@odata.nextLink']?.replace(this.baseUrl, '');
    }

    return events;
  }

  async createEvent(params: CreateEventParams): Promise<CalendarEvent> {
    await this.ensureValidToken();

    const calendarId = params.calendarId || 'primary';
    const calendarPath = calendarId === 'primary'
      ? '/me/calendar/events'
      : `/me/calendars/${encodeURIComponent(calendarId)}/events`;

    const eventBody: Record<string, unknown> = {
      subject: params.title,
      body: params.description
        ? { contentType: 'text', content: params.description }
        : undefined,
      location: params.location
        ? { displayName: params.location }
        : undefined,
      isAllDay: params.allDay || false,
    };

    if (params.allDay) {
      eventBody.start = {
        dateTime: params.startTime.toISOString().split('T')[0] + 'T00:00:00',
        timeZone: 'UTC',
      };
      eventBody.end = {
        dateTime: params.endTime.toISOString().split('T')[0] + 'T00:00:00',
        timeZone: 'UTC',
      };
    } else {
      eventBody.start = {
        dateTime: params.startTime.toISOString(),
        timeZone: 'UTC',
      };
      eventBody.end = {
        dateTime: params.endTime.toISOString(),
        timeZone: 'UTC',
      };
    }

    if (params.attendees && params.attendees.length > 0) {
      eventBody.attendees = params.attendees.map((email) => ({
        emailAddress: { address: email },
        type: 'required',
      }));
    }

    // Add Teams meeting if requested
    if (params.addConference) {
      eventBody.isOnlineMeeting = true;
      eventBody.onlineMeetingProvider = 'teamsForBusiness';
    }

    const response = await this.makeRequest(
      calendarPath,
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
    const eventPath = calendarId === 'primary'
      ? `/me/calendar/events/${encodeURIComponent(eventId)}`
      : `/me/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;

    const eventBody: Record<string, unknown> = {};

    if (updates.title !== undefined) {
      eventBody.subject = updates.title;
    }
    if (updates.description !== undefined) {
      eventBody.body = { contentType: 'text', content: updates.description };
    }
    if (updates.location !== undefined) {
      eventBody.location = { displayName: updates.location };
    }
    if (updates.startTime) {
      eventBody.start = updates.allDay
        ? { dateTime: updates.startTime.toISOString().split('T')[0] + 'T00:00:00', timeZone: 'UTC' }
        : { dateTime: updates.startTime.toISOString(), timeZone: 'UTC' };
    }
    if (updates.endTime) {
      eventBody.end = updates.allDay
        ? { dateTime: updates.endTime.toISOString().split('T')[0] + 'T00:00:00', timeZone: 'UTC' }
        : { dateTime: updates.endTime.toISOString(), timeZone: 'UTC' };
    }
    if (updates.attendees) {
      eventBody.attendees = updates.attendees.map((email) => ({
        emailAddress: { address: email },
        type: 'required',
      }));
    }
    if (updates.allDay !== undefined) {
      eventBody.isAllDay = updates.allDay;
    }

    const response = await this.makeRequest(eventPath, 'PATCH', eventBody);

    return this.mapEvent(response, calendarId);
  }

  async deleteEvent(
    eventId: string,
    calendarId: string = 'primary'
  ): Promise<{ success: boolean }> {
    await this.ensureValidToken();

    const eventPath = calendarId === 'primary'
      ? `/me/calendar/events/${encodeURIComponent(eventId)}`
      : `/me/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;

    await this.makeRequest(eventPath, 'DELETE');

    return { success: true };
  }

  async getFreeBusy(
    emails: string[],
    startDate: Date,
    endDate: Date
  ): Promise<Record<string, Array<{ start: Date; end: Date }>>> {
    await this.ensureValidToken();

    const response = await this.makeRequest(
      '/me/calendar/getSchedule',
      'POST',
      {
        schedules: emails,
        startTime: {
          dateTime: startDate.toISOString(),
          timeZone: 'UTC',
        },
        endTime: {
          dateTime: endDate.toISOString(),
          timeZone: 'UTC',
        },
        availabilityViewInterval: 30, // 30-minute intervals
      }
    );

    const result: Record<string, Array<{ start: Date; end: Date }>> = {};

    for (const schedule of response.value || []) {
      const email = schedule.scheduleId;
      result[email] = [];

      for (const item of schedule.scheduleItems || []) {
        if (item.status !== 'free') {
          result[email].push({
            start: new Date(item.start.dateTime),
            end: new Date(item.end.dateTime),
          });
        }
      }
    }

    return result;
  }

  // ============================================================================
  // Sync Operations
  // ============================================================================

  async deltaSync(
    calendarId: string,
    deltaLink?: string
  ): Promise<{
    events: CalendarEvent[];
    deletedIds: string[];
    nextDeltaLink?: string;
  }> {
    await this.ensureValidToken();

    const events: CalendarEvent[] = [];
    const deletedIds: string[] = [];

    // Build initial URL or use delta link
    let nextLink: string | undefined = deltaLink
      ? deltaLink.replace(this.baseUrl, '')
      : `/me/calendars/${encodeURIComponent(calendarId)}/events/delta`;

    let nextDeltaLink: string | undefined;

    while (nextLink) {
      const response: MicrosoftEventsListResponse = await this.makeRequest(nextLink);

      for (const event of response.value || []) {
        // Deleted events have @removed property
        if ((event as unknown as { '@removed'?: unknown })['@removed']) {
          deletedIds.push(event.id);
        } else if (!event.isCancelled) {
          events.push(this.mapEvent(event, calendarId));
        } else {
          deletedIds.push(event.id);
        }
      }

      if (response['@odata.deltaLink']) {
        nextDeltaLink = response['@odata.deltaLink'];
        nextLink = undefined;
      } else {
        nextLink = response['@odata.nextLink']?.replace(this.baseUrl, '');
      }
    }

    return { events, deletedIds, nextDeltaLink };
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

    const credentials = getOAuthCredentials('microsoft_outlook');
    if (!credentials) {
      throw new Error('Microsoft Outlook credentials not configured');
    }

    const provider = OAUTH_PROVIDERS.microsoft_outlook;

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
        scope: provider.defaultScopes?.join(' ') || '',
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

  private async makeRequest(
    path: string,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
    body?: Record<string, unknown>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any> {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
      Prefer: 'outlook.timezone="UTC"',
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (body && (method === 'POST' || method === 'PATCH')) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Microsoft Graph API error: ${response.status} - ${error}`);
    }

    if (method === 'DELETE' || response.status === 204) {
      return {};
    }

    return response.json();
  }

  // ============================================================================
  // Data Mapping
  // ============================================================================

  private mapCalendar(mcal: MicrosoftCalendar): Calendar {
    let accessRole: 'owner' | 'writer' | 'reader' = 'reader';
    if (mcal.canEdit && mcal.canShare) {
      accessRole = 'owner';
    } else if (mcal.canEdit) {
      accessRole = 'writer';
    }

    return {
      id: mcal.id,
      name: mcal.name,
      isPrimary: mcal.isDefaultCalendar,
      color: mcal.color,
      accessRole,
    };
  }

  private mapEvent(event: MicrosoftEvent, calendarId: string): CalendarEvent {
    const startTime = new Date(event.start.dateTime);
    const endTime = new Date(event.end.dateTime);

    let conferenceData: CalendarEvent['conferenceData'];
    if (event.onlineMeeting?.joinUrl) {
      let type: 'microsoft_teams' | 'zoom' | 'google_meet' = 'microsoft_teams';

      if (event.onlineMeetingProvider === 'teamsForBusiness' ||
          event.onlineMeetingProvider === 'skypeForBusiness') {
        type = 'microsoft_teams';
      } else if (event.onlineMeeting.joinUrl.includes('zoom.us')) {
        type = 'zoom';
      }

      conferenceData = {
        type,
        joinUrl: event.onlineMeeting.joinUrl,
      };
    }

    // Map Microsoft response status to our format
    const mapResponseStatus = (
      status?: string
    ): 'accepted' | 'declined' | 'tentative' | 'needsAction' => {
      switch (status) {
        case 'accepted':
          return 'accepted';
        case 'declined':
          return 'declined';
        case 'tentativelyAccepted':
          return 'tentative';
        default:
          return 'needsAction';
      }
    };

    // Map showAs to status
    let status: 'confirmed' | 'tentative' | 'cancelled' = 'confirmed';
    if (event.isCancelled) {
      status = 'cancelled';
    } else if (event.showAs === 'tentative') {
      status = 'tentative';
    }

    return {
      id: event.id,
      calendarId,
      title: event.subject || '(No title)',
      description: event.body?.content || event.bodyPreview,
      location: event.location?.displayName,
      startTime,
      endTime,
      allDay: event.isAllDay,
      status,
      attendees: event.attendees?.map((a) => ({
        email: a.emailAddress.address,
        name: a.emailAddress.name,
        responseStatus: mapResponseStatus(a.status?.response),
      })),
      conferenceData,
      recurrence: event.recurrence ? ['RRULE:' + JSON.stringify(event.recurrence)] : undefined,
    };
  }
}
