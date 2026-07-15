import type { FastifyPluginAsync } from 'fastify';
import fastifyPlugin from 'fastify-plugin';

import { RegisterUserUseCase } from '../../../../application/use-cases/authentication/register-user.use-case.js';
import { ResendEmailVerificationUseCase } from '../../../../application/use-cases/authentication/resend-email-verification.use-case.js';
import { VerifyEmailUseCase } from '../../../../application/use-cases/authentication/verify-email.use-case.js';
import { PasswordPolicy } from '../../../../domain/authentication/services/password-policy.js';
import { PrismaEmailVerificationRepository } from '../../../../infrastructure/database/repositories/prisma-email-verification.repository.js';
import { PrismaResendEmailVerificationRepository } from '../../../../infrastructure/database/repositories/prisma-resend-email-verification.repository.js';
import { PrismaUserRegistrationRepository } from '../../../../infrastructure/database/repositories/prisma-user-registration.repository.js';
import { env } from '../../../../shared/config/env.js';
import { authenticationRoutes } from './authentication.routes.js';

const authenticationPluginImplementation: FastifyPluginAsync = async (fastify): Promise<void> => {
  const registerUserUseCase = new RegisterUserUseCase({
    registrationRepository: new PrismaUserRegistrationRepository(fastify.infrastructure.prisma),

    passwordHasher: fastify.infrastructure.passwordHasher,

    passwordPolicy: new PasswordPolicy(),

    secureTokenService: fastify.infrastructure.secureTokenService,

    idGenerator: fastify.infrastructure.idGenerator,

    clock: fastify.infrastructure.clock,

    verificationTokenTtlMinutes: env.EMAIL_VERIFICATION_TOKEN_TTL_MINUTES,
  });

  const verifyEmailUseCase = new VerifyEmailUseCase({
    emailVerificationRepository: new PrismaEmailVerificationRepository(
      fastify.infrastructure.prisma,
    ),

    secureTokenService: fastify.infrastructure.secureTokenService,

    clock: fastify.infrastructure.clock,
  });

  const resendVerificationUseCase = new ResendEmailVerificationUseCase({
    repository: new PrismaResendEmailVerificationRepository(fastify.infrastructure.prisma),

    secureTokenService: fastify.infrastructure.secureTokenService,

    idGenerator: fastify.infrastructure.idGenerator,

    clock: fastify.infrastructure.clock,

    verificationTokenTtlMinutes: env.EMAIL_VERIFICATION_TOKEN_TTL_MINUTES,

    cooldownSeconds: env.EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS,
  });

  await fastify.register(authenticationRoutes, {
    prefix: '/api/v1/auth',
    registerUserUseCase,
    verifyEmailUseCase,
    resendVerificationUseCase,
  });
};

export const authenticationPlugin = fastifyPlugin(authenticationPluginImplementation, {
  name: 'authentication-plugin',
  dependencies: ['infrastructure-plugin'],
});
