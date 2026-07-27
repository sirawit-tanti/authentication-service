import { describe, expect, it } from 'vitest';

import {
  isIgnoredIncomingRequest,
  startTracing,
} from '../../../src/infrastructure/observability/tracing.js';

describe('OpenTelemetry tracing', () => {
  it('returns an idempotent disabled runtime', async () => {
    const tracing = startTracing({
      enabled: false,

      serviceName: 'authentication-service',

      serviceVersion: '1.0.0',

      environment: 'test',

      exporterEndpoint: 'http://localhost:4318/v1/traces',

      samplingRatio: 1,
    });

    expect(tracing.enabled).toBe(false);

    await expect(Promise.all([tracing.shutdown(), tracing.shutdown()])).resolves.toEqual([
      undefined,
      undefined,
    ]);
  });

  it('ignores metrics and documentation static assets', () => {
    expect(isIgnoredIncomingRequest('/metrics')).toBe(true);

    expect(isIgnoredIncomingRequest('/docs/static/index.css')).toBe(true);

    expect(isIgnoredIncomingRequest('/api/v1/auth/login')).toBe(false);
  });
});
