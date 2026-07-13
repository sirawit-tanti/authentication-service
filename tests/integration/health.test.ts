import { buildApplication } from '@/app.js';
import type { FastifyInstance } from 'fastify';

describe('GET /api/v1/health', () => {
  let application: FastifyInstance;

  beforeAll(async () => {
    application = await buildApplication({
      logger: false,
    });

    await application.ready();
  });

  afterAll(async () => {
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
      message: 'Service is healthy',
      data: {
        service: 'authentication-service',
        status: 'healthy',
      },
    });
  });

  it('returns the standard error response for an unknown route', async () => {
    const response = await application.inject({
      method: 'GET',
      url: '/api/v1/unknown',
    });

    expect(response.statusCode).toBe(404);

    expect(response.json()).toEqual({
      success: false,
      message: 'Route GET /api/v1/unknown was not found',
      errors: [
        {
          code: 'ROUTE_NOT_FOUND',
          message: 'Route GET /api/v1/unknown was not found',
        },
      ],
    });
  });
});
