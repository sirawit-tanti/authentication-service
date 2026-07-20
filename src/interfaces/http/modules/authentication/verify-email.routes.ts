import type { FastifyPluginCallback } from 'fastify';

import {
  createVerifyEmailController,
  type VerifyEmailExecutor,
} from './verify-email.controller.js';
import { verifyEmailRouteSchema, type VerifyEmailRequestBody } from './verify-email.schema.js';

export interface VerifyEmailRoutesOptions {
  verifyEmailUseCase: VerifyEmailExecutor;
}

interface VerifyEmailRouteRequest {
  Body: VerifyEmailRequestBody;
}

export const verifyEmailRoutes: FastifyPluginCallback<VerifyEmailRoutesOptions> = (
  fastify,
  options,
  done,
): void => {
  fastify.post<VerifyEmailRouteRequest>(
    '/verify-email',
    {
      schema: verifyEmailRouteSchema,
    },
    createVerifyEmailController({
      verifyEmailUseCase: options.verifyEmailUseCase,
    }),
  );

  done();
};
