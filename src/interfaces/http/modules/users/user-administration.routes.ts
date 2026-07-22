import type { FastifyPluginCallback } from 'fastify';

import type { AuthenticationGuard } from '../../authentication/authentication-guard.js';
import type { PermissionGuard } from '../../authorization/permission-guard.js';
import {
  createChangeUserStatusController,
  createGetUserController,
  createListUsersController,
  type ChangeUserStatusExecutor,
  type GetAdministrativeUserExecutor,
  type ListAdministrativeUsersExecutor,
  type UserAdministrationControllerDependencies,
} from './user-administration.controller.js';
import {
  changeUserStatusRouteSchema,
  getUserRouteSchema,
  listUsersRouteSchema,
  type ChangeUserStatusBody,
  type ListUsersQuery,
  type UserParams,
} from './user-administration.schema.js';

export interface UserAdministrationRoutesOptions {
  authenticationGuard: AuthenticationGuard;

  usersReadPermissionGuard: PermissionGuard;

  usersDisablePermissionGuard: PermissionGuard;

  listUsersUseCase: ListAdministrativeUsersExecutor;

  getUserUseCase: GetAdministrativeUserExecutor;

  changeUserStatusUseCase: ChangeUserStatusExecutor;
}

interface ListUsersRouteRequest {
  Querystring: ListUsersQuery;
}

interface GetUserRouteRequest {
  Params: UserParams;
}

interface ChangeUserStatusRouteRequest {
  Params: UserParams;

  Body: ChangeUserStatusBody;
}

export const userAdministrationRoutes: FastifyPluginCallback<UserAdministrationRoutesOptions> = (
  fastify,
  options,
  done,
): void => {
  fastify.decorateRequest('authenticatedPrincipal', null);

  const controllerDependencies: UserAdministrationControllerDependencies = {
    listUsersUseCase: options.listUsersUseCase,

    getUserUseCase: options.getUserUseCase,

    changeUserStatusUseCase: options.changeUserStatusUseCase,
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

  fastify.patch<ChangeUserStatusRouteRequest>(
    '/:userId/status',
    {
      schema: changeUserStatusRouteSchema,

      preHandler: [options.authenticationGuard, options.usersDisablePermissionGuard],
    },
    createChangeUserStatusController(controllerDependencies),
  );

  done();
};
