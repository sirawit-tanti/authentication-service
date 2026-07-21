import type { FastifyReply, FastifyRequest } from 'fastify';

import type {
  ListPermissionsCommand,
  ListPermissionsResult,
} from '@/application/use-cases/authorization/list-permissions.use-case.js';
import type {
  ListRolesCommand,
  ListRolesResult,
} from '@/application/use-cases/authorization/list-roles.use-case.js';
import { createErrorResponse, createSuccessResponse } from '@/shared/http/api-response.js';

export interface ListRolesExecutor {
  execute(command: ListRolesCommand): Promise<ListRolesResult>;
}

export interface ListPermissionsExecutor {
  execute(command: ListPermissionsCommand): Promise<ListPermissionsResult>;
}

export interface AuthorizationCatalogControllerDependencies {
  listRolesUseCase: ListRolesExecutor;

  listPermissionsUseCase: ListPermissionsExecutor;
}

export function createListRolesController(
  dependencies: AuthorizationCatalogControllerDependencies,
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async function listRolesController(
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

    const result = await dependencies.listRolesUseCase.execute({
      applicationId: principal.applicationId,
    });

    await reply.status(200).send(
      createSuccessResponse({
        roles: result.roles,
      }),
    );
  };
}

export function createListPermissionsController(
  dependencies: AuthorizationCatalogControllerDependencies,
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async function listPermissionsController(
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

    const result = await dependencies.listPermissionsUseCase.execute({
      applicationId: principal.applicationId,
    });

    await reply.status(200).send(
      createSuccessResponse({
        permissions: result.permissions,
      }),
    );
  };
}
