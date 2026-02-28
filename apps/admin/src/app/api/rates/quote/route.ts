import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { requireAdminRole } from '@/lib/auth';
import { quote } from '@crm-eco/rates';
import type { RateConfig, QuoteInput, QuoteOptions } from '@crm-eco/rates/types';
import seedConfig from '@crm-eco/rates/config';

export const dynamic = 'force-dynamic';

/**
 * POST /api/rates/quote
 * Run the rate engine and return a QuoteResult.
 * Body: { input: QuoteInput, options?: QuoteOptions, useDbConfig?: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    const { profile, error: authError } = await requireAdminRole(supabase);
    if (authError) return authError;

    const body = await request.json();
    const { input, options } = body as {
      input: QuoteInput;
      options?: QuoteOptions;
    };

    if (!input?.planId || !input?.coverageTier || !input?.household?.memberAge || !input?.coverageStart) {
      return NextResponse.json(
        { error: 'Missing required fields: planId, coverageTier, household.memberAge, coverageStart' },
        { status: 400 }
      );
    }

    // Check for admin rate set override from system_settings
    let effectiveOptions = options || {};

    if (!effectiveOptions.rateSetOverride) {
      const { data: setting } = await (supabase as any)
        .from('system_settings')
        .select('setting_value')
        .eq('organization_id', profile.organization_id)
        .eq('setting_key', 'active_rate_set')
        .single();

      if (setting?.setting_value) {
        effectiveOptions = {
          ...effectiveOptions,
          rateSetOverride: setting.setting_value as 'current' | 'rates_2026',
        };
      }
    }

    const config = seedConfig as unknown as RateConfig;
    const result = quote(config, input, effectiveOptions);

    return NextResponse.json(result);
  } catch (err) {
    console.error('Rate quote error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
