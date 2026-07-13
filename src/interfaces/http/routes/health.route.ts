import type { FastifyInstance } from 'fastify';

import { getHealthStatus } from '../controllers/health.controller.js';
import { healthResponseSchema } from '../schemas/health.schema.js';

export function healthRoutes(fastify: FastifyInstance): void {
  fastify.get(
    '/health',
    {
      schema: {
        tags: ['Health'],
        summary: 'Check service health',
        description: 'Returns the current health status of the authentication service',

        response: {
          200: healthResponseSchema,
        },
      },
    },
    getHealthStatus,
  );
}
