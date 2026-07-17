import Fastify, { type FastifyInstance } from 'fastify';

import type { ForgotPasswordCommand } from '../../../src/application/use-cases/authentication/forgot-password.use-case.js';
import type { ForgotPasswordExecutor } from '../../../src/interfaces/http/modules/authentication/forgot-password.controller.js';
import { forgotPasswordRoutes } from '../../../src/interfaces/http/modules/authentication/forgot-password.routes.js';
import { errorHandler } from '../../../src/shared/errors/error-handler.js';

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

  it('accepts a password reset request', async () => {
    const response = await application.inject({
      method: 'POST',

      url: '/api/v1/auth/forgot-password',

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
    });
  });

  it('rejects an invalid email', async () => {
    const response = await application.inject({
      method: 'POST',

      url: '/api/v1/auth/forgot-password',

      payload: {
        email: 'invalid-email',
      },
    });

    expect(response.statusCode).toBe(400);

    expect(forgotPasswordUseCase.command).toBeNull();
  });

  it('rejects an unexpected property', async () => {
    const response = await application.inject({
      method: 'POST',

      url: '/api/v1/auth/forgot-password',

      payload: {
        email: 'sirawit@example.com',
        unexpectedField: true,
      },
    });

    expect(response.statusCode).toBe(400);

    expect(forgotPasswordUseCase.command).toBeNull();
  });
});
