import OpenAI from 'openai';
import { supabase } from '../supabase.js';
import { config } from '../config.js';

const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });

export async function searchKB(query: string, topK: number = 5) {
  try {
    // Generate embedding for the query
    const embeddingResponse = await openai.embeddings.create({
      model: config.EMBED_MODEL,
      input: query,
    });

    const embedding = embeddingResponse.data[0].embedding;

    // Search for similar documents using vector similarity
    const { data: results, error } = await supabase
      .rpc('match_kb_docs', {
        query_embedding: embedding,
        match_threshold: 0.5,
        match_count: topK,
      });

    if (error) {
      console.error('KB search error:', error);
      return [];
    }

    return results || [];
  } catch (error) {
    console.error('Error searching KB:', error);
    return [];
  }
}

export async function ingestDocument(
  title: string,
  source: string,
  content: string
) {
  try {
    // Simple chunking - split by paragraphs and limit size
    const chunks = content
      .split('\n\n')
      .filter(chunk => chunk.trim().length > 50)
      .map(chunk => chunk.trim())
      .slice(0, 10); // Limit chunks per document

    for (const chunk of chunks) {
      // Generate embedding
      const embeddingResponse = await openai.embeddings.create({
        model: config.EMBED_MODEL,
        input: chunk,
      });

      const embedding = embeddingResponse.data[0].embedding;

      // Insert into database
      const { error } = await supabase
        .from('kb_docs')
        .insert({
          title,
          source,
          chunk,
          embedding,
          created_at: new Date().toISOString(),
        });

      if (error) {
        console.error('Error inserting chunk:', error);
      }
    }

    return { success: true, chunks: chunks.length };
  } catch (error) {
    console.error('Error ingesting document:', error);
    throw error;
  }
}