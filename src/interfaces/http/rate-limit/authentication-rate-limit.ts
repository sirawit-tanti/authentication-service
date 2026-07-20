import { env } from '@/shared/config/env.js';

export interface AuthenticationRateLimitPolicy {
  max: number;
  timeWindow: number;
  groupId: string;
}

export const AUTHENTICATION_RATE_LIMITS = {
  LOGIN: {
    max: env.AUTH_RATE_LIMIT_LOGIN_MAX,
    timeWindow: env.AUTH_RATE_LIMIT_LOGIN_WINDOW_MS,
    groupId: 'authentication-login',
  },

  REGISTER: {
    max: env.AUTH_RATE_LIMIT_REGISTER_MAX,
    timeWindow: env.AUTH_RATE_LIMIT_REGISTER_WINDOW_MS,
    groupId: 'authentication-register',
  },

  EMAIL_ACTION: {
    max: env.AUTH_RATE_LIMIT_EMAIL_MAX,
    timeWindow: env.AUTH_RATE_LIMIT_EMAIL_WINDOW_MS,
    groupId: 'authentication-email-action',
  },

  PASSWORD_ACTION: {
    max: env.AUTH_RATE_LIMIT_PASSWORD_MAX,
    timeWindow: env.AUTH_RATE_LIMIT_PASSWORD_WINDOW_MS,
    groupId: 'authentication-password-action',
  },

  REFRESH: {
    max: env.AUTH_RATE_LIMIT_REFRESH_MAX,
    timeWindow: env.AUTH_RATE_LIMIT_REFRESH_WINDOW_MS,
    groupId: 'authentication-refresh',
  },
} as const satisfies Record<string, AuthenticationRateLimitPolicy>;
