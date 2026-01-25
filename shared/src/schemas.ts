import { z } from 'zod';

export const CreateTicketSchema = z.object({
  subject: z.string().min(1, 'Subject is required'),
  description: z.string().min(1, 'Description is required'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  category: z.string().optional(),
  origin: z.enum(['member', 'advisor', 'staff', 'email', 'chat', 'phone']).default('staff'),
  requester_id: z.string().uuid().optional(),
});

export const AssignTicketSchema = z.object({
  ticket_id: z.string().uuid(),
  assignee_id: z.string().uuid(),
});

export const AddCommentSchema = z.object({
  ticket_id: z.string().uuid(),
  content: z.string().min(1, 'Comment content is required'),
  author_id: z.string().uuid(),
  is_internal: z.boolean().default(false),
});

export const SetStatusSchema = z.object({
  ticket_id: z.string().uuid(),
  status: z.enum(['new', 'open', 'pending', 'on_hold', 'resolved', 'closed']),
});

export const ScheduleReminderSchema = z.object({
  user_id: z.string().uuid(),
  ticket_id: z.string().uuid().optional(),
  run_at: z.string().datetime(),
  note: z.string().optional(),
});

export const SearchKBSchema = z.object({
  query: z.string().min(1, 'Query is required'),
  topK: z.number().int().positive().default(5),
});

export const RunN8NWorkflowSchema = z.object({
  workflowId: z.string().min(1, 'Workflow ID is required'),
  payload: z.record(z.any()).optional(),
});

export const FetchCRMContactSchema = z.object({
  email: z.string().email().optional(),
  member_id: z.string().optional(),
}).refine(
  (data) => data.email || data.member_id,
  { message: 'Either email or member_id must be provided' }
);

export const NotifySlackSchema = z.object({
  text: z.string().min(1, 'Message text is required'),
  webhook: z.string().url().optional(),
  blocks: z.array(z.any()).optional(),
});

export const TriageTicketSchema = z.object({
  subject: z.string().min(1, 'Subject is required'),
  description: z.string().min(1, 'Description is required'),
});

export type CreateTicketInput = z.infer<typeof CreateTicketSchema>;
export type AssignTicketInput = z.infer<typeof AssignTicketSchema>;
export type AddCommentInput = z.infer<typeof AddCommentSchema>;
export type SetStatusInput = z.infer<typeof SetStatusSchema>;
export type ScheduleReminderInput = z.infer<typeof ScheduleReminderSchema>;
export type SearchKBInput = z.infer<typeof SearchKBSchema>;
export type RunN8NWorkflowInput = z.infer<typeof RunN8NWorkflowSchema>;
export type FetchCRMContactInput = z.infer<typeof FetchCRMContactSchema>;
export type NotifySlackInput = z.infer<typeof NotifySlackSchema>;
export type TriageTicketInput = z.infer<typeof TriageTicketSchema>;

export const STAFF_ROLES = ['staff', 'agent', 'admin', 'super_admin'] as const;
export const ADMIN_ROLES = ['admin', 'super_admin'] as const;
export const AGENT_ROLES = ['agent', 'admin', 'super_admin'] as const;

export type StaffRole = typeof STAFF_ROLES[number];
export type AdminRole = typeof ADMIN_ROLES[number];
export type AgentRole = typeof AGENT_ROLES[number];
