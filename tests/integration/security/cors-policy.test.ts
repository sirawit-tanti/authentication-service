import type { FastifyInstance } from 'fastify';

import { buildApplication } from '@/app.js';

const ALLOWED_ORIGIN = 'http://localhost:3000';

const UNTRUSTED_ORIGIN = 'https://malicious.example.com';

async function createTestApplication(): Promise<FastifyInstance> {
  const application = await buildApplication({
    logger: false,
    registerInfrastructure: false,
  });

  application.get('/cors-test', async () => {
    return Promise.resolve({
      success: true,
    });
  });

  application.post('/cors-test', async () => {
    return Promise.resolve({
      success: true,
    });
  });

  await application.ready();

  return application;
}

describe('CORS security policy', () => {
  let application: FastifyInstance | null = null;

  afterEach(async (): Promise<void> => {
    if (application !== null) {
      await application.close();

      application = null;
    }
  });

  it('allows a configured browser origin', async () => {
    application = await createTestApplication();

    const response = await application.inject({
      method: 'GET',
      url: '/cors-test',
      headers: {
        origin: ALLOWED_ORIGIN,
      },
    });

    expect(response.statusCode).toBe(200);

    expect(response.json()).toEqual({
      success: true,
    });

    expect(response.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);

    expect(response.headers.vary).toContain('Origin');
  });

  it('allows server-to-server requests without an Origin header', async () => {
    application = await createTestApplication();

    const response = await application.inject({
      method: 'GET',
      url: '/cors-test',
    });

    expect(response.statusCode).toBe(200);

    expect(response.json()).toEqual({
      success: true,
    });

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('rejects an origin outside the configured allowlist', async () => {
    application = await createTestApplication();

    const response = await application.inject({
      method: 'GET',
      url: '/cors-test',
      headers: {
        origin: UNTRUSTED_ORIGIN,
      },
    });

    expect(response.statusCode).toBeGreaterThanOrEqual(400);

    expect(response.headers['access-control-allow-origin']).toBeUndefined();

    expect(response.body).not.toContain(UNTRUSTED_ORIGIN);
  });

  it('does not reflect an untrusted origin in response headers', async () => {
    application = await createTestApplication();

    const response = await application.inject({
      method: 'POST',
      url: '/cors-test',
      headers: {
        origin: UNTRUSTED_ORIGIN,
        'content-type': 'application/json',
      },
      payload: {
        value: 'test',
      },
    });

    expect(response.statusCode).toBeGreaterThanOrEqual(400);

    expect(response.headers['access-control-allow-origin']).not.toBe(UNTRUSTED_ORIGIN);

    expect(response.body).not.toContain(UNTRUSTED_ORIGIN);
  });

  it('returns the configured headers for an allowed preflight request', async () => {
    application = await createTestApplication();

    const response = await application.inject({
      method: 'OPTIONS',
      url: '/cors-test',
      headers: {
        origin: ALLOWED_ORIGIN,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'authorization, content-type, x-request-id',
      },
    });

    expect(response.statusCode).toBe(204);

    expect(response.body).toBe('');

    expect(response.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);

    expect(response.headers['access-control-allow-methods']).toContain('POST');

    expect(response.headers['access-control-allow-headers']).toContain('authorization');

    expect(response.headers['access-control-allow-headers']).toContain('content-type');

    expect(response.headers['access-control-allow-headers']).toContain('x-request-id');

    expect(response.headers['access-control-max-age']).toBe('60');
  });

  it('rejects a preflight request from an untrusted origin', async () => {
    application = await createTestApplication();

    const response = await application.inject({
      method: 'OPTIONS',
      url: '/cors-test',
      headers: {
        origin: UNTRUSTED_ORIGIN,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'authorization, content-type',
      },
    });

    expect(response.statusCode).toBeGreaterThanOrEqual(400);

    expect(response.headers['access-control-allow-origin']).toBeUndefined();

    expect(response.body).not.toContain(UNTRUSTED_ORIGIN);
  });

  it('exposes only the configured response headers', async () => {
    application = await createTestApplication();

    const response = await application.inject({
      method: 'GET',
      url: '/cors-test',
      headers: {
        origin: ALLOWED_ORIGIN,
      },
    });

    expect(response.statusCode).toBe(200);

    const exposedHeaders = response.headers['access-control-expose-headers'] ?? '';

    expect(exposedHeaders).toContain('x-request-id');

    expect(exposedHeaders).toContain('x-ratelimit-limit');

    expect(exposedHeaders).toContain('x-ratelimit-remaining');

    expect(exposedHeaders).toContain('x-ratelimit-reset');

    expect(exposedHeaders).toContain('retry-after');

    expect(exposedHeaders).not.toContain('authorization');

    expect(exposedHeaders).not.toContain('cookie');
  });

  it('does not enable credentialed CORS when credentials are disabled', async () => {
    application = await createTestApplication();

    const response = await application.inject({
      method: 'GET',
      url: '/cors-test',
      headers: {
        origin: ALLOWED_ORIGIN,
      },
    });

    expect(response.statusCode).toBe(200);

    expect(response.headers['access-control-allow-credentials']).toBeUndefined();
  });
});
