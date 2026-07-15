import type { FastifyPluginCallback } from 'fastify';

import type { RegisterUserExecutor } from './register.controller.js';
import { createRegisterController } from './register.controller.js';
import { registerRouteSchema, type RegisterRequestBody } from './register.schema.js';
import {
  createVerifyEmailController,
  type VerifyEmailExecutor,
} from './verify-email.controller.js';
import { verifyEmailRouteSchema, type VerifyEmailRequestBody } from './verify-email.schema.js';

export interface AuthenticationRoutesOptions {
  registerUserUseCase: RegisterUserExecutor;
  verifyEmailUseCase: VerifyEmailExecutor;
}

interface RegisterRouteRequest {
  Body: RegisterRequestBody;
}

interface VerifyEmailRouteRequest {
  Body: VerifyEmailRequestBody;
}

export const authenticationRoutes: FastifyPluginCallback<AuthenticationRoutesOptions> = (
  fastify,
  options,
  done,
): void => {
  const registerController = createRegisterController({
    registerUserUseCase: options.registerUserUseCase,
  });

  const verifyEmailController = createVerifyEmailController({
    verifyEmailUseCase: options.verifyEmailUseCase,
  });

  fastify.post<RegisterRouteRequest>(
    '/register',
    {
      schema: registerRouteSchema,
    },
    registerController,
  );

  fastify.post<VerifyEmailRouteRequest>(
    '/verify-email',
    {
      schema: verifyEmailRouteSchema,
    },
    verifyEmailController,
  );

  done();
};
