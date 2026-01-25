/*
  # Create match_kb_docs Function for Vector Similarity Search

  1. Purpose
    - Enable vector similarity search for knowledge base documents
    - Support AI-powered document retrieval using embeddings
    - Return relevant documents with similarity scores

  2. Function Details
    - Name: match_kb_docs
    - Parameters:
      - query_embedding: vector(1536) - The search vector
      - match_threshold: float - Minimum similarity score (0-1)
      - match_count: int - Maximum number of results to return
    - Returns: Table with document details and similarity scores

  3. Notes
    - Uses cosine similarity via the <=> operator
    - Filters results by threshold to ensure quality
    - Orders by similarity (descending)
    - Essential for AI agent knowledge base search tool
*/

CREATE OR REPLACE FUNCTION match_kb_docs(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  title text,
  source text,
  chunk text,
  similarity float
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kb_docs.id,
    kb_docs.title,
    kb_docs.source,
    kb_docs.chunk,
    1 - (kb_docs.embedding <=> query_embedding) AS similarity
  FROM kb_docs
  WHERE kb_docs.embedding IS NOT NULL
    AND 1 - (kb_docs.embedding <=> query_embedding) > match_threshold
  ORDER BY kb_docs.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Add index on embedding column for faster similarity search
CREATE INDEX IF NOT EXISTS kb_docs_embedding_idx ON kb_docs
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION match_kb_docs(vector(1536), float, int) TO authenticated;
GRANT EXECUTE ON FUNCTION match_kb_docs(vector(1536), float, int) TO service_role;
