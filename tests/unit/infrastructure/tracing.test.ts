import {
  isIgnoredIncomingRequest,
  serializeRedisStatement,
  startTracing,
} from '../../../src/infrastructure/observability/tracing.js';

describe('Tracing infrastructure', () => {
  it('returns a disabled runtime without starting an SDK', async () => {
    const runtime = startTracing({
      enabled: false,

      serviceName: 'authentication-service',

      serviceVersion: '1.0.0',

      environment: 'test',

      exporterEndpoint: 'http://localhost:4318/v1/traces',

      samplingRatio: 1,
    });

    expect(runtime.enabled).toBe(false);

    await expect(runtime.shutdown()).resolves.toBeUndefined();
  });

  it('ignores metrics and documentation static assets', () => {
    expect(isIgnoredIncomingRequest('/metrics')).toBe(true);

    expect(isIgnoredIncomingRequest('/docs/static/index.css')).toBe(true);

    expect(isIgnoredIncomingRequest('/api/v1/health/live')).toBe(false);
  });

  it('serializes only the Redis command name', () => {
    expect(serializeRedisStatement('get', ['secret-session-key'])).toBe('GET');

    expect(serializeRedisStatement('set', ['secret-session-key', 'secret-session-value'])).toBe(
      'SET',
    );
  });
});
