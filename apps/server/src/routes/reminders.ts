import { Router } from 'express';
import { supabase } from '../supabase.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// Cron endpoint to process due reminders
router.post('/tick', async (req: AuthenticatedRequest, res) => {
  try {
    // Get due reminders
    const { data: reminders, error } = await supabase
      .from('reminders')
      .select('*')
      .eq('status', 'scheduled')
      .lte('run_at', new Date().toISOString())
      .limit(50);

    if (error) {
      throw new Error(`Failed to fetch reminders: ${error.message}`);
    }

    const processed = [];
    
    for (const reminder of reminders || []) {
      try {
        // In a real implementation, you'd trigger the actual reminder action
        // For now, just mark as completed and log
        await supabase
          .from('reminders')
          .update({ status: 'completed' })
          .eq('id', reminder.id);
        
        // Could trigger webhook, email, Slack notification, etc.
        console.log(`Processed reminder ${reminder.id}:`, reminder.payload);
        
        processed.push(reminder.id);
      } catch (error) {
        console.error(`Failed to process reminder ${reminder.id}:`, error);
        
        await supabase
          .from('reminders')
          .update({ status: 'failed' })
          .eq('id', reminder.id);
      }
    }

    res.json({ processed: processed.length, total: reminders?.length || 0 });
  } catch (error) {
    console.error('Reminder tick error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Reminder processing failed' 
    });
  }
});

export default router;