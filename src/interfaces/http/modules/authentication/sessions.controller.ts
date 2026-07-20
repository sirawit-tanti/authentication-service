import type { FastifyReply, FastifyRequest } from 'fastify';

import type {
  ListUserSessionsCommand,
  ListUserSessionsResult,
} from '@/application/use-cases/authentication/list-user-sessions.use-case.js';
import type { RevokeOtherUserSessionsCommand } from '@/application/use-cases/authentication/revoke-other-user-sessions.use-case.js';
import type { RevokeUserSessionCommand } from '@/application/use-cases/authentication/revoke-user-session.use-case.js';
import { createRequestAuditContext } from '@/interfaces/http/auditing/request-audit-context.js';
import {
  createErrorResponse,
  createSuccessResponse,
  type ApiErrorDetail,
} from '@/shared/http/api-response.js';
import { revokeSessionParamsSchema, type RevokeSessionParams } from './sessions.schema.js';

export interface ListUserSessionsExecutor {
  execute(command: ListUserSessionsCommand): Promise<ListUserSessionsResult>;
}

export interface RevokeUserSessionExecutor {
  execute(command: RevokeUserSessionCommand): Promise<void>;
}

export interface RevokeOtherUserSessionsExecutor {
  execute(command: RevokeOtherUserSessionsCommand): Promise<{
    revokedCount: number;
  }>;
}

export interface SessionsControllerDependencies {
  listUserSessionsUseCase: ListUserSessionsExecutor;

  revokeUserSessionUseCase: RevokeUserSessionExecutor;

  revokeOtherUserSessionsUseCase: RevokeOtherUserSessionsExecutor;
}

interface RevokeSessionRequest {
  Params: RevokeSessionParams;
}

async function sendUnauthorized(reply: FastifyReply): Promise<void> {
  await reply.status(401).send(createErrorResponse('UNAUTHORIZED', 'Authentication is required'));
}

export function createListSessionsController(
  dependencies: SessionsControllerDependencies,
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async function listSessionsController(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const principal = request.authenticatedPrincipal;

    if (principal === null) {
      await sendUnauthorized(reply);

      return;
    }

    const result = await dependencies.listUserSessionsUseCase.execute({
      userId: principal.userId,

      currentSessionId: principal.sessionId,
    });

    await reply.status(200).send(createSuccessResponse(result));
  };
}

export function createRevokeSessionController(
  dependencies: SessionsControllerDependencies,
): (request: FastifyRequest<RevokeSessionRequest>, reply: FastifyReply) => Promise<void> {
  return async function revokeSessionController(
    request: FastifyRequest<RevokeSessionRequest>,

    reply: FastifyReply,
  ): Promise<void> {
    const principal = request.authenticatedPrincipal;

    if (principal === null) {
      await sendUnauthorized(reply);

      return;
    }

    const validationResult = revokeSessionParamsSchema.safeParse(request.params);

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

    await dependencies.revokeUserSessionUseCase.execute({
      userId: principal.userId,

      applicationId: principal.applicationId,

      sessionId: validationResult.data.sessionId,

      ...createRequestAuditContext(request),
    });

    await reply.status(204).send();
  };
}

export function createRevokeOtherSessionsController(
  dependencies: SessionsControllerDependencies,
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async function revokeOtherSessionsController(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const principal = request.authenticatedPrincipal;

    if (principal === null) {
      await sendUnauthorized(reply);

      return;
    }

    const result = await dependencies.revokeOtherUserSessionsUseCase.execute({
      userId: principal.userId,

      applicationId: principal.applicationId,

      currentSessionId: principal.sessionId,

      ...createRequestAuditContext(request),
    });

    await reply.status(200).send(createSuccessResponse(result));
  };
}
