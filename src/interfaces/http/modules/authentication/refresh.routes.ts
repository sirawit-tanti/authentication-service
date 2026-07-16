import type { FastifyPluginCallback } from 'fastify';

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
    },
    refreshController,
  );
  done();
};
