import type { FastifyRequest } from 'fastify';

import type { AuditRequestContext } from '@/application/auditing/audit-request-context.js';

const MAXIMUM_USER_AGENT_LENGTH = 512;

export function createRequestAuditContext(request: FastifyRequest): AuditRequestContext {
  const userAgent = request.headers['user-agent'];

  return {
    requestId: request.id,
    ipAddress: request.ip,

    ...(userAgent === undefined || userAgent.length === 0
      ? {}
      : {
          userAgent: userAgent.slice(0, MAXIMUM_USER_AGENT_LENGTH),
        }),
  };
}
