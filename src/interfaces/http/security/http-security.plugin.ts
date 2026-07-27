import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import fastifyPlugin from 'fastify-plugin';

import { env } from '@/shared/config/env.js';
import { HTTP_SECURITY } from './http-security.js';
import { CorsOriginNotAllowedError } from './cors-origin-not-allowed.error.js';

function isAllowedOrigin(origin: string | undefined): boolean {
  if (origin === undefined) {
    return true;
  }

  return HTTP_SECURITY.allowedOrigins.has(origin);
}

async function httpSecurityPluginImplementation(fastify: FastifyInstance): Promise<void> {
  await fastify.register(cors, {
    credentials: HTTP_SECURITY.allowCredentials,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['authorization', 'content-type', 'x-request-id'],
    exposedHeaders: [
      'x-request-id',
      'x-trace-id',
      'x-ratelimit-limit',
      'x-ratelimit-remaining',
      'x-ratelimit-reset',
      'retry-after',
    ],
    maxAge: 60,
    origin(origin, callback): void {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new CorsOriginNotAllowedError(), false);
    },
  });

  await fastify.register(helmet, {
    global: true,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        baseUri: ["'none'"],
        frameAncestors: ["'none'"],
        formAction: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    referrerPolicy: {
      policy: 'no-referrer',
    },
    frameguard: {
      action: 'deny',
    },
    hsts:
      env.NODE_ENV === 'production'
        ? {
            maxAge: HTTP_SECURITY.hstsMaxAgeSeconds,
            includeSubDomains: true,
            preload: false,
          }
        : false,
  });

  fastify.addHook('onSend', async (request: FastifyRequest, reply, payload): Promise<unknown> => {
    if (request.url.startsWith('/api/v1/auth')) {
      reply.header('Cache-Control', 'no-store, max-age=0');

      reply.header('Pragma', 'no-cache');

      reply.header('Expires', '0');
    }

    return payload;
  });
}

export const httpSecurityPlugin = fastifyPlugin(httpSecurityPluginImplementation, {
  name: 'http-security-plugin',
});
