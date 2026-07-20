import { env } from '@/shared/config/env.js';

function parseAllowedOrigins(value: string): ReadonlySet<string> {
  const origins = value
    .split(',')
    .map((origin): string => origin.trim())
    .filter((origin): boolean => origin.length > 0);

  return new Set(origins);
}

export const HTTP_SECURITY = Object.freeze({
  allowedOrigins: parseAllowedOrigins(env.CORS_ALLOWED_ORIGINS),

  allowCredentials: env.CORS_ALLOW_CREDENTIALS,

  bodyLimitBytes: env.HTTP_BODY_LIMIT_BYTES,

  hstsMaxAgeSeconds: env.HTTP_HSTS_MAX_AGE_SECONDS,
});
