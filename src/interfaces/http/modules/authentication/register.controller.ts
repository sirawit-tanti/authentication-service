import type { FastifyReply, FastifyRequest } from 'fastify';

import { EmailAlreadyExistsError } from '@/application/errors/email-already-exists.error.js';
import type {
  RegisterUserCommand,
  RegisterUserResult,
} from '@/application/use-cases/authentication/register-user.use-case.js';
import { DomainValidationError } from '@/shared/errors/domain-validation.error.js';
import { createErrorResponse, createSuccessResponse } from '@/shared/http/api-response.js';
import { registerRequestSchema, type RegisterRequestBody } from './register.schema.js';

export interface RegisterUserExecutor {
  execute(command: RegisterUserCommand): Promise<RegisterUserResult>;
}

export interface RegisterControllerDependencies {
  registerUserUseCase: RegisterUserExecutor;
}

interface RegisterRouteRequest {
  Body: RegisterRequestBody;
}

export function createRegisterController(
  dependencies: RegisterControllerDependencies,
): (request: FastifyRequest<RegisterRouteRequest>, reply: FastifyReply) => Promise<void> {
  return async function registerController(
    request: FastifyRequest<RegisterRouteRequest>,
    reply: FastifyReply,
  ): Promise<void> {
    const validationResult = registerRequestSchema.safeParse(request.body);

    if (!validationResult.success) {
      const validationDetails = validationResult.error.issues.map((issue) => ({
        code: issue.code,
        field: issue.path.length > 0 ? issue.path.map(String).join('.') : undefined,
        message: issue.message,
      }));

      await reply.status(400).send(
        createErrorResponse(
          'INVALID_REQUEST',
          'Request validation failed',
          validationDetails.map((detail) => {
            if (detail.field === undefined) {
              return {
                code: detail.code,
                message: detail.message,
              };
            }

            return {
              code: detail.code,
              field: detail.field,
              message: detail.message,
            };
          }),
        ),
      );

      return;
    }

    try {
      const result = await dependencies.registerUserUseCase.execute({
        email: validationResult.data.email,
        password: validationResult.data.password,
      });

      await reply.status(201).send(
        createSuccessResponse({
          userId: result.userId,
          email: result.email,
          status: result.status,
        }),
      );
    } catch (error: unknown) {
      if (error instanceof EmailAlreadyExistsError) {
        await reply
          .status(409)
          .send(
            createErrorResponse(
              'EMAIL_ALREADY_EXISTS',
              'A user with this email address already exists',
            ),
          );

        return;
      }

      if (error instanceof DomainValidationError) {
        await reply
          .status(422)
          .send(createErrorResponse('DOMAIN_VALIDATION_FAILED', error.message, error.issues));

        return;
      }

      throw error;
    }
  };
}
