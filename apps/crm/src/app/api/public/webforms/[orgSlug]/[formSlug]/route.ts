import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { z } from 'zod';
import { executeMatchingWorkflows } from '@/lib/automation';
import type { CrmRecord } from '@/lib/crm/types';
import type { CrmWebform } from '@/lib/automation/types';

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
        { status: 404 }
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
        { status: 404 }
      );
    }

    const typedWebform = webform as CrmWebform;

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
        { status: 400 }
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
        });
      }

      if (strategy === 'update') {
        // Update existing record
        const updatedData = { ...existingRecord.data, ...dataFields };
        
        const { data: updated, error: updateError } = await supabase
          .from('crm_records')
          .update({
            ...extractedSystem,
            data: updatedData,
          })
          .eq('id', existingRecord.id)
          .select()
          .single();

        if (updateError) {
          console.error('Failed to update record:', updateError);
          return NextResponse.json(
            { success: false, error: 'Failed to process submission' },
            { status: 500 }
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
      // Create new record
      const { data: created, error: createError } = await supabase
        .from('crm_records')
        .insert({
          org_id: org.id,
          module_id: typedWebform.module_id,
          ...extractedSystem,
          data: dataFields,
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
          { status: 500 }
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

    return NextResponse.json(response);
  } catch (error) {
    console.error('Webform submission error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
      },
      { status: 500 }
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
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
