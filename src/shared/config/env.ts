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
    .refine((url) => url.startsWith('postgresql://') || url.startsWith('postgres://'), {
      message: 'DATABASE_URL must use the postgresql:// or postgres:// protocol',
    }),

  REDIS_URL: z
    .string()
    .trim()
    .refine((url) => url.startsWith('redis://') || url.startsWith('rediss://'), {
      message: 'REDIS_URL must use the redis:// or rediss:// protocol',
    }),

  REDIS_KEY_PREFIX: z
    .string()
    .trim()
    .min(1)
    .regex(/^[a-zA-Z0-9:_-]+$/, {
      message:
        'REDIS_KEY_PREFIX may contain only letters, numbers, colons, underscores, and hyphens',
    })
    .default('auth:'),

  REDIS_CONNECT_TIMEOUT_MS: z.coerce.number().int().positive().max(60_000).default(10_000),

  REDIS_MAX_RETRIES_PER_REQUEST: z.coerce.number().int().min(0).max(10).default(3),

  BCRYPT_COST: z.coerce.number().int().min(10).max(15).default(12),

  EMAIL_VERIFICATION_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().max(1_440).default(60),

  BULLMQ_PREFIX: z
    .string()
    .trim()
    .min(1)
    .regex(/^[a-zA-Z0-9_-]+$/, {
      message: 'BULLMQ_PREFIX may contain only letters, numbers, underscores, and hyphens',
    })
    .default('auth-queue'),

  EMAIL_QUEUE_NAME: z
    .string()
    .trim()
    .min(1)
    .regex(/^[a-zA-Z0-9_-]+$/, {
      message: 'EMAIL_QUEUE_NAME may contain only letters, numbers, underscores, and hyphens',
    })
    .default('authentication-email'),

  EMAIL_WORKER_CONCURRENCY: z.coerce.number().int().positive().max(50).default(5),

  EMAIL_JOB_ATTEMPTS: z.coerce.number().int().min(1).max(20).default(5),

  EMAIL_JOB_BACKOFF_MS: z.coerce.number().int().positive().max(300_000).default(5_000),

  EMAIL_PROVIDER: z.enum(['development']).default('development'),

  EMAIL_FROM_ADDRESS: z.string().trim().pipe(z.email()).default('no-reply@example.com'),

  EMAIL_FROM_NAME: z.string().trim().min(1).max(100).default('Authentication Service'),

  EMAIL_VERIFICATION_BASE_URL: z
    .string()
    .trim()
    .pipe(z.url())
    .default('http://localhost:3000/verify-email'),

  OUTBOX_POLL_INTERVAL_MS: z.coerce.number().int().positive().max(60_000).default(1_000),

  OUTBOX_BATCH_SIZE: z.coerce.number().int().positive().max(100).default(20),

  OUTBOX_LOCK_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .max(15 * 60 * 1_000)
    .default(60_000),

  OUTBOX_MAX_ATTEMPTS: z.coerce.number().int().positive().max(100).default(10),
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
