import type { FastifyReply, FastifyRequest } from 'fastify';

import { InvalidCredentialsError } from '@/application/errors/invalid-credentials.error.js';
import { OptimisticConcurrencyError } from '@/application/errors/optimistic-concurrency.error.js';
import type {
  LoginUserCommand,
  LoginUserResult,
} from '@/application/use-cases/authentication/login-user.use-case.js';
import {
  createErrorResponse,
  createSuccessResponse,
  type ApiErrorDetail,
} from '@/shared/http/api-response.js';
import { loginRequestSchema, type LoginRequestBody } from './login.schema.js';

export interface LoginUserExecutor {
  execute(command: LoginUserCommand): Promise<LoginUserResult>;
}

export interface LoginControllerDependencies {
  loginUserUseCase: LoginUserExecutor;
}

interface LoginRouteRequest {
  Body: LoginRequestBody;
}

export function createLoginController(
  dependencies: LoginControllerDependencies,
): (request: FastifyRequest<LoginRouteRequest>, reply: FastifyReply) => Promise<void> {
  return async function loginController(
    request: FastifyRequest<LoginRouteRequest>,
    reply: FastifyReply,
  ): Promise<void> {
    const validationResult = loginRequestSchema.safeParse(request.body);

    if (!validationResult.success) {
      const details: ApiErrorDetail[] = validationResult.error.issues.map(
        (issue): ApiErrorDetail => {
          const field = issue.path.map(String).join('.');

          if (field.length === 0) {
            return {
              code: issue.code,
              message: issue.message,
            };
          }

          return {
            code: issue.code,
            field,
            message: issue.message,
          };
        },
      );

      await reply
        .status(400)
        .send(createErrorResponse('INVALID_REQUEST', 'Request validation failed', details));

      return;
    }

    try {
      const result = await dependencies.loginUserUseCase.execute({
        email: validationResult.data.email,
        password: validationResult.data.password,
      });

      await reply.status(200).send(createSuccessResponse(result));
    } catch (error: unknown) {
      if (error instanceof InvalidCredentialsError) {
        await reply
          .status(401)
          .send(createErrorResponse('INVALID_CREDENTIALS', 'Email or password is incorrect'));

        return;
      }

      if (error instanceof OptimisticConcurrencyError) {
        await reply
          .status(409)
          .send(
            createErrorResponse(
              'CONCURRENT_UPDATE',
              'The user account was modified by another operation',
            ),
          );

        return;
      }

      throw error;
    }
  };
}
