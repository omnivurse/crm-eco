/**
 * Enrollment Link Tracking Service
 *
 * Tracks enrollment links, visits, and conversions for advisor marketing
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types';

// Types
export interface EnrollmentLink {
  id: string;
  organizationId: string;
  advisorId: string;
  name: string;
  slug: string;
  description?: string;
  targetUrl?: string;
  productId?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  isActive: boolean;
  requiresPassword: boolean;
  maxUses?: number;
  expiresAt?: string;
  totalVisits: number;
  uniqueVisits: number;
  totalConversions: number;
  conversionRate: number;
  createdAt: string;
  updatedAt: string;
}

export interface LinkVisit {
  id: string;
  linkId: string;
  sessionId: string;
  visitorId?: string;
  visitedAt: string;
  durationSeconds?: number;
  ipAddress?: string;
  userAgent?: string;
  deviceType?: string;
  browser?: string;
  os?: string;
  country?: string;
  city?: string;
  referrerUrl?: string;
  referrerDomain?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  landingPage?: string;
  converted: boolean;
  conversionId?: string;
  pageViews: number;
}

export interface LinkConversion {
  id: string;
  linkId: string;
  visitId?: string;
  advisorId?: string;
  enrollmentId?: string;
  memberId?: string;
  convertedAt: string;
  timeToConvertSeconds?: number;
  visitsBeforeConversion: number;
  conversionValue?: number;
  lifetimeValue?: number;
}

export interface LinkAnalytics {
  id: string;
  linkId: string;
  periodDate: string;
  periodType: 'daily' | 'weekly' | 'monthly';
  totalVisits: number;
  uniqueVisitors: number;
  newVisitors: number;
  returningVisitors: number;
  desktopVisits: number;
  mobileVisits: number;
  tabletVisits: number;
  avgDurationSeconds: number;
  bounceRate: number;
  totalConversions: number;
  conversionRate: number;
  conversionValue: number;
  topReferrers: { domain: string; count: number }[];
  topCountries: { country: string; count: number }[];
}

export interface CreateLinkInput {
  advisorId: string;
  name: string;
  slug?: string;
  description?: string;
  targetUrl?: string;
  productId?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  requiresPassword?: boolean;
  password?: string;
  maxUses?: number;
  expiresAt?: string;
}

export interface TrackVisitInput {
  linkSlug: string;
  sessionId: string;
  visitorId?: string;
  ipAddress?: string;
  userAgent?: string;
  referrerUrl?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  landingPage?: string;
}

export interface TrackConversionInput {
  linkId: string;
  visitId?: string;
  enrollmentId?: string;
  memberId?: string;
  conversionValue?: number;
}

/**
 * Link Tracking Service
 */
export class LinkTrackingService {
  private supabase: SupabaseClient<Database>;
  private organizationId: string;

  constructor(supabase: SupabaseClient<Database>, organizationId: string) {
    this.supabase = supabase;
    this.organizationId = organizationId;
  }

  /**
   * Create a new enrollment link
   */
  async createLink(input: CreateLinkInput): Promise<EnrollmentLink> {
    // Generate slug if not provided
    let slug = input.slug || this.generateSlug(input.name);

    // Ensure slug is unique
    slug = await this.ensureUniqueSlug(slug);

    // Hash password if provided
    let passwordHash: string | null = null;
    if (input.requiresPassword && input.password) {
      passwordHash = await this.hashPassword(input.password);
    }

    const { data, error } = await this.supabase
      .from('enrollment_links')
      .insert({
        organization_id: this.organizationId,
        advisor_id: input.advisorId,
        name: input.name,
        slug,
        description: input.description,
        target_url: input.targetUrl,
        product_id: input.productId,
        utm_source: input.utmSource,
        utm_medium: input.utmMedium,
        utm_campaign: input.utmCampaign,
        utm_term: input.utmTerm,
        utm_content: input.utmContent,
        is_active: true,
        requires_password: input.requiresPassword || false,
        password_hash: passwordHash,
        max_uses: input.maxUses,
        expires_at: input.expiresAt,
        total_visits: 0,
        unique_visits: 0,
        total_conversions: 0,
        conversion_rate: 0,
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Failed to create link');
    }

    return this.mapLink(data);
  }

  /**
   * Get links for an advisor
   */
  async getLinksForAdvisor(advisorId: string): Promise<EnrollmentLink[]> {
    const { data, error } = await this.supabase
      .from('enrollment_links')
      .select('*')
      .eq('organization_id', this.organizationId)
      .eq('advisor_id', advisorId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return (data || []).map(this.mapLink);
  }

  /**
   * Get a link by slug
   */
  async getLinkBySlug(slug: string): Promise<EnrollmentLink | null> {
    const { data, error } = await this.supabase
      .from('enrollment_links')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      return null;
    }

    // Check if link is expired
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return null;
    }

    // Check if max uses reached
    if (data.max_uses && data.total_visits >= data.max_uses) {
      return null;
    }

    return this.mapLink(data);
  }

  /**
   * Track a visit to a link
   */
  async trackVisit(input: TrackVisitInput): Promise<string | null> {
    // Get the link
    const link = await this.getLinkBySlug(input.linkSlug);
    if (!link) {
      return null;
    }

    // Parse user agent for device info
    const deviceInfo = this.parseUserAgent(input.userAgent || '');
    const referrerDomain = this.extractDomain(input.referrerUrl);

    const { data, error } = await this.supabase
      .from('enrollment_link_visits')
      .insert({
        organization_id: this.organizationId,
        link_id: link.id,
        advisor_id: link.advisorId,
        session_id: input.sessionId,
        visitor_id: input.visitorId,
        ip_address: input.ipAddress,
        user_agent: input.userAgent,
        device_type: deviceInfo.deviceType,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        referrer_url: input.referrerUrl,
        referrer_domain: referrerDomain,
        utm_source: input.utmSource || link.utmSource,
        utm_medium: input.utmMedium || link.utmMedium,
        utm_campaign: input.utmCampaign || link.utmCampaign,
        utm_term: input.utmTerm,
        utm_content: input.utmContent,
        landing_page: input.landingPage,
        converted: false,
        page_views: 1,
      })
      .select('id')
      .single();

    if (error || !data) {
      console.error('Failed to track visit:', error);
      return null;
    }

    return data.id;
  }

  /**
   * Update visit duration and page views
   */
  async updateVisit(visitId: string, durationSeconds: number, pageViews: number): Promise<void> {
    await this.supabase
      .from('enrollment_link_visits')
      .update({
        duration_seconds: durationSeconds,
        page_views: pageViews,
      })
      .eq('id', visitId);
  }

  /**
   * Track a conversion
   */
  async trackConversion(input: TrackConversionInput): Promise<string> {
    // Get visit info if visit ID provided
    let firstTouchAt: string | null = null;
    let visitsBeforeConversion = 1;
    let timeToConvert: number | null = null;
    let advisorId: string | null = null;

    if (input.visitId) {
      const { data: visit } = await this.supabase
        .from('enrollment_link_visits')
        .select('*, enrollment_links!inner(advisor_id)')
        .eq('id', input.visitId)
        .single();

      if (visit) {
        firstTouchAt = visit.visited_at;
        advisorId = (visit.enrollment_links as { advisor_id: string }).advisor_id;
        timeToConvert = Math.floor(
          (new Date().getTime() - new Date(visit.visited_at).getTime()) / 1000
        );

        // Count previous visits from same visitor
        if (visit.visitor_id) {
          const { count } = await this.supabase
            .from('enrollment_link_visits')
            .select('*', { count: 'exact', head: true })
            .eq('link_id', input.linkId)
            .eq('visitor_id', visit.visitor_id);
          visitsBeforeConversion = count || 1;
        }
      }
    }

    const { data, error } = await this.supabase
      .from('enrollment_link_conversions')
      .insert({
        organization_id: this.organizationId,
        link_id: input.linkId,
        visit_id: input.visitId,
        advisor_id: advisorId,
        enrollment_id: input.enrollmentId,
        member_id: input.memberId,
        converted_at: new Date().toISOString(),
        time_to_convert_seconds: timeToConvert,
        visits_before_conversion: visitsBeforeConversion,
        first_touch_at: firstTouchAt,
        last_touch_at: new Date().toISOString(),
        conversion_value: input.conversionValue,
      })
      .select('id')
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Failed to track conversion');
    }

    return data.id;
  }

  /**
   * Get analytics for a link
   */
  async getLinkAnalytics(
    linkId: string,
    periodType: 'daily' | 'weekly' | 'monthly' = 'daily',
    startDate?: Date,
    endDate?: Date
  ): Promise<LinkAnalytics[]> {
    let query = this.supabase
      .from('enrollment_link_analytics')
      .select('*')
      .eq('link_id', linkId)
      .eq('period_type', periodType)
      .order('period_date', { ascending: false });

    if (startDate) {
      query = query.gte('period_date', startDate.toISOString().split('T')[0]);
    }
    if (endDate) {
      query = query.lte('period_date', endDate.toISOString().split('T')[0]);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    return (data || []).map(this.mapAnalytics);
  }

  /**
   * Get visit history for a link
   */
  async getVisitHistory(
    linkId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<LinkVisit[]> {
    let query = this.supabase
      .from('enrollment_link_visits')
      .select('*')
      .eq('link_id', linkId)
      .order('visited_at', { ascending: false });

    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    return (data || []).map(this.mapVisit);
  }

  /**
   * Get conversion history for a link
   */
  async getConversionHistory(
    linkId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<LinkConversion[]> {
    let query = this.supabase
      .from('enrollment_link_conversions')
      .select('*')
      .eq('link_id', linkId)
      .order('converted_at', { ascending: false });

    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    return (data || []).map(this.mapConversion);
  }

  /**
   * Update link
   */
  async updateLink(
    linkId: string,
    updates: Partial<CreateLinkInput>
  ): Promise<EnrollmentLink> {
    const updateData: Record<string, unknown> = {};

    if (updates.name) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.targetUrl !== undefined) updateData.target_url = updates.targetUrl;
    if (updates.productId !== undefined) updateData.product_id = updates.productId;
    if (updates.utmSource !== undefined) updateData.utm_source = updates.utmSource;
    if (updates.utmMedium !== undefined) updateData.utm_medium = updates.utmMedium;
    if (updates.utmCampaign !== undefined) updateData.utm_campaign = updates.utmCampaign;
    if (updates.utmTerm !== undefined) updateData.utm_term = updates.utmTerm;
    if (updates.utmContent !== undefined) updateData.utm_content = updates.utmContent;
    if (updates.maxUses !== undefined) updateData.max_uses = updates.maxUses;
    if (updates.expiresAt !== undefined) updateData.expires_at = updates.expiresAt;

    if (updates.requiresPassword !== undefined) {
      updateData.requires_password = updates.requiresPassword;
      if (updates.password) {
        updateData.password_hash = await this.hashPassword(updates.password);
      }
    }

    const { data, error } = await this.supabase
      .from('enrollment_links')
      .update(updateData)
      .eq('id', linkId)
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Failed to update link');
    }

    return this.mapLink(data);
  }

  /**
   * Deactivate a link
   */
  async deactivateLink(linkId: string): Promise<void> {
    await this.supabase
      .from('enrollment_links')
      .update({ is_active: false })
      .eq('id', linkId);
  }

  // Helper methods
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private async ensureUniqueSlug(slug: string): Promise<string> {
    let uniqueSlug = slug;
    let counter = 1;

    while (true) {
      const { count } = await this.supabase
        .from('enrollment_links')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', this.organizationId)
        .eq('slug', uniqueSlug);

      if (!count || count === 0) {
        return uniqueSlug;
      }

      uniqueSlug = `${slug}-${counter}`;
      counter++;
    }
  }

  private async hashPassword(password: string): Promise<string> {
    // Simple hash for demo - in production use bcrypt or similar
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private parseUserAgent(userAgent: string): { deviceType: string; browser: string; os: string } {
    let deviceType = 'desktop';
    let browser = 'Unknown';
    let os = 'Unknown';

    if (/mobile/i.test(userAgent)) deviceType = 'mobile';
    else if (/tablet|ipad/i.test(userAgent)) deviceType = 'tablet';

    if (/chrome/i.test(userAgent)) browser = 'Chrome';
    else if (/firefox/i.test(userAgent)) browser = 'Firefox';
    else if (/safari/i.test(userAgent)) browser = 'Safari';
    else if (/edge/i.test(userAgent)) browser = 'Edge';
    else if (/msie|trident/i.test(userAgent)) browser = 'IE';

    if (/windows/i.test(userAgent)) os = 'Windows';
    else if (/macintosh|mac os/i.test(userAgent)) os = 'macOS';
    else if (/linux/i.test(userAgent)) os = 'Linux';
    else if (/android/i.test(userAgent)) os = 'Android';
    else if (/iphone|ipad|ipod/i.test(userAgent)) os = 'iOS';

    return { deviceType, browser, os };
  }

  private extractDomain(url?: string): string | null {
    if (!url) return null;
    try {
      return new URL(url).hostname;
    } catch {
      return null;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapLink = (row: any): EnrollmentLink => ({
    id: row.id,
    organizationId: row.organization_id,
    advisorId: row.advisor_id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    targetUrl: row.target_url,
    productId: row.product_id,
    utmSource: row.utm_source,
    utmMedium: row.utm_medium,
    utmCampaign: row.utm_campaign,
    utmTerm: row.utm_term,
    utmContent: row.utm_content,
    isActive: row.is_active,
    requiresPassword: row.requires_password,
    maxUses: row.max_uses,
    expiresAt: row.expires_at,
    totalVisits: row.total_visits,
    uniqueVisits: row.unique_visits,
    totalConversions: row.total_conversions,
    conversionRate: row.conversion_rate,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapVisit = (row: any): LinkVisit => ({
    id: row.id,
    linkId: row.link_id,
    sessionId: row.session_id,
    visitorId: row.visitor_id,
    visitedAt: row.visited_at,
    durationSeconds: row.duration_seconds,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    deviceType: row.device_type,
    browser: row.browser,
    os: row.os,
    country: row.country,
    city: row.city,
    referrerUrl: row.referrer_url,
    referrerDomain: row.referrer_domain,
    utmSource: row.utm_source,
    utmMedium: row.utm_medium,
    utmCampaign: row.utm_campaign,
    landingPage: row.landing_page,
    converted: row.converted,
    conversionId: row.conversion_id,
    pageViews: row.page_views,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapConversion = (row: any): LinkConversion => ({
    id: row.id,
    linkId: row.link_id,
    visitId: row.visit_id,
    advisorId: row.advisor_id,
    enrollmentId: row.enrollment_id,
    memberId: row.member_id,
    convertedAt: row.converted_at,
    timeToConvertSeconds: row.time_to_convert_seconds,
    visitsBeforeConversion: row.visits_before_conversion,
    conversionValue: row.conversion_value,
    lifetimeValue: row.lifetime_value,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapAnalytics = (row: any): LinkAnalytics => ({
    id: row.id,
    linkId: row.link_id,
    periodDate: row.period_date,
    periodType: row.period_type,
    totalVisits: row.total_visits,
    uniqueVisitors: row.unique_visitors,
    newVisitors: row.new_visitors,
    returningVisitors: row.returning_visitors,
    desktopVisits: row.desktop_visits,
    mobileVisits: row.mobile_visits,
    tabletVisits: row.tablet_visits,
    avgDurationSeconds: row.avg_duration_seconds,
    bounceRate: row.bounce_rate,
    totalConversions: row.total_conversions,
    conversionRate: row.conversion_rate,
    conversionValue: row.conversion_value,
    topReferrers: row.top_referrers || [],
    topCountries: row.top_countries || [],
  });
}

export function createLinkTrackingService(
  supabase: SupabaseClient<Database>,
  organizationId: string
): LinkTrackingService {
  return new LinkTrackingService(supabase, organizationId);
}
