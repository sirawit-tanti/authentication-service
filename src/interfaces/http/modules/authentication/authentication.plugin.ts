import { randomUUID } from 'crypto';

import type { FastifyPluginAsync } from 'fastify';
import fastifyPlugin from 'fastify-plugin';

import { LoginUserUseCase } from '@/application/use-cases/authentication/login-user.use-case.js';
import { RegisterUserUseCase } from '@/application/use-cases/authentication/register-user.use-case.js';
import { ResendEmailVerificationUseCase } from '@/application/use-cases/authentication/resend-email-verification.use-case.js';
import { VerifyEmailUseCase } from '@/application/use-cases/authentication/verify-email.use-case.js';
import { PasswordPolicy } from '@/domain/authentication/services/password-policy.js';
import { PrismaEmailVerificationRepository } from '@/infrastructure/database/repositories/prisma-email-verification.repository.js';
import { PrismaResendEmailVerificationRepository } from '@/infrastructure/database/repositories/prisma-resend-email-verification.repository.js';
import { PrismaUserRegistrationRepository } from '@/infrastructure/database/repositories/prisma-user-registration.repository.js';
import { PrismaUserRepository } from '@/infrastructure/database/repositories/prisma-user.repository.js';
import { env } from '@/shared/config/env.js';
import { authenticationRoutes } from './authentication.routes.js';
import { loginRoutes } from './login.routes.js';
import { CryptoRefreshTokenService } from '@/infrastructure/authentication/crypto-refresh-token.service.js';
import { JwtAccessTokenService } from '@/infrastructure/authentication/jwt-access-token.service.js';
import { PrismaLoginSessionRepository } from '@/infrastructure/database/repositories/prisma-login-session.repository.js';
import { RefreshSessionUseCase } from '@/application/use-cases/authentication/refresh-session.use-case.js';
import { PrismaRefreshSessionRepository } from '@/infrastructure/database/repositories/prisma-refresh-session.repository.js';
import { refreshRoutes } from './refresh.routes.js';
import { LogoutSessionUseCase } from '@/application/use-cases/authentication/logout-session.use-case.js';
import { PrismaLogoutSessionRepository } from '@/infrastructure/database/repositories/prisma-logout-session.repository.js';
import { logoutRoutes } from './logout.routes.js';

const authenticationPluginImplementation: FastifyPluginAsync = async (fastify): Promise<void> => {
  const passwordHasher = fastify.infrastructure.passwordHasher;

  const dummyPasswordHash = await passwordHasher.hash(randomUUID());

  const registerUserUseCase = new RegisterUserUseCase({
    registrationRepository: new PrismaUserRegistrationRepository(fastify.infrastructure.prisma),

    passwordHasher,

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

  const accessTokenService = new JwtAccessTokenService({
    secret: env.JWT_ACCESS_TOKEN_SECRET,
    issuer: env.JWT_ACCESS_TOKEN_ISSUER,
    audience: env.JWT_ACCESS_TOKEN_AUDIENCE,

    timeToLiveMinutes: env.JWT_ACCESS_TOKEN_TTL_MINUTES,
  });

  const refreshTokenService = new CryptoRefreshTokenService();

  const refreshSessionUseCase = new RefreshSessionUseCase({
    repository: new PrismaRefreshSessionRepository(fastify.infrastructure.prisma),

    accessTokenService,
    refreshTokenService,

    idGenerator: fastify.infrastructure.idGenerator,

    clock: fastify.infrastructure.clock,

    accessTokenTtlMinutes: env.JWT_ACCESS_TOKEN_TTL_MINUTES,

    refreshTokenTtlDays: env.REFRESH_TOKEN_TTL_DAYS,
  });

  const logoutSessionUseCase = new LogoutSessionUseCase({
    repository: new PrismaLogoutSessionRepository(fastify.infrastructure.prisma),

    refreshTokenService,
    clock: fastify.infrastructure.clock,
  });

  const loginUserUseCase = new LoginUserUseCase({
    userRepository: new PrismaUserRepository(fastify.infrastructure.prisma),

    loginSessionRepository: new PrismaLoginSessionRepository(fastify.infrastructure.prisma),

    passwordHasher,
    accessTokenService,
    refreshTokenService,

    idGenerator: fastify.infrastructure.idGenerator,

    clock: fastify.infrastructure.clock,

    dummyPasswordHash,

    maximumFailedAttempts: env.LOGIN_MAX_FAILED_ATTEMPTS,

    lockDurationMinutes: env.LOGIN_LOCK_DURATION_MINUTES,

    accessTokenTtlMinutes: env.JWT_ACCESS_TOKEN_TTL_MINUTES,

    refreshTokenTtlDays: env.REFRESH_TOKEN_TTL_DAYS,
  });

  await fastify.register(authenticationRoutes, {
    prefix: '/api/v1/auth',
    registerUserUseCase,
    verifyEmailUseCase,
    resendVerificationUseCase,
  });

  await fastify.register(loginRoutes, {
    prefix: '/api/v1/auth',
    loginUserUseCase,
  });

  await fastify.register(refreshRoutes, {
    prefix: '/api/v1/auth',
    refreshSessionUseCase,
  });

  await fastify.register(logoutRoutes, {
    prefix: '/api/v1/auth',
    logoutSessionUseCase,
  });
};

export const authenticationPlugin = fastifyPlugin(authenticationPluginImplementation, {
  name: 'authentication-plugin',
  dependencies: ['infrastructure-plugin'],
});
