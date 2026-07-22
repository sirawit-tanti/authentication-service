import type { FastifyPluginAsync } from 'fastify';
import fastifyPlugin from 'fastify-plugin';

import { CreateRoleUseCase } from '@/application/use-cases/authorization/create-role.use-case.js';
import { GetUserRolesUseCase } from '@/application/use-cases/authorization/get-user-roles.use-case.js';
import { ListPermissionsUseCase } from '@/application/use-cases/authorization/list-permissions.use-case.js';
import { ListRolesUseCase } from '@/application/use-cases/authorization/list-roles.use-case.js';
import { ReplaceRolePermissionsUseCase } from '@/application/use-cases/authorization/replace-role-permissions.use-case.js';
import { ReplaceUserRolesUseCase } from '@/application/use-cases/authorization/replace-user-roles.use-case.js';
import { UpdateRoleUseCase } from '@/application/use-cases/authorization/update-role.use-case.js';
import { JwtAccessTokenService } from '@/infrastructure/authentication/jwt-access-token.service.js';
import { PrismaPermissionChecker } from '@/infrastructure/authorization/prisma-permission-checker.js';
import { PrismaAccessSessionRepository } from '@/infrastructure/database/repositories/prisma-access-session.repository.js';
import { PrismaAuthorizationCatalogQueryRepository } from '@/infrastructure/database/repositories/prisma-authorization-catalog-query.repository.js';
import { PrismaRoleManagementRepository } from '@/infrastructure/database/repositories/prisma-role-management.repository.js';
import { PrismaUserRoleAssignmentRepository } from '@/infrastructure/database/repositories/prisma-user-role-assignment.repository.js';
import { PrismaAccessTokenBlacklistRepository } from '@/infrastructure/database/repositories/prisma-access-token-blacklist.repository.js';
import { env } from '@/shared/config/env.js';
import { createAuthenticationGuard } from '../../authentication/authentication-guard.js';
import { createPermissionGuard } from '../../authorization/permission-guard.js';
import { authorizationCatalogRoutes } from './authorization-catalog.routes.js';
import { roleManagementRoutes } from './role-management.routes.js';

const ROLES_READ_PERMISSION = 'roles.read';

const ROLES_ASSIGN_PERMISSION = 'roles.assign';

const ROLES_MANAGE_PERMISSION = 'roles.manage';

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

    accessTokenBlacklistRepository: new PrismaAccessTokenBlacklistRepository(
      fastify.infrastructure.prisma,
    ),

    clock: fastify.infrastructure.clock,
  });

  const permissionChecker = new PrismaPermissionChecker(fastify.infrastructure.prisma);

  const rolesReadPermissionGuard = createPermissionGuard({
    permissionChecker,

    clock: fastify.infrastructure.clock,

    permissionCode: ROLES_READ_PERMISSION,
  });

  const rolesAssignPermissionGuard = createPermissionGuard({
    permissionChecker,

    clock: fastify.infrastructure.clock,

    permissionCode: ROLES_ASSIGN_PERMISSION,
  });

  const rolesManagePermissionGuard = createPermissionGuard({
    permissionChecker,

    clock: fastify.infrastructure.clock,

    permissionCode: ROLES_MANAGE_PERMISSION,
  });

  const catalogRepository = new PrismaAuthorizationCatalogQueryRepository(
    fastify.infrastructure.prisma,
  );

  const listRolesUseCase = new ListRolesUseCase(catalogRepository);

  const listPermissionsUseCase = new ListPermissionsUseCase(catalogRepository);

  const userRoleAssignmentRepository = new PrismaUserRoleAssignmentRepository(
    fastify.infrastructure.prisma,
  );

  const getUserRolesUseCase = new GetUserRolesUseCase({
    repository: userRoleAssignmentRepository,

    clock: fastify.infrastructure.clock,
  });

  const replaceUserRolesUseCase = new ReplaceUserRolesUseCase({
    repository: userRoleAssignmentRepository,

    clock: fastify.infrastructure.clock,
  });

  const roleManagementRepository = new PrismaRoleManagementRepository(
    fastify.infrastructure.prisma,
  );

  const createRoleUseCase = new CreateRoleUseCase({
    repository: roleManagementRepository,

    clock: fastify.infrastructure.clock,
  });

  const updateRoleUseCase = new UpdateRoleUseCase({
    repository: roleManagementRepository,

    clock: fastify.infrastructure.clock,
  });

  const replaceRolePermissionsUseCase = new ReplaceRolePermissionsUseCase({
    repository: roleManagementRepository,

    clock: fastify.infrastructure.clock,
  });

  await fastify.register(authorizationCatalogRoutes, {
    prefix: '/api/v1/authorization',

    authenticationGuard,

    rolesReadPermissionGuard,

    listRolesUseCase,

    listPermissionsUseCase,

    rolesAssignPermissionGuard,

    getUserRolesUseCase,

    replaceUserRolesUseCase,
  });

  await fastify.register(roleManagementRoutes, {
    prefix: '/api/v1/authorization',

    authenticationGuard,

    rolesManagePermissionGuard,

    createRoleUseCase,

    updateRoleUseCase,

    replaceRolePermissionsUseCase,
  });
};

export const authorizationPlugin = fastifyPlugin(authorizationPluginImplementation, {
  name: 'authorization-plugin',

  dependencies: ['infrastructure-plugin'],
});
