import type { FastifyReply, FastifyRequest } from 'fastify';
import type {
  GetUserAuthorizationCommand,
  GetUserAuthorizationResult,
} from '@/application/use-cases/authorization/get-user-authorization.use-case.js';
import { createErrorResponse, createSuccessResponse } from '@/shared/http/api-response.js';

export interface GetUserAuthorizationExecutor {
  execute(command: GetUserAuthorizationCommand): Promise<GetUserAuthorizationResult>;
}

export interface AuthorizationControllerDependencies {
  getUserAuthorizationUseCase: GetUserAuthorizationExecutor;
}

export function createAuthorizationController(
  dependencies: AuthorizationControllerDependencies,
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async function authorizationController(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const principal = request.authenticatedPrincipal;

    if (principal === null) {
      await reply
        .status(401)
        .send(createErrorResponse('UNAUTHORIZED', 'Authentication is required'));

      return;
    }

    const authorization = await dependencies.getUserAuthorizationUseCase.execute({
      userId: principal.userId,
      applicationId: principal.applicationId,
    });

    await reply.status(200).send(
      createSuccessResponse({
        roles: authorization.roles,
        permissions: authorization.permissions,
      }),
    );
  };
}
