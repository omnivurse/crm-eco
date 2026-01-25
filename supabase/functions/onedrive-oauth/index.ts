import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface OAuthCallbackRequest {
  code: string;
  state: string;
}

interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  refresh_token?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const encryptionSecret = Deno.env.get("OAUTH_ENCRYPTION_SECRET") || "change-me-in-production";

    const url = new URL(req.url);
    const path = url.pathname.split("/").pop();

    if (path === "authorize") {
      const clientId = Deno.env.get("ONEDRIVE_CLIENT_ID");
      const redirectUri = Deno.env.get("ONEDRIVE_REDIRECT_URI");

      if (!clientId || !redirectUri) {
        throw new Error("OneDrive OAuth credentials not configured");
      }

      const authUrl = new URL("https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
      authUrl.searchParams.set("client_id", clientId);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("scope", "Files.ReadWrite.All offline_access");
      authUrl.searchParams.set("state", crypto.randomUUID());

      return new Response(
        JSON.stringify({ authUrl: authUrl.toString() }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    if (path === "callback" && req.method === "POST") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        throw new Error("Missing authorization header");
      }

      const { code } = await req.json() as OAuthCallbackRequest;

      const clientId = Deno.env.get("ONEDRIVE_CLIENT_ID")!;
      const clientSecret = Deno.env.get("ONEDRIVE_CLIENT_SECRET")!;
      const redirectUri = Deno.env.get("ONEDRIVE_REDIRECT_URI")!;

      const tokenResponse = await fetch(
        "https://login.microsoftonline.com/common/oauth2/v2.0/token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            code: code,
            redirect_uri: redirectUri,
            grant_type: "authorization_code",
          }),
        }
      );

      if (!tokenResponse.ok) {
        const error = await tokenResponse.text();
        throw new Error(`Token exchange failed: ${error}`);
      }

      const tokens = await tokenResponse.json() as OAuthTokenResponse;

      const token = authHeader.replace("Bearer ", "");
      const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const user = await userResponse.json();

      const encryptResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/encrypt_token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseServiceKey}`,
          "apikey": supabaseServiceKey,
        },
        body: JSON.stringify({
          token: tokens.access_token,
          secret: encryptionSecret,
        }),
      });

      const encryptedAccessToken = await encryptResponse.text();

      let encryptedRefreshToken = null;
      if (tokens.refresh_token) {
        const refreshResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/encrypt_token`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
            "apikey": supabaseServiceKey,
          },
          body: JSON.stringify({
            token: tokens.refresh_token,
            secret: encryptionSecret,
          }),
        });
        encryptedRefreshToken = await refreshResponse.text();
      }

      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

      await fetch(`${supabaseUrl}/rest/v1/oauth_tokens`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseServiceKey}`,
          "apikey": supabaseServiceKey,
          "Prefer": "resolution=merge-duplicates",
        },
        body: JSON.stringify({
          user_id: user.id,
          provider: "onedrive",
          access_token_encrypted: encryptedAccessToken.replace(/"/g, ""),
          refresh_token_encrypted: encryptedRefreshToken?.replace(/"/g, ""),
          scope: tokens.scope,
          token_type: tokens.token_type,
          expires_at: expiresAt,
        }),
      });

      await fetch(`${supabaseUrl}/rest/v1/integrations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseServiceKey}`,
          "apikey": supabaseServiceKey,
          "Prefer": "resolution=merge-duplicates",
        },
        body: JSON.stringify({
          user_id: user.id,
          provider: "onedrive",
          is_active: true,
          metadata: { connected_at: new Date().toISOString() },
        }),
      });

      return new Response(
        JSON.stringify({ success: true, message: "OneDrive connected successfully" }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    if (path === "disconnect" && req.method === "POST") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        throw new Error("Missing authorization header");
      }

      const token = authHeader.replace("Bearer ", "");
      const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const user = await userResponse.json();

      await fetch(`${supabaseUrl}/rest/v1/oauth_tokens?user_id=eq.${user.id}&provider=eq.onedrive`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${supabaseServiceKey}`,
          "apikey": supabaseServiceKey,
        },
      });

      await fetch(`${supabaseUrl}/rest/v1/integrations?user_id=eq.${user.id}&provider=eq.onedrive`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
          "apikey": supabaseServiceKey,
        },
      });

      return new Response(
        JSON.stringify({ success: true, message: "OneDrive disconnected successfully" }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    throw new Error("Invalid endpoint");

  } catch (error) {
    console.error("OneDrive OAuth error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
