import { supabase } from '../supabase';

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
const EMBEDDING_MODEL = 'text-embedding-3-large';
const EMBEDDING_DIMENSIONS = 1536;

interface EmbeddingResponse {
  data: Array<{
    embedding: number[];
  }>;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  if (!OPENAI_API_KEY) {
    // Removed console.warn
    return new Array(EMBEDDING_DIMENSIONS).fill(0);
  }

  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = (await response.json()) as EmbeddingResponse;
    return data.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    return new Array(EMBEDDING_DIMENSIONS).fill(0);
  }
}

export interface KBSearchResult {
  id: string;
  title: string;
  content: string;
  similarity: number;
}

export async function searchKnowledgeBase(
  query: string,
  limit: number = 5
): Promise<KBSearchResult[]> {
  if (!query || query.trim().length === 0) {
    return [];
  }

  try {
    const embedding = await generateEmbedding(query);

    const { data, error } = await supabase.rpc('match_knowledge_articles', {
      query_embedding: embedding,
      match_count: limit,
    });

    if (error) {
      console.error('Error searching knowledge base:', error);
      return [];
    }

    return (data || []) as KBSearchResult[];
  } catch (error) {
    console.error('Error in vector search:', error);
    return [];
  }
}

export async function embedKBArticle(articleId: string): Promise<boolean> {
  try {
    const { data: article, error: fetchError } = await supabase
      .from('kb_articles')
      .select('title, body')
      .eq('id', articleId)
      .maybeSingle();

    if (fetchError || !article) {
      console.error('Error fetching article:', fetchError);
      return false;
    }

    const textToEmbed = `${article.title}\n\n${article.body}`;
    const embedding = await generateEmbedding(textToEmbed);

    const { error: updateError } = await supabase
      .from('kb_articles')
      .update({ embedding })
      .eq('id', articleId);

    if (updateError) {
      console.error('Error updating embedding:', updateError);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error embedding article:', error);
    return false;
  }
}

export async function embedAllPublishedArticles(): Promise<{
  success: number;
  failed: number;
  total: number;
}> {
  try {
    const { data: articles, error } = await supabase
      .from('kb_articles')
      .select('id')
      .eq('is_published', true)
      .is('embedding', null);

    if (error || !articles) {
      console.error('Error fetching articles:', error);
      return { success: 0, failed: 0, total: 0 };
    }

    let success = 0;
    let failed = 0;

    for (const article of articles) {
      const result = await embedKBArticle(article.id);
      if (result) {
        success++;
      } else {
        failed++;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return {
      success,
      failed,
      total: articles.length,
    };
  } catch (error) {
    console.error('Error in batch embedding:', error);
    return { success: 0, failed: 0, total: 0 };
  }
}

export async function findSimilarArticles(
  articleId: string,
  limit: number = 3
): Promise<KBSearchResult[]> {
  try {
    const { data: article, error } = await supabase
      .from('kb_articles')
      .select('title, body')
      .eq('id', articleId)
      .maybeSingle();

    if (error || !article) {
      console.error('Error fetching article:', error);
      return [];
    }

    const results = await searchKnowledgeBase(`${article.title} ${article.body}`, limit + 1);
    return results.filter((r) => r.id !== articleId).slice(0, limit);
  } catch (error) {
    console.error('Error finding similar articles:', error);
    return [];
  }
}
