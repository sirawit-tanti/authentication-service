import type { FastifyPluginAsync } from 'fastify';
import fastifyPlugin from 'fastify-plugin';

import { ListPermissionsUseCase } from '@/application/use-cases/authorization/list-permissions.use-case.js';
import { ListRolesUseCase } from '@/application/use-cases/authorization/list-roles.use-case.js';
import { PrismaPermissionChecker } from '@/infrastructure/authorization/prisma-permission-checker.js';
import { PrismaAccessSessionRepository } from '@/infrastructure/database/repositories/prisma-access-session.repository.js';
import { PrismaAuthorizationCatalogQueryRepository } from '@/infrastructure/database/repositories/prisma-authorization-catalog-query.repository.js';
import { JwtAccessTokenService } from '@/infrastructure/authentication/jwt-access-token.service.js';
import { env } from '@/shared/config/env.js';
import { createAuthenticationGuard } from '../../authentication/authentication-guard.js';
import { createPermissionGuard } from '../../authorization/permission-guard.js';
import { authorizationCatalogRoutes } from './authorization-catalog.routes.js';

const ROLES_READ_PERMISSION = 'roles.read';

const authorizationPluginImplementation: FastifyPluginAsync = async (fastify): Promise<void> => {
  const accessTokenService = new JwtAccessTokenService({
    secret: env.JWT_ACCESS_TOKEN_SECRET,

    issuer: env.JWT_ACCESS_TOKEN_ISSUER,

    audience: env.JWT_ACCESS_TOKEN_AUDIENCE,

    timeToLiveMinutes: env.JWT_ACCESS_TOKEN_TTL_MINUTES,
  });

  const authenticationGuard = createAuthenticationGuard({
    accessTokenService,

    accessSessionRepository: new PrismaAccessSessionRepository(fastify.infrastructure.prisma),

    clock: fastify.infrastructure.clock,
  });

  const permissionChecker = new PrismaPermissionChecker(fastify.infrastructure.prisma);

  const rolesReadPermissionGuard = createPermissionGuard({
    permissionChecker,

    clock: fastify.infrastructure.clock,

    permissionCode: ROLES_READ_PERMISSION,
  });

  const repository = new PrismaAuthorizationCatalogQueryRepository(fastify.infrastructure.prisma);

  const listRolesUseCase = new ListRolesUseCase(repository);

  const listPermissionsUseCase = new ListPermissionsUseCase(repository);

  await fastify.register(authorizationCatalogRoutes, {
    prefix: '/api/v1/authorization',

    authenticationGuard,

    rolesReadPermissionGuard,

    listRolesUseCase,

    listPermissionsUseCase,
  });
};

export const authorizationPlugin = fastifyPlugin(authorizationPluginImplementation, {
  name: 'authorization-plugin',

  dependencies: ['infrastructure-plugin'],
});
