import type { FastifyPluginAsync } from 'fastify';
import fastifyPlugin from 'fastify-plugin';

import { ChangeUserStatusUseCase } from '@/application/use-cases/users/change-user-status.use-case.js';
import { GetAdministrativeUserUseCase } from '@/application/use-cases/users/get-administrative-user.use-case.js';
import { ListAdministrativeUsersUseCase } from '@/application/use-cases/users/list-administrative-users.use-case.js';
import { JwtAccessTokenService } from '@/infrastructure/authentication/jwt-access-token.service.js';
import { PrismaPermissionChecker } from '@/infrastructure/authorization/prisma-permission-checker.js';
import { PrismaAccessSessionRepository } from '@/infrastructure/database/repositories/prisma-access-session.repository.js';
import { PrismaUserAdministrationQueryRepository } from '@/infrastructure/database/repositories/prisma-user-administration-query.repository.js';
import { PrismaUserStatusManagementRepository } from '@/infrastructure/database/repositories/prisma-user-status-management.repository.js';
import { PrismaAccessTokenBlacklistRepository } from '@/infrastructure/database/repositories/prisma-access-token-blacklist.repository.js';
import { env } from '@/shared/config/env.js';
import { createAuthenticationGuard } from '../../authentication/authentication-guard.js';
import { createPermissionGuard } from '../../authorization/permission-guard.js';
import { userAdministrationRoutes } from './user-administration.routes.js';

const USERS_READ_PERMISSION = 'users.read';

const USERS_DISABLE_PERMISSION = 'users.disable';

const usersPluginImplementation: FastifyPluginAsync = async (fastify): Promise<void> => {
  const accessTokenService = new JwtAccessTokenService({
    secret: env.JWT_ACCESS_TOKEN_SECRET,

    issuer: env.JWT_ACCESS_TOKEN_ISSUER,

    audience: env.JWT_ACCESS_TOKEN_AUDIENCE,

    timeToLiveMinutes: env.JWT_ACCESS_TOKEN_TTL_MINUTES,
  });

  const authenticationGuard = createAuthenticationGuard({
    accessTokenService,

    accessSessionRepository: new PrismaAccessSessionRepository(fastify.infrastructure.prisma),

    accessTokenBlacklistRepository: new PrismaAccessTokenBlacklistRepository(
      fastify.infrastructure.prisma,
    ),

    clock: fastify.infrastructure.clock,
  });

  const permissionChecker = new PrismaPermissionChecker(fastify.infrastructure.prisma);

  const usersReadPermissionGuard = createPermissionGuard({
    permissionChecker,

    clock: fastify.infrastructure.clock,

    permissionCode: USERS_READ_PERMISSION,
  });

  const usersDisablePermissionGuard = createPermissionGuard({
    permissionChecker,

    clock: fastify.infrastructure.clock,

    permissionCode: USERS_DISABLE_PERMISSION,
  });

  const queryRepository = new PrismaUserAdministrationQueryRepository(
    fastify.infrastructure.prisma,
  );

  const listUsersUseCase = new ListAdministrativeUsersUseCase({
    repository: queryRepository,

    clock: fastify.infrastructure.clock,
  });

  const getUserUseCase = new GetAdministrativeUserUseCase({
    repository: queryRepository,

    clock: fastify.infrastructure.clock,
  });

  const statusManagementRepository = new PrismaUserStatusManagementRepository(
    fastify.infrastructure.prisma,
  );

  const changeUserStatusUseCase = new ChangeUserStatusUseCase({
    repository: statusManagementRepository,

    clock: fastify.infrastructure.clock,
  });

  await fastify.register(userAdministrationRoutes, {
    prefix: '/api/v1/users',

    authenticationGuard,

    usersReadPermissionGuard,

    usersDisablePermissionGuard,

    listUsersUseCase,

    getUserUseCase,

    changeUserStatusUseCase,
  });
};

export const usersPlugin = fastifyPlugin(usersPluginImplementation, {
  name: 'users-plugin',

  dependencies: ['infrastructure-plugin'],
});
