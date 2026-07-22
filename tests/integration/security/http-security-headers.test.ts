import type { FastifyInstance } from 'fastify';

import { buildApplication } from '@/app.js';

async function createTestApplication(): Promise<FastifyInstance> {
  const application = await buildApplication({
    logger: false,
    registerInfrastructure: false,
  });

  application.get('/security-test', async () => {
    return Promise.resolve({
      success: true,
    });
  });

  application.get('/api/v1/auth/security-test', async () => {
    return Promise.resolve({
      success: true,
    });
  });

  await application.ready();

  return application;
}

describe('HTTP security headers', () => {
  let application: FastifyInstance | null = null;

  afterEach(async (): Promise<void> => {
    if (application !== null) {
      await application.close();

      application = null;
    }
  });

  it('adds baseline security headers to responses', async () => {
    application = await createTestApplication();

    const response = await application.inject({
      method: 'GET',
      url: '/security-test',
    });

    expect(response.statusCode).toBe(200);

    expect(response.headers['x-content-type-options']).toBe('nosniff');

    expect(response.headers['x-frame-options']).toBe('DENY');

    expect(response.headers['referrer-policy']).toBe('no-referrer');

    expect(response.headers['x-dns-prefetch-control']).toBe('off');

    expect(response.headers['x-download-options']).toBe('noopen');

    expect(response.headers['x-permitted-cross-domain-policies']).toBe('none');

    expect(response.headers['content-security-policy']).toContain("default-src 'none'");

    expect(response.headers['content-security-policy']).toContain("frame-ancestors 'none'");

    expect(response.headers['content-security-policy']).toContain("form-action 'none'");
  });

  it('does not send HSTS outside production', async () => {
    application = await createTestApplication();

    const response = await application.inject({
      method: 'GET',
      url: '/security-test',
    });

    expect(response.statusCode).toBe(200);

    expect(response.headers['strict-transport-security']).toBeUndefined();
  });

  it('prevents authentication responses from being cached', async () => {
    application = await createTestApplication();

    const response = await application.inject({
      method: 'GET',
      url: '/api/v1/auth/security-test',
    });

    expect(response.statusCode).toBe(200);

    expect(response.headers['cache-control']).toBe('no-store, max-age=0');

    expect(response.headers.pragma).toBe('no-cache');

    expect(response.headers.expires).toBe('0');
  });

  it('does not apply authentication cache headers to unrelated routes', async () => {
    application = await createTestApplication();

    const response = await application.inject({
      method: 'GET',
      url: '/security-test',
    });

    expect(response.statusCode).toBe(200);

    expect(response.headers['cache-control']).not.toBe('no-store, max-age=0');

    expect(response.headers.pragma).toBeUndefined();

    expect(response.headers.expires).toBeUndefined();
  });

  it('does not expose the server implementation header', async () => {
    application = await createTestApplication();

    const response = await application.inject({
      method: 'GET',
      url: '/security-test',
    });

    expect(response.statusCode).toBe(200);

    expect(response.headers['x-powered-by']).toBeUndefined();

    expect(response.headers.server).toBeUndefined();
  });
});
