import type { FastifyPluginCallback } from 'fastify';

import type { Metrics } from '@/application/ports/observability/metrics.js';
import { createMetricsController } from './metrics.controller.js';

export interface MetricsRoutesOptions {
  metrics: Metrics;
  environment: 'development' | 'test' | 'production';
  bearerToken?: string;
}

const metricsRouteSchema = {
  description: 'Expose Prometheus-compatible service metrics',

  tags: ['Operations'],

  response: {
    200: {
      type: 'string',
    },

    401: {
      type: 'object',

      additionalProperties: true,
    },
  },
} as const;

export const metricsRoutes: FastifyPluginCallback<MetricsRoutesOptions> = (
  fastify,
  options,
  done,
): void => {
  const metricsController = createMetricsController({
    metrics: options.metrics,
    environment: options.environment,

    ...(options.bearerToken === undefined
      ? {}
      : {
          bearerToken: options.bearerToken,
        }),
  });

  fastify.get(
    '/metrics',
    {
      schema: metricsRouteSchema,
      logLevel: 'silent',
    },
    metricsController,
  );

  done();
};
