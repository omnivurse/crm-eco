# OneDrive Integration - Setup Checklist

## ✅ Already Complete

- [x] Database schema created (integrations, oauth_tokens, files extended)
- [x] Security implemented (RLS policies, token encryption)
- [x] Edge Functions deployed (onedrive-oauth, onedrive-sync)
- [x] UI component created (OneDriveSettings)
- [x] Callback route added (/onedrive/callback)
- [x] Settings page integrated
- [x] Build verified (no errors)
- [x] Documentation created

## 🔧 What You Need to Do

### 1. Azure App Configuration (5 min)

**Your App Details:**
- Client ID: `116135df-cf51-4e4d-8a07-12ad387ba26c`
- Tenant ID: `ad4e49c8-3dea-4d37-8be6-ee2fdc324f04`
- Redirect URI: `https://support.mpb.health/onedrive/callback`

#### Add Client Secret:
1. Go to: https://portal.azure.com/
2. Navigate to: Azure Active Directory → App registrations → "IT Support Ticketing"
3. Left menu: **Certificates & secrets**
4. Click: **New client secret**
5. Description: "OneDrive Integration"
6. Expires: 24 months (recommended)
7. Click: **Add**
8. **📋 COPY THE VALUE IMMEDIATELY** (you won't see it again!)

#### Configure API Permissions:
1. Left menu: **API permissions**
2. Click: **Add a permission**
3. Select: **Microsoft Graph**
4. Select: **Delegated permissions**
5. Add these permissions:
   - ✅ `Files.ReadWrite.All`
   - ✅ `offline_access`
6. Click: **Add permissions**
7. Click: **Grant admin consent for [Your Org]** (requires admin)
8. Verify: Green checkmarks appear

#### Update Account Types (Important!):
1. Left menu: **Authentication**
2. Under "Supported account types", change to:
   - ✅ **Accounts in any organizational directory and personal Microsoft accounts**
3. Click: **Save**

### 2. Supabase Environment Variables (2 min)

Go to: Supabase Dashboard → Settings → Edge Functions → Manage Secrets

Add these 4 secrets:

```bash
ONEDRIVE_CLIENT_ID
Value: 116135df-cf51-4e4d-8a07-12ad387ba26c
```

```bash
ONEDRIVE_CLIENT_SECRET
Value: <paste the secret you copied from Azure>
```

```bash
ONEDRIVE_REDIRECT_URI
Value: https://support.mpb.health/onedrive/callback
```

```bash
OAUTH_ENCRYPTION_SECRET
Value: <generate a random string - see below>
```

**Generate encryption secret:**

Option A - Using terminal:
```bash
openssl rand -base64 32
```

Option B - Using Node.js:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Option C - Online generator:
https://generate-secret.vercel.app/32

### 3. Verify Edge Functions (30 sec)

Check they're deployed and active:

1. Go to: Supabase Dashboard → Edge Functions
2. Verify these are listed and **ACTIVE**:
   - ✅ `onedrive-oauth` (Status: ACTIVE)
   - ✅ `onedrive-sync` (Status: ACTIVE)

If not active, redeploy:
```bash
supabase functions deploy onedrive-oauth
supabase functions deploy onedrive-sync
```

### 4. Test the Integration (2 min)

1. Deploy your app or run locally
2. Login to your app
3. Navigate to: Settings (usually `/admin/settings`)
4. Scroll to: "Microsoft OneDrive" section
5. Click: **Connect OneDrive**
6. OAuth popup should appear
7. Authorize with your Microsoft account
8. Should see: "Connected" status
9. Upload a test file
10. Click: **Sync All**
11. Verify: File appears in your OneDrive

## 📋 Quick Reference

### Azure Portal URLs
- App registrations: https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/RegisteredApps
- Your app: Search for "IT Support Ticketing" or use Client ID

### Supabase URLs
- Edge Functions: https://supabase.com/dashboard/project/YOUR_PROJECT/functions
- Secrets: https://supabase.com/dashboard/project/YOUR_PROJECT/settings/functions

### Your App URLs
- Settings page: https://support.mpb.health/admin/settings
- OAuth callback: https://support.mpb.health/onedrive/callback

## 🔍 Verify Setup

Run through this checklist:

- [ ] Client secret added in Azure
- [ ] API permissions configured and granted
- [ ] Account types set to "any organizational directory and personal"
- [ ] All 4 environment variables added to Supabase
- [ ] Both Edge Functions show as ACTIVE
- [ ] Can see OneDrive section in Settings page
- [ ] "Connect OneDrive" button works
- [ ] OAuth popup opens
- [ ] After authorization, status shows "Connected"
- [ ] Can sync files to OneDrive

## 🚨 Troubleshooting

### "Client ID not found"
→ Add `ONEDRIVE_CLIENT_ID` to Supabase secrets

### "Token exchange failed"
→ Verify `ONEDRIVE_CLIENT_SECRET` is correct (copy/paste issue?)

### "Redirect URI mismatch"
→ Ensure Azure redirect URI exactly matches: `https://support.mpb.health/onedrive/callback`

### OAuth popup closes immediately
→ Check browser console for errors
→ Verify Edge Function logs in Supabase

### "OneDrive not connected" after authorization
→ Check Edge Function logs for errors
→ Verify all environment variables are set

### Files not syncing
→ Check that files table has onedrive_sync_status column
→ Verify Edge Function `onedrive-sync` is active
→ Check storage permissions

## 📞 Support

- Full guide: `ONEDRIVE_INTEGRATION_GUIDE.md`
- Architecture: `ONEDRIVE_ARCHITECTURE.md`
- Quick start: `ONEDRIVE_SETUP_QUICKSTART.md`

## 🎉 Success Criteria

You'll know it's working when:
1. ✅ OneDrive section appears in Settings
2. ✅ Can click "Connect OneDrive" and OAuth popup appears
3. ✅ Status shows "Connected" after authorization
4. ✅ Pending files appear in the list
5. ✅ "Sync All" successfully uploads files
6. ✅ Files appear in your OneDrive account

---

**Estimated total setup time:** ~10 minutes

**Current status:** Code ready, awaiting Azure & Supabase configuration

**Next step:** Add client secret in Azure Portal
