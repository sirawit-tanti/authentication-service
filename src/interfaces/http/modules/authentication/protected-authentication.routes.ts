import type { FastifyPluginCallback } from 'fastify';

import type { AuthenticationGuard } from '../../authentication/authentication-guard.js';
import { meController } from './me.controller.js';
import { meRouteSchema } from './me.schema.js';
import {
  createListSessionsController,
  createRevokeOtherSessionsController,
  createRevokeSessionController,
  type ListUserSessionsExecutor,
  type RevokeOtherUserSessionsExecutor,
  type RevokeUserSessionExecutor,
} from './sessions.controller.js';
import {
  listSessionsRouteSchema,
  revokeOtherSessionsRouteSchema,
  revokeSessionRouteSchema,
  type RevokeSessionParams,
} from './sessions.schema.js';
import {
  createChangePasswordController,
  type ChangePasswordExecutor,
} from './change-password.controller.js';
import {
  changePasswordRouteSchema,
  type ChangePasswordRequestBody,
} from './change-password.schema.js';
import { AUTHENTICATION_RATE_LIMITS } from '../../rate-limit/authentication-rate-limit.js';
import {
  createAuthorizationController,
  type GetUserAuthorizationExecutor,
} from './authorization.controller.js';
import { authorizationRouteSchema } from './authorization.schema.js';

export interface ProtectedAuthenticationRoutesOptions {
  authenticationGuard: AuthenticationGuard;

  listUserSessionsUseCase: ListUserSessionsExecutor;

  revokeUserSessionUseCase: RevokeUserSessionExecutor;

  revokeOtherUserSessionsUseCase: RevokeOtherUserSessionsExecutor;

  changePasswordUseCase: ChangePasswordExecutor;

  getUserAuthorizationUseCase: GetUserAuthorizationExecutor;
}

interface RevokeSessionRequest {
  Params: RevokeSessionParams;
}

interface ChangePasswordRouteRequest {
  Body: ChangePasswordRequestBody;
}

export const protectedAuthenticationRoutes: FastifyPluginCallback<
  ProtectedAuthenticationRoutesOptions
> = (fastify, options, done): void => {
  fastify.decorateRequest('authenticatedPrincipal', null);

  const controllerDependencies = {
    listUserSessionsUseCase: options.listUserSessionsUseCase,

    revokeUserSessionUseCase: options.revokeUserSessionUseCase,

    revokeOtherUserSessionsUseCase: options.revokeOtherUserSessionsUseCase,

    changePasswordUseCase: options.changePasswordUseCase,
  };

  fastify.get(
    '/me',
    {
      schema: meRouteSchema,
      preHandler: options.authenticationGuard,
    },
    meController,
  );

  fastify.get(
    '/authorization',
    {
      schema: authorizationRouteSchema,

      preHandler: options.authenticationGuard,
    },
    createAuthorizationController({
      getUserAuthorizationUseCase: options.getUserAuthorizationUseCase,
    }),
  );

  fastify.post<ChangePasswordRouteRequest>(
    '/change-password',
    {
      schema: changePasswordRouteSchema,
      preHandler: options.authenticationGuard,
      config: {
        rateLimit: AUTHENTICATION_RATE_LIMITS.PASSWORD_ACTION,
      },
    },
    createChangePasswordController({
      changePasswordUseCase: options.changePasswordUseCase,
    }),
  );

  fastify.get(
    '/sessions',
    {
      schema: listSessionsRouteSchema,
      preHandler: options.authenticationGuard,
    },
    createListSessionsController(controllerDependencies),
  );

  fastify.delete(
    '/sessions',
    {
      schema: revokeOtherSessionsRouteSchema,
      preHandler: options.authenticationGuard,
    },
    createRevokeOtherSessionsController(controllerDependencies),
  );

  fastify.delete<RevokeSessionRequest>(
    '/sessions/:sessionId',
    {
      schema: revokeSessionRouteSchema,
      preHandler: options.authenticationGuard,
    },
    createRevokeSessionController(controllerDependencies),
  );

  done();
};
