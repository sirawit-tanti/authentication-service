import type { FastifyPluginCallback } from 'fastify';

import { AUTHENTICATION_RATE_LIMITS } from '../../rate-limit/authentication-rate-limit.js';
import { createRefreshController, type RefreshSessionExecutor } from './refresh.controller.js';
import { refreshRouteSchema, type RefreshRequestBody } from './refresh.schema.js';

export interface RefreshRoutesOptions {
  refreshSessionUseCase: RefreshSessionExecutor;
}

interface RefreshRouteRequest {
  Body: RefreshRequestBody;
}

export const refreshRoutes: FastifyPluginCallback<RefreshRoutesOptions> = (
  fastify,
  options,
  done,
): void => {
  const refreshController = createRefreshController({
    refreshSessionUseCase: options.refreshSessionUseCase,
  });

  fastify.post<RefreshRouteRequest>(
    '/refresh',
    {
      schema: refreshRouteSchema,
      config: {
        rateLimit: AUTHENTICATION_RATE_LIMITS.REFRESH,
      },
    },
    refreshController,
  );
  done();
};
