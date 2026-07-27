import type { FastifyInstance } from 'fastify';

import { buildApplication } from '../../src/app.js';

describe('HTTP tracing integration', () => {
  let application: FastifyInstance;

  beforeEach(async () => {
    application = await buildApplication({
      logger: false,

      registerInfrastructure: false,

      swaggerEnabled: false,
    });

    await application.ready();
  });

  afterEach(async () => {
    await application.close();
  });

  it('does not create a fake trace identifier when no active span exists', async () => {
    const response = await application.inject({
      method: 'GET',

      url: '/api/v1/health/live',
    });

    expect(response.statusCode).toBe(200);

    expect(response.headers['x-trace-id']).toBeUndefined();
  });
});
