import { config } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const envFilePath = resolve(dirname(fileURLToPath(import.meta.url)), '../../.env');
config({ path: envFilePath });

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.string().default('development'),
  DATABASE_URL: z.string().url().optional(),
  AUTH_SECRET: z.string().min(1).optional(),
});

type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
