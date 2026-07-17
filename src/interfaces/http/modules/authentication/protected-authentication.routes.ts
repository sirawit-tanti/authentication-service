import type { FastifyPluginCallback } from 'fastify';

import type { AuthenticationGuard } from '../../authentication/authentication-guard.js';
import { meController } from './me.controller.js';
import { meRouteSchema } from './me.schema.js';
import {
  createListSessionsController,
  createRevokeSessionController,
  type ListUserSessionsExecutor,
  type RevokeUserSessionExecutor,
} from './sessions.controller.js';
import {
  listSessionsRouteSchema,
  revokeSessionRouteSchema,
  type RevokeSessionParams,
} from './sessions.schema.js';

export interface ProtectedAuthenticationRoutesOptions {
  authenticationGuard: AuthenticationGuard;

  listUserSessionsUseCase: ListUserSessionsExecutor;

  revokeUserSessionUseCase: RevokeUserSessionExecutor;
}

interface RevokeSessionRequest {
  Params: RevokeSessionParams;
}

export const protectedAuthenticationRoutes: FastifyPluginCallback<
  ProtectedAuthenticationRoutesOptions
> = (fastify, options, done): void => {
  fastify.decorateRequest('authenticatedPrincipal', null);

  const controllerDependencies = {
    listUserSessionsUseCase: options.listUserSessionsUseCase,

    revokeUserSessionUseCase: options.revokeUserSessionUseCase,
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
    '/sessions',
    {
      schema: listSessionsRouteSchema,
      preHandler: options.authenticationGuard,
    },
    createListSessionsController(controllerDependencies),
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
