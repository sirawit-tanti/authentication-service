import Fastify, { type FastifyInstance } from 'fastify';

import type { LogoutSessionCommand } from '../../../src/application/use-cases/authentication/logout-session.use-case.js';
import type { LogoutSessionExecutor } from '../../../src/interfaces/http/modules/authentication/logout.controller.js';
import { logoutRoutes } from '../../../src/interfaces/http/modules/authentication/logout.routes.js';
import { errorHandler } from '../../../src/shared/errors/error-handler.js';

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

  it('logs out the current session', async () => {
    const response = await application.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',

      payload: {
        refreshToken: 'current-refresh-token',
      },
    });

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');

    expect(logoutSessionUseCase.command).toEqual({
      refreshToken: 'current-refresh-token',
    });
  });

  it('returns the same response for an unknown token', async () => {
    const response = await application.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',

      payload: {
        refreshToken: 'unknown-refresh-token',
      },
    });

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');
  });

  it('rejects an empty refresh token', async () => {
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

  it('rejects an unexpected request property', async () => {
    const response = await application.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',

      payload: {
        refreshToken: 'current-refresh-token',
        unexpectedField: true,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(logoutSessionUseCase.command).toBeNull();
  });
});
