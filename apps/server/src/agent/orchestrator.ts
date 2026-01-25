import OpenAI from 'openai';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { config } from '../config.js';
import { tools, type ToolContext } from './tools.js';
import { logMessage } from './logs.js';
import pino from 'pino';

const logger = pino();
const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are Champion Charlie, a precise, calm, and proactive IT service agent for a healthcare organization. You help members, advisors, and staff with technical issues and requests.

## Your Role
- Be professional, concise, and solution-focused
- Follow company policies and escalation procedures
- Take safe, justified actions to resolve issues quickly
- Minimize back-and-forth by gathering complete context upfront
- Use reminders for follow-ups and proactive communication

## Capabilities
You have access to these tools:
- create_ticket: Create support tickets for users
- assign_ticket: Assign tickets to appropriate agents
- add_comment: Add updates and responses to tickets
- set_status: Update ticket status (open, in_progress, waiting, resolved, closed)
- schedule_reminder: Set follow-up reminders
- search_kb: Find solutions in the knowledge base
- triage_ticket: Classify tickets by origin, priority, and category
- run_n8n_workflow: Trigger automated workflows
- fetch_crm_contact: Look up user information
- notify_slack: Send notifications to team channels

## Guidelines
- Always ask for clarification if a request is ambiguous
- Verify user permissions before taking sensitive actions
- Document all actions with clear reasoning
- Escalate to human agents when you're uncertain (#escalation)
- Respect role-based access (members < advisors < staff < agents < admins)
- Never expose API keys or sensitive system information

## Ticket Routing
- Member issues: Account, billing, general support
- Advisor issues: Commissions, enrollment (e123), specialized tools
- Staff issues: Internal systems, infrastructure, security

Be helpful, efficient, and always prioritize user experience while maintaining security.`;

export async function processChat(
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  user: ToolContext['user']
): Promise<string> {
  const context: ToolContext = { user };
  
  // Build tool definitions for OpenAI
  const toolDefs = Object.entries(tools).map(([name, tool]) => ({
    type: 'function' as const,
    function: {
      name,
      description: tool.description,
      parameters: zodToJsonSchema(tool.schema),
    },
  }));

  let conversationHistory = [
    { role: 'system' as const, content: SYSTEM_PROMPT },
    ...messages,
  ];

  // Tool calling loop (max 10 iterations for complex workflows)
  for (let iteration = 0; iteration < 10; iteration++) {
    try {
      const response = await openai.chat.completions.create({
        model: config.CHAT_MODEL,
        messages: conversationHistory,
        tools: toolDefs,
        tool_choice: 'auto',
        temperature: 0.1,
      });

      const message = response.choices[0].message;
      
      // Log the assistant's message
      await logMessage({
        author: 'assistant',
        role: 'assistant',
        content: message.content || '',
        user_id: user.id,
      });

      // If no tool calls, return the response
      const toolCalls = message.tool_calls;
      if (!toolCalls || toolCalls.length === 0) {
        return message.content || 'I apologize, but I encountered an error processing your request.';
      }

      // Execute tool calls
      conversationHistory.push(message);
      
      for (const toolCall of toolCalls) {
        const toolName = toolCall.function.name as keyof typeof tools;
        const tool = tools[toolName];
        
        if (!tool) {
          logger.warn(`Unknown tool: ${toolName}`);
          continue;
        }

        try {
          const args = JSON.parse(toolCall.function.arguments);
          const validatedArgs = tool.schema.parse(args);
          
          logger.info(`Executing tool: ${toolName}`, validatedArgs);
          
          const result = await tool.run(validatedArgs, context);
          
          // Log the tool call
          await logMessage({
            author: 'system',
            role: 'tool',
            content: JSON.stringify(result),
            tool_name: toolName,
            tool_args: validatedArgs,
            result,
            user_id: user.id,
          });

          // Add tool result to conversation
          conversationHistory.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });
          
        } catch (error) {
          logger.error(`Tool execution failed: ${toolName}`, error);
          
          conversationHistory.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({ 
              error: error instanceof Error ? error.message : 'Unknown error' 
            }),
          });
        }
      }
    } catch (error) {
      logger.error('OpenAI API error:', error);
      throw new Error('Failed to process chat request');
    }
  }

  return 'I ran out of tool iterations while processing your request. Please try asking again or contact a human agent for assistance.';
}