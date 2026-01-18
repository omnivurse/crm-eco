import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();

    // Check auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, organization_id')
      .eq('user_id', user.id)
      .single() as { data: { id: string; organization_id: string } | null };

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Get user email settings
    // Note: Using type assertion since user_email_settings table is not in generated types yet
    const { data: settings, error } = await (supabase as any)
      .from('user_email_settings')
      .select('*')
      .eq('profile_id', profile.id)
      .single();

    // If no settings exist, return defaults
    if (error && error.code === 'PGRST116') {
      return NextResponse.json({
        settings: {
          default_sender_address_id: null,
          default_signature_id: null,
          default_reply_to: null,
          default_cc: [],
          default_bcc: [],
          track_opens: true,
          track_clicks: true,
          preferred_send_time: null,
          timezone: 'America/New_York',
          daily_send_limit: 500,
          emails_sent_today: 0,
        },
      });
    }

    if (error) {
      console.error('Error fetching settings:', error);
      return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
    }

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Email settings GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    // Check auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, organization_id')
      .eq('user_id', user.id)
      .single() as { data: { id: string; organization_id: string } | null };

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const body = await request.json();

    // Validate body fields
    const allowedFields = [
      'default_sender_address_id',
      'default_signature_id',
      'default_reply_to',
      'default_cc',
      'default_bcc',
      'track_opens',
      'track_clicks',
      'preferred_send_time',
      'timezone',
    ];

    const updateData: Record<string, unknown> = {
      org_id: profile.organization_id,
      profile_id: profile.id,
      updated_at: new Date().toISOString(),
    };

    for (const field of allowedFields) {
      if (field in body) {
        updateData[field] = body[field];
      }
    }

    // Upsert settings
    // Note: Using type assertion since user_email_settings table is not in generated types yet
    const { data: settings, error } = await (supabase as any)
      .from('user_email_settings')
      .upsert(updateData, {
        onConflict: 'profile_id',
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving settings:', error);
      return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
    }

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Email settings PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
