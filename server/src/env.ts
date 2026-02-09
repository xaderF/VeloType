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
  DAILY_RESET_TIMEZONE: z
    .string()
    .default('America/New_York')
    .refine((tz) => {
      try {
        // Throws RangeError for invalid IANA time zones.
        new Intl.DateTimeFormat('en-US', { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, 'Invalid DAILY_RESET_TIMEZONE (expected IANA timezone, e.g. America/Los_Angeles)'),
});

type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
