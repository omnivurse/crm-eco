import { z } from 'zod';

// Agent message type
export interface AgentMessage {
  id: string;
  created_at: string;
  author: string;
  role: string;
  content: string;
  user_id: string;
  tool_name?: string;
  tool_args?: unknown;
  result?: unknown;
}

// Chat request schema
export const ChatRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
  })),
  user: z.object({
    id: z.string(),
    role: z.string(),
    email: z.string().optional(),
  }).optional(),
});

// Tool schemas
export const CreateTicketSchema = z.object({
  subject: z.string(),
  description: z.string(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  category: z.string().optional(),
});

export const AssignTicketSchema = z.object({
  ticket_id: z.string(),
  assignee_id: z.string(),
});

export const AddCommentSchema = z.object({
  ticket_id: z.string(),
  content: z.string(),
  is_internal: z.boolean().optional(),
});

export const SetStatusSchema = z.object({
  ticket_id: z.string(),
  status: z.string(),
});

export const ScheduleReminderSchema = z.object({
  user_id: z.string(),
  ticket_id: z.string().optional(),
  run_at: z.string(),
  note: z.string().optional(),
});

export const SearchKBSchema = z.object({
  query: z.string(),
  topK: z.number().optional().default(5),
});

export const RunN8NWorkflowSchema = z.object({
  workflowId: z.string(),
  payload: z.record(z.any()).optional(),
});

export const FetchCRMContactSchema = z.object({
  email: z.string().optional(),
  member_id: z.string().optional(),
});

export const NotifySlackSchema = z.object({
  text: z.string(),
  webhook: z.string().optional(),
  blocks: z.array(z.any()).optional(),
});

export const TriageTicketSchema = z.object({
  subject: z.string(),
  description: z.string(),
});
