import type { FastifyInstance } from 'fastify';

import { buildApplication } from '../../src/app.js';

const DOCUMENTATION_TOKEN = 'swagger-test-token-containing-at-least-32-characters';

describe('OpenAPI documentation', () => {
  let application: FastifyInstance;

  beforeEach(async () => {
    application = await buildApplication({
      logger: false,

      registerInfrastructure: false,

      swaggerEnabled: true,

      swaggerBearerToken: DOCUMENTATION_TOKEN,
    });

    await application.ready();
  });

  afterEach(async () => {
    await application.close();
  });

  it('returns an OpenAPI document with bearer authentication', async () => {
    const response = await application.inject({
      method: 'GET',
      url: '/docs/json',

      headers: {
        authorization: `Bearer ${DOCUMENTATION_TOKEN}`,
      },
    });

    expect(response.statusCode).toBe(200);

    const document = response.json<{
      openapi: string;

      info: {
        title: string;
        version: string;
      };

      components?: {
        securitySchemes?: {
          bearerAuth?: {
            type: string;
            scheme: string;
            bearerFormat?: string;
          };
        };
      };

      paths: Record<string, unknown>;
    }>();

    expect(document.openapi).toBe('3.0.3');

    expect(document.info).toEqual(
      expect.objectContaining({
        title: 'Authentication Service API',

        version: '1.0.0',
      }),
    );

    expect(document.components?.securitySchemes?.bearerAuth).toEqual({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',

      description: 'JWT access token issued by the login or refresh endpoint',
    });

    expect(document.paths).toHaveProperty('/api/v1/health/live');

    expect(document.paths).toHaveProperty('/api/v1/health/ready');

    expect(document.paths).not.toHaveProperty('/metrics');

    expect(document.paths).not.toHaveProperty('/docs/json');
  });

  it('serves Swagger UI', async () => {
    const response = await application.inject({
      method: 'GET',
      url: '/docs/',

      headers: {
        authorization: `Bearer ${DOCUMENTATION_TOKEN}`,
      },
    });

    expect(response.statusCode).toBe(200);

    expect(response.headers['content-type']).toContain('text/html');

    expect(response.body).toContain('Swagger UI');
  });

  it('rejects documentation requests without the configured token', async () => {
    const response = await application.inject({
      method: 'GET',
      url: '/docs/json',
    });

    expect(response.statusCode).toBe(401);

    expect(response.json()).toEqual({
      success: false,

      error: {
        code: 'UNAUTHORIZED',

        message: 'Documentation authentication is required',
      },
    });
  });

  it('rejects an invalid documentation token', async () => {
    const response = await application.inject({
      method: 'GET',
      url: '/docs/json',

      headers: {
        authorization: 'Bearer incorrect-documentation-token',
      },
    });

    expect(response.statusCode).toBe(401);
  });
});

describe('Disabled OpenAPI documentation', () => {
  it('does not register documentation routes', async () => {
    const application = await buildApplication({
      logger: false,

      registerInfrastructure: false,

      swaggerEnabled: false,
    });

    await application.ready();

    try {
      const response = await application.inject({
        method: 'GET',
        url: '/docs/json',
      });

      expect(response.statusCode).toBe(404);
    } finally {
      await application.close();
    }
  });
});
