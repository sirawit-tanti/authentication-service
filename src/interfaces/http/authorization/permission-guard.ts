import type { FastifyReply, FastifyRequest } from 'fastify';

import type { PermissionChecker } from '@/application/ports/authorization/permission-checker.js';
import type { Clock } from '@/application/ports/system/clock.js';
import { createErrorResponse } from '@/shared/http/api-response.js';

export interface PermissionGuardDependencies {
  permissionChecker: PermissionChecker;
  clock: Clock;
  permissionCode: string;
}

export type PermissionGuard = (
  request: FastifyRequest,
  reply: FastifyReply,
) => Promise<FastifyReply | void>;

export function createPermissionGuard(dependencies: PermissionGuardDependencies): PermissionGuard {
  return async function permissionGuard(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<FastifyReply | void> {
    const principal = request.authenticatedPrincipal;

    if (principal === null) {
      return reply
        .status(401)
        .send(createErrorResponse('UNAUTHORIZED', 'Authentication is required'));
    }

    const hasPermission = await dependencies.permissionChecker.hasPermission({
      userId: principal.userId,

      applicationId: principal.applicationId,

      permissionCode: dependencies.permissionCode,

      checkedAt: dependencies.clock.now(),
    });

    if (!hasPermission) {
      return reply
        .status(403)
        .send(
          createErrorResponse('FORBIDDEN', 'You do not have permission to perform this action'),
        );
    }
  };
}
