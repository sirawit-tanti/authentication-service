import type { FastifyPluginCallback } from 'fastify';

import type { AuthenticationGuard } from '../../authentication/authentication-guard.js';
import type { PermissionGuard } from '../../authorization/permission-guard.js';
import {
  createGetUserController,
  createListUsersController,
  type GetAdministrativeUserExecutor,
  type ListAdministrativeUsersExecutor,
} from './user-administration.controller.js';
import {
  getUserRouteSchema,
  listUsersRouteSchema,
  type ListUsersQuery,
  type UserParams,
} from './user-administration.schema.js';

export interface UserAdministrationRoutesOptions {
  authenticationGuard: AuthenticationGuard;

  usersReadPermissionGuard: PermissionGuard;

  listUsersUseCase: ListAdministrativeUsersExecutor;

  getUserUseCase: GetAdministrativeUserExecutor;
}

interface ListUsersRouteRequest {
  Querystring: ListUsersQuery;
}

interface GetUserRouteRequest {
  Params: UserParams;
}

export const userAdministrationRoutes: FastifyPluginCallback<UserAdministrationRoutesOptions> = (
  fastify,
  options,
  done,
): void => {
  fastify.decorateRequest('authenticatedPrincipal', null);

  const controllerDependencies = {
    listUsersUseCase: options.listUsersUseCase,

    getUserUseCase: options.getUserUseCase,
  };

  fastify.get<ListUsersRouteRequest>(
    '/',
    {
      schema: listUsersRouteSchema,

      preHandler: [options.authenticationGuard, options.usersReadPermissionGuard],
    },
    createListUsersController(controllerDependencies),
  );

  fastify.get<GetUserRouteRequest>(
    '/:userId',
    {
      schema: getUserRouteSchema,

      preHandler: [options.authenticationGuard, options.usersReadPermissionGuard],
    },
    createGetUserController(controllerDependencies),
  );

  done();
};
