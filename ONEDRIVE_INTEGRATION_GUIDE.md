# OneDrive Integration Guide

## Overview

The MPB Health platform now includes comprehensive Microsoft OneDrive integration, allowing users to automatically sync their files between the application and their OneDrive accounts. This provides seamless cloud storage, backup, and accessibility across devices.

## Features

### ✅ Secure OAuth Authentication
- Uses Microsoft OAuth 2.0 for secure authorization
- Access and refresh tokens are encrypted using PostgreSQL's `pgcrypto` extension
- Tokens are never exposed to the client application

### ✅ Automated File Synchronization
- Files uploaded to the platform can be automatically synced to OneDrive
- Track sync status for each file (not_synced, syncing, synced, conflict, error)
- Batch sync multiple files at once
- View pending files that need synchronization

### ✅ Comprehensive File Management
- Upload files to specific OneDrive folders
- Download files from OneDrive
- Track OneDrive metadata (webUrl, parentReference, eTag, etc.)
- View file sync history and last sync timestamps

### ✅ User-Friendly Interface
- Visual connection status indicator
- One-click connection/disconnection
- Pending files dashboard
- Real-time sync progress feedback
- Error handling with clear user messages

## Database Schema

### Tables Created

#### `integrations`
Tracks user integrations with external services including OneDrive.

```sql
CREATE TABLE public.integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('ms_teams', 'google', 'onedrive', 'ms_onedrive', 'onepassword', 'bitwarden', 'vault')),
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb DEFAULT '{}',
  last_sync_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider)
);
```

#### `oauth_tokens`
Securely stores encrypted OAuth tokens.

```sql
CREATE TABLE public.oauth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('ms_teams', 'google', 'onedrive', 'ms_onedrive')),
  access_token_encrypted text NOT NULL,
  refresh_token_encrypted text,
  scope text,
  token_type text NOT NULL DEFAULT 'Bearer',
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider)
);
```

#### `files` (Extended)
Added OneDrive sync tracking columns:

```sql
ALTER TABLE public.files
  ADD COLUMN onedrive_id text,
  ADD COLUMN onedrive_sync_status text CHECK (onedrive_sync_status IN ('not_synced', 'syncing', 'synced', 'conflict', 'error')) DEFAULT 'not_synced',
  ADD COLUMN onedrive_last_sync_at timestamptz,
  ADD COLUMN onedrive_metadata jsonb DEFAULT '{}';
```

### Helper Functions

#### `mark_file_for_onedrive_sync(file_id uuid)`
Marks a file as needing synchronization with OneDrive.

#### `get_onedrive_pending_files(p_user_id uuid)`
Returns all files for a user that are pending OneDrive sync.

#### `update_onedrive_sync_status(p_file_id uuid, p_status text, p_onedrive_id text, p_metadata jsonb)`
Updates the sync status and metadata for a file.

#### `encrypt_token(token text, secret text)`
Server-side function to encrypt OAuth tokens (service role only).

#### `decrypt_token(encrypted_token text, secret text)`
Server-side function to decrypt OAuth tokens (service role only).

## Edge Functions

### 1. `onedrive-oauth`
Handles OAuth authentication flow for OneDrive.

**Endpoints:**

- `GET /onedrive-oauth/authorize` - Get the OAuth authorization URL
- `POST /onedrive-oauth/callback` - Handle OAuth callback and store tokens
- `POST /onedrive-oauth/disconnect` - Disconnect OneDrive integration

**Environment Variables Required:**
- `ONEDRIVE_CLIENT_ID` - Microsoft App Registration Client ID
- `ONEDRIVE_CLIENT_SECRET` - Microsoft App Registration Client Secret
- `ONEDRIVE_REDIRECT_URI` - OAuth redirect URI
- `OAUTH_ENCRYPTION_SECRET` - Secret key for token encryption

### 2. `onedrive-sync`
Handles file operations with OneDrive.

**Endpoints:**

- `GET /onedrive-sync/list` - List files in OneDrive folder
- `POST /onedrive-sync/upload` - Upload a file to OneDrive
- `POST /onedrive-sync/download` - Get download URL for OneDrive file
- `POST /onedrive-sync/sync-pending` - Get list of files pending sync

## Setup Instructions

### Step 1: Register Application with Microsoft

1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to **Azure Active Directory** > **App registrations**
3. Click **New registration**
4. Configure:
   - **Name**: MPB Health OneDrive Integration
   - **Supported account types**: Accounts in any organizational directory and personal Microsoft accounts
   - **Redirect URI**: `https://your-domain.com/onedrive/callback` (Web)
5. Save the **Application (client) ID**
6. Go to **Certificates & secrets** > **New client secret**
7. Save the **Client secret value**
8. Go to **API permissions** > **Add a permission**
9. Select **Microsoft Graph** > **Delegated permissions**
10. Add: `Files.ReadWrite.All`, `offline_access`
11. Click **Grant admin consent**

### Step 2: Configure Environment Variables

Add the following to your Supabase project secrets or `.env` file:

```bash
ONEDRIVE_CLIENT_ID=your_client_id_here
ONEDRIVE_CLIENT_SECRET=your_client_secret_here
ONEDRIVE_REDIRECT_URI=https://your-domain.com/onedrive/callback
OAUTH_ENCRYPTION_SECRET=your_strong_random_secret_here
```

### Step 3: Deploy Edge Functions

Deploy the OneDrive Edge Functions to your Supabase project:

```bash
# Deploy OAuth function
supabase functions deploy onedrive-oauth

# Deploy sync function
supabase functions deploy onedrive-sync
```

### Step 4: Add UI Component

The `OneDriveSettings` component can be added to your settings page or integrations dashboard:

```tsx
import { OneDriveSettings } from '../../components/integrations/OneDriveSettings';

// In your settings page
<OneDriveSettings />
```

## Usage

### For End Users

1. **Connect OneDrive**:
   - Navigate to Settings > Integrations
   - Click "Connect OneDrive"
   - Authorize the application in the Microsoft OAuth popup
   - Connection will be confirmed automatically

2. **Sync Files**:
   - Files are automatically marked for sync when uploaded
   - View pending files in the OneDrive settings panel
   - Click "Sync All" to upload all pending files
   - Monitor sync progress and status

3. **Access Files**:
   - Click "Open OneDrive" to view synced files
   - Files are accessible from any device with OneDrive

4. **Disconnect**:
   - Click "Disconnect" to remove the integration
   - Note: This does NOT delete files from OneDrive

### For Developers

#### Programmatically Mark Files for Sync

```typescript
await supabase.rpc('mark_file_for_onedrive_sync', {
  file_id: 'uuid-here'
});
```

#### Get Pending Files

```typescript
const { data } = await supabase.rpc('get_onedrive_pending_files', {
  p_user_id: userId
});
```

#### Update Sync Status

```typescript
await supabase.rpc('update_onedrive_sync_status', {
  p_file_id: 'uuid-here',
  p_status: 'synced',
  p_onedrive_id: 'onedrive-file-id',
  p_metadata: {
    webUrl: 'https://...',
    lastModified: new Date().toISOString()
  }
});
```

## Security

### Token Encryption
- All OAuth tokens are encrypted using `pgcrypto` with AES-256
- Tokens are never exposed to client applications
- Only Edge Functions with service role key can decrypt tokens

### Row Level Security
- Users can only access their own integrations and tokens
- Files sync status is protected by existing file RLS policies
- Server-side functions enforce user ownership checks

### OAuth Scopes
- Minimal scopes requested: `Files.ReadWrite.All`, `offline_access`
- Users must explicitly authorize the application
- Tokens can be revoked at any time by disconnecting

## Troubleshooting

### Connection Issues

**Problem**: "Failed to get authorization URL"
- **Solution**: Verify `ONEDRIVE_CLIENT_ID` is set correctly in environment variables

**Problem**: "Token exchange failed"
- **Solution**: Check that `ONEDRIVE_CLIENT_SECRET` matches your Azure app registration

### Sync Issues

**Problem**: Files stuck in "syncing" status
- **Solution**: Check Edge Function logs for errors, retry sync

**Problem**: "OneDrive not connected" error
- **Solution**: Reconnect OneDrive from settings page

### Token Issues

**Problem**: "Invalid authentication token"
- **Solution**: Token may have expired, disconnect and reconnect OneDrive

## Future Enhancements

Planned features for future releases:

- [ ] Automatic background sync at scheduled intervals
- [ ] Two-way sync (download changes from OneDrive)
- [ ] Conflict resolution UI for file conflicts
- [ ] Selective folder sync
- [ ] Shared folder support
- [ ] Real-time sync status notifications
- [ ] Bandwidth usage tracking
- [ ] Sync history and audit log

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review Edge Function logs in Supabase dashboard
3. Contact your system administrator

## License

This integration is part of the MPB Health platform and follows the same licensing terms.
