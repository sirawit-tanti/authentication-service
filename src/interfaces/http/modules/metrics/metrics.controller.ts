import { timingSafeEqual } from 'node:crypto';

import type { FastifyReply, FastifyRequest } from 'fastify';

import type { Metrics } from '@/application/ports/observability/metrics.js';
import { createErrorResponse } from '@/shared/http/api-response.js';

export interface MetricsControllerOptions {
  metrics: Metrics;
  environment: 'development' | 'test' | 'production';
  bearerToken?: string;
}

function extractBearerToken(authorizationHeader: string | undefined): string | undefined {
  if (authorizationHeader === undefined) {
    return undefined;
  }

  const parts = authorizationHeader.trim().split(/\s+/u);

  if (parts.length !== 2) {
    return undefined;
  }

  const [scheme, token] = parts;

  if (scheme?.toLowerCase() !== 'bearer' || token === undefined || token.length === 0) {
    return undefined;
  }

  return token;
}

function tokensMatch(receivedToken: string, expectedToken: string): boolean {
  const receivedBuffer = Buffer.from(receivedToken);
  const expectedBuffer = Buffer.from(expectedToken);

  if (receivedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(receivedBuffer, expectedBuffer);
}

function isAuthorized(request: FastifyRequest, options: MetricsControllerOptions): boolean {
  const configuredToken = options.bearerToken?.trim();

  if (
    options.environment !== 'production' &&
    (configuredToken === undefined || configuredToken.length === 0)
  ) {
    return true;
  }

  if (configuredToken === undefined || configuredToken.length === 0) {
    return false;
  }

  const receivedToken = extractBearerToken(request.headers.authorization);

  if (receivedToken === undefined) {
    return false;
  }

  return tokensMatch(receivedToken, configuredToken);
}

export function createMetricsController(
  options: MetricsControllerOptions,
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async function metricsController(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    if (!isAuthorized(request, options)) {
      await reply
        .status(401)
        .send(createErrorResponse('UNAUTHORIZED', 'Authentication is required'));

      return;
    }

    const metricsPayload = await options.metrics.render();

    reply.header('Content-Type', options.metrics.getContentType());

    reply.header('Cache-Control', 'no-store, max-age=0');

    await reply.status(200).send(metricsPayload);
  };
}
