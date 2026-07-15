import type { FastifyPluginCallback } from 'fastify';

import type { RegisterUserExecutor } from './register.controller.js';
import { createRegisterController } from './register.controller.js';
import { registerRouteSchema, type RegisterRequestBody } from './register.schema.js';

export interface AuthenticationRoutesOptions {
  registerUserUseCase: RegisterUserExecutor;
}

interface RegisterRouteRequest {
  Body: RegisterRequestBody;
}

export const authenticationRoutes: FastifyPluginCallback<AuthenticationRoutesOptions> = (
  fastify,
  options,
  done,
): void => {
  const registerController = createRegisterController({
    registerUserUseCase: options.registerUserUseCase,
  });

  fastify.post<RegisterRouteRequest>(
    '/register',
    {
      schema: registerRouteSchema,
    },
    registerController,
  );

  done();
};
