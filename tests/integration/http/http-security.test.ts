import Fastify, { type FastifyInstance } from 'fastify';

import { errorHandler } from '../../../src/shared/errors/error-handler.js';
import { httpSecurityPlugin } from '../../../src/interfaces/http/security/http-security.plugin.js';

describe('HTTP security', () => {
  let application: FastifyInstance;

  beforeEach(async () => {
    application = Fastify({
      logger: false,
      bodyLimit: 64 * 1_024,
    });

    await application.register(errorHandler);

    await application.register(httpSecurityPlugin);

    application.post(
      '/api/v1/auth/test',
      (): Promise<{
        success: true;
      }> =>
        Promise.resolve({
          success: true,
        }),
    );

    await application.ready();
  });

  afterEach(async () => {
    await application.close();
  });

  it('adds security headers', async () => {
    const response = await application.inject({
      method: 'POST',
      url: '/api/v1/auth/test',
    });

    expect(response.statusCode).toBe(200);

    expect(response.headers['x-content-type-options']).toBe('nosniff');

    expect(response.headers['x-frame-options']).toBe('DENY');

    expect(response.headers['referrer-policy']).toBe('no-referrer');
  });

  it('disables caching for authentication responses', async () => {
    const response = await application.inject({
      method: 'POST',
      url: '/api/v1/auth/test',
    });

    expect(response.headers['cache-control']).toBe('no-store, max-age=0');

    expect(response.headers.pragma).toBe('no-cache');

    expect(response.headers.expires).toBe('0');
  });

  it('allows requests without an Origin header', async () => {
    const response = await application.inject({
      method: 'POST',
      url: '/api/v1/auth/test',
    });

    expect(response.statusCode).toBe(200);
  });

  it('allows a configured Origin', async () => {
    const response = await application.inject({
      method: 'OPTIONS',
      url: '/api/v1/auth/test',

      headers: {
        origin: 'http://localhost:3000',

        'access-control-request-method': 'POST',
      },
    });

    expect(response.statusCode).toBe(204);

    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
  });

  it('rejects an untrusted Origin', async () => {
    const response = await application.inject({
      method: 'POST',
      url: '/api/v1/auth/test',

      headers: {
        origin: 'https://malicious.example',
      },
    });

    expect(response.statusCode).toBe(403);

    expect(response.json()).toEqual({
      success: false,

      error: {
        code: 'CORS_ORIGIN_NOT_ALLOWED',

        message: 'Request origin is not allowed',
      },
    });
  });

  it('rejects a request body that exceeds the configured limit', async () => {
    const smallApplication = Fastify({
      logger: false,
      bodyLimit: 32,
    });

    await smallApplication.register(errorHandler);

    smallApplication.post(
      '/api/v1/auth/test',
      (): Promise<{
        success: true;
      }> =>
        Promise.resolve({
          success: true,
        }),
    );

    await smallApplication.ready();

    try {
      const response = await smallApplication.inject({
        method: 'POST',
        url: '/api/v1/auth/test',

        payload: {
          value: 'a'.repeat(1_000),
        },
      });

      expect(response.statusCode).toBe(413);

      expect(response.json()).toEqual({
        success: false,

        error: {
          code: 'PAYLOAD_TOO_LARGE',

          message: 'Request body exceeds the allowed size',
        },
      });
    } finally {
      await smallApplication.close();
    }
  });
});
