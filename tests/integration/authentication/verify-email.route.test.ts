import Fastify, { type FastifyInstance } from 'fastify';

import { EmailAlreadyVerifiedError } from '../../../src/application/errors/email-already-verified.error.js';
import { EmailVerificationTokenExpiredError } from '../../../src/application/errors/email-verification-token-expired.error.js';
import { EmailVerificationTokenInvalidError } from '../../../src/application/errors/email-verification-token-invalid.error.js';
import { OptimisticConcurrencyError } from '../../../src/application/errors/optimistic-concurrency.error.js';
import type { VerifyEmailResult } from '../../../src/application/ports/repositories/email-verification.repository.js';
import type { VerifyEmailCommand } from '../../../src/application/use-cases/authentication/verify-email.use-case.js';
import type { VerifyEmailExecutor } from '../../../src/interfaces/http/modules/authentication/verify-email.controller.js';
import { verifyEmailRoutes } from '../../../src/interfaces/http/modules/authentication/verify-email.routes.js';
import { errorHandler } from '../../../src/shared/errors/error-handler.js';

const USER_ID = 'f7ee2402-e515-47fa-b79f-c700e82b4451';

const REQUEST_ID = 'verify-email-route-request-id';

const USER_AGENT = 'Vitest Verify Email Client';

class FakeVerifyEmailUseCase implements VerifyEmailExecutor {
  public command: VerifyEmailCommand | null = null;

  public error: Error | null = null;

  public result: VerifyEmailResult = {
    userId: USER_ID,
    email: 'sirawit@example.com',
    status: 'ACTIVE',
  };

  public execute(command: VerifyEmailCommand): Promise<VerifyEmailResult> {
    this.command = command;

    if (this.error !== null) {
      return Promise.reject(this.error);
    }

    return Promise.resolve(this.result);
  }
}

describe('POST /api/v1/auth/verify-email', () => {
  let application: FastifyInstance;

  let verifyEmailUseCase: FakeVerifyEmailUseCase;

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

    verifyEmailUseCase = new FakeVerifyEmailUseCase();

    await application.register(errorHandler);

    await application.register(verifyEmailRoutes, {
      prefix: '/api/v1/auth',

      verifyEmailUseCase,
    });

    await application.ready();
  });

  afterEach(async () => {
    await application.close();
  });

  it('verifies the email and passes the audit request context', async () => {
    const response = await application.inject({
      method: 'POST',

      url: '/api/v1/auth/verify-email',

      headers: {
        'x-request-id': REQUEST_ID,

        'user-agent': USER_AGENT,
      },

      payload: {
        token: 'raw-verification-token',
      },
    });

    expect(response.statusCode).toBe(200);

    expect(response.json()).toEqual({
      success: true,

      data: {
        userId: USER_ID,

        email: 'sirawit@example.com',

        status: 'ACTIVE',
      },
    });

    expect(verifyEmailUseCase.command).toEqual({
      token: 'raw-verification-token',

      requestId: REQUEST_ID,

      ipAddress: '127.0.0.1',

      userAgent: USER_AGENT,
    });
  });

  it('truncates a long user agent before passing it to the use case', async () => {
    const longUserAgent = 'a'.repeat(600);

    const response = await application.inject({
      method: 'POST',

      url: '/api/v1/auth/verify-email',

      headers: {
        'user-agent': longUserAgent,
      },

      payload: {
        token: 'raw-verification-token',
      },
    });

    expect(response.statusCode).toBe(200);

    expect(verifyEmailUseCase.command?.userAgent).toBe('a'.repeat(512));
  });

  it('omits the user agent when the header is empty', async () => {
    const response = await application.inject({
      method: 'POST',

      url: '/api/v1/auth/verify-email',

      headers: {
        'x-request-id': REQUEST_ID,

        'user-agent': '',
      },

      payload: {
        token: 'raw-verification-token',
      },
    });

    expect(response.statusCode).toBe(200);

    expect(verifyEmailUseCase.command).toMatchObject({
      token: 'raw-verification-token',

      requestId: REQUEST_ID,

      ipAddress: '127.0.0.1',
    });

    expect(verifyEmailUseCase.command).not.toHaveProperty('userAgent');
  });

  it('returns 422 for an invalid verification token', async () => {
    verifyEmailUseCase.error = new EmailVerificationTokenInvalidError();

    const response = await application.inject({
      method: 'POST',

      url: '/api/v1/auth/verify-email',

      payload: {
        token: 'invalid-verification-token',
      },
    });

    expect(response.statusCode).toBe(422);

    expect(response.json()).toEqual({
      success: false,

      error: {
        code: 'INVALID_VERIFICATION_TOKEN',

        message: 'Email verification token is invalid',
      },
    });
  });

  it('returns 410 for an expired verification token', async () => {
    verifyEmailUseCase.error = new EmailVerificationTokenExpiredError();

    const response = await application.inject({
      method: 'POST',

      url: '/api/v1/auth/verify-email',

      payload: {
        token: 'expired-verification-token',
      },
    });

    expect(response.statusCode).toBe(410);

    expect(response.json()).toEqual({
      success: false,

      error: {
        code: 'VERIFICATION_TOKEN_EXPIRED',

        message: 'Email verification token has expired',
      },
    });
  });

  it('returns 409 when the email is already verified', async () => {
    verifyEmailUseCase.error = new EmailAlreadyVerifiedError();

    const response = await application.inject({
      method: 'POST',

      url: '/api/v1/auth/verify-email',

      payload: {
        token: 'used-verification-token',
      },
    });

    expect(response.statusCode).toBe(409);

    expect(response.json()).toEqual({
      success: false,

      error: {
        code: 'EMAIL_ALREADY_VERIFIED',

        message: 'Email address has already been verified',
      },
    });
  });

  it('returns 409 when a concurrent account update occurs', async () => {
    verifyEmailUseCase.error = new OptimisticConcurrencyError('User', USER_ID);

    const response = await application.inject({
      method: 'POST',

      url: '/api/v1/auth/verify-email',

      payload: {
        token: 'raw-verification-token',
      },
    });

    expect(response.statusCode).toBe(409);

    expect(response.json()).toEqual({
      success: false,

      error: {
        code: 'CONCURRENT_UPDATE',

        message: 'The user account was modified by another operation',
      },
    });
  });

  it('rejects an empty verification token without calling the use case', async () => {
    const response = await application.inject({
      method: 'POST',

      url: '/api/v1/auth/verify-email',

      payload: {
        token: '',
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

    expect(verifyEmailUseCase.command).toBeNull();
  });

  it('rejects an unexpected request property without calling the use case', async () => {
    const response = await application.inject({
      method: 'POST',

      url: '/api/v1/auth/verify-email',

      payload: {
        token: 'raw-verification-token',

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

    expect(verifyEmailUseCase.command).toBeNull();
  });

  it('does not expose the verification token in the response', async () => {
    const response = await application.inject({
      method: 'POST',

      url: '/api/v1/auth/verify-email',

      payload: {
        token: 'secret-verification-token',
      },
    });

    expect(response.statusCode).toBe(200);

    const responseBody = JSON.stringify(response.json());

    expect(responseBody).not.toContain('secret-verification-token');
  });
});
