import type { FastifyReply, FastifyRequest } from 'fastify';

import type { LogoutSessionCommand } from '@/application/use-cases/authentication/logout-session.use-case.js';
import { createRequestAuditContext } from '@/interfaces/http/auditing/request-audit-context.js';
import { createErrorResponse, type ApiErrorDetail } from '@/shared/http/api-response.js';
import { logoutRequestSchema, type LogoutRequestBody } from './logout.schema.js';

export interface LogoutSessionExecutor {
  execute(command: LogoutSessionCommand): Promise<void>;
}

export interface LogoutControllerDependencies {
  logoutSessionUseCase: LogoutSessionExecutor;
}

interface LogoutRouteRequest {
  Body: LogoutRequestBody;
}

export function createLogoutController(
  dependencies: LogoutControllerDependencies,
): (request: FastifyRequest<LogoutRouteRequest>, reply: FastifyReply) => Promise<void> {
  return async function logoutController(
    request: FastifyRequest<LogoutRouteRequest>,
    reply: FastifyReply,
  ): Promise<void> {
    const validationResult = logoutRequestSchema.safeParse(request.body);

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

    await dependencies.logoutSessionUseCase.execute({
      refreshToken: validationResult.data.refreshToken,

      ...createRequestAuditContext(request),
    });

    await reply.status(204).send();
  };
}
