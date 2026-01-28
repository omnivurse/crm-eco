import { Router } from 'express';
import { ChatRequestSchema } from '../types/shared.js';
import { processChat } from '../agent/orchestrator.js';
import { logMessage } from '../agent/logs.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

router.post('/chat', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { messages } = ChatRequestSchema.parse({
      messages: req.body.messages,
      user: req.user,
    });

    // Log user message
    const userMessage = messages[messages.length - 1];
    if (userMessage.role === 'user') {
      await logMessage({
        author: 'user',
        role: 'user',
        content: userMessage.content,
        user_id: req.user.id,
      });
    }

    // Process with AI agent
    const reply = await processChat(messages, req.user);

    res.json({ reply });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Chat processing failed' 
    });
  }
});

// Direct tool endpoints for admin/testing
router.post('/tools/:toolName', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user || !['agent', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    res.json({ message: 'Direct tool access not implemented yet' });
  } catch (error) {
    res.status(500).json({ error: 'Tool execution failed' });
  }
});

export default router;