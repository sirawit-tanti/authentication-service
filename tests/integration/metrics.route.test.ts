import type { FastifyInstance } from 'fastify';

import { buildApplication } from '../../src/app.js';
import { PrometheusMetrics } from '../../src/infrastructure/observability/prometheus-metrics.js';

const METRICS_TOKEN = 'metrics-test-token-with-at-least-32-characters';

describe('GET /metrics', () => {
  let application: FastifyInstance;

  beforeEach(async () => {
    application = await buildApplication({
      logger: false,

      registerInfrastructure: false,

      metrics: new PrometheusMetrics({
        serviceName: 'authentication-service-test',

        collectProcessMetrics: false,
      }),

      metricsBearerToken: METRICS_TOKEN,
    });

    await application.ready();
  });

  afterEach(async () => {
    await application.close();
  });

  it('returns Prometheus metrics with a valid bearer token', async () => {
    await application.inject({
      method: 'GET',
      url: '/api/v1/health/live',
    });

    const response = await application.inject({
      method: 'GET',
      url: '/metrics',

      headers: {
        authorization: `Bearer ${METRICS_TOKEN}`,
      },
    });

    expect(response.statusCode).toBe(200);

    expect(response.headers['content-type']).toContain('text/plain');

    expect(response.body).toContain('authentication_service_http_requests_total');

    expect(response.body).toContain('route="/api/v1/health/live"');

    expect(response.body).not.toContain('route="/metrics"');
  });

  it('rejects a missing bearer token when a token is configured', async () => {
    const response = await application.inject({
      method: 'GET',
      url: '/metrics',
    });

    expect(response.statusCode).toBe(401);

    expect(response.json()).toEqual({
      success: false,

      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication is required',
      },
    });
  });

  it('rejects an invalid bearer token', async () => {
    const response = await application.inject({
      method: 'GET',
      url: '/metrics',

      headers: {
        authorization: 'Bearer incorrect-metrics-token-value',
      },
    });

    expect(response.statusCode).toBe(401);
  });

  it('does not expose sensitive request values as labels', async () => {
    const sensitiveValue = 'sirawit@example.com';

    await application.inject({
      method: 'GET',

      url: `/api/v1/unknown?email=${encodeURIComponent(sensitiveValue)}`,
    });

    const response = await application.inject({
      method: 'GET',
      url: '/metrics',

      headers: {
        authorization: `Bearer ${METRICS_TOKEN}`,
      },
    });

    expect(response.statusCode).toBe(200);

    expect(response.body).not.toContain(sensitiveValue);

    expect(response.body).not.toContain('email=');

    expect(response.body).toContain('route="UNMATCHED"');
  });
});
