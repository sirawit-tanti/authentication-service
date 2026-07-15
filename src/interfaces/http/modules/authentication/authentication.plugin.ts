import type { FastifyPluginAsync } from 'fastify';
import fastifyPlugin from 'fastify-plugin';

import { RegisterUserUseCase } from '@/application/use-cases/authentication/register-user.use-case.js';
import { VerifyEmailUseCase } from '@/application/use-cases/authentication/verify-email.use-case.js';
import { PasswordPolicy } from '@/domain/authentication/services/password-policy.js';
import { PrismaEmailVerificationRepository } from '@/infrastructure/database/repositories/prisma-email-verification.repository.js';
import { PrismaUserRegistrationRepository } from '@/infrastructure/database/repositories/prisma-user-registration.repository.js';
import { env } from '@/shared/config/env.js';
import { authenticationRoutes } from './authentication.routes.js';

const authenticationPluginImplementation: FastifyPluginAsync = async (fastify): Promise<void> => {
  const registrationRepository = new PrismaUserRegistrationRepository(
    fastify.infrastructure.prisma,
  );

  const emailVerificationRepository = new PrismaEmailVerificationRepository(
    fastify.infrastructure.prisma,
  );

  const registerUserUseCase = new RegisterUserUseCase({
    registrationRepository,

    passwordHasher: fastify.infrastructure.passwordHasher,

    passwordPolicy: new PasswordPolicy(),

    secureTokenService: fastify.infrastructure.secureTokenService,

    idGenerator: fastify.infrastructure.idGenerator,

    clock: fastify.infrastructure.clock,

    verificationTokenTtlMinutes: env.EMAIL_VERIFICATION_TOKEN_TTL_MINUTES,
  });

  const verifyEmailUseCase = new VerifyEmailUseCase({
    emailVerificationRepository,

    secureTokenService: fastify.infrastructure.secureTokenService,

    clock: fastify.infrastructure.clock,
  });

  await fastify.register(authenticationRoutes, {
    prefix: '/api/v1/auth',
    registerUserUseCase,
    verifyEmailUseCase,
  });
};

export const authenticationPlugin = fastifyPlugin(authenticationPluginImplementation, {
  name: 'authentication-plugin',
  dependencies: ['infrastructure-plugin'],
});
