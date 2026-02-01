-- Cleanup migration to drop any legacy tables from previous installations
-- This ensures a clean slate for the CRM schema

-- Drop ticket system tables first (dependent tables)
DROP TABLE IF EXISTS ticket_comments CASCADE;
DROP TABLE IF EXISTS ticket_attachments CASCADE;
DROP TABLE IF EXISTS tickets CASCADE;

-- Drop chat/messaging tables
DROP TABLE IF EXISTS message_reactions CASCADE;
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS channel_members CASCADE;
DROP TABLE IF EXISTS chat_channels CASCADE;

-- Drop knowledge base
DROP TABLE IF EXISTS kb_articles CASCADE;

-- Drop needs system
DROP TABLE IF EXISTS need_events CASCADE;
DROP TABLE IF EXISTS needs CASCADE;

-- Drop core CRM tables
DROP TABLE IF EXISTS leads CASCADE;
DROP TABLE IF EXISTS members CASCADE;
DROP TABLE IF EXISTS advisors CASCADE;
DROP TABLE IF EXISTS activities CASCADE;
DROP TABLE IF EXISTS custom_field_definitions CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;

-- Drop custom types from old schema
DROP TYPE IF EXISTS ticket_status CASCADE;
DROP TYPE IF EXISTS ticket_priority CASCADE;

-- Drop old functions
DROP FUNCTION IF EXISTS get_user_organization_id() CASCADE;
DROP FUNCTION IF EXISTS get_user_role() CASCADE;
DROP FUNCTION IF EXISTS get_user_advisor_id() CASCADE;
DROP FUNCTION IF EXISTS set_updated_at() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Completed cleanup
