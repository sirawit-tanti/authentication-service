import { describe, expect, it } from 'vitest';

import { PrometheusMetrics } from '../../../src/infrastructure/observability/prometheus-metrics.js';

describe('PrometheusMetrics', () => {
  it('records HTTP request metrics', async () => {
    const metrics = new PrometheusMetrics({
      serviceName: 'authentication-service',
      collectProcessMetrics: false,
    });

    metrics.incrementActiveHttpRequests();

    metrics.recordHttpRequest({
      method: 'GET',
      route: '/api/v1/health/live',
      statusCode: 200,
      durationSeconds: 0.025,
    });

    metrics.decrementActiveHttpRequests();

    const output = await metrics.render();

    expect(output).toContain('authentication_service_http_requests_total');

    expect(output).toContain('method="GET"');

    expect(output).toContain('route="/api/v1/health/live"');

    expect(output).toContain('status_code="200"');

    expect(output).toContain('authentication_service_http_request_duration_seconds_count');

    expect(output).toContain('authentication_service_http_active_requests');
  });

  it('records database and Redis metrics', async () => {
    const metrics = new PrometheusMetrics({
      serviceName: 'authentication-service',
      collectProcessMetrics: false,
    });

    metrics.observeDatabaseQuery({
      target: 'quaint::connector::metrics',
      durationSeconds: 0.01,
    });

    metrics.recordDatabaseError();

    metrics.setRedisConnectionState('ready');

    metrics.recordRedisError();

    const output = await metrics.render();

    expect(output).toContain('authentication_service_database_query_duration_seconds_count');

    expect(output).toContain('target="quaint::connector::metrics"');

    expect(output).toContain('authentication_service_database_errors_total');

    expect(output).toContain('authentication_service_redis_connection_state');

    expect(output).toContain('state="ready"');

    expect(output).toContain('authentication_service_redis_errors_total');
  });

  it('uses an isolated registry for each instance', async () => {
    const firstMetrics = new PrometheusMetrics({
      serviceName: 'first-service',
      collectProcessMetrics: false,
    });

    const secondMetrics = new PrometheusMetrics({
      serviceName: 'second-service',
      collectProcessMetrics: false,
    });

    firstMetrics.recordDatabaseError();

    const firstOutput = await firstMetrics.render();

    const secondOutput = await secondMetrics.render();

    expect(firstOutput).toContain(
      'authentication_service_database_errors_total{service="first-service"} 1',
    );

    expect(secondOutput).toContain(
      'authentication_service_database_errors_total{service="second-service"} 0',
    );
  });

  it('rejects an empty service name', () => {
    expect(() => {
      new PrometheusMetrics({
        serviceName: '   ',
      });
    }).toThrow('Metrics service name must not be empty');
  });
});
