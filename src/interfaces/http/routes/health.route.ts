import type { FastifyInstance } from 'fastify';

import {
  getHealthStatus,
  getLivenessStatus,
  getReadinessStatus,
} from '../controllers/health.controller.js';

import {
  healthResponseSchema,
  livenessResponseSchema,
  readinessResponseSchema,
} from '../schemas/health.schema.js';

export function healthRoutes(fastify: FastifyInstance): void {
  fastify.get(
    '/health',
    {
      schema: {
        tags: ['Health'],
        summary: 'Check service health',
        description: 'Returns the basic health status of the authentication service',

        response: {
          200: healthResponseSchema,
        },
      },
    },
    getHealthStatus,
  );

  fastify.get(
    '/health/live',
    {
      schema: {
        tags: ['Health'],
        summary: 'Check service liveness',
        description: 'Returns whether the Node.js service process is alive',

        response: {
          200: livenessResponseSchema,
        },
      },
    },
    getLivenessStatus,
  );

  fastify.get(
    '/health/ready',
    {
      schema: {
        tags: ['Health'],
        summary: 'Check service readiness',
        description: 'Returns whether the service and PostgreSQL dependency are ready',

        response: {
          200: readinessResponseSchema,
        },
      },
    },
    getReadinessStatus,
  );
}
