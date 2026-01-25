import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface OneDriveFile {
  id: string;
  name: string;
  size: number;
  file?: { mimeType: string };
  parentReference?: { path: string };
  webUrl?: string;
  "@microsoft.graph.downloadUrl"?: string;
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

    if (!userResponse.ok) {
      throw new Error("Invalid authentication token");
    }

    const user = await userResponse.json();

    const tokenResponse = await fetch(
      `${supabaseUrl}/rest/v1/oauth_tokens?user_id=eq.${user.id}&provider=eq.onedrive&select=*`,
      {
        headers: {
          "Authorization": `Bearer ${supabaseServiceKey}`,
          "apikey": supabaseServiceKey,
        },
      }
    );

    const tokens = await tokenResponse.json();
    if (!tokens || tokens.length === 0) {
      throw new Error("OneDrive not connected. Please connect your OneDrive account first.");
    }

    const oauthToken = tokens[0];

    const decryptResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/decrypt_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseServiceKey}`,
        "apikey": supabaseServiceKey,
      },
      body: JSON.stringify({
        encrypted_token: oauthToken.access_token_encrypted,
        secret: encryptionSecret,
      }),
    });

    const accessToken = (await decryptResponse.text()).replace(/"/g, "");

    const url = new URL(req.url);
    const path = url.pathname.split("/").pop();

    if (path === "list") {
      const folderId = url.searchParams.get("folderId") || "root";

      const response = await fetch(
        `https://graph.microsoft.com/v1.0/me/drive/items/${folderId}/children`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`OneDrive API error: ${await response.text()}`);
      }

      const data = await response.json();

      return new Response(JSON.stringify(data), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    if (path === "upload" && req.method === "POST") {
      const { fileId, fileName, folderId = "root" } = await req.json();

      const fileResponse = await fetch(
        `${supabaseUrl}/rest/v1/files?id=eq.${fileId}&select=*`,
        {
          headers: {
            "Authorization": `Bearer ${token}`,
            "apikey": supabaseServiceKey,
          },
        }
      );

      const files = await fileResponse.json();
      if (!files || files.length === 0) {
        throw new Error("File not found");
      }

      const file = files[0];

      await fetch(
        `${supabaseUrl}/rest/v1/rpc/update_onedrive_sync_status`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
            "apikey": supabaseServiceKey,
          },
          body: JSON.stringify({
            p_file_id: fileId,
            p_status: "syncing",
          }),
        }
      );

      const storageResponse = await fetch(
        `${supabaseUrl}/storage/v1/object/public/${file.storage_path}`,
        {
          headers: {
            "Authorization": `Bearer ${token}`,
          },
        }
      );

      if (!storageResponse.ok) {
        throw new Error("Failed to download file from storage");
      }

      const fileBlob = await storageResponse.blob();

      const uploadResponse = await fetch(
        `https://graph.microsoft.com/v1.0/me/drive/items/${folderId}:/${fileName || file.filename}:/content`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": file.mime_type || "application/octet-stream",
          },
          body: fileBlob,
        }
      );

      if (!uploadResponse.ok) {
        await fetch(
          `${supabaseUrl}/rest/v1/rpc/update_onedrive_sync_status`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`,
              "apikey": supabaseServiceKey,
            },
            body: JSON.stringify({
              p_file_id: fileId,
              p_status: "error",
            }),
          }
        );
        throw new Error(`OneDrive upload failed: ${await uploadResponse.text()}`);
      }

      const uploadedFile = await uploadResponse.json() as OneDriveFile;

      await fetch(
        `${supabaseUrl}/rest/v1/rpc/update_onedrive_sync_status`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
            "apikey": supabaseServiceKey,
          },
          body: JSON.stringify({
            p_file_id: fileId,
            p_status: "synced",
            p_onedrive_id: uploadedFile.id,
            p_metadata: {
              webUrl: uploadedFile.webUrl,
              parentReference: uploadedFile.parentReference,
              size: uploadedFile.size,
              lastModified: new Date().toISOString(),
            },
          }),
        }
      );

      return new Response(
        JSON.stringify({
          success: true,
          message: "File uploaded to OneDrive successfully",
          onedrive_id: uploadedFile.id,
          webUrl: uploadedFile.webUrl,
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    if (path === "download" && req.method === "POST") {
      const { oneDriveId } = await req.json();

      const fileMetaResponse = await fetch(
        `https://graph.microsoft.com/v1.0/me/drive/items/${oneDriveId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!fileMetaResponse.ok) {
        throw new Error(`Failed to get file metadata: ${await fileMetaResponse.text()}`);
      }

      const fileMeta = await fileMetaResponse.json() as OneDriveFile;

      return new Response(
        JSON.stringify({
          success: true,
          file: {
            id: fileMeta.id,
            name: fileMeta.name,
            size: fileMeta.size,
            mimeType: fileMeta.file?.mimeType,
            webUrl: fileMeta.webUrl,
            downloadUrl: fileMeta["@microsoft.graph.downloadUrl"],
          },
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    if (path === "sync-pending" && req.method === "POST") {
      const pendingResponse = await fetch(
        `${supabaseUrl}/rest/v1/rpc/get_onedrive_pending_files`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
            "apikey": supabaseServiceKey,
          },
          body: JSON.stringify({
            p_user_id: user.id,
          }),
        }
      );

      const pendingFiles = await pendingResponse.json();

      return new Response(
        JSON.stringify({
          success: true,
          pending_files: pendingFiles,
          count: pendingFiles.length,
        }),
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
    console.error("OneDrive sync error:", error);
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
