import { supabase } from '../supabase.js';

export interface AuditLogEntry {
  actor_id: string | null;
  target_user_id?: string | null;
  action: string;
  details?: Record<string, any>;
  ip?: string;
  user_agent?: string;
}

export async function logAudit(
  actorId: string | null,
  action: string,
  targetUserId: string | null = null,
  details: Record<string, any> = {},
  ip?: string,
  userAgent?: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('audit_logs')
      .insert({
        actor_id: actorId,
        target_user_id: targetUserId,
        action,
        details,
        ip,
        user_agent: userAgent,
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Failed to log audit entry:', error);
    }
  } catch (error) {
    console.error('Error logging audit entry:', error);
  }
}

export async function logAuditBatch(
  entries: AuditLogEntry[]
): Promise<void> {
  try {
    const { error } = await supabase
      .from('audit_logs')
      .insert(entries.map(entry => ({
        ...entry,
        created_at: new Date().toISOString(),
      })));

    if (error) {
      console.error('Failed to log audit entries:', error);
    }
  } catch (error) {
    console.error('Error logging audit entries:', error);
  }
}