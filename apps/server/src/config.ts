import { z } from 'zod';

const configSchema = z.object({
  // OpenAI
  OPENAI_API_KEY: z.string().min(1),
  EMBED_MODEL: z.string().default('text-embedding-3-large'),
  CHAT_MODEL: z.string().default('gpt-4o-mini'),
  
  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_ANON_KEY: z.string().min(1),
  
  // External services
  N8N_BASE_URL: z.string().url().optional(),
  N8N_API_KEY: z.string().optional(),
  SLACK_WEBHOOK_URL: z.string().url().optional(),
  CRM_BASE_URL: z.string().url().optional(),
  CRM_API_KEY: z.string().optional(),
  
  // Server
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().default(3001),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  
  // Security
  JWT_SECRET: z.string().min(32).optional(),
  RATE_LIMIT_WINDOW: z.coerce.number().default(15),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  ALLOW_DEMO_AUTH: z.string().default('false'),
});

export const config = configSchema.parse(process.env);