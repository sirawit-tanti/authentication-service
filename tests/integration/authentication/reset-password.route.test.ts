import Fastify, { type FastifyInstance } from 'fastify';

import { InvalidPasswordResetTokenError } from '@/application/errors/invalid-password-reset-token.error.js';
import { PasswordResetConflictError } from '@/application/errors/password-reset-conflict.error.js';
import { PasswordUnchangedError } from '@/application/errors/password-unchanged.error.js';
import type { ResetPasswordCommand } from '@/application/use-cases/authentication/reset-password.use-case.js';
import type { ResetPasswordExecutor } from '@/interfaces/http/modules/authentication/reset-password.controller.js';
import { resetPasswordRoutes } from '@/interfaces/http/modules/authentication/reset-password.routes.js';
import { errorHandler } from '@/shared/errors/error-handler.js';

const REQUEST_ID = 'reset-password-route-request-id';

const USER_AGENT = 'Vitest Reset Password Client';

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

      requestIdHeader: 'x-request-id',

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

  it('resets the user password and passes the audit request context', async () => {
    const response = await application.inject({
      method: 'POST',

      url: '/api/v1/auth/reset-password',

      headers: {
        'x-request-id': REQUEST_ID,

        'user-agent': USER_AGENT,
      },

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

      requestId: REQUEST_ID,

      ipAddress: '127.0.0.1',

      userAgent: USER_AGENT,
    });
  });

  it('truncates a long user agent before passing it to the use case', async () => {
    const longUserAgent = 'a'.repeat(600);

    const response = await application.inject({
      method: 'POST',

      url: '/api/v1/auth/reset-password',

      headers: {
        'user-agent': longUserAgent,
      },

      payload: {
        token: 'raw-reset-token',

        newPassword: 'NewPassword#2026',
      },
    });

    expect(response.statusCode).toBe(204);

    expect(response.body).toBe('');

    expect(resetPasswordUseCase.command?.userAgent).toBe('a'.repeat(512));
  });

  it('omits the user agent when the header is empty', async () => {
    const response = await application.inject({
      method: 'POST',

      url: '/api/v1/auth/reset-password',

      headers: {
        'x-request-id': REQUEST_ID,

        'user-agent': '',
      },

      payload: {
        token: 'raw-reset-token',

        newPassword: 'NewPassword#2026',
      },
    });

    expect(response.statusCode).toBe(204);

    expect(response.body).toBe('');

    expect(resetPasswordUseCase.command).toMatchObject({
      token: 'raw-reset-token',

      newPassword: 'NewPassword#2026',

      requestId: REQUEST_ID,

      ipAddress: '127.0.0.1',
    });

    expect(resetPasswordUseCase.command).not.toHaveProperty('userAgent');
  });

  it('rejects an invalid password reset token', async () => {
    resetPasswordUseCase.error = new InvalidPasswordResetTokenError();

    const response = await application.inject({
      method: 'POST',

      url: '/api/v1/auth/reset-password',

      headers: {
        'x-request-id': REQUEST_ID,

        'user-agent': USER_AGENT,
      },

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

    expect(resetPasswordUseCase.command).toMatchObject({
      token: 'invalid-token',

      requestId: REQUEST_ID,

      ipAddress: '127.0.0.1',

      userAgent: USER_AGENT,
    });
  });

  it('rejects the existing password as the new password', async () => {
    resetPasswordUseCase.error = new PasswordUnchangedError();

    const response = await application.inject({
      method: 'POST',

      url: '/api/v1/auth/reset-password',

      payload: {
        token: 'raw-reset-token',

        newPassword: 'OldPassword#2026',
      },
    });

    expect(response.statusCode).toBe(400);

    expect(response.json()).toEqual({
      success: false,

      error: {
        code: 'PASSWORD_UNCHANGED',

        message: 'New password must be different from the current password',
      },
    });
  });

  it('returns a conflict when the password reset cannot be completed', async () => {
    resetPasswordUseCase.error = new PasswordResetConflictError();

    const response = await application.inject({
      method: 'POST',

      url: '/api/v1/auth/reset-password',

      payload: {
        token: 'raw-reset-token',

        newPassword: 'NewPassword#2026',
      },
    });

    expect(response.statusCode).toBe(409);

    expect(response.json()).toEqual({
      success: false,

      error: {
        code: 'PASSWORD_RESET_CONFLICT',

        message: 'Password reset could not be completed because the account changed',
      },
    });
  });

  it('rejects a short password without calling the use case', async () => {
    const response = await application.inject({
      method: 'POST',

      url: '/api/v1/auth/reset-password',

      payload: {
        token: 'raw-reset-token',

        newPassword: 'short',
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

    expect(resetPasswordUseCase.command).toBeNull();
  });

  it('rejects an unexpected request property without calling the use case', async () => {
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

    expect(response.json()).toMatchObject({
      success: false,

      error: {
        code: 'INVALID_REQUEST',

        message: 'Request validation failed',
      },
    });

    expect(resetPasswordUseCase.command).toBeNull();
  });

  it('returns no response body after a successful password reset', async () => {
    const response = await application.inject({
      method: 'POST',

      url: '/api/v1/auth/reset-password',

      payload: {
        token: 'secret-reset-token',

        newPassword: 'NewPassword#2026',
      },
    });

    expect(response.statusCode).toBe(204);

    expect(response.body).toBe('');

    expect(response.body).not.toContain('secret-reset-token');

    expect(response.body).not.toContain('NewPassword#2026');
  });
});
