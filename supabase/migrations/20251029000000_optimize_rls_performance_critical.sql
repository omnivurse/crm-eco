/*
  # RLS Performance Optimization - Skipped

  This migration was disabled because it referenced tables that don't exist
  in the clean CRM schema. The RLS optimizations it intended to apply
  (replacing auth.uid() with (select auth.uid()) for better performance)
  should be applied in the individual table migrations instead.

  Original purpose: Optimize 159 RLS policies by caching auth function calls.
*/

-- No-op migration - optimizations moved to individual table migrations
SELECT 1;
