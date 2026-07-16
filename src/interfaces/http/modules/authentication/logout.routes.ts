import type { FastifyPluginCallback } from 'fastify';

import { createLogoutController, type LogoutSessionExecutor } from './logout.controller.js';
import { logoutRouteSchema, type LogoutRequestBody } from './logout.schema.js';

export interface LogoutRoutesOptions {
  logoutSessionUseCase: LogoutSessionExecutor;
}

interface LogoutRouteRequest {
  Body: LogoutRequestBody;
}

export const logoutRoutes: FastifyPluginCallback<LogoutRoutesOptions> = (
  fastify,
  options,
  done,
): void => {
  const logoutController = createLogoutController({
    logoutSessionUseCase: options.logoutSessionUseCase,
  });

  fastify.post<LogoutRouteRequest>(
    '/logout',
    {
      schema: logoutRouteSchema,
    },
    logoutController,
  );

  done();
};
