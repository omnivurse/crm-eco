import { Router } from 'express';
import { z } from 'zod';
import { searchKB, ingestDocument } from '../kb/search.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// Search knowledge base
router.get('/search', async (req: AuthenticatedRequest, res) => {
  try {
    const { q: query, limit } = z.object({
      q: z.string().min(1),
      limit: z.coerce.number().min(1).max(20).default(5),
    }).parse(req.query);

    const results = await searchKB(query, limit);
    res.json({ results });
  } catch (error) {
    console.error('KB search error:', error);
    res.status(400).json({ 
      error: error instanceof Error ? error.message : 'Search failed' 
    });
  }
});

// Ingest document (admin only)
router.post('/ingest', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { title, source, content } = z.object({
      title: z.string().min(1),
      source: z.string().min(1),
      content: z.string().min(10),
    }).parse(req.body);

    const result = await ingestDocument(title, source, content);
    res.json(result);
  } catch (error) {
    console.error('KB ingest error:', error);
    res.status(400).json({ 
      error: error instanceof Error ? error.message : 'Ingest failed' 
    });
  }
});

export default router;