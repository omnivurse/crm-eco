-- ============================================================================
-- Website: Blog Posts and Contact Submissions
-- ============================================================================

-- Blog Posts Table
CREATE TABLE IF NOT EXISTS blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  excerpt text,
  content text,
  featured_image_url text,
  category text NOT NULL DEFAULT 'general',
  tags text[] DEFAULT '{}',
  author text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts (slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts (status);
CREATE INDEX IF NOT EXISTS idx_blog_posts_category ON blog_posts (category);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published_at ON blog_posts (published_at DESC);

-- RLS for blog_posts
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

-- Public read access for published posts
CREATE POLICY "blog_posts_public_read"
  ON blog_posts
  FOR SELECT
  USING (status = 'published');

-- Authenticated users with admin role can manage posts
CREATE POLICY "blog_posts_admin_manage"
  ON blog_posts
  FOR ALL
  USING (
    auth.uid() IN (
      SELECT p.user_id FROM profiles p WHERE p.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT p.user_id FROM profiles p WHERE p.role IN ('owner', 'admin')
    )
  );

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_blog_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER blog_posts_updated_at
  BEFORE UPDATE ON blog_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_blog_posts_updated_at();

-- ============================================================================
-- Contact Submissions Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS contact_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  subject text,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'replied', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_contact_submissions_status ON contact_submissions (status);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_created_at ON contact_submissions (created_at DESC);

-- RLS for contact_submissions
ALTER TABLE contact_submissions ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (public contact form)
CREATE POLICY "contact_submissions_public_insert"
  ON contact_submissions
  FOR INSERT
  WITH CHECK (true);

-- Admin can read and manage
CREATE POLICY "contact_submissions_admin_read"
  ON contact_submissions
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT p.user_id FROM profiles p WHERE p.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "contact_submissions_admin_update"
  ON contact_submissions
  FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT p.user_id FROM profiles p WHERE p.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT p.user_id FROM profiles p WHERE p.role IN ('owner', 'admin')
    )
  );

-- ============================================================================
-- Seed sample blog posts
-- ============================================================================

INSERT INTO blog_posts (slug, title, excerpt, content, category, author, status, published_at) VALUES
(
  'understanding-health-sharing',
  'Understanding Health Sharing: A Complete Guide',
  'Learn the fundamentals of health sharing ministries and how they provide an alternative to traditional insurance for families and individuals.',
  'Health sharing ministries offer a community-based approach to managing medical expenses. Unlike traditional insurance, members voluntarily share each other''s medical costs. This guide covers everything you need to know about how health sharing works, who it''s best for, and how to get started.',
  'Health Tips',
  'Pay It Forward Health Team',
  'published',
  now() - interval '30 days'
),
(
  'wellness-tips-for-families',
  '10 Wellness Tips for the Whole Family',
  'Simple, practical wellness habits that your entire family can adopt for a healthier lifestyle.',
  'Maintaining family wellness doesn''t have to be complicated. From staying active together to eating nutritious meals, here are 10 evidence-based tips that can help your whole family thrive.',
  'Health Tips',
  'Pay It Forward Health Team',
  'published',
  now() - interval '14 days'
),
(
  'community-story-johnson-family',
  'How the Johnson Family Found Affordable Healthcare',
  'After struggling with rising insurance premiums, the Johnson family discovered health sharing and saved thousands.',
  'The Johnson family of four was paying over $1,800 per month for traditional health insurance. When they discovered Pay It Forward Health, they found a community-driven alternative that cut their monthly costs by more than half while providing the coverage they needed.',
  'Community Stories',
  'Pay It Forward Health Team',
  'published',
  now() - interval '7 days'
),
(
  'new-plan-options-2026',
  'Introducing New Plan Options for 2026',
  'We''re excited to announce expanded plan options designed to give you more flexibility and better value.',
  'After listening to member feedback, we''ve redesigned our plan offerings for 2026. The new options include lower monthly share amounts, expanded specialist coverage, and enhanced prescription assistance.',
  'Plan Updates',
  'Pay It Forward Health Team',
  'published',
  now() - interval '3 days'
),
(
  'mental-health-matters',
  'Mental Health Matters: Resources for Members',
  'Your mental health is just as important as your physical health. Discover the mental health resources available through your membership.',
  'At Pay It Forward Health, we believe in caring for the whole person. That''s why our plans include mental health sharing benefits, and we''re continually expanding our wellness resources to support your emotional well-being.',
  'Wellness',
  'Pay It Forward Health Team',
  'published',
  now() - interval '1 day'
),
(
  'preventive-care-guide',
  'Your Complete Preventive Care Guide',
  'Prevention is the best medicine. Here''s your guide to the preventive care benefits included with your membership.',
  'Preventive care is a cornerstone of good health. Regular check-ups, screenings, and vaccinations can catch problems early and keep you healthier in the long run. Here''s what''s covered under your Pay It Forward Health membership.',
  'Health Tips',
  'Pay It Forward Health Team',
  'published',
  now()
)
ON CONFLICT (slug) DO NOTHING;
