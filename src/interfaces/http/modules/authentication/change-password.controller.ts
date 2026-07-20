import type { FastifyReply, FastifyRequest } from 'fastify';

import { InvalidCurrentPasswordError } from '@/application/errors/invalid-current-password.error.js';
import { PasswordChangeConflictError } from '@/application/errors/password-change-conflict.error.js';
import { PasswordUnchangedError } from '@/application/errors/password-unchanged.error.js';
import type { ChangePasswordCommand } from '@/application/use-cases/authentication/change-password.use-case.js';
import { createRequestAuditContext } from '@/interfaces/http/auditing/request-audit-context.js';
import { createErrorResponse, type ApiErrorDetail } from '@/shared/http/api-response.js';
import {
  changePasswordRequestSchema,
  type ChangePasswordRequestBody,
} from './change-password.schema.js';

export interface ChangePasswordExecutor {
  execute(command: ChangePasswordCommand): Promise<void>;
}

export interface ChangePasswordControllerDependencies {
  changePasswordUseCase: ChangePasswordExecutor;
}

interface ChangePasswordRouteRequest {
  Body: ChangePasswordRequestBody;
}

export function createChangePasswordController(
  dependencies: ChangePasswordControllerDependencies,
): (request: FastifyRequest<ChangePasswordRouteRequest>, reply: FastifyReply) => Promise<void> {
  return async function changePasswordController(
    request: FastifyRequest<ChangePasswordRouteRequest>,
    reply: FastifyReply,
  ): Promise<void> {
    const principal = request.authenticatedPrincipal;

    if (principal === null) {
      await reply
        .status(401)
        .send(createErrorResponse('UNAUTHORIZED', 'Authentication is required'));

      return;
    }

    const validationResult = changePasswordRequestSchema.safeParse(request.body);

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
      await dependencies.changePasswordUseCase.execute({
        userId: principal.userId,

        currentSessionId: principal.sessionId,

        currentPassword: validationResult.data.currentPassword,

        newPassword: validationResult.data.newPassword,

        ...createRequestAuditContext(request),
      });
    } catch (error: unknown) {
      if (error instanceof InvalidCurrentPasswordError) {
        await reply
          .status(400)
          .send(createErrorResponse('INVALID_CURRENT_PASSWORD', error.message));

        return;
      }

      if (error instanceof PasswordUnchangedError) {
        await reply.status(400).send(createErrorResponse('PASSWORD_UNCHANGED', error.message));

        return;
      }

      if (error instanceof PasswordChangeConflictError) {
        await reply
          .status(409)
          .send(createErrorResponse('PASSWORD_CHANGE_CONFLICT', error.message));

        return;
      }

      throw error;
    }

    await reply.status(204).send();
  };
}
