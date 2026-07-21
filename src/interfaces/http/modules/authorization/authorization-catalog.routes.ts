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

export interface AuthorizationCatalogRoutesOptions {
  authenticationGuard: AuthenticationGuard;

  rolesReadPermissionGuard: PermissionGuard;

  listRolesUseCase: ListRolesExecutor;

  listPermissionsUseCase: ListPermissionsExecutor;
}

export const authorizationCatalogRoutes: FastifyPluginCallback<
  AuthorizationCatalogRoutesOptions
> = (fastify, options, done): void => {
  fastify.decorateRequest('authenticatedPrincipal', null);

  const controllerDependencies = {
    listRolesUseCase: options.listRolesUseCase,

    listPermissionsUseCase: options.listPermissionsUseCase,
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

  done();
};
