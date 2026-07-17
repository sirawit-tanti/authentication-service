import type { FastifyPluginCallback } from 'fastify';

import {
  createForgotPasswordController,
  type ForgotPasswordExecutor,
} from './forgot-password.controller.js';
import {
  forgotPasswordRouteSchema,
  type ForgotPasswordRequestBody,
} from './forgot-password.schema.js';

export interface ForgotPasswordRoutesOptions {
  forgotPasswordUseCase: ForgotPasswordExecutor;
}

interface ForgotPasswordRouteRequest {
  Body: ForgotPasswordRequestBody;
}

export const forgotPasswordRoutes: FastifyPluginCallback<ForgotPasswordRoutesOptions> = (
  fastify,
  options,
  done,
): void => {
  fastify.post<ForgotPasswordRouteRequest>(
    '/forgot-password',
    {
      schema: forgotPasswordRouteSchema,
    },
    createForgotPasswordController({
      forgotPasswordUseCase: options.forgotPasswordUseCase,
    }),
  );

  done();
};
