import Fastify, { type FastifyInstance } from 'fastify';

import { EmailAlreadyExistsError } from '@/application/errors/email-already-exists.error.js';
import type {
  RegisterUserCommand,
  RegisterUserResult,
} from '@/application/use-cases/authentication/register-user.use-case.js';
import { DomainValidationError } from '@/shared/errors/domain-validation.error.js';
import type { RegisterUserExecutor } from '@/interfaces/http/modules/authentication/register.controller.js';
import { authenticationRoutes } from '@/interfaces/http/modules/authentication/authentication.routes.js';
import { errorHandler } from '@/shared/errors/error-handler.js';

class FakeRegisterUserUseCase implements RegisterUserExecutor {
  public command: RegisterUserCommand | null = null;

  public result: RegisterUserResult = {
    userId: 'f7ee2402-e515-47fa-b79f-c700e82b4451',
    email: 'sirawit@example.com',
    status: 'PENDING_VERIFICATION',
  };

  public error: Error | null = null;

  public execute(command: RegisterUserCommand): Promise<RegisterUserResult> {
    this.command = command;

    if (this.error !== null) {
      return Promise.reject(this.error);
    }

    return Promise.resolve(this.result);
  }
}

describe('POST /v1/auth/register', () => {
  let application: FastifyInstance;
  let registerUserUseCase: FakeRegisterUserUseCase;

  beforeEach(async () => {
    application = Fastify({
      logger: false,
    });

    registerUserUseCase = new FakeRegisterUserUseCase();

    await application.register(errorHandler);

    await application.register(authenticationRoutes, {
      prefix: '/v1/auth',
      registerUserUseCase,
    });

    await application.ready();
  });

  afterEach(async () => {
    await application.close();
  });

  it('registers a user and returns HTTP 201', async () => {
    const response = await application.inject({
      method: 'POST',
      url: '/v1/auth/register',

      payload: {
        email: '  Sirawit@Example.com  ',
        password: 'SecurePassword#2026',
      },
    });

    expect(response.statusCode).toBe(201);

    expect(response.json()).toEqual({
      success: true,

      data: {
        userId: 'f7ee2402-e515-47fa-b79f-c700e82b4451',
        email: 'sirawit@example.com',
        status: 'PENDING_VERIFICATION',
      },
    });

    expect(registerUserUseCase.command).toEqual({
      email: 'Sirawit@Example.com',
      password: 'SecurePassword#2026',
    });
  });

  it('does not expose a verification token', async () => {
    const response = await application.inject({
      method: 'POST',
      url: '/v1/auth/register',

      payload: {
        email: 'sirawit@example.com',
        password: 'SecurePassword#2026',
      },
    });

    const responseBody: unknown = response.json();
    const serializedResponse = JSON.stringify(responseBody);

    expect(serializedResponse).not.toContain('verificationToken');

    expect(serializedResponse).not.toContain('SecurePassword#2026');
  });

  it('rejects an invalid request body', async () => {
    const response = await application.inject({
      method: 'POST',
      url: '/v1/auth/register',

      payload: {
        email: 'not-an-email',
        password: '',
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

    expect(registerUserUseCase.command).toBeNull();
  });

  it('returns HTTP 409 when email already exists', async () => {
    registerUserUseCase.error = new EmailAlreadyExistsError();

    const response = await application.inject({
      method: 'POST',
      url: '/v1/auth/register',

      payload: {
        email: 'sirawit@example.com',
        password: 'SecurePassword#2026',
      },
    });

    expect(response.statusCode).toBe(409);

    expect(response.json()).toEqual({
      success: false,

      error: {
        code: 'EMAIL_ALREADY_EXISTS',
        message: 'A user with this email address already exists',
      },
    });
  });

  it('returns HTTP 422 when a domain rule fails', async () => {
    registerUserUseCase.error = new DomainValidationError(
      'Password does not meet the required policy',
      [
        {
          code: 'PASSWORD_TOO_SHORT',
          field: 'password',
          message: 'Password must contain at least 12 characters',
        },
      ],
    );

    const response = await application.inject({
      method: 'POST',
      url: '/v1/auth/register',

      payload: {
        email: 'sirawit@example.com',
        password: 'SecurePassword#2026',
      },
    });

    expect(response.statusCode).toBe(422);

    expect(response.json()).toEqual({
      success: false,

      error: {
        code: 'DOMAIN_VALIDATION_FAILED',
        message: 'Password does not meet the required policy',

        details: [
          {
            code: 'PASSWORD_TOO_SHORT',
            field: 'password',
            message: 'Password must contain at least 12 characters',
          },
        ],
      },
    });
  });
});
