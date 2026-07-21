import type { FastifyPluginCallback } from 'fastify';

import type { AuthenticationGuard } from '../../authentication/authentication-guard.js';
import type { PermissionGuard } from '../../authorization/permission-guard.js';
import {
  createCreateRoleController,
  createReplaceRolePermissionsController,
  createUpdateRoleController,
  type CreateRoleExecutor,
  type ReplaceRolePermissionsExecutor,
  type UpdateRoleExecutor,
} from './role-management.controller.js';
import {
  createRoleRouteSchema,
  replaceRolePermissionsRouteSchema,
  updateRoleRouteSchema,
  type CreateRoleBody,
  type ReplaceRolePermissionsBody,
  type RoleParams,
  type UpdateRoleBody,
} from './role-management.schema.js';

export interface RoleManagementRoutesOptions {
  authenticationGuard: AuthenticationGuard;

  rolesManagePermissionGuard: PermissionGuard;

  createRoleUseCase: CreateRoleExecutor;

  updateRoleUseCase: UpdateRoleExecutor;

  replaceRolePermissionsUseCase: ReplaceRolePermissionsExecutor;
}

interface CreateRoleRouteRequest {
  Body: CreateRoleBody;
}

interface UpdateRoleRouteRequest {
  Params: RoleParams;

  Body: UpdateRoleBody;
}

interface ReplacePermissionsRouteRequest {
  Params: RoleParams;

  Body: ReplaceRolePermissionsBody;
}

export const roleManagementRoutes: FastifyPluginCallback<RoleManagementRoutesOptions> = (
  fastify,
  options,
  done,
): void => {
  fastify.decorateRequest('authenticatedPrincipal', null);

  const controllerDependencies = {
    createRoleUseCase: options.createRoleUseCase,

    updateRoleUseCase: options.updateRoleUseCase,

    replaceRolePermissionsUseCase: options.replaceRolePermissionsUseCase,
  };

  fastify.post<CreateRoleRouteRequest>(
    '/roles',
    {
      schema: createRoleRouteSchema,

      preHandler: [options.authenticationGuard, options.rolesManagePermissionGuard],
    },
    createCreateRoleController(controllerDependencies),
  );

  fastify.patch<UpdateRoleRouteRequest>(
    '/roles/:roleId',
    {
      schema: updateRoleRouteSchema,

      preHandler: [options.authenticationGuard, options.rolesManagePermissionGuard],
    },
    createUpdateRoleController(controllerDependencies),
  );

  fastify.put<ReplacePermissionsRouteRequest>(
    '/roles/:roleId/permissions',
    {
      schema: replaceRolePermissionsRouteSchema,

      preHandler: [options.authenticationGuard, options.rolesManagePermissionGuard],
    },
    createReplaceRolePermissionsController(controllerDependencies),
  );

  done();
};
