# OneDrive Integration - Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Double Helix Hub Platform                          │
│                                                                       │
│  ┌────────────────┐         ┌──────────────────┐                   │
│  │  User Browser  │────────▶│  React Frontend  │                   │
│  │                │         │  (OneDriveUI)    │                   │
│  └────────────────┘         └──────────────────┘                   │
│         │                            │                               │
│         │                            │                               │
│         │ OAuth Popup    ┌───────────┼───────────┐                 │
│         └───────────────▶│   Supabase Edge       │                 │
│                          │   Functions           │                 │
│                          ├───────────────────────┤                 │
│                          │ onedrive-oauth        │                 │
│                          │ - /authorize          │                 │
│                          │ - /callback           │                 │
│                          │ - /disconnect         │                 │
│                          ├───────────────────────┤                 │
│                          │ onedrive-sync         │                 │
│                          │ - /list               │                 │
│                          │ - /upload             │                 │
│                          │ - /download           │                 │
│                          │ - /sync-pending       │                 │
│                          └───────────────────────┘                 │
│                                    │                                 │
│                                    │                                 │
│  ┌─────────────────────────────────▼──────────────────────────┐   │
│  │              Supabase PostgreSQL Database                    │   │
│  ├──────────────────────────────────────────────────────────────┤   │
│  │ Tables:                                                       │   │
│  │  • integrations  (user connections)                          │   │
│  │  • oauth_tokens  (encrypted tokens)                          │   │
│  │  • files         (+ OneDrive sync fields)                    │   │
│  │                                                               │   │
│  │ Functions:                                                    │   │
│  │  • encrypt_token / decrypt_token                             │   │
│  │  • mark_file_for_onedrive_sync                              │   │
│  │  • get_onedrive_pending_files                               │   │
│  │  • update_onedrive_sync_status                              │   │
│  │                                                               │   │
│  │ Security:                                                     │   │
│  │  • RLS policies enforced                                     │   │
│  │  • pgcrypto extension for token encryption                   │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                    │                                 │
└────────────────────────────────────┼─────────────────────────────────┘
                                     │
                                     │ Microsoft Graph API
                                     │ (OAuth & File Operations)
                                     ▼
                  ┌──────────────────────────────────┐
                  │   Microsoft Cloud Services       │
                  ├──────────────────────────────────┤
                  │  Azure Active Directory          │
                  │  - OAuth 2.0 Authorization       │
                  │  - Token Management              │
                  │                                  │
                  │  OneDrive for Business/Personal  │
                  │  - File Storage                  │
                  │  - File Sync                     │
                  │  - Metadata Management           │
                  └──────────────────────────────────┘
```

## Data Flow Diagrams

### 1. OAuth Connection Flow

```
User                Frontend            Edge Function         Azure AD          Database
  │                    │                     │                    │                │
  │  Click Connect     │                     │                    │                │
  ├───────────────────▶│                     │                    │                │
  │                    │  GET /authorize     │                    │                │
  │                    ├────────────────────▶│                    │                │
  │                    │                     │  Build OAuth URL   │                │
  │                    │◀────────────────────┤                    │                │
  │                    │                     │                    │                │
  │  OAuth Popup       │                     │                    │                │
  ├────────────────────┼─────────────────────┼───────────────────▶│                │
  │                    │                     │                    │  Authenticate  │
  │                    │                     │                    │  & Authorize   │
  │◀───────────────────┼─────────────────────┼────────────────────┤                │
  │  Auth Code         │                     │                    │                │
  │                    │                     │                    │                │
  │                    │  POST /callback     │                    │                │
  │                    │  {code}             │                    │                │
  │                    ├────────────────────▶│                    │                │
  │                    │                     │  Exchange Code     │                │
  │                    │                     ├───────────────────▶│                │
  │                    │                     │◀───────────────────┤                │
  │                    │                     │  Access Token      │                │
  │                    │                     │  Refresh Token     │                │
  │                    │                     │                    │                │
  │                    │                     │  Encrypt Tokens    │                │
  │                    │                     ├────────────────────┼───────────────▶│
  │                    │                     │                    │  Store Tokens  │
  │                    │                     │                    │  & Integration │
  │                    │◀────────────────────┤                    │                │
  │◀───────────────────┤                     │                    │                │
  │  Connected!        │                     │                    │                │
```

### 2. File Upload & Sync Flow

```
User              Frontend         Edge Function      Database       Storage      OneDrive
  │                  │                   │                │             │             │
  │  Upload File     │                   │                │             │             │
  ├─────────────────▶│                   │                │             │             │
  │                  │  Upload to Storage│                │             │             │
  │                  ├───────────────────┼────────────────┼────────────▶│             │
  │                  │                   │                │◀────────────┤             │
  │                  │  Create File Record                │             │             │
  │                  ├───────────────────┼───────────────▶│             │             │
  │                  │                   │  (sync_status: not_synced)   │             │
  │                  │                   │                │             │             │
  │  Click Sync All  │                   │                │             │             │
  ├─────────────────▶│                   │                │             │             │
  │                  │  POST /upload     │                │             │             │
  │                  ├──────────────────▶│                │             │             │
  │                  │  {fileId}         │                │             │             │
  │                  │                   │  Get File Info │             │             │
  │                  │                   ├───────────────▶│             │             │
  │                  │                   │◀───────────────┤             │             │
  │                  │                   │  Update Status │             │             │
  │                  │                   │  (syncing)     │             │             │
  │                  │                   ├───────────────▶│             │             │
  │                  │                   │                │             │             │
  │                  │                   │  Download File │             │             │
  │                  │                   ├────────────────┼────────────▶│             │
  │                  │                   │◀───────────────┼─────────────┤             │
  │                  │                   │                │             │             │
  │                  │                   │  Upload to OneDrive          │             │
  │                  │                   ├────────────────┼─────────────┼────────────▶│
  │                  │                   │◀───────────────┼─────────────┼─────────────┤
  │                  │                   │  OneDrive ID   │             │             │
  │                  │                   │                │             │             │
  │                  │                   │  Update Status │             │             │
  │                  │                   │  (synced)      │             │             │
  │                  │                   ├───────────────▶│             │             │
  │                  │◀──────────────────┤  Save Metadata │             │             │
  │◀─────────────────┤                   │                │             │             │
  │  Sync Complete!  │                   │                │             │             │
```

## Security Architecture

### Token Encryption Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Token Security Layer                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  1. OAuth Token Received from Microsoft                      │
│     ↓                                                         │
│  2. Edge Function (Service Role)                             │
│     └─→ Call encrypt_token(token, secret)                   │
│         └─→ pgcrypto AES-256 encryption                     │
│              └─→ Base64 encoding                            │
│                   ↓                                          │
│  3. Store Encrypted Token in Database                        │
│     • access_token_encrypted: "base64..."                   │
│     • refresh_token_encrypted: "base64..."                  │
│                   ↓                                          │
│  4. When Needed for API Call                                 │
│     └─→ Edge Function retrieves encrypted token             │
│         └─→ Call decrypt_token(encrypted, secret)           │
│             └─→ Use decrypted token for Microsoft API       │
│                 └─→ Token never sent to client              │
│                                                               │
│  RLS Policies:                                               │
│  • Users can see token EXISTS but not read encrypted value  │
│  • Only service_role can encrypt/decrypt                    │
│  • Client apps cannot access encryption functions           │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Row Level Security Model

```
┌──────────────────────────────────────────────────────────┐
│                  RLS Policy Matrix                        │
├──────────────────────────────────────────────────────────┤
│                                                            │
│  Table: integrations                                      │
│  ┌────────────┬──────────────────────────────────┐      │
│  │ Operation  │ Policy                           │      │
│  ├────────────┼──────────────────────────────────┤      │
│  │ SELECT     │ user_id = auth.uid()             │      │
│  │ INSERT     │ user_id = auth.uid()             │      │
│  │ UPDATE     │ user_id = auth.uid()             │      │
│  │ DELETE     │ user_id = auth.uid()             │      │
│  └────────────┴──────────────────────────────────┘      │
│                                                            │
│  Table: oauth_tokens                                      │
│  ┌────────────┬──────────────────────────────────┐      │
│  │ Operation  │ Policy                           │      │
│  ├────────────┼──────────────────────────────────┤      │
│  │ SELECT     │ user_id = auth.uid()             │      │
│  │            │ (but encrypted fields hidden)    │      │
│  │ INSERT     │ service_role ONLY                │      │
│  │ UPDATE     │ service_role ONLY                │      │
│  │ DELETE     │ user_id = auth.uid()             │      │
│  └────────────┴──────────────────────────────────┘      │
│                                                            │
│  Table: files (OneDrive fields)                           │
│  ┌────────────┬──────────────────────────────────┐      │
│  │ Operation  │ Policy                           │      │
│  ├────────────┼──────────────────────────────────┤      │
│  │ SELECT     │ owner_id = auth.uid()            │      │
│  │ INSERT     │ owner_id = auth.uid()            │      │
│  │ UPDATE     │ owner_id = auth.uid()            │      │
│  │ DELETE     │ owner_id = auth.uid()            │      │
│  └────────────┴──────────────────────────────────┘      │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

## File Sync State Machine

```
┌─────────────────────────────────────────────────────────────────┐
│                    File Sync Status Flow                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│      ┌──────────────┐                                           │
│      │ not_synced   │ ◀─── Initial state when file uploaded    │
│      └──────┬───────┘                                           │
│             │                                                     │
│             │ User clicks "Sync"                                 │
│             ▼                                                     │
│      ┌──────────────┐                                           │
│      │   syncing    │ ◀─── Upload in progress                  │
│      └──────┬───────┘                                           │
│             │                                                     │
│         ┌───┴───┐                                               │
│         │       │                                                │
│    Success    Failure                                            │
│         │       │                                                │
│         ▼       ▼                                                │
│  ┌────────┐  ┌───────┐                                         │
│  │ synced │  │ error │ ◀─── Network error, API error, etc.    │
│  └────────┘  └───┬───┘                                         │
│      │           │                                               │
│      │           │ User retries                                  │
│      │           └──────────────────┐                           │
│      │                              │                            │
│      │ File modified                ▼                            │
│      └────────────────────▶ ┌──────────────┐                   │
│                             │ not_synced   │                   │
│                             └──────────────┘                   │
│                                                                   │
│  Future: conflict state for two-way sync                        │
│      ┌──────────────┐                                           │
│      │  conflict    │ ◀─── Local & remote versions differ      │
│      └──────────────┘      (Not implemented yet)               │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Component Interaction Map

```
┌────────────────────────────────────────────────────────────────────┐
│                     Frontend Component Layer                        │
├────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  OneDriveSettings.tsx                                        │ │
│  ├──────────────────────────────────────────────────────────────┤ │
│  │                                                               │ │
│  │  State Management:                                           │ │
│  │  • integration: OneDriveIntegration | null                   │ │
│  │  • pendingFiles: PendingFile[]                              │ │
│  │  • loading, connecting, syncing: boolean                     │ │
│  │  • error, success: string | null                             │ │
│  │                                                               │ │
│  │  Functions:                                                   │ │
│  │  • loadIntegration() ───────▶ Query integrations table      │ │
│  │  • loadPendingFiles() ──────▶ Call Edge Function            │ │
│  │  • connectOneDrive() ────────▶ OAuth flow                    │ │
│  │  • disconnectOneDrive() ─────▶ Delete integration            │ │
│  │  • syncPendingFiles() ───────▶ Batch upload files            │ │
│  │                                                               │ │
│  │  UI Sections:                                                 │ │
│  │  ┌────────────────────────────────────────────────────┐     │ │
│  │  │ Connection Status Card                             │     │ │
│  │  │ • Provider logo & name                             │     │ │
│  │  │ • Connected / Not Connected badge                  │     │ │
│  │  │ • Connect / Disconnect button                      │     │ │
│  │  └────────────────────────────────────────────────────┘     │ │
│  │                                                               │ │
│  │  ┌────────────────────────────────────────────────────┐     │ │
│  │  │ Status Dashboard (when connected)                  │     │ │
│  │  │ • Active status indicator                          │     │ │
│  │  │ • Last sync timestamp                              │     │ │
│  │  │ • Pending files count                              │     │ │
│  │  └────────────────────────────────────────────────────┘     │ │
│  │                                                               │ │
│  │  ┌────────────────────────────────────────────────────┐     │ │
│  │  │ Pending Files List                                 │     │ │
│  │  │ • File name, size, mime type                       │     │ │
│  │  │ • Sync All button                                  │     │ │
│  │  │ • Progress indicators                              │     │ │
│  │  └────────────────────────────────────────────────────┘     │ │
│  │                                                               │ │
│  │  ┌────────────────────────────────────────────────────┐     │ │
│  │  │ How It Works Section                               │     │ │
│  │  │ • Step-by-step guide                               │     │ │
│  │  │ • Numbered instructions                            │     │ │
│  │  └────────────────────────────────────────────────────┘     │ │
│  │                                                               │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## Performance Considerations

### Optimization Strategies

1. **Database Indexes**
   ```sql
   -- Fast lookups by OneDrive ID
   CREATE INDEX idx_files_onedrive_id ON files(onedrive_id);

   -- Efficient sync status queries
   CREATE INDEX idx_files_onedrive_sync_status ON files(onedrive_sync_status);

   -- User-specific sync queries
   CREATE INDEX idx_files_owner_onedrive_status ON files(owner_id, onedrive_sync_status);
   ```

2. **Batch Operations**
   - Sync up to 100 files at once
   - Parallel uploads with error handling
   - Progress tracking per file

3. **Caching Strategy**
   - Token refresh handled automatically
   - Integration status cached in component state
   - Pending files list refreshed after sync

4. **Error Recovery**
   - Failed uploads marked as 'error' status
   - Retry mechanism available
   - Detailed error messages for debugging

## Scalability

### Current Limits
- **Files per sync**: 100 (configurable in `get_onedrive_pending_files`)
- **Token expiry**: Handled by refresh tokens
- **Concurrent uploads**: Managed by Edge Function concurrency

### Future Scaling Options
- Background job queue for large batches
- Webhook notifications for sync completion
- Distributed sync workers
- CDN integration for large files

---

**Architecture Status**: Production Ready ✅
**Security Level**: Enterprise Grade 🔒
**Performance**: Optimized for typical workloads ⚡
