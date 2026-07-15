import type { FastifyInstance } from 'fastify';

import { buildApplication } from '../../src/app.js';

describe('GET /api/v1/health', () => {
  let application: FastifyInstance;

  beforeEach(async () => {
    application = await buildApplication({
      logger: false,
      registerInfrastructure: false,
    });

    await application.ready();
  });

  afterEach(async () => {
    await application.close();
  });

  it('returns the service health status', async () => {
    const response = await application.inject({
      method: 'GET',
      url: '/api/v1/health',
    });

    expect(response.statusCode).toBe(200);

    expect(response.json()).toMatchObject({
      success: true,

      data: {
        status: 'ok',

        dependencies: {
          postgresql: {
            status: 'not_checked',
          },

          redis: {
            status: 'not_checked',
          },
        },
      },
    });

    expect(
      response.json<{
        data: {
          timestamp: string;
        };
      }>().data.timestamp,
    ).toEqual(expect.any(String));
  });

  it('returns the standard error response for an unknown route', async () => {
    const response = await application.inject({
      method: 'GET',
      url: '/api/v1/unknown',
    });

    expect(response.statusCode).toBe(404);

    expect(response.json()).toEqual({
      success: false,

      error: {
        code: 'ROUTE_NOT_FOUND',
        message: 'Route GET /api/v1/unknown was not found',
      },
    });
  });
});
