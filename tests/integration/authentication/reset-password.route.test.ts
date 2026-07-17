import Fastify, { type FastifyInstance } from 'fastify';

import { InvalidPasswordResetTokenError } from '../../../src/application/errors/invalid-password-reset-token.error.js';
import type { ResetPasswordCommand } from '../../../src/application/use-cases/authentication/reset-password.use-case.js';
import type { ResetPasswordExecutor } from '../../../src/interfaces/http/modules/authentication/reset-password.controller.js';
import { resetPasswordRoutes } from '../../../src/interfaces/http/modules/authentication/reset-password.routes.js';
import { errorHandler } from '../../../src/shared/errors/error-handler.js';

class FakeResetPasswordUseCase implements ResetPasswordExecutor {
  public command: ResetPasswordCommand | null = null;

  public error: Error | null = null;

  public execute(command: ResetPasswordCommand): Promise<void> {
    this.command = command;

    if (this.error !== null) {
      return Promise.reject(this.error);
    }

    return Promise.resolve();
  }
}

describe('POST /api/v1/auth/reset-password', () => {
  let application: FastifyInstance;

  let resetPasswordUseCase: FakeResetPasswordUseCase;

  beforeEach(async () => {
    application = Fastify({
      logger: false,

      ajv: {
        customOptions: {
          removeAdditional: false,
        },
      },
    });

    resetPasswordUseCase = new FakeResetPasswordUseCase();

    await application.register(errorHandler);

    await application.register(resetPasswordRoutes, {
      prefix: '/api/v1/auth',
      resetPasswordUseCase,
    });

    await application.ready();
  });

  afterEach(async () => {
    await application.close();
  });

  it('resets the user password', async () => {
    const response = await application.inject({
      method: 'POST',

      url: '/api/v1/auth/reset-password',

      payload: {
        token: 'raw-reset-token',
        newPassword: 'NewPassword#2026',
      },
    });

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');

    expect(resetPasswordUseCase.command).toEqual({
      token: 'raw-reset-token',
      newPassword: 'NewPassword#2026',
    });
  });

  it('rejects an invalid token', async () => {
    resetPasswordUseCase.error = new InvalidPasswordResetTokenError();

    const response = await application.inject({
      method: 'POST',

      url: '/api/v1/auth/reset-password',

      payload: {
        token: 'invalid-token',
        newPassword: 'NewPassword#2026',
      },
    });

    expect(response.statusCode).toBe(400);

    expect(response.json()).toEqual({
      success: false,

      error: {
        code: 'INVALID_PASSWORD_RESET_TOKEN',

        message: 'Password reset token is invalid or has expired',
      },
    });
  });

  it('rejects a short password', async () => {
    const response = await application.inject({
      method: 'POST',

      url: '/api/v1/auth/reset-password',

      payload: {
        token: 'raw-reset-token',
        newPassword: 'short',
      },
    });

    expect(response.statusCode).toBe(400);

    expect(resetPasswordUseCase.command).toBeNull();
  });

  it('rejects an unexpected request property', async () => {
    const response = await application.inject({
      method: 'POST',

      url: '/api/v1/auth/reset-password',

      payload: {
        token: 'raw-reset-token',

        newPassword: 'NewPassword#2026',

        unexpectedField: true,
      },
    });

    expect(response.statusCode).toBe(400);

    expect(resetPasswordUseCase.command).toBeNull();
  });
});
