import type { FastifyReply, FastifyRequest } from 'fastify';

import { InvalidRefreshTokenError } from '@/application/errors/invalid-refresh-token.error.js';
import type {
  RefreshSessionCommand,
  RefreshSessionResult,
} from '@/application/use-cases/authentication/refresh-session.use-case.js';
import { createRequestAuditContext } from '@/interfaces/http/auditing/request-audit-context.js';
import {
  createErrorResponse,
  createSuccessResponse,
  type ApiErrorDetail,
} from '@/shared/http/api-response.js';
import { refreshRequestSchema, type RefreshRequestBody } from './refresh.schema.js';

export interface RefreshSessionExecutor {
  execute(command: RefreshSessionCommand): Promise<RefreshSessionResult>;
}

export interface RefreshControllerDependencies {
  refreshSessionUseCase: RefreshSessionExecutor;
}

interface RefreshRouteRequest {
  Body: RefreshRequestBody;
}

export function createRefreshController(dependencies: RefreshControllerDependencies): (
  request: FastifyRequest<RefreshRouteRequest>,

  reply: FastifyReply,
) => Promise<void> {
  return async function refreshController(request, reply): Promise<void> {
    const validationResult = refreshRequestSchema.safeParse(request.body);

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
      const result = await dependencies.refreshSessionUseCase.execute({
        refreshToken: validationResult.data.refreshToken,

        ...createRequestAuditContext(request),
      });

      await reply.status(200).send(createSuccessResponse(result));
    } catch (error: unknown) {
      if (error instanceof InvalidRefreshTokenError) {
        await reply
          .status(401)
          .send(createErrorResponse('INVALID_REFRESH_TOKEN', 'Refresh token is invalid'));

        return;
      }

      throw error;
    }
  };
}
