import type { FastifyReply, FastifyRequest } from 'fastify';

import { InvalidRoleAssignmentError } from '@/application/errors/invalid-role-assignment.error.js';
import { RoleAssignmentUserNotFoundError } from '@/application/errors/role-assignment-user-not-found.error.js';
import type {
  GetUserRolesCommand,
  GetUserRolesResult,
} from '@/application/use-cases/authorization/get-user-roles.use-case.js';
import type {
  ReplaceUserRolesCommand,
  ReplaceUserRolesResult,
} from '@/application/use-cases/authorization/replace-user-roles.use-case.js';
import { createErrorResponse, createSuccessResponse } from '@/shared/http/api-response.js';
import { getAuditRequestContext } from '../../auditing/get-audit-request-context.js';
import {
  replaceUserRolesBodySchema,
  userRoleParamsSchema,
  type ReplaceUserRolesBody,
  type UserRoleParams,
} from './user-role-assignment.schema.js';

export interface GetUserRolesExecutor {
  execute(command: GetUserRolesCommand): Promise<GetUserRolesResult>;
}

export interface ReplaceUserRolesExecutor {
  execute(command: ReplaceUserRolesCommand): Promise<ReplaceUserRolesResult>;
}

export interface UserRoleAssignmentControllerDependencies {
  getUserRolesUseCase: GetUserRolesExecutor;

  replaceUserRolesUseCase: ReplaceUserRolesExecutor;
}

interface UserRoleRouteRequest {
  Params: UserRoleParams;
}

interface ReplaceUserRoleRouteRequest {
  Params: UserRoleParams;

  Body: ReplaceUserRolesBody;
}

export function createGetUserRolesController(
  dependencies: UserRoleAssignmentControllerDependencies,
): (
  request: FastifyRequest<UserRoleRouteRequest>,

  reply: FastifyReply,
) => Promise<void> {
  return async function getUserRolesController(request, reply): Promise<void> {
    const principal = request.authenticatedPrincipal;

    if (principal === null) {
      await reply
        .status(401)
        .send(createErrorResponse('UNAUTHORIZED', 'Authentication is required'));

      return;
    }

    const paramsResult = userRoleParamsSchema.safeParse(request.params);

    if (!paramsResult.success) {
      await reply
        .status(400)
        .send(createErrorResponse('INVALID_REQUEST', 'Request validation failed'));

      return;
    }

    const result = await dependencies.getUserRolesUseCase.execute({
      userId: paramsResult.data.userId,

      applicationId: principal.applicationId,
    });

    await reply.status(200).send(
      createSuccessResponse({
        roles: result.roles,
      }),
    );
  };
}

export function createReplaceUserRolesController(
  dependencies: UserRoleAssignmentControllerDependencies,
): (
  request: FastifyRequest<ReplaceUserRoleRouteRequest>,

  reply: FastifyReply,
) => Promise<void> {
  return async function replaceUserRolesController(request, reply): Promise<void> {
    const principal = request.authenticatedPrincipal;

    if (principal === null) {
      await reply
        .status(401)
        .send(createErrorResponse('UNAUTHORIZED', 'Authentication is required'));

      return;
    }

    const paramsResult = userRoleParamsSchema.safeParse(request.params);

    const bodyResult = replaceUserRolesBodySchema.safeParse(request.body);

    if (!paramsResult.success || !bodyResult.success) {
      await reply
        .status(400)
        .send(createErrorResponse('INVALID_REQUEST', 'Request validation failed'));

      return;
    }

    const auditContext = getAuditRequestContext(request);

    try {
      const result = await dependencies.replaceUserRolesUseCase.execute({
        targetUserId: paramsResult.data.userId,

        applicationId: principal.applicationId,

        roleIds: bodyResult.data.roleIds,

        assignedByUserId: principal.userId,

        ...auditContext,
      });

      await reply.status(200).send(
        createSuccessResponse({
          roles: result.roles,
        }),
      );
    } catch (error: unknown) {
      if (error instanceof RoleAssignmentUserNotFoundError) {
        await reply.status(404).send(createErrorResponse('USER_NOT_FOUND', error.message));

        return;
      }

      if (error instanceof InvalidRoleAssignmentError) {
        await reply.status(400).send(
          createErrorResponse(
            'INVALID_ROLE_ASSIGNMENT',
            error.message,
            error.invalidRoleIds.map((roleId) => ({
              code: 'INVALID_ROLE_ID',

              field: 'roleIds',

              message: `Role ${roleId} is invalid for this application`,
            })),
          ),
        );

        return;
      }

      throw error;
    }
  };
}
