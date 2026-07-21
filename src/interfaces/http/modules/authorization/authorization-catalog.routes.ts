import type { FastifyPluginCallback } from 'fastify';

import type { AuthenticationGuard } from '../../authentication/authentication-guard.js';
import type { PermissionGuard } from '../../authorization/permission-guard.js';
import {
  createListPermissionsController,
  createListRolesController,
  type ListPermissionsExecutor,
  type ListRolesExecutor,
} from './authorization-catalog.controller.js';
import {
  listPermissionsRouteSchema,
  listRolesRouteSchema,
} from './authorization-catalog.schema.js';
import {
  createGetUserRolesController,
  createReplaceUserRolesController,
  type GetUserRolesExecutor,
  type ReplaceUserRolesExecutor,
} from './user-role-assignment.controller.js';
import {
  getUserRolesRouteSchema,
  replaceUserRolesRouteSchema,
  type UserRoleParams,
  type ReplaceUserRolesBody,
} from './user-role-assignment.schema.js';

export interface AuthorizationCatalogRoutesOptions {
  authenticationGuard: AuthenticationGuard;

  rolesReadPermissionGuard: PermissionGuard;

  listRolesUseCase: ListRolesExecutor;

  listPermissionsUseCase: ListPermissionsExecutor;

  rolesAssignPermissionGuard: PermissionGuard;

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

export const authorizationCatalogRoutes: FastifyPluginCallback<
  AuthorizationCatalogRoutesOptions
> = (fastify, options, done): void => {
  fastify.decorateRequest('authenticatedPrincipal', null);

  const controllerDependencies = {
    listRolesUseCase: options.listRolesUseCase,

    listPermissionsUseCase: options.listPermissionsUseCase,

    getUserRolesUseCase: options.getUserRolesUseCase,

    replaceUserRolesUseCase: options.replaceUserRolesUseCase,
  };

  fastify.get(
    '/roles',
    {
      schema: listRolesRouteSchema,

      preHandler: [options.authenticationGuard, options.rolesReadPermissionGuard],
    },
    createListRolesController(controllerDependencies),
  );

  fastify.get(
    '/permissions',
    {
      schema: listPermissionsRouteSchema,

      preHandler: [options.authenticationGuard, options.rolesReadPermissionGuard],
    },
    createListPermissionsController(controllerDependencies),
  );

  fastify.get<UserRoleRouteRequest>(
    '/users/:userId/roles',
    {
      schema: getUserRolesRouteSchema,

      preHandler: [options.authenticationGuard, options.rolesReadPermissionGuard],
    },
    createGetUserRolesController(controllerDependencies),
  );

  fastify.put<ReplaceUserRoleRouteRequest>(
    '/users/:userId/roles',
    {
      schema: replaceUserRolesRouteSchema,

      preHandler: [options.authenticationGuard, options.rolesAssignPermissionGuard],
    },
    createReplaceUserRolesController(controllerDependencies),
  );

  done();
};
