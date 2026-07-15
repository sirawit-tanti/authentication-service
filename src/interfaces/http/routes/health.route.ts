import type { FastifyPluginCallback } from 'fastify';

import { healthController } from '../controllers/health.controller.js';
import { healthRouteSchema } from '../schemas/health.schema.js';

export const healthRoutes: FastifyPluginCallback = (fastify, _options, done): void => {
  fastify.get(
    '/health',
    {
      schema: healthRouteSchema,
    },
    healthController,
  );

  done();
};
