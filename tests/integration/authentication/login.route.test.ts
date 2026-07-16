import Fastify, { type FastifyInstance } from 'fastify';

import { InvalidCredentialsError } from '@/application/errors/invalid-credentials.error.js';
import type {
  LoginUserCommand,
  LoginUserResult,
} from '@/application/use-cases/authentication/login-user.use-case.js';
import type { LoginUserExecutor } from '@/interfaces/http/modules/authentication/login.controller.js';
import { loginRoutes } from '@/interfaces/http/modules/authentication/login.routes.js';
import { errorHandler } from '@/shared/errors/error-handler.js';

class FakeLoginUserUseCase implements LoginUserExecutor {
  public command: LoginUserCommand | null = null;

  public error: Error | null = null;

  public execute(command: LoginUserCommand): Promise<LoginUserResult> {
    this.command = command;

    if (this.error !== null) {
      return Promise.reject(this.error);
    }

    return Promise.resolve({
      userId: 'f7ee2402-e515-47fa-b79f-c700e82b4451',
      email: 'sirawit@example.com',
      status: 'ACTIVE',
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

  it('authenticates a user', async () => {
    const response = await application.inject({
      method: 'POST',
      url: '/api/v1/auth/login',

      payload: {
        email: '  Sirawit@Example.com  ',
        password: 'UnitTestOnly#2026',
      },
    });

    expect(response.statusCode).toBe(200);

    expect(response.json()).toEqual({
      success: true,

      data: {
        userId: 'f7ee2402-e515-47fa-b79f-c700e82b4451',
        email: 'sirawit@example.com',
        status: 'ACTIVE',
      },
    });

    expect(loginUserUseCase.command).toEqual({
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
        email: 'sirawit@example.com',
        password: 'UnitTestOnly#2026',
      },
    });

    expect(JSON.stringify(response.json())).not.toContain('UnitTestOnly#2026');
  });
});
