import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Initialize Supabase Admin client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify user is admin
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if user is admin or super_admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || !["admin", "super_admin"].includes(profile.role)) {
      return new Response(
        JSON.stringify({ error: "Insufficient permissions" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get the email to purge from request body
    const body = await req.json();
    const emailToPurge = body.email;

    if (!emailToPurge) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Attempting to purge deleted users with email: ${emailToPurge}`);

    // Use admin API to list users (including soft-deleted ones)
    const listResponse = await fetch(
      `${supabaseUrl}/auth/v1/admin/users`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          apikey: supabaseServiceKey,
        },
      }
    );

    if (!listResponse.ok) {
      throw new Error(`Failed to list users: ${await listResponse.text()}`);
    }

    const usersData = await listResponse.json();
    const users = usersData.users || [];

    // Find all users with this email (including soft-deleted)
    const matchingUsers = users.filter(
      (u: any) => u.email === emailToPurge && u.deleted_at !== null
    );

    if (matchingUsers.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `No deleted users found with email: ${emailToPurge}`,
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Found ${matchingUsers.length} deleted user(s) to purge`);

    // Permanently delete each soft-deleted user
    const purgedUsers = [];
    for (const deletedUser of matchingUsers) {
      try {
        // Hard delete using shouldSoftDelete=false parameter
        const deleteResponse = await fetch(
          `${supabaseUrl}/auth/v1/admin/users/${deletedUser.id}?should_soft_delete=false`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${supabaseServiceKey}`,
              apikey: supabaseServiceKey,
            },
          }
        );

        if (deleteResponse.ok) {
          console.log(`Permanently deleted user: ${deletedUser.id}`);
          purgedUsers.push({
            id: deletedUser.id,
            email: deletedUser.email,
            deleted_at: deletedUser.deleted_at,
          });
        } else {
          console.error(
            `Failed to delete user ${deletedUser.id}: ${await deleteResponse.text()}`
          );
        }
      } catch (err) {
        console.error(`Error deleting user ${deletedUser.id}:`, err);
      }
    }

    // Log audit
    await supabase.from("audit_logs").insert({
      actor_id: user.id,
      action: "purge_deleted_users",
      details: {
        email: emailToPurge,
        purged_count: purgedUsers.length,
        purged_users: purgedUsers,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully purged ${purgedUsers.length} deleted user(s)`,
        email: emailToPurge,
        purged_users: purgedUsers,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Purge error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
