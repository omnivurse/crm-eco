/*
  # Add Helper Functions and PHI Detection v2
  
  This migration adds critical helper functions and PHI compliance features:
  
  1. Helper Functions
    - `has_role(role_in text)` - Check if user has specific role
    - `match_knowledge_articles()` - Vector search for KB articles
    - `validate_free_text()` - PHI detection in free text fields
  
  2. PHI Compliance
    - Trigger on tickets to prevent PHI in description fields
    - HIPAA-compliant text validation
  
  3. Security
    - All functions use proper security definer settings
    - RLS-compatible implementations
    
  Note: This schema doesn't use org_id (single-tenant per database)
*/

-- =====================================================
-- HELPER FUNCTION: has_role()
-- Check if current user has a specific role
-- =====================================================

CREATE OR REPLACE FUNCTION public.has_role(role_in text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 
    FROM public.profiles 
    WHERE id = auth.uid() 
      AND role = role_in
  );
$$;

-- =====================================================
-- VECTOR SEARCH: match_knowledge_articles()
-- Semantic search for knowledge base articles
-- Requires pgvector extension and embedding column
-- =====================================================

CREATE OR REPLACE FUNCTION public.match_knowledge_articles(
  query_embedding vector(1536),
  match_count int DEFAULT 5
)
RETURNS TABLE(
  id uuid,
  title text,
  content text,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if embedding column exists, if not return empty
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'kb_articles' 
      AND column_name = 'embedding'
  ) THEN
    RETURN;
  END IF;

  -- Return matching articles with similarity score
  RETURN QUERY
  SELECT 
    ka.id,
    ka.title,
    ka.body as content,
    (1 - (ka.embedding <=> query_embedding))::float as similarity
  FROM public.kb_articles ka
  WHERE ka.is_published = true
  ORDER BY ka.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- =====================================================
-- PHI DETECTION: validate_free_text()
-- Detects potential PHI in text fields
-- =====================================================

CREATE OR REPLACE FUNCTION public.validate_free_text(txt text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Return true if text is null or empty
  IF txt IS NULL OR trim(txt) = '' THEN
    RETURN true;
  END IF;

  -- Check for Social Security Numbers
  IF txt ~* '(ssn|social\s*security|[0-9]{3}-[0-9]{2}-[0-9]{4})' THEN
    RETURN false;
  END IF;

  -- Check for Medical Record Numbers
  IF txt ~* '(mrn|medical\s*record|patient\s*id)' THEN
    RETURN false;
  END IF;

  -- Check for medical terms
  IF txt ~* '(diagnosis|prescription|medication|treatment|procedure|surgery)' THEN
    RETURN false;
  END IF;

  -- Check for Date of Birth patterns
  IF txt ~* 'dob\s*:?\s*[0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4}' THEN
    RETURN false;
  END IF;

  -- Check for HIPAA/PHI keywords
  IF txt ~* '(hipaa|phi|protected\s*health|health\s*information)' THEN
    RETURN false;
  END IF;

  -- Text is safe
  RETURN true;
END;
$$;

-- =====================================================
-- PHI ENFORCEMENT TRIGGER FUNCTION
-- Prevents PHI in ticket descriptions and comments
-- =====================================================

CREATE OR REPLACE FUNCTION public.enforce_no_phi()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check ticket description field for PHI
  IF TG_TABLE_NAME = 'tickets' AND NEW.description IS NOT NULL THEN
    IF NOT public.validate_free_text(NEW.description) THEN
      RAISE EXCEPTION 'PHI-like content detected in description. Please use secure forms for sensitive information.'
        USING ERRCODE = 'P0001',
              HINT = 'Remove Social Security Numbers, Medical Record Numbers, diagnoses, or dates of birth.';
    END IF;
  END IF;

  -- Check ticket comment body field for PHI
  IF TG_TABLE_NAME = 'ticket_comments' AND NEW.body IS NOT NULL THEN
    IF NOT public.validate_free_text(NEW.body) THEN
      RAISE EXCEPTION 'PHI-like content detected in comment. Please use secure forms for sensitive information.'
        USING ERRCODE = 'P0001',
              HINT = 'Remove Social Security Numbers, Medical Record Numbers, diagnoses, or dates of birth.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- =====================================================
-- APPLY TRIGGERS
-- =====================================================

-- Apply trigger to tickets table
DROP TRIGGER IF EXISTS tickets_no_phi ON public.tickets;
CREATE TRIGGER tickets_no_phi 
  BEFORE INSERT OR UPDATE ON public.tickets
  FOR EACH ROW 
  EXECUTE FUNCTION public.enforce_no_phi();

-- Apply trigger to ticket_comments table
DROP TRIGGER IF EXISTS ticket_comments_no_phi ON public.ticket_comments;
CREATE TRIGGER ticket_comments_no_phi
  BEFORE INSERT OR UPDATE ON public.ticket_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_no_phi();

-- =====================================================
-- GRANTS
-- Ensure authenticated users can use these functions
-- =====================================================

GRANT EXECUTE ON FUNCTION public.has_role(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_knowledge_articles(vector, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_free_text(text) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.has_role(text) IS 'Check if current authenticated user has specified role';
COMMENT ON FUNCTION public.match_knowledge_articles(vector, int) IS 'Vector similarity search for knowledge base articles using pgvector';
COMMENT ON FUNCTION public.validate_free_text(text) IS 'Validate text does not contain PHI (Protected Health Information) for HIPAA compliance';
COMMENT ON FUNCTION public.enforce_no_phi() IS 'Trigger function to prevent PHI in tickets and comments';
