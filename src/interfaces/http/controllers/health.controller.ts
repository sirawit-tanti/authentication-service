import type { FastifyReply, FastifyRequest } from 'fastify';

import { createSuccessResponse } from '@/shared/http/api-response.js';

interface HealthDependencyStatus {
  status: 'connected' | 'not_checked';
}

interface HealthResponseData {
  status: 'ok';
  timestamp: string;

  dependencies: {
    postgresql: HealthDependencyStatus;
    redis: HealthDependencyStatus;
  };
}

interface FastifyServerWithOptionalInfrastructure {
  infrastructure?: {
    prisma: {
      $queryRaw: (query: TemplateStringsArray) => Promise<unknown>;
    };

    redis: {
      ping(): Promise<string>;
    };
  };
}

function getOptionalInfrastructure(
  request: FastifyRequest,
): FastifyServerWithOptionalInfrastructure['infrastructure'] {
  const server = request.server as FastifyServerWithOptionalInfrastructure;

  return server.infrastructure;
}

export async function healthController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const infrastructure = getOptionalInfrastructure(request);

  if (infrastructure === undefined) {
    const response: HealthResponseData = {
      status: 'ok',
      timestamp: new Date().toISOString(),

      dependencies: {
        postgresql: {
          status: 'not_checked',
        },

        redis: {
          status: 'not_checked',
        },
      },
    };

    await reply.status(200).send(createSuccessResponse(response));

    return;
  }

  await Promise.all([infrastructure.prisma.$queryRaw`SELECT 1`, infrastructure.redis.ping()]);

  const response: HealthResponseData = {
    status: 'ok',
    timestamp: new Date().toISOString(),

    dependencies: {
      postgresql: {
        status: 'connected',
      },

      redis: {
        status: 'connected',
      },
    },
  };

  await reply.status(200).send(createSuccessResponse(response));
}
