import type { FastifyPluginCallback } from 'fastify';

import { livenessController, readinessController } from '../controllers/health.controller.js';
import { livenessRouteSchema, readinessRouteSchema } from '../schemas/health.schema.js';

export const healthRoutes: FastifyPluginCallback = (fastify, _options, done): void => {
  fastify.get(
    '/health',
    {
      schema: readinessRouteSchema,
    },
    readinessController,
  );

  fastify.get(
    '/health/live',
    {
      schema: livenessRouteSchema,
    },
    livenessController,
  );

  fastify.get(
    '/health/ready',
    {
      schema: readinessRouteSchema,
    },
    readinessController,
  );

  done();
};
