import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance, FastifyRequest } from 'fastify';

const RATE_LIMIT_MESSAGE = 'Too many requests. Please try again later';

interface RateLimitContext {
  after: string;
  max: number;
  ttl: number;
}

interface RateLimitErrorResponse {
  statusCode: 429;
  success: false;
  error: {
    code: 'RATE_LIMIT_EXCEEDED';
    message: string;
  };
}

export async function registerAuthenticationRateLimit(fastify: FastifyInstance): Promise<void> {
  await fastify.register(rateLimit, {
    global: false,
    redis: fastify.infrastructure.redis,
    nameSpace: 'authentication-rate-limit',
    skipOnError: false,
    keyGenerator(request: FastifyRequest): string {
      return request.ip;
    },
    errorResponseBuilder(
      request: FastifyRequest,
      context: RateLimitContext,
    ): RateLimitErrorResponse {
      request.log.warn(
        {
          requestId: request.id,
          clientIp: request.ip,
          route: request.routeOptions.url,
          rateLimitMax: context.max,
          retryAfter: context.after,
          rateLimit: context.ttl,
        },
        'Authentication rate limie exceeded',
      );

      return {
        statusCode: 429,
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: RATE_LIMIT_MESSAGE,
        },
      };
    },
  });
}
