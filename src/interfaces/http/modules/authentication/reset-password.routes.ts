import type { FastifyPluginCallback } from 'fastify';

import { AUTHENTICATION_RATE_LIMITS } from '../../rate-limit/authentication-rate-limit.js';
import {
  createResetPasswordController,
  type ResetPasswordExecutor,
} from './reset-password.controller.js';
import {
  resetPasswordRouteSchema,
  type ResetPasswordRequestBody,
} from './reset-password.schema.js';

export interface ResetPasswordRoutesOptions {
  resetPasswordUseCase: ResetPasswordExecutor;
}

interface ResetPasswordRouteRequest {
  Body: ResetPasswordRequestBody;
}

export const resetPasswordRoutes: FastifyPluginCallback<ResetPasswordRoutesOptions> = (
  fastify,
  options,
  done,
): void => {
  fastify.post<ResetPasswordRouteRequest>(
    '/reset-password',
    {
      schema: resetPasswordRouteSchema,
      config: {
        rateLimit: AUTHENTICATION_RATE_LIMITS.PASSWORD_ACTION,
      },
    },
    createResetPasswordController({
      resetPasswordUseCase: options.resetPasswordUseCase,
    }),
  );

  done();
};
