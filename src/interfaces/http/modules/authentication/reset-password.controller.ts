import type { FastifyReply, FastifyRequest } from 'fastify';

import { InvalidPasswordResetTokenError } from '@/application/errors/invalid-password-reset-token.error.js';
import { PasswordResetConflictError } from '@/application/errors/password-reset-conflict.error.js';
import { PasswordUnchangedError } from '@/application/errors/password-unchanged.error.js';
import type { ResetPasswordCommand } from '@/application/use-cases/authentication/reset-password.use-case.js';
import { createErrorResponse, type ApiErrorDetail } from '@/shared/http/api-response.js';
import {
  resetPasswordRequestSchema,
  type ResetPasswordRequestBody,
} from './reset-password.schema.js';

export interface ResetPasswordExecutor {
  execute(command: ResetPasswordCommand): Promise<void>;
}

export interface ResetPasswordControllerDependencies {
  resetPasswordUseCase: ResetPasswordExecutor;
}

interface ResetPasswordRouteRequest {
  Body: ResetPasswordRequestBody;
}

export function createResetPasswordController(
  dependencies: ResetPasswordControllerDependencies,
): (request: FastifyRequest<ResetPasswordRouteRequest>, reply: FastifyReply) => Promise<void> {
  return async function resetPasswordController(
    request: FastifyRequest<ResetPasswordRouteRequest>,

    reply: FastifyReply,
  ): Promise<void> {
    const validationResult = resetPasswordRequestSchema.safeParse(request.body);

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
      await dependencies.resetPasswordUseCase.execute({
        token: validationResult.data.token,

        newPassword: validationResult.data.newPassword,
      });
    } catch (error: unknown) {
      if (error instanceof InvalidPasswordResetTokenError) {
        await reply
          .status(400)
          .send(createErrorResponse('INVALID_PASSWORD_RESET_TOKEN', error.message));

        return;
      }

      if (error instanceof PasswordUnchangedError) {
        await reply.status(400).send(createErrorResponse('PASSWORD_UNCHANGED', error.message));

        return;
      }

      if (error instanceof PasswordResetConflictError) {
        await reply.status(409).send(createErrorResponse('PASSWORD_RESET_CONFLICT', error.message));

        return;
      }

      throw error;
    }

    await reply.status(204).send();
  };
}
