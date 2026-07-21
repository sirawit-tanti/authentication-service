import type { FastifyRequest } from 'fastify';

import type { AuditRequestContext } from '@/application/auditing/audit-request-context.js';

const MAX_USER_AGENT_LENGTH = 512;

function normalizeOptionalText(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalizedValue = value.trim();

  return normalizedValue.length === 0 ? undefined : normalizedValue;
}

export function getAuditRequestContext(request: FastifyRequest): AuditRequestContext {
  const userAgentHeader = request.headers['user-agent'];

  const normalizedUserAgent = normalizeOptionalText(
    typeof userAgentHeader === 'string' ? userAgentHeader : undefined,
  );

  const requestId = normalizeOptionalText(request.id);

  const ipAddress = normalizeOptionalText(request.ip);

  return {
    ...(requestId === undefined
      ? {}
      : {
          requestId,
        }),

    ...(ipAddress === undefined
      ? {}
      : {
          ipAddress,
        }),

    ...(normalizedUserAgent === undefined
      ? {}
      : {
          userAgent: normalizedUserAgent.slice(0, MAX_USER_AGENT_LENGTH),
        }),
  };
}
