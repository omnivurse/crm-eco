import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../supabase.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// GoTo Connect API configuration
const GOTO_API_BASE = 'https://api.goto.com';

// =====================================================================
// HELPER FUNCTIONS
// =====================================================================

/**
 * Get GoTo Connect access token from settings
 */
async function getGotoAccessToken(): Promise<string | null> {
  const { data, error } = await supabase
    .from('goto_settings')
    .select('access_token_encrypted')
    .maybeSingle();

  if (error || !data?.access_token_encrypted) {
    console.error('Failed to get GoTo access token:', error);
    return null;
  }

  return data.access_token_encrypted;
}

/**
 * Make authenticated request to GoTo Connect API
 */
async function gotoApiRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getGotoAccessToken();
  if (!token) {
    throw new Error('GoTo Connect not configured');
  }

  const url = `${GOTO_API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  return response;
}

/**
 * Find or create agent call status
 */
async function ensureAgentStatus(agentId: string) {
  const { data, error } = await supabase
    .from('agent_call_status')
    .select('*')
    .eq('agent_id', agentId)
    .maybeSingle();

  if (!data) {
    // Create new status entry
    await supabase.from('agent_call_status').insert({
      agent_id: agentId,
      status: 'offline',
    });
  }
}

// =====================================================================
// DEVICE MANAGEMENT ROUTES
// =====================================================================

/**
 * Register a new WebRTC device for an agent
 * POST /api/goto-connect/devices
 */
router.post('/devices', authenticateToken, async (req, res) => {
  try {
    const schema = z.object({
      device_name: z.string(),
      device_type: z.string().default('webrtc'),
      extension_number: z.string().optional(),
    });

    const body = schema.parse(req.body);
    const userId = (req as any).user.id;

    // First, create notification channel
    const channelResponse = await gotoApiRequest('/notification-channel/v1/channels', {
      method: 'POST',
      body: JSON.stringify({
        type: 'Webhook',
        webhookData: {
          url: process.env.GOTO_WEBHOOK_URL || `${process.env.PUBLIC_URL}/api/goto-connect/webhooks`,
        },
      }),
    });

    if (!channelResponse.ok) {
      throw new Error('Failed to create notification channel');
    }

    const channelData = await channelResponse.json();

    // Create device in GoTo Connect
    const deviceResponse = await gotoApiRequest('/web-calls/v1/devices', {
      method: 'POST',
      body: JSON.stringify({
        name: body.device_name,
        callbackChannelId: channelData.id,
      }),
    });

    if (!deviceResponse.ok) {
      throw new Error('Failed to register device with GoTo Connect');
    }

    const deviceData = await deviceResponse.json();

    // Save device to database
    const { data: device, error } = await supabase
      .from('goto_devices')
      .insert({
        agent_id: userId,
        goto_device_id: deviceData.id,
        device_name: body.device_name,
        device_type: body.device_type,
        extension_number: body.extension_number,
        is_active: true,
        registration_data: deviceData,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Ensure agent status exists
    await ensureAgentStatus(userId);

    res.json({
      success: true,
      device,
      goto_device: deviceData,
    });
  } catch (error) {
    console.error('Device registration error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to register device',
    });
  }
});

/**
 * Get all devices for current agent
 * GET /api/goto-connect/devices
 */
router.get('/devices', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;

    const { data: devices, error } = await supabase
      .from('goto_devices')
      .select('*')
      .eq('agent_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      devices: devices || [],
    });
  } catch (error) {
    console.error('Get devices error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch devices',
    });
  }
});

/**
 * Deactivate a device
 * DELETE /api/goto-connect/devices/:deviceId
 */
router.delete('/devices/:deviceId', authenticateToken, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const userId = (req as any).user.id;

    // Update device status in database
    const { error } = await supabase
      .from('goto_devices')
      .update({ is_active: false })
      .eq('id', deviceId)
      .eq('agent_id', userId);

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      message: 'Device deactivated',
    });
  } catch (error) {
    console.error('Device deactivation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to deactivate device',
    });
  }
});

// =====================================================================
// CALL MANAGEMENT ROUTES
// =====================================================================

/**
 * Make an outbound call
 * POST /api/goto-connect/calls
 */
router.post('/calls', authenticateToken, async (req, res) => {
  try {
    const schema = z.object({
      to_phone: z.string(),
      device_id: z.string(),
      ticket_id: z.string().optional(),
    });

    const body = schema.parse(req.body);
    const userId = (req as any).user.id;

    // Get device info
    const { data: device } = await supabase
      .from('goto_devices')
      .select('*')
      .eq('id', body.device_id)
      .eq('agent_id', userId)
      .single();

    if (!device) {
      return res.status(404).json({
        success: false,
        error: 'Device not found',
      });
    }

    // Create call in GoTo Connect
    const callResponse = await gotoApiRequest('/web-calls/v1/calls', {
      method: 'POST',
      body: JSON.stringify({
        deviceId: device.goto_device_id,
        dialString: body.to_phone,
      }),
    });

    if (!callResponse.ok) {
      throw new Error('Failed to initiate call');
    }

    const callData = await callResponse.json();

    // Create call log in database
    const { data: callLog, error } = await supabase
      .from('call_logs')
      .insert({
        goto_call_id: callData.id,
        caller_phone: device.extension_number || 'unknown',
        recipient_phone: body.to_phone,
        assigned_agent_id: userId,
        ticket_id: body.ticket_id || null,
        direction: 'outbound',
        status: 'queued',
        metadata: callData,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      call_log: callLog,
      goto_call: callData,
    });
  } catch (error) {
    console.error('Make call error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to make call',
    });
  }
});

/**
 * Get call history
 * GET /api/goto-connect/calls
 */
router.get('/calls', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { status, limit = '50' } = req.query;

    let query = supabase
      .from('call_logs')
      .select(`
        *,
        ticket:tickets(id, subject, status),
        agent:profiles!assigned_agent_id(id, full_name, email)
      `)
      .eq('assigned_agent_id', userId)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit as string));

    if (status) {
      query = query.eq('status', status);
    }

    const { data: calls, error } = await query;

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      calls: calls || [],
    });
  } catch (error) {
    console.error('Get calls error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch calls',
    });
  }
});

/**
 * Get a specific call
 * GET /api/goto-connect/calls/:callId
 */
router.get('/calls/:callId', authenticateToken, async (req, res) => {
  try {
    const { callId } = req.params;

    const { data: call, error } = await supabase
      .from('call_logs')
      .select(`
        *,
        ticket:tickets(id, subject, status, description),
        agent:profiles!assigned_agent_id(id, full_name, email),
        participants:call_participants(*)
      `)
      .eq('id', callId)
      .single();

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      call,
    });
  } catch (error) {
    console.error('Get call error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch call',
    });
  }
});

/**
 * Update call (add notes, outcome, link ticket)
 * PATCH /api/goto-connect/calls/:callId
 */
router.patch('/calls/:callId', authenticateToken, async (req, res) => {
  try {
    const { callId } = req.params;
    const schema = z.object({
      notes: z.string().optional(),
      outcome: z.string().optional(),
      ticket_id: z.string().optional(),
      call_summary: z.string().optional(),
    });

    const body = schema.parse(req.body);

    const { data: call, error } = await supabase
      .from('call_logs')
      .update(body)
      .eq('id', callId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      call,
    });
  } catch (error) {
    console.error('Update call error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update call',
    });
  }
});

// =====================================================================
// AGENT STATUS ROUTES
// =====================================================================

/**
 * Get current agent status
 * GET /api/goto-connect/status
 */
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;

    const { data: status, error } = await supabase
      .from('agent_call_status')
      .select('*')
      .eq('agent_id', userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!status) {
      // Create default status
      const { data: newStatus, error: createError } = await supabase
        .from('agent_call_status')
        .insert({
          agent_id: userId,
          status: 'offline',
        })
        .select()
        .single();

      if (createError) {
        throw createError;
      }

      return res.json({
        success: true,
        status: newStatus,
      });
    }

    res.json({
      success: true,
      status,
    });
  } catch (error) {
    console.error('Get status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch status',
    });
  }
});

/**
 * Update agent status
 * PATCH /api/goto-connect/status
 */
router.patch('/status', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const schema = z.object({
      status: z.enum(['available', 'busy', 'away', 'dnd', 'offline']),
      status_message: z.string().optional(),
    });

    const body = schema.parse(req.body);

    // Ensure status exists
    await ensureAgentStatus(userId);

    const { data: status, error } = await supabase
      .from('agent_call_status')
      .update({
        status: body.status,
        status_message: body.status_message,
        updated_at: new Date().toISOString(),
      })
      .eq('agent_id', userId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      status,
    });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update status',
    });
  }
});

/**
 * Get all agent statuses (for call routing)
 * GET /api/goto-connect/agents/status
 */
router.get('/agents/status', authenticateToken, async (req, res) => {
  try {
    const { data: statuses, error } = await supabase
      .from('agent_call_status')
      .select(`
        *,
        agent:profiles!agent_id(id, full_name, email, role)
      `)
      .order('updated_at', { ascending: false });

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      statuses: statuses || [],
    });
  } catch (error) {
    console.error('Get agent statuses error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch agent statuses',
    });
  }
});

// =====================================================================
// CALL QUEUE ROUTES
// =====================================================================

/**
 * Get current call queue
 * GET /api/goto-connect/queue
 */
router.get('/queue', authenticateToken, async (req, res) => {
  try {
    const { data: queue, error } = await supabase
      .from('call_queue')
      .select(`
        *,
        call:call_logs(*)
      `)
      .eq('status', 'waiting')
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      queue: queue || [],
    });
  } catch (error) {
    console.error('Get queue error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch queue',
    });
  }
});

/**
 * Assign a queued call to current agent
 * POST /api/goto-connect/queue/:queueId/assign
 */
router.post('/queue/:queueId/assign', authenticateToken, async (req, res) => {
  try {
    const { queueId } = req.params;
    const userId = (req as any).user.id;

    // Get queue item
    const { data: queueItem } = await supabase
      .from('call_queue')
      .select('*')
      .eq('id', queueId)
      .eq('status', 'waiting')
      .single();

    if (!queueItem) {
      return res.status(404).json({
        success: false,
        error: 'Queue item not found or already assigned',
      });
    }

    // Update call log
    await supabase
      .from('call_logs')
      .update({
        assigned_agent_id: userId,
        status: 'ringing',
      })
      .eq('id', queueItem.call_log_id);

    // Update queue item
    const { data: updated, error } = await supabase
      .from('call_queue')
      .update({
        status: 'assigned',
        assigned_at: new Date().toISOString(),
      })
      .eq('id', queueId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      queue_item: updated,
    });
  } catch (error) {
    console.error('Assign call error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to assign call',
    });
  }
});

// =====================================================================
// SETTINGS ROUTES
// =====================================================================

/**
 * Get GoTo Connect settings
 * GET /api/goto-connect/settings
 */
router.get('/settings', authenticateToken, async (req, res) => {
  try {
    const { data: settings, error } = await supabase
      .from('goto_settings')
      .select('*')
      .maybeSingle();

    if (error) {
      throw error;
    }

    // Don't send encrypted token to client
    if (settings) {
      delete settings.access_token_encrypted;
    }

    res.json({
      success: true,
      settings: settings || {},
    });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch settings',
    });
  }
});

/**
 * Update GoTo Connect settings (admin only)
 * PATCH /api/goto-connect/settings
 */
router.patch('/settings', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    const userId = (req as any).user.id;
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized: Admin access required',
      });
    }

    const schema = z.object({
      access_token: z.string().optional(),
      webhook_url: z.string().optional(),
      business_hours_start: z.string().optional(),
      business_hours_end: z.string().optional(),
      max_queue_wait_seconds: z.number().optional(),
      voicemail_enabled: z.boolean().optional(),
      auto_ticket_creation: z.boolean().optional(),
      call_recording_enabled: z.boolean().optional(),
      recording_retention_days: z.number().optional(),
    });

    const body = schema.parse(req.body);

    // If access_token provided, store it (should be encrypted in production)
    const updateData: any = { ...body };
    if (body.access_token) {
      updateData.access_token_encrypted = body.access_token;
      delete updateData.access_token;
    }

    // Get current settings
    const { data: current } = await supabase
      .from('goto_settings')
      .select('id')
      .maybeSingle();

    let result;
    if (current) {
      // Update existing
      const { data, error } = await supabase
        .from('goto_settings')
        .update(updateData)
        .eq('id', current.id)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      // Insert new
      const { data, error } = await supabase
        .from('goto_settings')
        .insert(updateData)
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    // Don't send encrypted token to client
    delete result.access_token_encrypted;

    res.json({
      success: true,
      settings: result,
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update settings',
    });
  }
});

export default router;
