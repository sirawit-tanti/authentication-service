import type { FastifyPluginCallback } from 'fastify';

import type { AuthenticationGuard } from '../../authentication/authentication-guard.js';
import { meController } from './me.controller.js';
import { meRouteSchema } from './me.schema.js';

export interface ProtectedAuthenticationRoutesOptions {
  authenticationGuard: AuthenticationGuard;
}

export const protectedAuthenticationRoutes: FastifyPluginCallback<
  ProtectedAuthenticationRoutesOptions
> = (fastify, options, done): void => {
  fastify.decorateRequest('authenticatedPrincipal', null);

  fastify.get(
    '/me',
    {
      schema: meRouteSchema,
      preHandler: options.authenticationGuard,
    },
    meController,
  );

  done();
};
