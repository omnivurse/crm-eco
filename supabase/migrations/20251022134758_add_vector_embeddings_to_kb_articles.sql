/*
  # Add Vector Embeddings to Knowledge Base Articles
  
  This migration adds vector embedding support to kb_articles for semantic search:
  
  1. New Column
    - `embedding` (vector(1536)) - OpenAI text-embedding-3-large dimension
  
  2. Indexes
    - IVFFlat index for fast vector similarity search
  
  3. Security
    - No RLS changes needed (inherits from table)
  
  Prerequisites:
    - pgvector extension must be enabled
*/

-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to kb_articles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'kb_articles' 
      AND column_name = 'embedding'
  ) THEN
    ALTER TABLE public.kb_articles 
    ADD COLUMN embedding vector(1536);
  END IF;
END $$;

-- Create index for vector similarity search
-- Using IVFFlat with 100 lists (good for ~10k-100k rows)
CREATE INDEX IF NOT EXISTS kb_articles_embedding_idx 
  ON public.kb_articles 
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Add comment for documentation
COMMENT ON COLUMN public.kb_articles.embedding IS 
  'Vector embedding (1536 dimensions) for semantic search using text-embedding-3-large model';
