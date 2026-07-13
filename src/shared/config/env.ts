import 'dotenv/config';

import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  APP_NAME: z.string().trim().min(1).default('authentication-service'),

  APP_HOST: z.string().trim().min(1).default('0.0.0.0'),

  APP_PORT: z.coerce.number().int().positive().max(65_535).default(3000),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  DATABASE_URL: z
    .string()
    .trim()
    .url()
    .refine((url) => url.startsWith('postgresql://') || url.startsWith('postgres://'), {
      message: 'DATABASE_URL must use the postgresql:// or postgres:// protocol',
    }),

  REDIS_URL: z
    .string()
    .trim()
    .url()
    .refine((url) => url.startsWith('redis://') || url.startsWith('rediss://'), {
      message: 'REDIS_URL must use the redis:// or rediss:// protocol',
    }),
});

const parsedEnvironment = environmentSchema.safeParse(process.env);

if (!parsedEnvironment.success) {
  const formattedErrors = z.flattenError(parsedEnvironment.error);

  console.error('Invalid environment configuration:', {
    formErrors: formattedErrors.formErrors,
    fieldErrors: formattedErrors.fieldErrors,
  });

  throw new Error('Application environment configuration is invalid');
}

export const env = Object.freeze(parsedEnvironment.data);

export type Environment = typeof env;
