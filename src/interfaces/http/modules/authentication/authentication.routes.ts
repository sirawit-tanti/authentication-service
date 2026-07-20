import type { FastifyPluginCallback } from 'fastify';

import { AUTHENTICATION_RATE_LIMITS } from '../../rate-limit/authentication-rate-limit.js';
import type { RegisterUserExecutor } from './register.controller.js';
import { createRegisterController } from './register.controller.js';
import { registerRouteSchema, type RegisterRequestBody } from './register.schema.js';
import type { ResendVerificationExecutor } from './resend-verification.controller.js';
import { createResendVerificationController } from './resend-verification.controller.js';
import {
  resendVerificationRouteSchema,
  type ResendVerificationRequestBody,
} from './resend-verification.schema.js';
import type { VerifyEmailExecutor } from './verify-email.controller.js';
import { createVerifyEmailController } from './verify-email.controller.js';
import { verifyEmailRouteSchema, type VerifyEmailRequestBody } from './verify-email.schema.js';

export interface AuthenticationRoutesOptions {
  registerUserUseCase: RegisterUserExecutor;
  verifyEmailUseCase: VerifyEmailExecutor;
  resendVerificationUseCase: ResendVerificationExecutor;
}

interface RegisterRouteRequest {
  Body: RegisterRequestBody;
}

interface VerifyEmailRouteRequest {
  Body: VerifyEmailRequestBody;
}

interface ResendVerificationRouteRequest {
  Body: ResendVerificationRequestBody;
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

  const resendVerificationController = createResendVerificationController({
    resendVerificationUseCase: options.resendVerificationUseCase,
  });

  fastify.post<RegisterRouteRequest>(
    '/register',
    {
      schema: registerRouteSchema,
      config: {
        rateLimit: AUTHENTICATION_RATE_LIMITS.REGISTER,
      },
    },
    registerController,
  );

  fastify.post<VerifyEmailRouteRequest>(
    '/verify-email',
    {
      schema: verifyEmailRouteSchema,
      config: {
        rateLimit: AUTHENTICATION_RATE_LIMITS.PASSWORD_ACTION,
      },
    },
    verifyEmailController,
  );

  fastify.post<ResendVerificationRouteRequest>(
    '/resend-verification',
    {
      schema: resendVerificationRouteSchema,
      config: {
        rateLimit: AUTHENTICATION_RATE_LIMITS.EMAIL_ACTION,
      },
    },
    resendVerificationController,
  );

  done();
};
