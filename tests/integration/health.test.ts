import Fastify, { type FastifyInstance } from 'fastify';

import { buildApplication } from '../../src/app.js';
import { healthRoutes } from '../../src/interfaces/http/routes/health.route.js';

interface FakeHealthInfrastructure {
  prisma: {
    $queryRaw: (query: TemplateStringsArray) => Promise<unknown>;
  };

  redis: {
    ping(): Promise<string>;
  };
}

async function buildHealthApplication(
  infrastructure: FakeHealthInfrastructure | undefined,
): Promise<FastifyInstance> {
  const application = Fastify({
    logger: false,
  });

  if (infrastructure !== undefined) {
    application.decorate('infrastructure', infrastructure as never);
  }

  await application.register(healthRoutes, {
    prefix: '/api/v1',
  });

  await application.ready();

  return application;
}

describe('Health routes', () => {
  it('returns liveness without checking infrastructure', async () => {
    const application = await buildHealthApplication({
      prisma: {
        $queryRaw(): Promise<unknown> {
          return Promise.reject(new Error('PostgreSQL must not be called'));
        },
      },

      redis: {
        ping(): Promise<string> {
          return Promise.reject(new Error('Redis must not be called'));
        },
      },
    });

    try {
      const response = await application.inject({
        method: 'GET',

        url: '/api/v1/health/live',
      });

      expect(response.statusCode).toBe(200);

      expect(response.json()).toMatchObject({
        success: true,

        data: {
          status: 'alive',
        },
      });

      expect(
        response.json<{
          data: {
            timestamp: string;
            uptimeSeconds: number;
          };
        }>().data.timestamp,
      ).toEqual(expect.any(String));

      expect(
        response.json<{
          data: {
            uptimeSeconds: number;
          };
        }>().data.uptimeSeconds,
      ).toEqual(expect.any(Number));
    } finally {
      await application.close();
    }
  });

  it('returns ready when PostgreSQL and Redis are available', async () => {
    const application = await buildHealthApplication({
      prisma: {
        $queryRaw(): Promise<unknown> {
          return Promise.resolve([
            {
              value: 1,
            },
          ]);
        },
      },

      redis: {
        ping(): Promise<string> {
          return Promise.resolve('PONG');
        },
      },
    });

    try {
      const response = await application.inject({
        method: 'GET',

        url: '/api/v1/health/ready',
      });

      expect(response.statusCode).toBe(200);

      expect(response.json()).toMatchObject({
        success: true,

        data: {
          status: 'ready',

          dependencies: {
            postgresql: {
              status: 'connected',
            },

            redis: {
              status: 'connected',
            },
          },
        },
      });
    } finally {
      await application.close();
    }
  });

  it('returns not ready when PostgreSQL is unavailable', async () => {
    const application = await buildHealthApplication({
      prisma: {
        $queryRaw(): Promise<unknown> {
          return Promise.reject(new Error('PostgreSQL unavailable'));
        },
      },

      redis: {
        ping(): Promise<string> {
          return Promise.resolve('PONG');
        },
      },
    });

    try {
      const response = await application.inject({
        method: 'GET',

        url: '/api/v1/health/ready',
      });

      expect(response.statusCode).toBe(503);

      expect(response.json()).toMatchObject({
        success: true,

        data: {
          status: 'not_ready',

          dependencies: {
            postgresql: {
              status: 'unavailable',
            },

            redis: {
              status: 'connected',
            },
          },
        },
      });
    } finally {
      await application.close();
    }
  });

  it('returns not ready when Redis is unavailable', async () => {
    const application = await buildHealthApplication({
      prisma: {
        $queryRaw(): Promise<unknown> {
          return Promise.resolve([]);
        },
      },

      redis: {
        ping(): Promise<string> {
          return Promise.reject(new Error('Redis unavailable'));
        },
      },
    });

    try {
      const response = await application.inject({
        method: 'GET',

        url: '/api/v1/health/ready',
      });

      expect(response.statusCode).toBe(503);

      expect(response.json()).toMatchObject({
        success: true,

        data: {
          status: 'not_ready',

          dependencies: {
            postgresql: {
              status: 'connected',
            },

            redis: {
              status: 'unavailable',
            },
          },
        },
      });
    } finally {
      await application.close();
    }
  });

  it('returns not ready when infrastructure is not registered', async () => {
    const application = await buildApplication({
      logger: false,

      registerInfrastructure: false,
    });

    try {
      await application.ready();

      const response = await application.inject({
        method: 'GET',

        url: '/api/v1/health/ready',
      });

      expect(response.statusCode).toBe(503);

      expect(response.json()).toMatchObject({
        success: true,

        data: {
          status: 'not_ready',

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
    } finally {
      await application.close();
    }
  });

  it('keeps the legacy health route as a readiness alias', async () => {
    const application = await buildHealthApplication({
      prisma: {
        $queryRaw(): Promise<unknown> {
          return Promise.resolve([]);
        },
      },

      redis: {
        ping(): Promise<string> {
          return Promise.resolve('PONG');
        },
      },
    });

    try {
      const response = await application.inject({
        method: 'GET',

        url: '/api/v1/health',
      });

      expect(response.statusCode).toBe(200);

      expect(response.json()).toMatchObject({
        success: true,

        data: {
          status: 'ready',
        },
      });
    } finally {
      await application.close();
    }
  });

  it('returns the standard error response for an unknown route', async () => {
    const application = await buildApplication({
      logger: false,

      registerInfrastructure: false,
    });

    try {
      await application.ready();

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
    } finally {
      await application.close();
    }
  });
});
