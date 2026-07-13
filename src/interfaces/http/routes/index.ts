import type { FastifyInstance } from 'fastify';

import { healthRoutes } from './health.route.js';

export async function apiV1Routes(fastify: FastifyInstance): Promise<void> {
  await fastify.register(healthRoutes);
}
