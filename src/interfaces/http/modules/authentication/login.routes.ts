import type { FastifyPluginCallback } from 'fastify';

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
    },
    loginController,
  );

  done();
};
