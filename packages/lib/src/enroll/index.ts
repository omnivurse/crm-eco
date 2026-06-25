// Shared anon-enrollment helpers, reusable by both apps/portal and apps/website
// without duplication. Imported via the dedicated subpath:
//   import { readDraftFromRequest } from '@crm-eco/lib/enroll';
//
// draft-cookie + recaptcha carry next/server *types* only, so they live behind
// this subpath rather than the root barrel (mirroring how supabase/server and
// supabase/middleware are subpath-only). The approval-adapter is NOT here — it
// lives at packages/lib/src/enrollment/approval-adapter.ts (shared by #45) and is
// re-exported through the enrollment barrel -> the '@crm-eco/lib' root.
export * from './draft-cookie';
export * from './recaptcha';
