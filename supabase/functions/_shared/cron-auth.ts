/**
 * Shared fail-closed auth for internal/cron edge functions.
 * Accepts:
 *   - Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
 *   - Authorization: Bearer <CRON_SECRET>
 *   - x-cron-secret: <CRON_SECRET>
 *
 * If CRON_SECRET is unset, only the service-role bearer is accepted
 * (never fail-open).
 */

export function authorizeInternalEdgeRequest(req: Request): boolean {
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";

  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const headerSecret = req.headers.get("x-cron-secret")?.trim() ?? "";

  if (serviceRole && bearer && bearer === serviceRole) return true;
  if (cronSecret && bearer && bearer === cronSecret) return true;
  if (cronSecret && headerSecret && headerSecret === cronSecret) return true;

  return false;
}

export function unauthorizedResponse(
  corsHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
