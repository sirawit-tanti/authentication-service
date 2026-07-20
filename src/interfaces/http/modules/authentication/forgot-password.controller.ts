import type { FastifyReply, FastifyRequest } from 'fastify';

import type { ForgotPasswordCommand } from '@/application/use-cases/authentication/forgot-password.use-case.js';
import { createRequestAuditContext } from '@/interfaces/http/auditing/request-audit-context.js';
import {
  createErrorResponse,
  createSuccessResponse,
  type ApiErrorDetail,
} from '@/shared/http/api-response.js';
import {
  forgotPasswordRequestSchema,
  type ForgotPasswordRequestBody,
} from './forgot-password.schema.js';

const ACCEPTED_MESSAGE =
  'If an account exists for this email, a password reset message will be sent';

export interface ForgotPasswordExecutor {
  execute(command: ForgotPasswordCommand): Promise<void>;
}

export interface ForgotPasswordControllerDependencies {
  forgotPasswordUseCase: ForgotPasswordExecutor;
}

interface ForgotPasswordRouteRequest {
  Body: ForgotPasswordRequestBody;
}

export function createForgotPasswordController(
  dependencies: ForgotPasswordControllerDependencies,
): (request: FastifyRequest<ForgotPasswordRouteRequest>, reply: FastifyReply) => Promise<void> {
  return async function forgotPasswordController(
    request: FastifyRequest<ForgotPasswordRouteRequest>,

    reply: FastifyReply,
  ): Promise<void> {
    const validationResult = forgotPasswordRequestSchema.safeParse(request.body);

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

    await dependencies.forgotPasswordUseCase.execute({
      email: validationResult.data.email,

      ...createRequestAuditContext(request),
    });

    await reply.status(202).send(
      createSuccessResponse({
        message: ACCEPTED_MESSAGE,
      }),
    );
  };
}
