import type { FastifyPluginAsync } from 'fastify';
import fastifyPlugin from 'fastify-plugin';

import { RegisterUserUseCase } from '@/application/use-cases/authentication/register-user.use-case.js';
import { PasswordPolicy } from '@/domain/authentication/services/password-policy.js';
import { PrismaUserRegistrationRepository } from '@/infrastructure/database/repositories/prisma-user-registration.repository.js';
import { env } from '@/shared/config/env.js';
import { authenticationRoutes } from './authentication.routes.js';

const authenticationPluginImplementation: FastifyPluginAsync = async (fastify): Promise<void> => {
  const registrationRepository = new PrismaUserRegistrationRepository(
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

  await fastify.register(authenticationRoutes, {
    prefix: '/api/v1/auth',
    registerUserUseCase,
  });
};

export const authenticationPlugin = fastifyPlugin(authenticationPluginImplementation, {
  name: 'authentication-plugin',
  dependencies: ['infrastructure-plugin'],
});
