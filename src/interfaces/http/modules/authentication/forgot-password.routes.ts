import type { FastifyPluginCallback } from 'fastify';

import { AUTHENTICATION_RATE_LIMITS } from '../../rate-limit/authentication-rate-limit.js';
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
      config: {
        rateLimit: AUTHENTICATION_RATE_LIMITS.EMAIL_ACTION,
      },
    },
    createForgotPasswordController({
      forgotPasswordUseCase: options.forgotPasswordUseCase,
    }),
  );

  done();
};
