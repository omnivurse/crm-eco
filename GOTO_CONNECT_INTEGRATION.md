# GoTo Connect Call Center Integration

## Overview

This document describes the complete GoTo Connect integration for the MPB Health IT Help Desk system. The integration provides a full-featured call center solution with real-time call handling, automatic ticket creation, call recording, and comprehensive agent management.

## Features

### Core Call Center Capabilities

- **Inbound Call Management**: Receive and route incoming calls to available agents
- **Outbound Calling**: Click-to-call from anywhere in the system
- **Call Queue System**: Priority-based call routing with real-time queue management
- **Agent Status Management**: Available, Busy, Away, DND, and Offline statuses
- **Real-Time Notifications**: Browser and audio notifications for incoming calls
- **Call Recording**: Automatic recording with secure storage and playback
- **Ticket Integration**: Automatic ticket creation and linking for all calls

### Advanced Features

- **Multi-Agent Support**: Conference calls and call transfers
- **Call Analytics**: Comprehensive metrics and reporting
- **WebRTC Browser Calling**: No additional hardware required
- **Voicemail Support**: Automatic voicemail routing after timeout
- **Call History**: Searchable call logs with full audit trail
- **SIP Integration**: Works with desk phones and softphones

## Architecture

### Database Schema

The integration adds the following tables:

- `call_logs`: Complete audit trail of all calls
- `call_participants`: Tracks all participants in each call
- `goto_devices`: Registered WebRTC devices for each agent
- `call_queue`: Manages waiting calls with priority routing
- `goto_webhooks`: Webhook event log for debugging
- `goto_settings`: System-wide GoTo Connect configuration
- `agent_call_status`: Real-time agent availability

### API Endpoints

#### Device Management
- `POST /api/goto-connect/devices` - Register a new device
- `GET /api/goto-connect/devices` - Get all devices
- `DELETE /api/goto-connect/devices/:deviceId` - Deactivate device

#### Call Management
- `POST /api/goto-connect/calls` - Make an outbound call
- `GET /api/goto-connect/calls` - Get call history
- `GET /api/goto-connect/calls/:callId` - Get call details
- `PATCH /api/goto-connect/calls/:callId` - Update call (notes, outcome, etc.)

#### Agent Status
- `GET /api/goto-connect/status` - Get current agent status
- `PATCH /api/goto-connect/status` - Update agent status
- `GET /api/goto-connect/agents/status` - Get all agent statuses

#### Call Queue
- `GET /api/goto-connect/queue` - Get current queue
- `POST /api/goto-connect/queue/:queueId/assign` - Assign queued call

#### Settings
- `GET /api/goto-connect/settings` - Get settings
- `PATCH /api/goto-connect/settings` - Update settings (admin only)

### Supabase Edge Function

**goto-webhook-processor**: Processes incoming webhooks from GoTo Connect
- Handles STARTING, RINGING, ACTIVE, ENDING events
- Creates/updates call logs
- Manages call queue
- Auto-creates tickets for inbound calls
- Tracks call participants

## Setup Instructions

### 1. GoTo Connect Configuration

1. **Get Personal Access Token**:
   - Log in to [GoTo Connect Dashboard](https://admin.goto.com/)
   - Navigate to Settings → Integrations → API
   - Create a new Personal Access Token
   - Copy the token (you'll need it later)

2. **Required OAuth Scopes**:
   - `webrtc.v1.write` - For making/receiving calls
   - `call-events.v1.notifications.manage` - For webhook management
   - `call-events.v1.events.read` - For reading call events

### 2. Database Setup

Run the migration to create the required tables:

```bash
# Migration file already created at:
# supabase/migrations/20251105203143_add_goto_connect_call_center_system.sql

# If using Supabase CLI:
supabase db push

# Or apply manually in Supabase Dashboard → SQL Editor
```

### 3. Environment Variables

Add to your `.env` file:

```env
# GoTo Connect Integration
GOTO_ACCESS_TOKEN=your-goto-personal-access-token
GOTO_WEBHOOK_URL=https://your-domain.com/api/goto-connect/webhooks
PUBLIC_URL=https://your-domain.com
```

### 4. Deploy Webhook Processor

Deploy the Supabase Edge Function:

```bash
# Deploy using Supabase CLI
supabase functions deploy goto-webhook-processor

# Or use the Supabase Dashboard → Edge Functions
```

### 5. Configure Webhook URL in GoTo Connect

1. Go to GoTo Connect Dashboard
2. Navigate to Settings → Webhooks
3. Add your webhook URL: `https://your-domain.com/functions/v1/goto-webhook-processor`
4. Select events: `call.starting`, `call.active`, `call.ending`

### 6. Admin Configuration

1. Log in as an admin user
2. Navigate to Admin → GoTo Connect Settings
3. Enter your Personal Access Token
4. Configure business hours, queue settings, and recording preferences
5. Save settings

## Usage Guide

### For Agents

#### Setting Up Your Device

1. Navigate to Call Dashboard
2. Click "Register Device"
3. Allow microphone permissions when prompted
4. Your browser is now registered as a calling device

#### Receiving Calls

1. Set your status to "Available"
2. Incoming calls will show a pop-up notification
3. Click "Accept" to answer the call
4. Use the call controls to mute, hold, or end the call

#### Making Calls

**From Ticket View**:
1. Open any ticket with a phone number
2. Click the "Call" button next to the phone number
3. The call will initiate automatically

**From Call Dashboard**:
1. Click "New Call"
2. Enter the phone number
3. Select your device
4. Optionally link to an existing ticket
5. Click "Call"

#### Managing Your Status

Click the status indicator in the top right to change:
- **Available**: Ready to receive calls
- **Busy**: In a call or handling other tasks
- **Away**: Temporarily unavailable
- **Do Not Disturb**: No incoming calls
- **Offline**: Not available for calls

### For Administrators

#### Monitoring Call Queue

- View real-time queue on the Call Dashboard
- See wait times and priorities
- Manually assign calls to specific agents

#### Call Analytics

Access comprehensive metrics:
- Total calls by period
- Answer rate and missed calls
- Average handle time
- Agent performance scorecards
- Peak hours analysis

#### Managing Settings

Configure system-wide settings:
- Business hours
- Maximum queue wait time
- Automatic ticket creation
- Call recording preferences
- Voicemail settings

## Call Flow

### Inbound Call Flow

1. **Call Received**: GoTo Connect webhook notifies system
2. **Event Logged**: Webhook stored in `goto_webhooks` table
3. **Call Created**: Entry created in `call_logs` table
4. **Ticket Creation**: If enabled, ticket auto-created
5. **Queue Addition**: Call added to queue with priority
6. **Agent Notification**: Available agents notified
7. **Call Assignment**: Agent accepts call
8. **Call Active**: Timer starts, status updated
9. **Call Ended**: Duration calculated, recording saved
10. **Ticket Updated**: Call log linked to ticket

### Outbound Call Flow

1. **Click-to-Call**: Agent clicks phone number
2. **Device Check**: System verifies active device
3. **API Call**: Request sent to GoTo Connect API
4. **Call Initiated**: GoTo Connect starts dial
5. **Call Log Created**: Entry in database
6. **Status Updates**: Real-time status via webhooks
7. **Call Active**: Once connected
8. **Call Ended**: Recording saved, notes added

## Call Recording

### Storage

- Recordings stored in Supabase Storage bucket `call-recordings`
- Organized by date: `/YYYY/MM/DD/call-id.mp3`
- Automatic retention policy based on settings

### Access Control

- RLS policies ensure secure access
- Agents can access their own calls
- Ticket requesters can access linked calls
- Admins have full access

### Transcription (Optional)

- Integrate OpenAI Whisper API for transcription
- Automatic transcription saved to `call_logs.recording_transcription`
- Searchable transcripts for compliance

## Security & Compliance

### Data Protection

- Personal access tokens encrypted at rest
- RLS policies on all call data
- Audit logging for all actions
- PII redaction capabilities

### HIPAA Compliance

- Call recordings can be encrypted
- Access logging for all playback
- Automatic deletion based on retention policy
- PHI detection and masking

### Access Control

- Role-based permissions (agent, admin, super_admin)
- Agent can only see their own calls
- Requesters see only calls for their tickets
- Admins have full system access

## Troubleshooting

### Common Issues

**Calls Not Connecting**:
- Verify Personal Access Token is valid
- Check device registration status
- Ensure webhook URL is accessible
- Verify OAuth scopes are correct

**Webhooks Not Received**:
- Check Supabase Edge Function logs
- Verify webhook URL in GoTo Connect
- Test endpoint manually with curl
- Check firewall and CORS settings

**No Incoming Call Notifications**:
- Verify browser notification permissions
- Check agent status (must be "Available")
- Ensure real-time subscriptions are active
- Check browser console for errors

**Recording Playback Issues**:
- Verify Supabase Storage bucket exists
- Check RLS policies on storage
- Ensure recording URL is valid
- Verify user has access permissions

### Debug Mode

Enable detailed logging:

```typescript
// In goto-webhook-processor/index.ts
console.log('Debug webhook event:', JSON.stringify(event, null, 2));
```

View logs:
```bash
supabase functions logs goto-webhook-processor
```

## API Integration Examples

### Making a Call from Code

```typescript
const response = await fetch('/api/goto-connect/calls', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({
    to_phone: '+1234567890',
    device_id: 'device-uuid',
    ticket_id: 'ticket-uuid', // optional
  }),
});

const data = await response.json();
console.log('Call initiated:', data.call_log);
```

### Subscribing to Real-Time Call Updates

```typescript
const subscription = supabase
  .channel('call_updates')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'call_logs',
      filter: `assigned_agent_id=eq.${userId}`,
    },
    (payload) => {
      console.log('Call updated:', payload.new);
    }
  )
  .subscribe();
```

## Performance Optimization

### Database Indexes

All critical indexes created automatically:
- `call_logs.status` - Fast queue queries
- `call_logs.assigned_agent_id` - Agent call history
- `call_logs.caller_phone` - Phone number lookups
- `call_queue.priority` - Queue sorting

### Caching Strategy

- Agent status cached for 30 seconds
- Call queue refreshed every 5 seconds
- Call history paginated (50 per page)

### Webhook Processing

- Async processing with retry logic
- Duplicate event detection
- Missing event recovery using sequence numbers

## Future Enhancements

Planned features for future releases:

- **AI Call Summarization**: Automatic call summaries using OpenAI
- **Smart Routing**: ML-based agent selection
- **Skill-Based Routing**: Route by agent expertise
- **IVR Integration**: Interactive voice response menus
- **SMS Integration**: Text messaging via GoTo Connect
- **Advanced Analytics**: Predictive analytics and forecasting
- **Mobile App**: Native iOS/Android apps for agents

## Support

For issues or questions:

1. Check this documentation first
2. Review GoTo Connect API documentation: https://developer.goto.com/
3. Check Supabase Edge Function logs
4. Contact your system administrator
5. Raise an issue in the project repository

## License

This integration is part of the MPB Health IT Help Desk system and follows the same license terms.
