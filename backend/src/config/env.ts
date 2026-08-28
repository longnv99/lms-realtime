import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  LOG_LEVEL: z.string().default('debug'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN_DAYS: z.coerce.number().int().positive().default(30),
  BREVO_API_KEY: z.string().optional().default(''),
  EMAIL_FROM: z.string().email().default('no-reply@lms-realtime.local'),
  NOTIFICATIONS_MOCK_MODE: z.coerce.boolean().default(true),
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
