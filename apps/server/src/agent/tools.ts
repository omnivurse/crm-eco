import { z } from 'zod';
import { supabase } from '../supabase.js';
import { searchKB } from '../kb/search.js';
import { logAudit } from '../utils/audit.js';
import {
  CreateTicketSchema,
  AssignTicketSchema,
  AddCommentSchema,
  SetStatusSchema,
  ScheduleReminderSchema,
  SearchKBSchema,
  RunN8NWorkflowSchema,
  FetchCRMContactSchema,
  NotifySlackSchema,
  TriageTicketSchema,
} from '../types/shared.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

export interface ToolContext {
  user: NonNullable<AuthenticatedRequest['user']>;
}

export const tools = {
  create_ticket: {
    description: "Create a new support ticket",
    schema: CreateTicketSchema,
    run: async (args: z.infer<typeof CreateTicketSchema>, ctx: ToolContext) => {
      const { data: ticket, error } = await supabase
        .from('tickets')
        .insert({
          ...args,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw new Error(`Failed to create ticket: ${error.message}`);

      await logAudit(ctx.user.id, 'create_ticket', null, { ticket_id: ticket.id, ...args });
      
      return { success: true, ticket };
    }
  },

  assign_ticket: {
    description: "Assign a ticket to an agent",
    schema: AssignTicketSchema,
    run: async (args: z.infer<typeof AssignTicketSchema>, ctx: ToolContext) => {
      // Check if user has permission to assign tickets
      if (!['agent', 'admin'].includes(ctx.user.role)) {
        throw new Error('Insufficient permissions to assign tickets');
      }

      const { data: ticket, error } = await supabase
        .from('tickets')
        .update({ assignee_id: args.assignee_id })
        .eq('id', args.ticket_id)
        .select()
        .single();

      if (error) throw new Error(`Failed to assign ticket: ${error.message}`);

      await logAudit(ctx.user.id, 'assign_ticket', args.assignee_id, { ticket_id: args.ticket_id });
      
      return { success: true, ticket };
    }
  },

  add_comment: {
    description: "Add a comment to a ticket",
    schema: AddCommentSchema,
    run: async (args: z.infer<typeof AddCommentSchema>, ctx: ToolContext) => {
      const { data: comment, error } = await supabase
        .from('ticket_comments')
        .insert({
          ...args,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw new Error(`Failed to add comment: ${error.message}`);

      await logAudit(ctx.user.id, 'add_comment', null, { ticket_id: args.ticket_id, comment_id: comment.id });
      
      return { success: true, comment };
    }
  },

  set_status: {
    description: "Update a ticket's status",
    schema: SetStatusSchema,
    run: async (args: z.infer<typeof SetStatusSchema>, ctx: ToolContext) => {
      if (!['agent', 'admin'].includes(ctx.user.role)) {
        throw new Error('Insufficient permissions to update ticket status');
      }

      const { data: ticket, error } = await supabase
        .from('tickets')
        .update({ status: args.status })
        .eq('id', args.ticket_id)
        .select()
        .single();

      if (error) throw new Error(`Failed to update status: ${error.message}`);

      await logAudit(ctx.user.id, 'set_status', null, { ticket_id: args.ticket_id, status: args.status });
      
      return { success: true, ticket };
    }
  },

  schedule_reminder: {
    description: "Schedule a reminder for follow-up",
    schema: ScheduleReminderSchema,
    run: async (args: z.infer<typeof ScheduleReminderSchema>, ctx: ToolContext) => {
      const { data: reminder, error } = await supabase
        .from('reminders')
        .insert({
          user_id: args.user_id,
          ticket_id: args.ticket_id,
          run_at: args.run_at,
          payload: { note: args.note },
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw new Error(`Failed to schedule reminder: ${error.message}`);

      await logAudit(ctx.user.id, 'schedule_reminder', args.user_id, { reminder_id: reminder.id, ticket_id: args.ticket_id, run_at: args.run_at });
      
      return { success: true, reminder };
    }
  },

  search_kb: {
    description: "Search the knowledge base using vector similarity",
    schema: SearchKBSchema,
    run: async (args: z.infer<typeof SearchKBSchema>) => {
      const results = await searchKB(args.query, args.topK);
      return { success: true, results };
    }
  },

  run_n8n_workflow: {
    description: "Trigger an n8n workflow",
    schema: RunN8NWorkflowSchema,
    run: async (args: z.infer<typeof RunN8NWorkflowSchema>, ctx: ToolContext) => {
      if (!process.env.N8N_BASE_URL || !process.env.N8N_API_KEY) {
        throw new Error('n8n integration not configured');
      }

      const response = await fetch(
        `${process.env.N8N_BASE_URL}/webhook/${args.workflowId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.N8N_API_KEY}`,
          },
          body: JSON.stringify(args.payload),
        }
      );

      if (!response.ok) {
        throw new Error(`n8n workflow failed: ${response.statusText}`);
      }

      const result = await response.json();
      await logAudit(ctx.user.id, 'run_n8n_workflow', null, { workflow_id: args.workflowId });
      
      return { success: true, result };
    }
  },

  fetch_crm_contact: {
    description: "Fetch contact information from CRM",
    schema: FetchCRMContactSchema,
    run: async (args: z.infer<typeof FetchCRMContactSchema>, ctx: ToolContext) => {
      if (!process.env.CRM_BASE_URL || !process.env.CRM_API_KEY) {
        throw new Error('CRM integration not configured');
      }

      const queryParam = args.email ? `email=${args.email}` : `member_id=${args.member_id}`;
      const response = await fetch(
        `${process.env.CRM_BASE_URL}/contacts?${queryParam}`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.CRM_API_KEY}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`CRM lookup failed: ${response.statusText}`);
      }

      const contact = await response.json();
      await logAudit(ctx.user.id, 'fetch_crm_contact', null, { email: args.email, member_id: args.member_id });
      
      return { success: true, contact };
    }
  },

  notify_slack: {
    description: "Send a notification to Slack",
    schema: NotifySlackSchema,
    run: async (args: z.infer<typeof NotifySlackSchema>, ctx: ToolContext) => {
      const webhookUrl = args.webhook || process.env.SLACK_WEBHOOK_URL;
      if (!webhookUrl) {
        throw new Error('Slack webhook not configured');
      }

      const payload = {
        text: args.text,
        ...(args.blocks && { blocks: args.blocks }),
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Slack notification failed: ${response.statusText}`);
      }

      await logAudit(ctx.user.id, 'notify_slack', null, { text: args.text });
      
      return { success: true };
    }
  },

  triage_ticket: {
    description: "Automatically classify ticket origin, priority, and category",
    schema: TriageTicketSchema,
    run: async (args: z.infer<typeof TriageTicketSchema>) => {
      // Simple keyword-based classification
      const subject = args.subject.toLowerCase();
      const description = args.description.toLowerCase();
      const text = `${subject} ${description}`;

      let origin: 'member' | 'advisor' | 'staff' = 'member';
      let priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal';
      let category = 'Other';

      // Origin detection
      if (text.includes('commission') || text.includes('enrollment') || text.includes('e123')) {
        origin = 'advisor';
      } else if (text.includes('server') || text.includes('network') || text.includes('infrastructure')) {
        origin = 'staff';
      }

      // Priority detection
      if (text.includes('urgent') || text.includes('down') || text.includes('critical')) {
        priority = 'urgent';
      } else if (text.includes('important') || text.includes('asap') || text.includes('high')) {
        priority = 'high';
      } else if (text.includes('when possible') || text.includes('low priority')) {
        priority = 'low';
      }

      // Category detection
      if (text.includes('password') || text.includes('login') || text.includes('access')) {
        category = 'Access';
      } else if (text.includes('email') || text.includes('outlook')) {
        category = 'Email';
      } else if (text.includes('software') || text.includes('application')) {
        category = 'Software';
      } else if (text.includes('hardware') || text.includes('computer') || text.includes('printer')) {
        category = 'Hardware';
      } else if (text.includes('network') || text.includes('internet') || text.includes('wifi')) {
        category = 'Network';
      }

      return {
        success: true,
        classification: {
          origin,
          priority,
          category,
          confidence: 0.8, // Mock confidence score
        }
      };
    }
  },
};

export type ToolName = keyof typeof tools;