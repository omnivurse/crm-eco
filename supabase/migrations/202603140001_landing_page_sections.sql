-- Add sections JSONB column to landing_pages for the page builder
ALTER TABLE landing_pages
  ADD COLUMN IF NOT EXISTS sections jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN landing_pages.sections IS 'Array of page builder sections [{id, type, title, data, visible}]';
