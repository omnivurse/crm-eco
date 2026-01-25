import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface DailyLogEntry {
  id: string;
  entry_type: string;
  description: string;
  duration_minutes: number | null;
  created_at: string;
}

interface DailyLogReportPayload {
  reportId?: string;
  dailyLogId: string;
  userId: string;
  workDate: string;
  startedAt: string;
  endedAt: string;
  highlights: string | null;
  blockers: string | null;
  summary: string | null;
  userName: string;
  userEmail: string;
  entries: DailyLogEntry[];
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
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("FROM_EMAIL") || "reports@mympb.com";
    const recipientEmail = "vrt@mympb.com";

    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Email service not configured",
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

    const payload: DailyLogReportPayload = await req.json();

    const {
      reportId,
      dailyLogId,
      userId,
      workDate,
      startedAt,
      endedAt,
      highlights,
      blockers,
      summary,
      userName,
      userEmail,
      entries = [],
    } = payload;

    if (!dailyLogId || !userId || !workDate) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields: dailyLogId, userId, workDate",
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

    const workDuration = calculateWorkDuration(startedAt, endedAt);
    const entryStats = calculateEntryStats(entries);

    const subject = `Daily Work Log - ${userName} - ${formatDate(workDate)}`;
    const bodyText = generateTextReport(payload, workDuration, entryStats);
    const bodyHtml = generateHtmlReport(payload, workDuration, entryStats);

    const emailRequest = {
      from: `MPB Health Reports <${fromEmail}>`,
      to: recipientEmail,
      subject: subject,
      text: bodyText,
      html: bodyHtml,
    };

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailRequest),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error("Resend API error:", resendData);

      if (reportId) {
        await updateReportStatus(
          supabaseUrl,
          supabaseServiceKey,
          reportId,
          "failed",
          resendData.message || "Email delivery failed"
        );
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: resendData.message || "Failed to send email",
          details: resendData,
        }),
        {
          status: resendResponse.status,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    if (reportId) {
      await updateReportStatus(
        supabaseUrl,
        supabaseServiceKey,
        reportId,
        "sent",
        null
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Daily log report sent successfully",
        emailId: resendData.id,
        reportId: reportId,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Send daily log report error:", error);

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

function calculateWorkDuration(startedAt: string, endedAt: string): string {
  const start = new Date(startedAt);
  const end = new Date(endedAt);
  const diffMs = end.getTime() - start.getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
}

function calculateEntryStats(entries: DailyLogEntry[]): Record<string, number> {
  const stats: Record<string, number> = {};
  entries.forEach((entry) => {
    stats[entry.entry_type] = (stats[entry.entry_type] || 0) + 1;
  });
  return stats;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatTime(timeStr: string): string {
  const time = new Date(timeStr);
  return time.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function generateTextReport(
  payload: DailyLogReportPayload,
  workDuration: string,
  entryStats: Record<string, number>
): string {
  const { userName, userEmail, workDate, startedAt, endedAt, highlights, blockers, entries } = payload;

  let text = `DAILY WORK LOG REPORT\n`;
  text += `${"=".repeat(60)}\n\n`;
  text += `Team Member: ${userName}\n`;
  text += `Email: ${userEmail}\n`;
  text += `Date: ${formatDate(workDate)}\n`;
  text += `Work Hours: ${formatTime(startedAt)} - ${formatTime(endedAt)}\n`;
  text += `Total Duration: ${workDuration}\n\n`;

  text += `${"=".repeat(60)}\n\n`;

  if (highlights) {
    text += `HIGHLIGHTS\n`;
    text += `${"-".repeat(60)}\n`;
    text += `${highlights}\n\n`;
  }

  if (blockers) {
    text += `BLOCKERS\n`;
    text += `${"-".repeat(60)}\n`;
    text += `${blockers}\n\n`;
  }

  if (entries.length > 0) {
    text += `ACTIVITY TIMELINE (${entries.length} entries)\n`;
    text += `${"-".repeat(60)}\n`;

    entries.forEach((entry, index) => {
      text += `${formatTime(entry.created_at)} - [${entry.entry_type.toUpperCase()}]\n`;
      text += `${entry.description}\n`;
      if (entry.duration_minutes) {
        text += `Duration: ${entry.duration_minutes} minutes\n`;
      }
      if (index < entries.length - 1) text += `\n`;
    });

    text += `\n\n`;
    text += `ENTRY SUMMARY\n`;
    text += `${"-".repeat(60)}\n`;
    Object.entries(entryStats).forEach(([type, count]) => {
      text += `${type}: ${count}\n`;
    });
  }

  text += `\n${"=".repeat(60)}\n`;
  text += `Report generated automatically by MPB Health ServiceOps\n`;

  return text;
}

function generateHtmlReport(
  payload: DailyLogReportPayload,
  workDuration: string,
  entryStats: Record<string, number>
): string {
  const { userName, userEmail, workDate, startedAt, endedAt, highlights, blockers, entries } = payload;

  const entryTypeColors: Record<string, string> = {
    task: "#0ea5e9",
    meeting: "#8b5cf6",
    blocker: "#ef4444",
    note: "#6b7280",
    achievement: "#10b981",
    break: "#f59e0b",
    other: "#64748b",
  };

  const entryTypeLabels: Record<string, string> = {
    task: "Task",
    meeting: "Meeting",
    blocker: "Blocker",
    note: "Note",
    achievement: "Achievement",
    break: "Break",
    other: "Other",
  };

  let entriesHtml = "";
  if (entries.length > 0) {
    entries.forEach((entry, index) => {
      const bgColor = index % 2 === 0 ? "#f9fafb" : "#ffffff";
      const badgeColor = entryTypeColors[entry.entry_type] || "#64748b";
      const typeLabel = entryTypeLabels[entry.entry_type] || entry.entry_type;

      entriesHtml += `
        <tr style="background-color: ${bgColor};">
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; width: 100px; white-space: nowrap; color: #6b7280; font-size: 14px;">
            ${formatTime(entry.created_at)}
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; width: 120px;">
            <span style="display: inline-block; padding: 4px 12px; border-radius: 9999px; background-color: ${badgeColor}; color: white; font-size: 12px; font-weight: 600; text-transform: uppercase;">
              ${typeLabel}
            </span>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #374151; font-size: 14px; line-height: 1.6;">
            ${entry.description}
            ${entry.duration_minutes ? `<div style="margin-top: 4px; color: #6b7280; font-size: 13px;">⏱ ${entry.duration_minutes} minutes</div>` : ""}
          </td>
        </tr>
      `;
    });
  }

  let statsHtml = "";
  Object.entries(entryStats).forEach(([type, count]) => {
    const badgeColor = entryTypeColors[type] || "#64748b";
    const typeLabel = entryTypeLabels[type] || type;
    statsHtml += `
      <div style="display: inline-block; margin-right: 12px; margin-bottom: 8px;">
        <span style="padding: 6px 16px; border-radius: 9999px; background-color: ${badgeColor}; color: white; font-size: 14px; font-weight: 600;">
          ${typeLabel}: ${count}
        </span>
      </div>
    `;
  });

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily Work Log Report</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 700px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e3a8a 0%, #0ea5e9 100%); padding: 40px; text-align: center;">
              <h1 style="margin: 0 0 8px 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Daily Work Log Report</h1>
              <p style="margin: 0; color: #bfdbfe; font-size: 16px; font-weight: 500;">${formatDate(workDate)}</p>
            </td>
          </tr>

          <!-- Team Member Info -->
          <tr>
            <td style="padding: 32px 40px; border-bottom: 2px solid #e5e7eb;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0;">
                    <div style="color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Team Member</div>
                    <div style="color: #111827; font-size: 18px; font-weight: 600;">${userName}</div>
                    <div style="color: #6b7280; font-size: 14px; margin-top: 2px;">${userEmail}</div>
                  </td>
                  <td style="padding: 8px 0; text-align: right;">
                    <div style="color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Work Hours</div>
                    <div style="color: #111827; font-size: 18px; font-weight: 600;">${workDuration}</div>
                    <div style="color: #6b7280; font-size: 14px; margin-top: 2px;">${formatTime(startedAt)} - ${formatTime(endedAt)}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${highlights ? `
          <!-- Highlights Section -->
          <tr>
            <td style="padding: 32px 40px; border-bottom: 1px solid #e5e7eb;">
              <h2 style="margin: 0 0 16px 0; color: #10b981; font-size: 20px; font-weight: 700; display: flex; align-items: center;">
                <span style="display: inline-block; width: 24px; height: 24px; margin-right: 8px;">✨</span>
                Highlights
              </h2>
              <div style="color: #374151; font-size: 15px; line-height: 1.7; white-space: pre-wrap;">${highlights}</div>
            </td>
          </tr>
          ` : ""}

          ${blockers ? `
          <!-- Blockers Section -->
          <tr>
            <td style="padding: 32px 40px; border-bottom: 1px solid #e5e7eb;">
              <h2 style="margin: 0 0 16px 0; color: #ef4444; font-size: 20px; font-weight: 700; display: flex; align-items: center;">
                <span style="display: inline-block; width: 24px; height: 24px; margin-right: 8px;">🚧</span>
                Blockers
              </h2>
              <div style="color: #374151; font-size: 15px; line-height: 1.7; white-space: pre-wrap;">${blockers}</div>
            </td>
          </tr>
          ` : ""}

          ${entries.length > 0 ? `
          <!-- Activity Timeline -->
          <tr>
            <td style="padding: 32px 40px;">
              <h2 style="margin: 0 0 20px 0; color: #111827; font-size: 20px; font-weight: 700; display: flex; align-items: center;">
                <span style="display: inline-block; width: 24px; height: 24px; margin-right: 8px;">📋</span>
                Activity Timeline
                <span style="margin-left: 12px; padding: 4px 12px; border-radius: 9999px; background-color: #e0f2fe; color: #0369a1; font-size: 14px; font-weight: 600;">
                  ${entries.length} entries
                </span>
              </h2>

              <table role="presentation" style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                <thead>
                  <tr style="background-color: #f9fafb;">
                    <th style="padding: 12px; text-align: left; color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e5e7eb;">Time</th>
                    <th style="padding: 12px; text-align: left; color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e5e7eb;">Type</th>
                    <th style="padding: 12px; text-align: left; color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e5e7eb;">Description</th>
                  </tr>
                </thead>
                <tbody>
                  ${entriesHtml}
                </tbody>
              </table>

              <!-- Entry Statistics -->
              <div style="margin-top: 24px; padding: 20px; background-color: #f9fafb; border-radius: 8px;">
                <h3 style="margin: 0 0 12px 0; color: #374151; font-size: 16px; font-weight: 600;">Entry Summary</h3>
                <div style="line-height: 1.8;">
                  ${statsHtml}
                </div>
              </div>
            </td>
          </tr>
          ` : ""}

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 40px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 13px; text-align: center; line-height: 1.6;">
                This report was automatically generated by MPB Health ServiceOps.<br>
                For questions or concerns, please contact the management team.
              </p>
              <p style="margin: 12px 0 0 0; color: #9ca3af; font-size: 12px; text-align: center;">
                &copy; ${new Date().getFullYear()} MPB Health. All rights reserved.
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

async function updateReportStatus(
  supabaseUrl: string,
  supabaseServiceKey: string,
  reportId: string,
  status: string,
  errorMessage: string | null
): Promise<void> {
  const supabaseHeaders = {
    "Content-Type": "application/json",
    "apikey": supabaseServiceKey,
    "Authorization": `Bearer ${supabaseServiceKey}`,
  };

  const updateData: any = {
    email_status: status,
    updated_at: new Date().toISOString(),
  };

  if (status === "sent") {
    updateData.email_sent_at = new Date().toISOString();
  }

  if (errorMessage) {
    updateData.error_message = errorMessage;
    const retryCount = await getRetryCount(supabaseUrl, supabaseServiceKey, reportId);
    updateData.retry_count = retryCount + 1;
  }

  await fetch(
    `${supabaseUrl}/rest/v1/daily_log_reports?id=eq.${reportId}`,
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
  reportId: string
): Promise<number> {
  const supabaseHeaders = {
    "apikey": supabaseServiceKey,
    "Authorization": `Bearer ${supabaseServiceKey}`,
  };

  const response = await fetch(
    `${supabaseUrl}/rest/v1/daily_log_reports?id=eq.${reportId}&select=retry_count`,
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
