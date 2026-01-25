import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * Client calls this after signIn/signInWithOAuth.
 * We decode the user's access token to extract:
 *  - sub (user id)
 *  - app_metadata or user_metadata groups
 * Then apply group->role mapping server-side.
 */
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { 
      status: 405, 
      headers: corsHeaders 
    });
  }

  const auth = req.headers.get('Authorization') ?? '';
  const token = auth.replace('Bearer ', '').trim();
  
  if (!token) {
    return new Response('Unauthorized', { 
      status: 401, 
      headers: corsHeaders 
    });
  }

  try {
    // Verify JWT using Supabase's built-in verification
    // The token is verified by Supabase Auth before reaching this function
    // We decode it to extract the claims we need
    const parts = token.split('.');
    if (parts.length !== 3) {
      return new Response('Invalid token format', {
        status: 400,
        headers: corsHeaders
      });
    }

    // Base64 decode the JWT payload (signature already verified by Supabase Auth)
    let payload;
    try {
      payload = JSON.parse(atob(parts[1]));
    } catch (e) {
      return new Response('Invalid token encoding', {
        status: 400,
        headers: corsHeaders
      });
    }

    const sub: string | undefined = payload?.sub;

    if (!sub) {
      return new Response('Invalid token payload', {
        status: 400,
        headers: corsHeaders
      });
    }

    // Verify token hasn't expired
    const exp = payload?.exp;
    if (exp && Date.now() >= exp * 1000) {
      return new Response('Token expired', {
        status: 401,
        headers: corsHeaders
      });
    }

    const groupsFromApp = payload?.app_metadata?.groups;
    const groupsFromUser = payload?.user_metadata?.groups;
    const groups: string[] = Array.isArray(groupsFromApp)
      ? groupsFromApp
      : Array.isArray(groupsFromUser)
      ? groupsFromUser
      : [];

    // Apply mapping through RPC
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/apply_role_from_groups`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE}`,
        apikey: SERVICE_ROLE,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ u: sub, groups }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      return new Response(`Role mapping failed: ${errorText}`, { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    const newRole = await res.text();
    
    return new Response(
      JSON.stringify({ role: newRole.replace(/"/g, '') }), 
      { 
        status: 200, 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        } 
      }
    );
  } catch (error) {
    console.error('Post-login error:', error);
    return new Response(`Internal error: ${error}`, { 
      status: 500, 
      headers: corsHeaders 
    });
  }
});