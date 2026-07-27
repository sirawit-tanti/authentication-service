import Fastify, { LogController, type FastifyInstance, type FastifyServerOptions } from 'fastify';

import type { Metrics } from './application/ports/observability/metrics.js';
import {
  createInfrastructureContainer,
  type InfrastructureContainer,
} from './infrastructure/container/infrastructure-container.js';
import { infrastructurePlugin } from './infrastructure/container/infrastructure.plugin.js';
import { PrometheusMetrics } from './infrastructure/observability/prometheus-metrics.js';
import { auditingPlugin } from './interfaces/http/modules/auditing/auditing.plugin.js';
import { authenticationPlugin } from './interfaces/http/modules/authentication/authentication.plugin.js';
import { authorizationPlugin } from './interfaces/http/modules/authorization/authorization.plugin.js';
import { metricsRoutes } from './interfaces/http/modules/metrics/metrics.routes.js';
import { usersPlugin } from './interfaces/http/modules/users/users.plugin.js';
import { httpMetricsPlugin } from './interfaces/http/observability/http-metrics.plugin.js';
import { apiV1Routes } from './interfaces/http/routes/index.js';
import { httpSecurityPlugin } from './interfaces/http/security/http-security.plugin.js';
import { openApiPlugin } from './interfaces/http/documentation/openapi.plugin.js';
import { httpTracingPlugin } from './interfaces/http/observability/http-tracing.plugin.js';
import { env } from './shared/config/env.js';
import { errorHandler } from './shared/errors/error-handler.js';
import { createLoggerRedactionConfiguration } from './shared/logging/logger-redaction.js';

export interface BuildApplicationOptions {
  logger?: FastifyServerOptions['logger'];

  registerInfrastructure?: boolean;

  infrastructure?: InfrastructureContainer;

  metrics?: Metrics;

  metricsBearerToken?: string;

  swaggerEnabled?: boolean;

  swaggerBearerToken?: string;

  trustProxy?: FastifyServerOptions['trustProxy'];

  bodyLimit?: number;
}

export async function buildApplication(
  options: BuildApplicationOptions = {},
): Promise<FastifyInstance> {
  const application = Fastify({
    logger: options.logger ?? {
      level: env.LOG_LEVEL,

      redact: createLoggerRedactionConfiguration(),
    },

    bodyLimit: options.bodyLimit ?? env.HTTP_BODY_LIMIT_BYTES,

    trustProxy: options.trustProxy ?? env.HTTP_TRUST_PROXY_HOPS,

    ajv: {
      customOptions: {
        removeAdditional: false,
      },
    },

    requestIdHeader: 'x-request-id',

    logController: new LogController({
      requestIdLogLabel: 'requestId',
      disableRequestLogging: false,
    }),
  });

  const metrics =
    options.metrics ??
    new PrometheusMetrics({
      serviceName: env.APP_NAME,
    });

  await application.register(openApiPlugin, {
    enabled: options.swaggerEnabled ?? env.SWAGGER_ENABLED,

    environment: env.NODE_ENV,

    applicationName: env.APP_NAME,

    applicationVersion: '1.0.0',

    ...(options.swaggerBearerToken !== undefined
      ? {
          bearerToken: options.swaggerBearerToken,
        }
      : env.SWAGGER_BEARER_TOKEN === undefined
        ? {}
        : {
            bearerToken: env.SWAGGER_BEARER_TOKEN,
          }),
  });

  await application.register(errorHandler);

  await application.register(httpSecurityPlugin);

  await application.register(httpTracingPlugin);

  await application.register(httpMetricsPlugin, {
    metrics,
  });

  await application.register(metricsRoutes, {
    metrics,
    environment: env.NODE_ENV,

    ...(options.metricsBearerToken !== undefined
      ? {
          bearerToken: options.metricsBearerToken,
        }
      : env.METRICS_BEARER_TOKEN === undefined
        ? {}
        : {
            bearerToken: env.METRICS_BEARER_TOKEN,
          }),
  });

  if (options.registerInfrastructure !== false) {
    const infrastructure = options.infrastructure ?? createInfrastructureContainer();

    await application.register(infrastructurePlugin, {
      container: infrastructure,
      metrics,
    });

    await application.register(authenticationPlugin);

    await application.register(auditingPlugin);

    await application.register(authorizationPlugin);

    await application.register(usersPlugin);
  }

  await application.register(apiV1Routes, {
    prefix: '/api/v1',
  });

  return application;
}
