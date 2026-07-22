import Fastify, { type FastifyInstance } from 'fastify';

import { InvalidRefreshTokenError } from '@/application/errors/invalid-refresh-token.error.js';
import type {
  RefreshSessionCommand,
  RefreshSessionResult,
} from '@/application/use-cases/authentication/refresh-session.use-case.js';
import type { RefreshSessionExecutor } from '@/interfaces/http/modules/authentication/refresh.controller.js';
import { refreshRoutes } from '@/interfaces/http/modules/authentication/refresh.routes.js';
import { errorHandler } from '@/shared/errors/error-handler.js';

const SESSION_ID = 'be4c57d3-b4c9-4eb5-a975-92adb74f69c8';

const REFRESH_TOKEN_EXPIRES_AT = new Date('2026-08-15T00:00:00.000Z');

const REQUEST_ID = 'refresh-route-request-id';

const USER_AGENT = 'Vitest Refresh Route Client';

class FakeRefreshSessionUseCase implements RefreshSessionExecutor {
  public command: RefreshSessionCommand | null = null;

  public result: RefreshSessionResult = {
    sessionId: SESSION_ID,

    tokens: {
      accessToken: 'new-access-token',

      refreshToken: 'new-refresh-token',

      tokenType: 'Bearer',

      accessTokenExpiresInSeconds: 900,

      refreshTokenExpiresAt: REFRESH_TOKEN_EXPIRES_AT,
    },
  };

  public error: Error | null = null;

  public execute(command: RefreshSessionCommand): Promise<RefreshSessionResult> {
    this.command = command;

    if (this.error !== null) {
      return Promise.reject(this.error);
    }

    return Promise.resolve(this.result);
  }
}

interface TestContext {
  application: FastifyInstance;

  useCase: FakeRefreshSessionUseCase;
}

async function createTestContext(): Promise<TestContext> {
  const application = Fastify({
    logger: false,

    requestIdHeader: 'x-request-id',

    ajv: {
      customOptions: {
        removeAdditional: false,
      },
    },
  });

  const useCase = new FakeRefreshSessionUseCase();

  await application.register(errorHandler);

  await application.register(refreshRoutes, {
    prefix: '/api/v1/auth',

    refreshSessionUseCase: useCase,
  });

  await application.ready();

  return {
    application,

    useCase,
  };
}

describe('Refresh routes', () => {
  let application: FastifyInstance | null = null;

  afterEach(async (): Promise<void> => {
    if (application !== null) {
      await application.close();

      application = null;
    }
  });

  it('rotates a refresh token and forwards request audit context', async () => {
    const context = await createTestContext();

    application = context.application;

    const response = await application.inject({
      method: 'POST',

      url: '/api/v1/auth/refresh',

      headers: {
        'x-request-id': REQUEST_ID,

        'user-agent': USER_AGENT,
      },

      payload: {
        refreshToken: 'current-refresh-token',
      },
    });

    expect(response.statusCode).toBe(200);

    expect(context.useCase.command).toEqual({
      refreshToken: 'current-refresh-token',

      requestId: REQUEST_ID,

      ipAddress: '127.0.0.1',

      userAgent: USER_AGENT,
    });

    expect(response.json()).toEqual({
      success: true,

      data: {
        sessionId: SESSION_ID,

        tokens: {
          accessToken: 'new-access-token',

          refreshToken: 'new-refresh-token',

          tokenType: 'Bearer',

          accessTokenExpiresInSeconds: 900,

          refreshTokenExpiresAt: REFRESH_TOKEN_EXPIRES_AT.toISOString(),
        },
      },
    });
  });

  it('returns a generic 401 response for an invalid refresh token', async () => {
    const context = await createTestContext();

    application = context.application;

    context.useCase.error = new InvalidRefreshTokenError();

    const rawRefreshToken = 'invalid-sensitive-refresh-token';

    const response = await application.inject({
      method: 'POST',

      url: '/api/v1/auth/refresh',

      headers: {
        'x-request-id': REQUEST_ID,

        'user-agent': USER_AGENT,
      },

      payload: {
        refreshToken: rawRefreshToken,
      },
    });

    expect(response.statusCode).toBe(401);

    expect(context.useCase.command).toEqual({
      refreshToken: rawRefreshToken,

      requestId: REQUEST_ID,

      ipAddress: '127.0.0.1',

      userAgent: USER_AGENT,
    });

    expect(response.json()).toEqual({
      success: false,

      error: {
        code: 'INVALID_REFRESH_TOKEN',

        message: 'Refresh token is invalid',
      },
    });

    expect(response.body).not.toContain(rawRefreshToken);
  });

  it('rejects a request without a refresh token', async () => {
    const context = await createTestContext();

    application = context.application;

    const response = await application.inject({
      method: 'POST',

      url: '/api/v1/auth/refresh',

      payload: {},
    });

    expect(response.statusCode).toBe(400);

    expect(context.useCase.command).toBeNull();

    expect(response.body).not.toContain('new-access-token');

    expect(response.body).not.toContain('new-refresh-token');
  });

  it('rejects an empty refresh token', async () => {
    const context = await createTestContext();

    application = context.application;

    const response = await application.inject({
      method: 'POST',

      url: '/api/v1/auth/refresh',

      payload: {
        refreshToken: '   ',
      },
    });

    expect(response.statusCode).toBe(400);

    expect(context.useCase.command).toBeNull();
  });

  it('rejects a refresh token longer than the configured maximum', async () => {
    const context = await createTestContext();

    application = context.application;

    const oversizedRefreshToken = 'a'.repeat(513);

    const response = await application.inject({
      method: 'POST',

      url: '/api/v1/auth/refresh',

      payload: {
        refreshToken: oversizedRefreshToken,
      },
    });

    expect(response.statusCode).toBe(400);

    expect(context.useCase.command).toBeNull();

    expect(response.body).not.toContain(oversizedRefreshToken);
  });

  it('rejects additional request properties', async () => {
    const context = await createTestContext();

    application = context.application;

    const response = await application.inject({
      method: 'POST',

      url: '/api/v1/auth/refresh',

      payload: {
        refreshToken: 'current-refresh-token',

        accessToken: 'unexpected-access-token',
      },
    });

    expect(response.statusCode).toBe(400);

    expect(context.useCase.command).toBeNull();

    expect(response.body).not.toContain('unexpected-access-token');
  });

  it('does not expose internal errors as successful responses', async () => {
    const context = await createTestContext();

    application = context.application;

    context.useCase.error = new Error('Database connection failed');

    const response = await application.inject({
      method: 'POST',

      url: '/api/v1/auth/refresh',

      payload: {
        refreshToken: 'current-refresh-token',
      },
    });

    expect(response.statusCode).toBe(500);

    expect(response.body).not.toContain('Database connection failed');

    expect(response.body).not.toContain('current-refresh-token');
  });
});
