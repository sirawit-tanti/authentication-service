import type { FastifyReply, FastifyRequest } from 'fastify';

import {
  DuplicateRoleCodeError,
  InvalidRolePermissionsError,
  RoleNotFoundError,
  SystemRoleProtectedError,
} from '@/application/errors/role-management.error.js';
import type {
  CreateRoleCommand,
  CreateRoleResult,
} from '@/application/use-cases/authorization/create-role.use-case.js';
import type {
  ReplaceRolePermissionsCommand,
  ReplaceRolePermissionsResult,
} from '@/application/use-cases/authorization/replace-role-permissions.use-case.js';
import type {
  UpdateRoleCommand,
  UpdateRoleResult,
} from '@/application/use-cases/authorization/update-role.use-case.js';
import { createErrorResponse, createSuccessResponse } from '@/shared/http/api-response.js';
import { getAuditRequestContext } from '../../auditing/get-audit-request-context.js';
import {
  createRoleBodySchema,
  replaceRolePermissionsBodySchema,
  roleParamsSchema,
  updateRoleBodySchema,
  type CreateRoleBody,
  type ReplaceRolePermissionsBody,
  type RoleParams,
  type UpdateRoleBody,
} from './role-management.schema.js';

export interface CreateRoleExecutor {
  execute(command: CreateRoleCommand): Promise<CreateRoleResult>;
}

export interface UpdateRoleExecutor {
  execute(command: UpdateRoleCommand): Promise<UpdateRoleResult>;
}

export interface ReplaceRolePermissionsExecutor {
  execute(command: ReplaceRolePermissionsCommand): Promise<ReplaceRolePermissionsResult>;
}

export interface RoleManagementControllerDependencies {
  createRoleUseCase: CreateRoleExecutor;

  updateRoleUseCase: UpdateRoleExecutor;

  replaceRolePermissionsUseCase: ReplaceRolePermissionsExecutor;
}

interface CreateRoleRequest {
  Body: CreateRoleBody;
}

interface UpdateRoleRequest {
  Params: RoleParams;

  Body: UpdateRoleBody;
}

interface ReplaceRolePermissionsRequest {
  Params: RoleParams;

  Body: ReplaceRolePermissionsBody;
}

export function createCreateRoleController(dependencies: RoleManagementControllerDependencies): (
  request: FastifyRequest<CreateRoleRequest>,

  reply: FastifyReply,
) => Promise<void> {
  return async function createRoleController(request, reply): Promise<void> {
    const principal = request.authenticatedPrincipal;

    if (principal === null) {
      await reply
        .status(401)
        .send(createErrorResponse('UNAUTHORIZED', 'Authentication is required'));

      return;
    }

    const validationResult = createRoleBodySchema.safeParse(request.body);

    if (!validationResult.success) {
      await reply
        .status(400)
        .send(createErrorResponse('INVALID_REQUEST', 'Request validation failed'));

      return;
    }

    try {
      const result = await dependencies.createRoleUseCase.execute({
        applicationId: principal.applicationId,

        actorUserId: principal.userId,

        code: validationResult.data.code,

        name: validationResult.data.name,

        description: validationResult.data.description,

        ...getAuditRequestContext(request),
      });

      await reply.status(201).send(
        createSuccessResponse({
          role: result.role,
        }),
      );
    } catch (error: unknown) {
      if (error instanceof DuplicateRoleCodeError) {
        await reply
          .status(409)
          .send(createErrorResponse('ROLE_CODE_ALREADY_EXISTS', error.message));

        return;
      }

      throw error;
    }
  };
}

export function createUpdateRoleController(dependencies: RoleManagementControllerDependencies): (
  request: FastifyRequest<UpdateRoleRequest>,

  reply: FastifyReply,
) => Promise<void> {
  return async function updateRoleController(request, reply): Promise<void> {
    const principal = request.authenticatedPrincipal;

    if (principal === null) {
      await reply
        .status(401)
        .send(createErrorResponse('UNAUTHORIZED', 'Authentication is required'));

      return;
    }

    const paramsResult = roleParamsSchema.safeParse(request.params);

    const bodyResult = updateRoleBodySchema.safeParse(request.body);

    if (!paramsResult.success || !bodyResult.success) {
      await reply
        .status(400)
        .send(createErrorResponse('INVALID_REQUEST', 'Request validation failed'));

      return;
    }

    try {
      const updateData = bodyResult.data;

      const result = await dependencies.updateRoleUseCase.execute({
        applicationId: principal.applicationId,

        actorUserId: principal.userId,

        roleId: paramsResult.data.roleId,

        ...(updateData.name === undefined
          ? {}
          : {
              name: updateData.name,
            }),

        ...(updateData.description === undefined
          ? {}
          : {
              description: updateData.description,
            }),

        ...(updateData.isActive === undefined
          ? {}
          : {
              isActive: updateData.isActive,
            }),

        ...getAuditRequestContext(request),
      });

      await reply.status(200).send(
        createSuccessResponse({
          role: result.role,
        }),
      );
    } catch (error: unknown) {
      if (error instanceof RoleNotFoundError) {
        await reply.status(404).send(createErrorResponse('ROLE_NOT_FOUND', error.message));

        return;
      }

      if (error instanceof SystemRoleProtectedError) {
        await reply.status(403).send(createErrorResponse('SYSTEM_ROLE_PROTECTED', error.message));

        return;
      }

      throw error;
    }
  };
}

export function createReplaceRolePermissionsController(
  dependencies: RoleManagementControllerDependencies,
): (
  request: FastifyRequest<ReplaceRolePermissionsRequest>,

  reply: FastifyReply,
) => Promise<void> {
  return async function replaceRolePermissionsController(request, reply): Promise<void> {
    const principal = request.authenticatedPrincipal;

    if (principal === null) {
      await reply
        .status(401)
        .send(createErrorResponse('UNAUTHORIZED', 'Authentication is required'));

      return;
    }

    const paramsResult = roleParamsSchema.safeParse(request.params);

    const bodyResult = replaceRolePermissionsBodySchema.safeParse(request.body);

    if (!paramsResult.success || !bodyResult.success) {
      await reply
        .status(400)
        .send(createErrorResponse('INVALID_REQUEST', 'Request validation failed'));

      return;
    }

    try {
      const result = await dependencies.replaceRolePermissionsUseCase.execute({
        applicationId: principal.applicationId,

        actorUserId: principal.userId,

        roleId: paramsResult.data.roleId,

        permissionIds: bodyResult.data.permissionIds,

        ...getAuditRequestContext(request),
      });

      await reply.status(200).send(
        createSuccessResponse({
          role: result.role,
        }),
      );
    } catch (error: unknown) {
      if (error instanceof RoleNotFoundError) {
        await reply.status(404).send(createErrorResponse('ROLE_NOT_FOUND', error.message));

        return;
      }

      if (error instanceof SystemRoleProtectedError) {
        await reply.status(403).send(createErrorResponse('SYSTEM_ROLE_PROTECTED', error.message));

        return;
      }

      if (error instanceof InvalidRolePermissionsError) {
        await reply
          .status(400)
          .send(createErrorResponse('INVALID_ROLE_PERMISSIONS', error.message));

        return;
      }

      throw error;
    }
  };
}
