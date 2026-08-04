import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  authorizeInternalEdgeRequest,
  unauthorizedResponse,
} from "../_shared/cron-auth.ts";
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") || Deno.env.get("ALLOWED_ORIGIN") || "*").split(",").map(s => s.trim());

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes("*") ? "*" : (ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]);
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
  };
}

async function getOrgEmailConfig(supabaseUrl: string, supabaseServiceKey: string, organizationId: string) {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/system_settings?organization_id=eq.${organizationId}&category=eq.email&setting_key=in.(%22email_from_address%22,%22email_from_name%22)&select=setting_key,setting_value`,
    {
      headers: {
        Authorization: `Bearer ${supabaseServiceKey}`,
        apikey: supabaseServiceKey,
        'Content-Type': 'application/json',
      },
    }
  );

  const config: Record<string, string> = {};
  if (res.ok) {
    const settings = await res.json();
    (settings || []).forEach((s: any) => { config[s.setting_key] = s.setting_value; });
  }

  return {
    fromEmail: config.email_from_address || Deno.env.get('FROM_EMAIL') || 'noreply@mail.doublehelixhub.com',
    fromName: config.email_from_name || Deno.env.get('RESEND_FROM_NAME') || 'Double Helix Hub',
  };
}

interface EmailPayload {
  notificationId?: string;
  ticketId: string;
  recipientEmail: string;
  recipientName?: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  notificationType?: string;
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  // Fail closed. Service-role key (RLS bypassed), no caller check previously —
  // it reads a ticket and emails its contents, so an open endpoint leaks support
  // correspondence. `verify_jwt` accepts the public anon key, so it
  // authenticates nothing on its own.
  //
  // NOTE: this function has NO caller anywhere in the repo (apps, packages,
  // migrations all searched). If it turns out to be invoked from a UI path with
  // a user JWT rather than a DB trigger / service-role caller, swap this for
  // callerMayAccessOrg() anchored to the ticket's organization_id — the lookup
  // already happens below.
  if (!authorizeInternalEdgeRequest(req)) return unauthorizedResponse(corsHeaders);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const payload: EmailPayload = await req.json();

    const {
      notificationId,
      ticketId,
      recipientEmail,
      recipientName,
      subject,
      bodyText,
      bodyHtml,
      notificationType = "manual",
    } = payload;

    // Look up the ticket's organization_id for per-org email config
    let orgEmailConfig = { fromEmail: Deno.env.get('FROM_EMAIL') || 'noreply@mail.doublehelixhub.com', fromName: 'Double Helix Hub' };
    if (ticketId) {
      const ticketRes = await fetch(
        `${supabaseUrl}/rest/v1/tickets?id=eq.${ticketId}&select=organization_id`,
        {
          headers: {
            Authorization: `Bearer ${supabaseServiceKey}`,
            apikey: supabaseServiceKey,
            'Content-Type': 'application/json',
          },
        }
      );
      if (ticketRes.ok) {
        const tickets = await ticketRes.json();
        if (tickets?.[0]?.organization_id) {
          orgEmailConfig = await getOrgEmailConfig(supabaseUrl, supabaseServiceKey, tickets[0].organization_id);
        }
      }
    }

    if (!recipientEmail || !subject || !bodyText) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields: recipientEmail, subject, bodyText",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Construct ticket URL for email links — use app URL, not Supabase URL
    const siteUrl = Deno.env.get("SITE_URL") || Deno.env.get("NEXT_PUBLIC_APP_URL") || supabaseUrl;
    const ticketUrl = `${siteUrl}/tickets/${ticketId}`;

    const enhancedBodyText = `${bodyText}

---
View your ticket: ${ticketUrl}

This is an automated message from ${orgEmailConfig.fromName}. Please do not reply directly to this email.`;

    const enhancedBodyHtml = bodyHtml
      ? `${bodyHtml}
<hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;" />
<p style="color: #6b7280; font-size: 14px;">
  <a href="${ticketUrl}" style="color: #1e40af; text-decoration: none;">View your ticket</a>
</p>
<p style="color: #9ca3af; font-size: 12px; margin-top: 20px;">
  This is an automated message from ${orgEmailConfig.fromName}. Please do not reply directly to this email.
</p>`
      : generateDefaultHtml(recipientName || "Valued Customer", bodyText, ticketUrl, orgEmailConfig.fromName);

    let emailSent = false;
    let emailProvider = "";
    let errorMessage = "";

    // Try Resend with retry (up to 2 retries with backoff)
    if (resendApiKey) {
      const maxAttempts = 3;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const resendResponse = await sendViaResend(
            resendApiKey,
            orgEmailConfig.fromEmail,
            orgEmailConfig.fromName,
            recipientEmail,
            subject,
            enhancedBodyText,
            enhancedBodyHtml
          );

          if (resendResponse.success) {
            emailSent = true;
            emailProvider = "resend";
            console.log(`Email sent via Resend (attempt ${attempt}):`, resendResponse.id);
            break;
          } else {
            errorMessage = resendResponse.error || "Resend failed";
            console.error(`Resend error (attempt ${attempt}/${maxAttempts}):`, errorMessage);
          }
        } catch (error) {
          errorMessage = error instanceof Error ? error.message : "Resend error";
          console.error(`Resend exception (attempt ${attempt}/${maxAttempts}):`, error);
        }

        // Wait before retry (1s, then 3s)
        if (attempt < maxAttempts) {
          await new Promise(r => setTimeout(r, attempt * 1000 + 1000));
        }
      }
    }

    if (!emailSent) {
      console.error("CRITICAL: All Resend attempts failed. Ticket email NOT sent.", errorMessage);
    }

    // Update notification status
    const supabaseHeaders = {
      "Content-Type": "application/json",
      "apikey": supabaseServiceKey,
      "Authorization": `Bearer ${supabaseServiceKey}`,
    };

    if (emailSent) {
      if (notificationId) {
        await updateNotificationStatus(
          supabaseUrl,
          supabaseServiceKey,
          notificationId,
          "sent",
          null,
          emailProvider
        );
      } else {
        await fetch(`${supabaseUrl}/rest/v1/ticket_email_notifications`, {
          method: "POST",
          headers: supabaseHeaders,
          body: JSON.stringify({
            ticket_id: ticketId,
            recipient_email: recipientEmail,
            recipient_name: recipientName,
            notification_type: notificationType,
            subject: subject,
            body_text: enhancedBodyText,
            body_html: enhancedBodyHtml,
            status: "sent",
            sent_at: new Date().toISOString(),
            metadata: {
              provider: emailProvider,
              manual_send: true,
            },
          }),
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Email sent successfully",
          provider: emailProvider,
          notificationId: notificationId,
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    } else {
      // All providers failed
      if (notificationId) {
        await updateNotificationStatus(
          supabaseUrl,
          supabaseServiceKey,
          notificationId,
          "failed",
          errorMessage,
          "none"
        );
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: "All email providers failed",
          details: errorMessage,
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }
  } catch (error) {
    console.error("Send ticket email error:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});

async function sendViaResend(
  apiKey: string,
  from: string,
  fromName: string,
  to: string,
  subject: string,
  text: string,
  html: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${fromName} <${from}>`,
      to: to,
      subject: subject,
      text: text,
      html: html,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    return {
      success: false,
      error: data.message || "Resend API error",
    };
  }

  return {
    success: true,
    id: data.id,
  };
}

async function updateNotificationStatus(
  supabaseUrl: string,
  supabaseServiceKey: string,
  notificationId: string,
  status: string,
  errorMessage: string | null,
  provider: string
): Promise<void> {
  const supabaseHeaders = {
    "Content-Type": "application/json",
    "apikey": supabaseServiceKey,
    "Authorization": `Bearer ${supabaseServiceKey}`,
  };

  const updateData: any = {
    status: status,
    updated_at: new Date().toISOString(),
  };

  if (status === "sent") {
    updateData.sent_at = new Date().toISOString();
    updateData.metadata = { provider };
  }

  if (errorMessage) {
    updateData.error_message = errorMessage;
    updateData.retry_count = await getRetryCount(supabaseUrl, supabaseServiceKey, notificationId) + 1;
  }

  await fetch(
    `${supabaseUrl}/rest/v1/ticket_email_notifications?id=eq.${notificationId}`,
    {
      method: "PATCH",
      headers: supabaseHeaders,
      body: JSON.stringify(updateData),
    }
  );
}

async function getRetryCount(
  supabaseUrl: string,
  supabaseServiceKey: string,
  notificationId: string
): Promise<number> {
  const supabaseHeaders = {
    "apikey": supabaseServiceKey,
    "Authorization": `Bearer ${supabaseServiceKey}`,
  };

  const response = await fetch(
    `${supabaseUrl}/rest/v1/ticket_email_notifications?id=eq.${notificationId}&select=retry_count`,
    { headers: supabaseHeaders }
  );

  if (response.ok) {
    const data = await response.json();
    if (data && data.length > 0) {
      return data[0].retry_count || 0;
    }
  }

  return 0;
}

function generateDefaultHtml(
  recipientName: string,
  bodyText: string,
  ticketUrl: string,
  orgName: string = 'Double Helix Hub'
): string {
  const paragraphs = bodyText
    .split("\n\n")
    .map((p) => `<p style="margin: 0 0 16px 0; line-height: 1.6;">${p.replace(/\n/g, "<br />")}</p>`)
    .join("");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${orgName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%); padding: 30px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">${orgName}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <div style="color: #111827; font-size: 16px;">
                ${paragraphs}
              </div>
              <div style="margin-top: 32px; text-align: center;">
                <a href="${ticketUrl}" style="display: inline-block; background-color: #1e40af; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 500; font-size: 16px;">View Your Ticket</a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f3f4f6; padding: 20px 40px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 12px; text-align: center;">
                This is an automated message from ${orgName}. Please do not reply directly to this email.
              </p>
              <p style="margin: 8px 0 0 0; color: #9ca3af; font-size: 11px; text-align: center;">
                &copy; ${new Date().getFullYear()} ${orgName}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}