/**
 * Gemini AI Client for Rx Pricing
 * 
 * This module provides a simple fetch-based client for calling the Google
 * Generative Language API (Gemini) to get AI-powered Rx pricing estimates.
 * 
 * Environment variables:
 * - GEMINI_API_KEY: Your Google AI API key
 * - GEMINI_MODEL: Model to use (default: gemini-1.5-flash)
 */

// ============================================================================
// Types
// ============================================================================

export interface GeminiRxPricingResponse {
  options: {
    medicationName: string;
    pharmacy: string;
    estimatedMonthlyCost: number;
    notes?: string;
  }[];
  summary: string;
}

export interface GeminiApiResponse {
  candidates?: {
    content?: {
      parts?: {
        text?: string;
      }[];
    };
  }[];
  error?: {
    message: string;
    code: number;
  };
}

// ============================================================================
// Configuration
// ============================================================================

const getGeminiConfig = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  
  return { apiKey, model };
};

// ============================================================================
// Gemini Client
// ============================================================================

/**
 * Call Gemini API with a prompt and parse the response as Rx pricing data.
 * 
 * @param prompt - The structured prompt asking for Rx pricing in JSON format
 * @returns Parsed Rx pricing response, or null if API unavailable/errors
 */
export async function callGeminiForRxPricing(
  prompt: string
): Promise<GeminiRxPricingResponse | null> {
  const { apiKey, model } = getGeminiConfig();

  // If no API key, return null to trigger fallback
  if (!apiKey) {
    console.log('Gemini API key not configured, using mock fallback');
    return null;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.2, // Lower temperature for more consistent/factual output
      topP: 0.8,
      topK: 40,
      maxOutputTokens: 2048,
    },
    safetySettings: [
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_ONLY_HIGH',
      },
    ],
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', response.status, errorText);
      return null;
    }

    const data: GeminiApiResponse = await response.json();

    // Check for API-level errors
    if (data.error) {
      console.error('Gemini API returned error:', data.error.message);
      return null;
    }

    // Extract the text response from the first candidate
    const textContent = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textContent) {
      console.error('Gemini returned empty response');
      return null;
    }

    // Try to parse as JSON
    // The model should return JSON, but it might include markdown code fences
    const jsonMatch = textContent.match(/```json\s*([\s\S]*?)\s*```/) ||
                      textContent.match(/```\s*([\s\S]*?)\s*```/) ||
                      [null, textContent];
    
    const jsonString = jsonMatch[1]?.trim() || textContent.trim();

    try {
      const parsed = JSON.parse(jsonString);
      
      // Validate the response structure
      if (!parsed.options || !Array.isArray(parsed.options)) {
        console.error('Gemini response missing options array');
        return null;
      }

      return {
        options: parsed.options.map((opt: Record<string, unknown>) => ({
          medicationName: String(opt.medicationName || ''),
          pharmacy: String(opt.pharmacy || 'Unknown Pharmacy'),
          estimatedMonthlyCost: Number(opt.estimatedMonthlyCost) || 0,
          notes: opt.notes ? String(opt.notes) : undefined,
        })),
        summary: String(parsed.summary || 'AI-generated Rx pricing estimates'),
      };
    } catch (parseError) {
      console.error('Failed to parse Gemini Rx JSON:', parseError);
      console.error('Raw response:', textContent.substring(0, 500));
      return null;
    }
  } catch (fetchError) {
    console.error('Gemini API fetch error:', fetchError);
    return null;
  }
}

/**
 * Check if Gemini is configured and available
 */
export function isGeminiConfigured(): boolean {
  const { apiKey } = getGeminiConfig();
  return !!apiKey;
}

/**
 * Get the configured Gemini model name
 */
export function getGeminiModel(): string {
  const { model } = getGeminiConfig();
  return model;
}

