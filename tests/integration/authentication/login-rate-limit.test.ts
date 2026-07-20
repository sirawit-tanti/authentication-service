import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';

import type {
  LoginUserCommand,
  LoginUserResult,
} from '../../../src/application/use-cases/authentication/login-user.use-case.js';
import type { LoginUserExecutor } from '../../../src/interfaces/http/modules/authentication/login.controller.js';
import { loginRoutes } from '../../../src/interfaces/http/modules/authentication/login.routes.js';
import { errorHandler } from '../../../src/shared/errors/error-handler.js';

const USER_ID = 'f7ee2402-e515-47fa-b79f-c700e82b4451';

const APPLICATION_ID = 'd797d3eb-41ce-40cf-9d79-30b15fe49042';

const SESSION_ID = 'be4c57d3-b4c9-4eb5-a975-92adb74f69c8';

class FakeLoginUserUseCase implements LoginUserExecutor {
  public execute(command: LoginUserCommand): Promise<LoginUserResult> {
    void command;

    return Promise.resolve({
      user: {
        userId: USER_ID,
        email: 'sirawit@example.com',
        status: 'ACTIVE',
      },

      sessionId: SESSION_ID,

      tokens: {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        tokenType: 'Bearer',
        accessTokenExpiresInSeconds: 900,

        refreshTokenExpiresAt: new Date('2026-08-17T00:00:00.000Z'),
      },
    });
  }
}

describe('Login rate limiting', () => {
  let application: FastifyInstance;

  beforeEach(async () => {
    application = Fastify({
      logger: false,
    });

    await application.register(errorHandler);

    await application.register(rateLimit, {
      global: false,

      errorResponseBuilder() {
        return {
          statusCode: 429,
          success: false,

          error: {
            code: 'RATE_LIMIT_EXCEEDED',

            message: 'Too many requests. Please try again later',
          },
        };
      },
    });

    await application.register(loginRoutes, {
      prefix: '/api/v1/auth',

      loginUserUseCase: new FakeLoginUserUseCase(),
    });

    await application.ready();
  });

  afterEach(async () => {
    await application.close();
  });

  it('rejects login requests after the configured limit', async () => {
    const payload = {
      applicationId: APPLICATION_ID,
      email: 'sirawit@example.com',
      password: 'SecurePassword#2026',
    };

    for (let index = 0; index < 5; index += 1) {
      const response = await application.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload,
      });

      expect(response.statusCode).toBe(200);
    }

    const blockedResponse = await application.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload,
    });

    expect(blockedResponse.statusCode).toBe(429);

    expect(blockedResponse.json()).toEqual({
      success: false,

      error: {
        code: 'RATE_LIMIT_EXCEEDED',

        message: 'Too many requests. Please try again later',
      },
    });

    expect(blockedResponse.headers['retry-after']).toBeDefined();
  });
});
