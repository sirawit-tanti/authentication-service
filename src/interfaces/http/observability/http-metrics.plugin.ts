import type { FastifyPluginCallback, FastifyRequest } from 'fastify';
import fastifyPlugin from 'fastify-plugin';

import type { Metrics } from '@/application/ports/observability/metrics.js';

export interface HttpMetricsPluginOptions {
  metrics: Metrics;
}

const requestStartedAt = new WeakMap<FastifyRequest, bigint>();

function shouldSkipMetrics(request: FastifyRequest): boolean {
  return request.raw.url?.startsWith('/metrics') === true;
}

function resolveRoute(request: FastifyRequest): string {
  const route = request.routeOptions.url;

  if (route === undefined || route.length === 0) {
    return 'UNMATCHED';
  }

  return route;
}

const httpMetricsPluginImplementation: FastifyPluginCallback<HttpMetricsPluginOptions> = (
  fastify,
  options,
  done,
): void => {
  const { metrics } = options;

  fastify.addHook('onRequest', (request, _reply, hookDone): void => {
    if (shouldSkipMetrics(request)) {
      hookDone();

      return;
    }

    requestStartedAt.set(request, process.hrtime.bigint());

    metrics.incrementActiveHttpRequests();

    hookDone();
  });

  fastify.addHook('onResponse', (request, reply, hookDone): void => {
    if (shouldSkipMetrics(request)) {
      hookDone();

      return;
    }

    const startedAt = requestStartedAt.get(request);

    if (startedAt === undefined) {
      hookDone();

      return;
    }

    requestStartedAt.delete(request);

    const durationNanoseconds = process.hrtime.bigint() - startedAt;

    const durationSeconds = Number(durationNanoseconds) / 1_000_000_000;

    metrics.decrementActiveHttpRequests();

    metrics.recordHttpRequest({
      method: request.method,
      route: resolveRoute(request),
      statusCode: reply.statusCode,
      durationSeconds,
    });

    hookDone();
  });

  done();
};

export const httpMetricsPlugin = fastifyPlugin(httpMetricsPluginImplementation, {
  name: 'http-metrics-plugin',
});
