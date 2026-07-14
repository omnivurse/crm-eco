/**
 * Status tone system — promoted to `@crm-eco/ui` so CRM, Admin, and the Member
 * Portal all share ONE status colour system (one hue = one meaning, everywhere).
 *
 * This file now re-exports the shared implementation so existing
 * `@/components/ui/status-badge` imports keep working unchanged. The `--tone-*`
 * tokens live in `@crm-eco/ui/styles/theme.css`.
 */
export {
  StatusBadge,
  statusToTone,
  type Tone,
  type StatusBadgeProps,
} from '@crm-eco/ui/components/status-badge';
