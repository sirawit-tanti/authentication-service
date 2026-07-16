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
        userId: 'f7ee2402-e515-47fa-b79f-c700e82b4451',

        email: 'sirawit@example.com',
        status: 'ACTIVE',
      },

      sessionId: 'be4c57d3-b4c9-4eb5-a975-92adb74f69c8',

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

  it('authenticates a user and returns a token pair', async () => {
    const response = await application.inject({
      method: 'POST',
      url: '/api/v1/auth/login',

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
          userId: 'f7ee2402-e515-47fa-b79f-c700e82b4451',

          email: 'sirawit@example.com',
          status: 'ACTIVE',
        },

        sessionId: 'be4c57d3-b4c9-4eb5-a975-92adb74f69c8',

        tokens: {
          accessToken: 'test-access-token',
          refreshToken: 'test-refresh-token',
          tokenType: 'Bearer',
          accessTokenExpiresInSeconds: 900,

          refreshTokenExpiresAt: '2026-08-15T00:00:00.000Z',
        },
      },
    });

    expect(loginUserUseCase.command).toMatchObject({
      applicationId: APPLICATION_ID,
      email: 'Sirawit@Example.com',
      password: 'UnitTestOnly#2026',
    });
  });

  it('returns the same response for invalid credentials', async () => {
    loginUserUseCase.error = new InvalidCredentialsError();

    const response = await application.inject({
      method: 'POST',
      url: '/api/v1/auth/login',

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
  });

  it('rejects an invalid request body', async () => {
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

  it('does not expose the password', async () => {
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
