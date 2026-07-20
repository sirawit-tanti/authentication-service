import Fastify, { type FastifyInstance } from 'fastify';

import type { ForgotPasswordCommand } from '../../../src/application/use-cases/authentication/forgot-password.use-case.js';
import type { ForgotPasswordExecutor } from '../../../src/interfaces/http/modules/authentication/forgot-password.controller.js';
import { forgotPasswordRoutes } from '../../../src/interfaces/http/modules/authentication/forgot-password.routes.js';
import { errorHandler } from '../../../src/shared/errors/error-handler.js';

const REQUEST_ID = 'forgot-password-route-request-id';

const USER_AGENT = 'Vitest Forgot Password Client';

class FakeForgotPasswordUseCase implements ForgotPasswordExecutor {
  public command: ForgotPasswordCommand | null = null;

  public execute(command: ForgotPasswordCommand): Promise<void> {
    this.command = command;

    return Promise.resolve();
  }
}

describe('POST /api/v1/auth/forgot-password', () => {
  let application: FastifyInstance;

  let forgotPasswordUseCase: FakeForgotPasswordUseCase;

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

    forgotPasswordUseCase = new FakeForgotPasswordUseCase();

    await application.register(errorHandler);

    await application.register(forgotPasswordRoutes, {
      prefix: '/api/v1/auth',

      forgotPasswordUseCase,
    });

    await application.ready();
  });

  afterEach(async () => {
    await application.close();
  });

  it('accepts a password reset request and passes the audit request context', async () => {
    const response = await application.inject({
      method: 'POST',

      url: '/api/v1/auth/forgot-password',

      headers: {
        'x-request-id': REQUEST_ID,

        'user-agent': USER_AGENT,
      },

      payload: {
        email: 'Sirawit@Example.com',
      },
    });

    expect(response.statusCode).toBe(202);

    expect(response.json()).toEqual({
      success: true,

      data: {
        message: 'If an account exists for this email, a password reset message will be sent',
      },
    });

    expect(forgotPasswordUseCase.command).toEqual({
      email: 'sirawit@example.com',

      requestId: REQUEST_ID,

      ipAddress: '127.0.0.1',

      userAgent: USER_AGENT,
    });
  });

  it('truncates a long user agent before passing it to the use case', async () => {
    const longUserAgent = 'a'.repeat(600);

    const response = await application.inject({
      method: 'POST',

      url: '/api/v1/auth/forgot-password',

      headers: {
        'user-agent': longUserAgent,
      },

      payload: {
        email: 'sirawit@example.com',
      },
    });

    expect(response.statusCode).toBe(202);

    expect(forgotPasswordUseCase.command?.userAgent).toBe('a'.repeat(512));
  });

  it('omits the user agent when the header is empty', async () => {
    const response = await application.inject({
      method: 'POST',

      url: '/api/v1/auth/forgot-password',

      headers: {
        'x-request-id': REQUEST_ID,

        'user-agent': '',
      },

      payload: {
        email: 'sirawit@example.com',
      },
    });

    expect(response.statusCode).toBe(202);

    expect(forgotPasswordUseCase.command).toMatchObject({
      email: 'sirawit@example.com',

      requestId: REQUEST_ID,

      ipAddress: '127.0.0.1',
    });

    expect(forgotPasswordUseCase.command).not.toHaveProperty('userAgent');
  });

  it('rejects an invalid email without calling the use case', async () => {
    const response = await application.inject({
      method: 'POST',

      url: '/api/v1/auth/forgot-password',

      payload: {
        email: 'invalid-email',
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

    expect(forgotPasswordUseCase.command).toBeNull();
  });

  it('rejects an unexpected property without calling the use case', async () => {
    const response = await application.inject({
      method: 'POST',

      url: '/api/v1/auth/forgot-password',

      payload: {
        email: 'sirawit@example.com',

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

    expect(forgotPasswordUseCase.command).toBeNull();
  });

  it('does not expose whether the account exists', async () => {
    const response = await application.inject({
      method: 'POST',

      url: '/api/v1/auth/forgot-password',

      payload: {
        email: 'missing@example.com',
      },
    });

    expect(response.statusCode).toBe(202);

    expect(response.json()).toEqual({
      success: true,

      data: {
        message: 'If an account exists for this email, a password reset message will be sent',
      },
    });
  });
});
