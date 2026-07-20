import Fastify, { type FastifyInstance } from 'fastify';

import { InvalidCredentialsError } from '@/application/errors/invalid-credentials.error.js';
import type {
  LoginUserCommand,
  LoginUserResult,
} from '@/application/use-cases/authentication/login-user.use-case.js';
import type { LoginUserExecutor } from '@/interfaces/http/modules/authentication/login.controller.js';
import { loginRoutes } from '@/interfaces/http/modules/authentication/login.routes.js';
import { errorHandler } from '@/shared/errors/error-handler.js';

const APPLICATION_ID = 'd797d3eb-41ce-40cf-9d79-30b15fe49042';

const USER_ID = 'f7ee2402-e515-47fa-b79f-c700e82b4451';

const SESSION_ID = 'be4c57d3-b4c9-4eb5-a975-92adb74f69c8';

const REQUEST_ID = 'login-route-test-request-id';

class FakeLoginUserUseCase implements LoginUserExecutor {
  public command: LoginUserCommand | null = null;

  public error: Error | null = null;

  public execute(command: LoginUserCommand): Promise<LoginUserResult> {
    this.command = command;

    if (this.error !== null) {
      return Promise.reject(this.error);
    }

    return Promise.resolve({
      user: {
        userId: USER_ID,
        email: 'sirawit@example.com',
        status: 'ACTIVE',
      },

      sessionId: SESSION_ID,

      tokens: {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        tokenType: 'Bearer',
        accessTokenExpiresInSeconds: 900,

        refreshTokenExpiresAt: new Date('2026-08-15T00:00:00.000Z'),
      },
    });
  }
}

describe('POST /api/v1/auth/login', () => {
  let application: FastifyInstance;

  let loginUserUseCase: FakeLoginUserUseCase;

  beforeEach(async () => {
    application = Fastify({
      logger: false,
      requestIdHeader: 'x-request-id',
    });

    loginUserUseCase = new FakeLoginUserUseCase();

    await application.register(errorHandler);

    await application.register(loginRoutes, {
      prefix: '/api/v1/auth',
      loginUserUseCase,
    });

    await application.ready();
  });

  afterEach(async () => {
    await application.close();
  });

  it('authenticates a user and passes audit request context', async () => {
    const response = await application.inject({
      method: 'POST',
      url: '/api/v1/auth/login',

      headers: {
        'x-request-id': REQUEST_ID,
        'user-agent': 'Vitest Login Client',
      },

      payload: {
        applicationId: APPLICATION_ID,

        email: '  Sirawit@Example.com  ',

        password: 'UnitTestOnly#2026',
      },
    });

    expect(response.statusCode).toBe(200);

    expect(response.json()).toEqual({
      success: true,

      data: {
        user: {
          userId: USER_ID,
          email: 'sirawit@example.com',
          status: 'ACTIVE',
        },

        sessionId: SESSION_ID,

        tokens: {
          accessToken: 'test-access-token',

          refreshToken: 'test-refresh-token',

          tokenType: 'Bearer',

          accessTokenExpiresInSeconds: 900,

          refreshTokenExpiresAt: '2026-08-15T00:00:00.000Z',
        },
      },
    });

    expect(loginUserUseCase.command).toEqual({
      applicationId: APPLICATION_ID,
      email: 'Sirawit@Example.com',
      password: 'UnitTestOnly#2026',

      requestId: REQUEST_ID,
      ipAddress: '127.0.0.1',
      userAgent: 'Vitest Login Client',
    });
  });

  it('truncates a long user agent before passing it to the use case', async () => {
    const longUserAgent = 'a'.repeat(600);

    const response = await application.inject({
      method: 'POST',
      url: '/api/v1/auth/login',

      headers: {
        'user-agent': longUserAgent,
      },

      payload: {
        applicationId: APPLICATION_ID,
        email: 'sirawit@example.com',
        password: 'UnitTestOnly#2026',
      },
    });

    expect(response.statusCode).toBe(200);

    expect(loginUserUseCase.command?.userAgent).toBe('a'.repeat(512));
  });

  it('omits the user agent when the header is empty', async () => {
    const response = await application.inject({
      method: 'POST',
      url: '/api/v1/auth/login',

      headers: {
        'user-agent': '',
      },

      payload: {
        applicationId: APPLICATION_ID,
        email: 'sirawit@example.com',
        password: 'UnitTestOnly#2026',
      },
    });

    expect(response.statusCode).toBe(200);

    expect(loginUserUseCase.command).toMatchObject({
      applicationId: APPLICATION_ID,
      email: 'sirawit@example.com',
      password: 'UnitTestOnly#2026',
      ipAddress: '127.0.0.1',
    });

    expect(loginUserUseCase.command).not.toHaveProperty('userAgent');
  });

  it('returns the same response for invalid credentials', async () => {
    loginUserUseCase.error = new InvalidCredentialsError();

    const response = await application.inject({
      method: 'POST',
      url: '/api/v1/auth/login',

      headers: {
        'x-request-id': REQUEST_ID,
        'user-agent': 'Vitest Login Client',
      },

      payload: {
        applicationId: APPLICATION_ID,
        email: 'sirawit@example.com',

        password: 'IncorrectTestOnly#2026',
      },
    });

    expect(response.statusCode).toBe(401);

    expect(response.json()).toEqual({
      success: false,

      error: {
        code: 'INVALID_CREDENTIALS',

        message: 'Email or password is incorrect',
      },
    });

    expect(loginUserUseCase.command).toMatchObject({
      requestId: REQUEST_ID,
      ipAddress: '127.0.0.1',
      userAgent: 'Vitest Login Client',
    });
  });

  it('rejects an invalid request body without calling the use case', async () => {
    const response = await application.inject({
      method: 'POST',
      url: '/api/v1/auth/login',

      payload: {
        applicationId: 'not-a-uuid',
        email: 'invalid-email',
        password: '',
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

    expect(loginUserUseCase.command).toBeNull();
  });

  it('does not expose the password in the response', async () => {
    const response = await application.inject({
      method: 'POST',
      url: '/api/v1/auth/login',

      payload: {
        applicationId: APPLICATION_ID,
        email: 'sirawit@example.com',
        password: 'UnitTestOnly#2026',
      },
    });

    expect(JSON.stringify(response.json())).not.toContain('UnitTestOnly#2026');
  });
});
