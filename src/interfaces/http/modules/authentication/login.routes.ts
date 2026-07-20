import type { FastifyPluginCallback } from 'fastify';

import { AUTHENTICATION_RATE_LIMITS } from '../../rate-limit/authentication-rate-limit.js';
import { createLoginController, type LoginUserExecutor } from './login.controller.js';
import { loginRouteSchema, type LoginRequestBody } from './login.schema.js';

export interface LoginRoutesOptions {
  loginUserUseCase: LoginUserExecutor;
}

interface LoginRouteRequest {
  Body: LoginRequestBody;
}

export const loginRoutes: FastifyPluginCallback<LoginRoutesOptions> = (
  fastify,
  options,
  done,
): void => {
  const loginController = createLoginController({
    loginUserUseCase: options.loginUserUseCase,
  });

  fastify.post<LoginRouteRequest>(
    '/login',
    {
      schema: loginRouteSchema,
      config: {
        rateLimit: AUTHENTICATION_RATE_LIMITS.LOGIN,
      },
    },
    loginController,
  );

  done();
};
