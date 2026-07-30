import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { z } from 'zod';
import { executeMatchingWorkflows } from '@/lib/automation';
import type { CrmRecord } from '@/lib/crm/types';
import type { CrmWebform } from '@/lib/automation/types';
import { rateLimitDurable, getRateLimitHeaders } from '@crm-eco/lib/rate-limit';
import {
  buildNormalizedRecordWrite,
  pickUpdateMirrorColumns,
} from '@/lib/crm/merge-crm-data-json-to-row';

/**
 * Creates a service role client for public webform submissions
 */
function createServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return []; },
        setAll() {},
      },
    }
  );
}

interface RouteParams {
  params: Promise<{
    orgSlug: string;
    formSlug: string;
  }>;
}

/**
 * POST /api/public/webforms/[orgSlug]/[formSlug]
 * Public endpoint for webform submissions
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const origin = request.headers.get('origin') || '';
  const allowedOrigins = [
    process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_WEBSITE_URL,
    'https://doublehelixhub.com',
    'https://www.doublehelixhub.com',
  ].filter(Boolean);
  const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || '';
  const corsHeaders = {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
  const rateLimitResult = await rateLimitDurable(`webform:${ip}`, {
    limit: 10,
    windowSeconds: 60 * 60,
  });
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many submissions. Please try again later.' },
      { status: 429, headers: { ...corsHeaders, ...getRateLimitHeaders(rateLimitResult) } }
    );
  }

  try {
    const { orgSlug, formSlug } = await params;
    const supabase = createServiceClient();

    // Get organization by slug
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', orgSlug)
      .single();

    if (orgError || !org) {
      return NextResponse.json(
        { success: false, error: 'Organization not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    // Get webform by slug
    const { data: webform, error: webformError } = await supabase
      .from('crm_webforms')
      .select('*')
      .eq('org_id', org.id)
      .eq('slug', formSlug)
      .eq('is_enabled', true)
      .single();

    if (webformError || !webform) {
      return NextResponse.json(
        { success: false, error: 'Form not found or disabled' },
        { status: 404, headers: corsHeaders }
      );
    }

    const typedWebform = webform as CrmWebform;

    // Resolve the module key so record writes normalize consistently with the
    // form-create/edit paths (person-module title + status handling).
    const { data: moduleRow } = await supabase
      .from('crm_modules')
      .select('key')
      .eq('id', typedWebform.module_id)
      .maybeSingle();
    const moduleKey = (moduleRow as { key: string | null } | null)?.key ?? null;

    // Parse submission data
    let submissionData: Record<string, unknown>;
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      submissionData = await request.json();
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData();
      submissionData = Object.fromEntries(formData.entries());
    } else {
      return NextResponse.json(
        { success: false, error: 'Unsupported content type' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Merge with hidden fields
    const recordData = {
      ...typedWebform.hidden_fields,
      ...submissionData,
      _webform_id: typedWebform.id,
      _webform_submitted_at: new Date().toISOString(),
    };

    // Extract system fields
    const systemFields = ['title', 'status', 'stage', 'email', 'phone'];
    const dataFields: Record<string, unknown> = {};
    const extractedSystem: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(recordData)) {
      if (systemFields.includes(key)) {
        extractedSystem[key] = value;
      } else {
        dataFields[key] = value;
      }
    }

    // Generate title if not provided
    if (!extractedSystem.title) {
      const firstName = dataFields.first_name || '';
      const lastName = dataFields.last_name || '';
      const email = extractedSystem.email || dataFields.email;
      extractedSystem.title = firstName || lastName 
        ? `${firstName} ${lastName}`.trim()
        : email || 'Webform Submission';
    }

    // Check for duplicates based on dedupe config
    let existingRecord: CrmRecord | null = null;
    const dedupeConfig = typedWebform.dedupe_config;

    if (dedupeConfig?.enabled && dedupeConfig.fields?.length > 0) {
      // Build dedupe query
      let query = supabase
        .from('crm_records')
        .select('*')
        .eq('org_id', org.id)
        .eq('module_id', typedWebform.module_id);

      for (const field of dedupeConfig.fields) {
        const value = extractedSystem[field] || dataFields[field];
        if (value) {
          if (systemFields.includes(field)) {
            query = query.eq(field, value);
          } else {
            query = query.eq(`data->>${field}`, value);
          }
        }
      }

      const { data: duplicates } = await query.limit(1);
      existingRecord = duplicates?.[0] as CrmRecord | null;
    }

    let record: CrmRecord;
    let isNew = true;

    if (existingRecord) {
      const strategy = dedupeConfig?.strategy || 'update';

      if (strategy === 'skip') {
        // Increment submit count
        await supabase.rpc('increment_webform_submit_count', { p_webform_id: typedWebform.id });

        return NextResponse.json({
          success: true,
          message: typedWebform.success_message,
          recordId: existingRecord.id,
          duplicate: true,
        }, { headers: corsHeaders });
      }

      if (strategy === 'update') {
        // Update existing record — normalize the merged JSONB and mirror
        // canonical values onto indexed columns so the update displays/filters.
        const mergedData = { ...existingRecord.data, ...dataFields };
        const norm = buildNormalizedRecordWrite(mergedData, {
          moduleKey,
          previousTitle: existingRecord.title,
        });

        const { data: updated, error: updateError } = await supabase
          .from('crm_records')
          .update({
            // On update, don't re-mirror out-of-band-owned columns from stale JSONB.
            ...pickUpdateMirrorColumns(norm.columns),
            ...extractedSystem,
            data: norm.data,
          })
          .eq('id', existingRecord.id)
          .select()
          .single();

        if (updateError) {
          console.error('Failed to update record:', updateError);
          return NextResponse.json(
            { success: false, error: 'Failed to process submission' },
            { status: 500, headers: corsHeaders }
          );
        }

        record = updated as CrmRecord;
        isNew = false;
      } else {
        // create_duplicate - fall through to create
        existingRecord = null;
      }
    }

    if (!existingRecord) {
      // Create new record — normalize JSONB + mirror indexed columns.
      const norm = buildNormalizedRecordWrite(dataFields, {
        moduleKey,
        previousTitle: (extractedSystem.title as string | null) ?? null,
      });
      const { data: created, error: createError } = await supabase
        .from('crm_records')
        .insert({
          org_id: org.id,
          module_id: typedWebform.module_id,
          ...norm.columns,
          ...extractedSystem,
          data: norm.data,
          system: {
            source: 'webform',
            webform_id: typedWebform.id,
          },
        })
        .select()
        .single();

      if (createError) {
        console.error('Failed to create record:', createError);
        return NextResponse.json(
          { success: false, error: 'Failed to process submission' },
          { status: 500, headers: corsHeaders }
        );
      }

      record = created as CrmRecord;
    }

    // Increment webform submit count
    await supabase.rpc('increment_webform_submit_count', { p_webform_id: typedWebform.id });

    // Trigger webform workflows (fire and forget for faster response)
    executeMatchingWorkflows({
      orgId: org.id,
      moduleId: typedWebform.module_id,
      record: record!,
      trigger: 'webform',
      dryRun: false,
    }).catch(error => {
      console.error('Webform workflow execution error:', error);
    });

    // Return success
    const response: Record<string, unknown> = {
      success: true,
      message: typedWebform.success_message,
      recordId: record!.id,
      isNew,
    };

    // If redirect URL is set, include it
    if (typedWebform.redirect_url) {
      response.redirectUrl = typedWebform.redirect_url;
    }

    return NextResponse.json(response, { headers: corsHeaders });
  } catch (error) {
    console.error('Webform submission error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * GET /api/public/webforms/[orgSlug]/[formSlug]
 * Get webform configuration for rendering
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { orgSlug, formSlug } = await params;
    const supabase = createServiceClient();

    // Get organization by slug
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('slug', orgSlug)
      .single();

    if (orgError || !org) {
      return NextResponse.json(
        { success: false, error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Get webform by slug
    const { data: webform, error: webformError } = await supabase
      .from('crm_webforms')
      .select('id, name, slug, description, layout, success_message, redirect_url, module_id')
      .eq('org_id', org.id)
      .eq('slug', formSlug)
      .eq('is_enabled', true)
      .single();

    if (webformError || !webform) {
      return NextResponse.json(
        { success: false, error: 'Form not found or disabled' },
        { status: 404 }
      );
    }

    // Get field definitions for the module
    const { data: fields } = await supabase
      .from('crm_fields')
      .select('key, label, type, required, options, tooltip, default_value')
      .eq('module_id', webform.module_id)
      .order('display_order');

    return NextResponse.json({
      success: true,
      organization: {
        name: org.name,
      },
      webform: {
        id: webform.id,
        name: webform.name,
        description: webform.description,
        layout: webform.layout,
        successMessage: webform.success_message,
        redirectUrl: webform.redirect_url,
      },
      fields: fields || [],
    });
  } catch (error) {
    console.error('Webform config error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS handler for CORS
 */
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin') || '';
  const allowedOrigins = [
    process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_WEBSITE_URL,
    'https://doublehelixhub.com',
    'https://www.doublehelixhub.com',
  ].filter(Boolean);
  const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || '';

  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
