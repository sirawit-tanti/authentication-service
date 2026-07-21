import type { FastifyPluginAsync } from 'fastify';
import fastifyPlugin from 'fastify-plugin';

import { ListAuditLogsUseCase } from '@/application/use-cases/auditing/list-audit-logs.use-case.js';
import { JwtAccessTokenService } from '@/infrastructure/authentication/jwt-access-token.service.js';
import { PrismaPermissionChecker } from '@/infrastructure/authorization/prisma-permission-checker.js';
import { PrismaAccessSessionRepository } from '@/infrastructure/database/repositories/prisma-access-session.repository.js';
import { PrismaAuditLogQueryRepository } from '@/infrastructure/database/repositories/prisma-audit-log-query.repository.js';
import { env } from '@/shared/config/env.js';
import { createAuthenticationGuard } from '../../authentication/authentication-guard.js';
import { createPermissionGuard } from '../../authorization/permission-guard.js';
import { auditingRoutes } from './auditing.routes.js';

const AUDIT_LOG_READ_PERMISSION_CODE = 'audit_logs.read';

const auditingPluginImplementation: FastifyPluginAsync = async (fastify): Promise<void> => {
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

  const auditLogsReadPermissionGuard = createPermissionGuard({
    permissionChecker,
    clock: fastify.infrastructure.clock,
    permissionCode: AUDIT_LOG_READ_PERMISSION_CODE,
  });

  const auditLogQueryRepository = new PrismaAuditLogQueryRepository(fastify.infrastructure.prisma);

  const listAuditLogsUseCase = new ListAuditLogsUseCase(auditLogQueryRepository);

  await fastify.register(auditingRoutes, {
    prefix: '/api/v1',
    authenticationGuard,
    auditLogsReadPermissionGuard,
    listAuditLogsUseCase,
  });
};

export const auditingPlugin = fastifyPlugin(auditingPluginImplementation, {
  name: 'auditing-plugin',
  dependencies: ['infrastructure-plugin'],
});
