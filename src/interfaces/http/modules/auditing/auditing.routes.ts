import type { FastifyPluginCallback } from 'fastify';

import type { AuthenticationGuard } from '../../authentication/authentication-guard.js';
import type { PermissionGuard } from '../../authorization/permission-guard.js';
import {
  createListAuditLogsController,
  type ListAuditLogsExecutor,
} from './audit-logs.controller.js';
import { listAuditLogsRouteSchema, type ListAuditLogsQuery } from './audit-logs.schema.js';

export interface AuditingRoutesOptions {
  authenticationGuard: AuthenticationGuard;
  auditLogsReadPermissionGuard: PermissionGuard;
  listAuditLogsUseCase: ListAuditLogsExecutor;
}

interface ListAuditLogsRequest {
  Querystring: ListAuditLogsQuery;
}

export const auditingRoutes: FastifyPluginCallback<AuditingRoutesOptions> = (
  fastify,
  options,
  done,
): void => {
  fastify.decorateRequest('authenticatedPrincipal', null);

  fastify.get<ListAuditLogsRequest>(
    '/audit-logs',
    {
      schema: listAuditLogsRouteSchema,

      preHandler: [options.authenticationGuard, options.auditLogsReadPermissionGuard],
    },
    createListAuditLogsController({
      listAuditLogsUseCase: options.listAuditLogsUseCase,
    }),
  );

  done();
};
