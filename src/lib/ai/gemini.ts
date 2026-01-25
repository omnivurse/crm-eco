import { z } from 'zod';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-1.5-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const RecommendationSchema = z.object({
  next_action: z.enum(['assign', 'request_info', 'escalate', 'link_kb', 'create_problem', 'schedule_change']),
  rationale: z.string(),
  confidence: z.number().min(0).max(1),
});

export type Recommendation = z.infer<typeof RecommendationSchema>;

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

async function callGeminiAPI(prompt: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    // Removed console.warn
    return '';
  }

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt,
          }],
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as GeminiResponse;
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    throw error;
  }
}

export async function geminiSummarize(text: string): Promise<string> {
  if (!text || text.trim().length === 0) {
    return 'No content to summarize.';
  }

  const prompt = `Summarize the following support ticket or issue in 5 concise bullet points. Focus on the problem, impact, and key details. Be professional and clear.

Content:
${text}

Provide your summary as 5 bullet points starting with "- ".`;

  try {
    const summary = await callGeminiAPI(prompt);
    return summary || 'Unable to generate summary at this time.';
  } catch {
    return 'Unable to generate summary. AI service temporarily unavailable.';
  }
}

export async function recommendNextAction(ticket: {
  summary: string;
  description?: string;
  priority?: string;
  status?: string;
}): Promise<Recommendation> {
  const contextText = `
Summary: ${ticket.summary}
Description: ${ticket.description || 'N/A'}
Priority: ${ticket.priority || 'medium'}
Status: ${ticket.status || 'new'}
`.trim();

  const prompt = `You are an IT service desk AI assistant. Analyze this ticket and recommend the best next action.

Ticket Information:
${contextText}

Respond ONLY with valid JSON matching this exact schema:
{
  "next_action": "assign" | "request_info" | "escalate" | "link_kb" | "create_problem" | "schedule_change",
  "rationale": "Brief explanation of why this action is recommended",
  "confidence": 0.0 to 1.0
}

Choose:
- "assign" if ready for agent assignment
- "request_info" if more details needed from requester
- "escalate" if high priority or complex issue
- "link_kb" if likely has existing knowledge base solution
- "create_problem" if recurring issue needing root cause analysis
- "schedule_change" if requires planned maintenance/change

Respond with ONLY the JSON object, no other text.`;

  try {
    const responseText = await callGeminiAPI(prompt);

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const validated = RecommendationSchema.parse(parsed);
    return validated;
  } catch (error) {
    console.error('Error getting recommendation:', error);
    return {
      next_action: 'request_info',
      rationale: 'Unable to analyze ticket automatically. Manual review recommended.',
      confidence: 0.3,
    };
  }
}

export async function draftReply(ticket: {
  summary: string;
  description?: string;
  priority?: string;
}): Promise<string> {
  const contextText = `
Summary: ${ticket.summary}
Description: ${ticket.description || 'N/A'}
Priority: ${ticket.priority || 'medium'}
`.trim();

  const prompt = `You are a professional IT support agent. Draft a polite, helpful reply to this customer ticket.

Ticket Information:
${contextText}

Write a professional response that:
1. Acknowledges their issue
2. Shows empathy and understanding
3. Outlines next steps or requests additional information if needed
4. Sets appropriate expectations
5. Thanks them for their patience

Keep it concise (3-4 sentences) and friendly but professional.`;

  try {
    const reply = await callGeminiAPI(prompt);
    return reply || 'Thank you for contacting support. We are reviewing your request and will respond shortly.';
  } catch {
    return 'Thank you for contacting support. We are reviewing your request and will respond shortly.';
  }
}

export async function suggestKBArticles(query: string): Promise<string[]> {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const prompt = `You are an IT knowledge base assistant. Given this support query, suggest 3-5 relevant knowledge base article titles that might help resolve the issue.

Query: ${query}

Respond with a JSON array of article title suggestions:
["Article Title 1", "Article Title 2", "Article Title 3"]

Focus on common IT support topics like password resets, VPN access, software installation, network issues, email problems, etc.`;

  try {
    const responseText = await callGeminiAPI(prompt);

    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string').slice(0, 5);
    }
    return [];
  } catch (error) {
    console.error('Error suggesting KB articles:', error);
    return [];
  }
}
