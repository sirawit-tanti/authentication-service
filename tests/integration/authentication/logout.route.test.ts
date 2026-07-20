import Fastify, { type FastifyInstance } from 'fastify';

import type { LogoutSessionCommand } from '../../../src/application/use-cases/authentication/logout-session.use-case.js';
import type { LogoutSessionExecutor } from '../../../src/interfaces/http/modules/authentication/logout.controller.js';
import { logoutRoutes } from '../../../src/interfaces/http/modules/authentication/logout.routes.js';
import { errorHandler } from '../../../src/shared/errors/error-handler.js';

const REQUEST_ID = 'logout-route-request-id';

const USER_AGENT = 'Vitest Logout Client';

class FakeLogoutSessionUseCase implements LogoutSessionExecutor {
  public command: LogoutSessionCommand | null = null;

  public execute(command: LogoutSessionCommand): Promise<void> {
    this.command = command;

    return Promise.resolve();
  }
}

describe('POST /api/v1/auth/logout', () => {
  let application: FastifyInstance;

  let logoutSessionUseCase: FakeLogoutSessionUseCase;

  beforeEach(async () => {
    application = Fastify({
      logger: false,

      requestIdHeader: 'x-request-id',

      ajv: {
        customOptions: {
          removeAdditional: false,
        },
      },
    });

    logoutSessionUseCase = new FakeLogoutSessionUseCase();

    await application.register(errorHandler);

    await application.register(logoutRoutes, {
      prefix: '/api/v1/auth',
      logoutSessionUseCase,
    });

    await application.ready();
  });

  afterEach(async () => {
    await application.close();
  });

  it('logs out the current session and passes the audit request context', async () => {
    const response = await application.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',

      headers: {
        'x-request-id': REQUEST_ID,

        'user-agent': USER_AGENT,
      },

      payload: {
        refreshToken: 'current-refresh-token',
      },
    });

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');

    expect(logoutSessionUseCase.command).toEqual({
      refreshToken: 'current-refresh-token',

      requestId: REQUEST_ID,

      ipAddress: '127.0.0.1',

      userAgent: USER_AGENT,
    });
  });

  it('truncates a long user agent before passing it to the use case', async () => {
    const longUserAgent = 'a'.repeat(600);

    const response = await application.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',

      headers: {
        'user-agent': longUserAgent,
      },

      payload: {
        refreshToken: 'current-refresh-token',
      },
    });

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');

    expect(logoutSessionUseCase.command?.userAgent).toBe('a'.repeat(512));
  });

  it('omits the user agent when the header is empty', async () => {
    const response = await application.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',

      headers: {
        'x-request-id': REQUEST_ID,

        'user-agent': '',
      },

      payload: {
        refreshToken: 'current-refresh-token',
      },
    });

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');

    expect(logoutSessionUseCase.command).toMatchObject({
      refreshToken: 'current-refresh-token',

      requestId: REQUEST_ID,

      ipAddress: '127.0.0.1',
    });

    expect(logoutSessionUseCase.command).not.toHaveProperty('userAgent');
  });

  it('returns the same response for an unknown token', async () => {
    const response = await application.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',

      headers: {
        'x-request-id': REQUEST_ID,

        'user-agent': USER_AGENT,
      },

      payload: {
        refreshToken: 'unknown-refresh-token',
      },
    });

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');

    expect(logoutSessionUseCase.command).toEqual({
      refreshToken: 'unknown-refresh-token',

      requestId: REQUEST_ID,

      ipAddress: '127.0.0.1',

      userAgent: USER_AGENT,
    });
  });

  it('rejects an empty refresh token without calling the use case', async () => {
    const response = await application.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',

      payload: {
        refreshToken: '',
      },
    });

    expect(response.statusCode).toBe(400);

    expect(response.json()).toMatchObject({
      success: false,

      error: {
        code: 'INVALID_REQUEST',

        message: 'Request validation failed',
      },
    });

    expect(logoutSessionUseCase.command).toBeNull();
  });

  it('rejects an unexpected request property without calling the use case', async () => {
    const response = await application.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',

      payload: {
        refreshToken: 'current-refresh-token',

        unexpectedField: true,
      },
    });

    expect(response.statusCode).toBe(400);

    expect(response.json()).toMatchObject({
      success: false,

      error: {
        code: 'INVALID_REQUEST',

        message: 'Request validation failed',
      },
    });

    expect(logoutSessionUseCase.command).toBeNull();
  });

  it('returns no response body after a successful logout', async () => {
    const response = await application.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',

      payload: {
        refreshToken: 'secret-refresh-token',
      },
    });

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');

    expect(response.body).not.toContain('secret-refresh-token');
  });
});
