/*
  # Move Vector Extension from Public Schema

  1. Purpose
    - Move the vector extension to the extensions schema for better organization
    - Prevents pollution of the public schema with extension objects
    - Follows PostgreSQL best practices for extension management

  2. Security Impact
    - Isolates extension objects from application tables
    - Reduces attack surface by separating concerns
    - Makes schema management more maintainable

  3. Changes
    - Create extensions schema if it doesn't exist
    - Drop and recreate vector extension in extensions schema
    - Update search paths to include extensions schema

  4. Notes
    - This is a schema-only change - data is not affected
    - Functions using vector types will continue to work
    - May require application code to reference extensions.vector explicitly
*/

-- Create extensions schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS extensions;

-- Drop vector extension from public schema if it exists
DROP EXTENSION IF EXISTS vector CASCADE;

-- Create vector extension in extensions schema
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Update search path for functions that use vector types
-- These functions need to be aware of the extensions schema

-- Update match_kb_docs function to use extensions schema
DROP FUNCTION IF EXISTS match_kb_docs(vector, double precision, int);
CREATE OR REPLACE FUNCTION match_kb_docs(
  query_embedding extensions.vector,
  match_threshold double precision,
  match_count int
)
RETURNS TABLE (
  id uuid,
  title text,
  content text,
  similarity double precision
)
LANGUAGE plpgsql
STABLE
SET search_path = pg_catalog, public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kb_articles.id,
    kb_articles.title,
    kb_articles.content,
    1 - (kb_articles.embedding <=> query_embedding) as similarity
  FROM kb_articles
  WHERE
    kb_articles.status = 'published'
    AND 1 - (kb_articles.embedding <=> query_embedding) > match_threshold
  ORDER BY kb_articles.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Update match_knowledge_articles function to use extensions schema
DROP FUNCTION IF EXISTS public.match_knowledge_articles(vector, integer);
CREATE OR REPLACE FUNCTION public.match_knowledge_articles(
  query_embedding extensions.vector,
  match_count integer DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  title text,
  content text,
  category_id uuid,
  similarity double precision
)
LANGUAGE plpgsql
STABLE
SET search_path = pg_catalog, public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.title,
    a.content,
    a.category_id,
    1 - (a.embedding <=> query_embedding) as similarity
  FROM kb_articles a
  WHERE
    a.status = 'published'
    AND a.embedding IS NOT NULL
  ORDER BY a.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Grant usage on extensions schema to authenticated users
GRANT USAGE ON SCHEMA extensions TO authenticated;
GRANT USAGE ON SCHEMA extensions TO service_role;
