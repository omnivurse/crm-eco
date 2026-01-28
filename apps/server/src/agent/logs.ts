import { supabase } from '../supabase.js';
import type { AgentMessage } from '../types/shared.js';

export async function logMessage(message: Omit<AgentMessage, 'id' | 'created_at'>) {
  try {
    const { error } = await supabase
      .from('agent_messages')
      .insert({
        ...message,
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Failed to log message:', error);
    }
  } catch (error) {
    console.error('Error logging message:', error);
  }
}