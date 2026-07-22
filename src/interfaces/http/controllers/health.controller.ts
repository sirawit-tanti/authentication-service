import { performance } from 'node:perf_hooks';

import type { FastifyReply, FastifyRequest } from 'fastify';

import { createSuccessResponse } from '@/shared/http/api-response.js';

const DEPENDENCY_TIMEOUT_MILLISECONDS = 2_000;

type HealthDependencyState = 'connected' | 'unavailable' | 'timeout' | 'not_checked';

interface HealthDependencyStatus {
  status: HealthDependencyState;
  responseTimeMilliseconds?: number;
}

interface LivenessResponseData {
  status: 'alive';
  timestamp: string;
  uptimeSeconds: number;
}

interface ReadinessResponseData {
  status: 'ready' | 'not_ready';
  timestamp: string;

  dependencies: {
    postgresql: HealthDependencyStatus;
    redis: HealthDependencyStatus;
  };
}

interface HealthInfrastructure {
  prisma: {
    $queryRaw: (query: TemplateStringsArray) => Promise<unknown>;
  };

  redis: {
    ping(): Promise<string>;
  };
}

interface FastifyServerWithOptionalInfrastructure {
  infrastructure?: HealthInfrastructure;
}

function getOptionalInfrastructure(request: FastifyRequest): HealthInfrastructure | undefined {
  const server = request.server as FastifyServerWithOptionalInfrastructure;

  return server.infrastructure;
}

function createTimeoutPromise(timeoutMilliseconds: number): Promise<never> {
  return new Promise<never>((_resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Dependency check exceeded ${String(timeoutMilliseconds)} milliseconds`));
    }, timeoutMilliseconds);

    timeout.unref();
  });
}

async function checkDependency(operation: () => Promise<unknown>): Promise<HealthDependencyStatus> {
  const startedAt = performance.now();

  try {
    await Promise.race([operation(), createTimeoutPromise(DEPENDENCY_TIMEOUT_MILLISECONDS)]);

    return {
      status: 'connected',

      responseTimeMilliseconds: Math.max(0, Math.round(performance.now() - startedAt)),
    };
  } catch (error: unknown) {
    const responseTimeMilliseconds = Math.max(0, Math.round(performance.now() - startedAt));

    const timedOut = error instanceof Error && error.message.includes('Dependency check exceeded');

    return {
      status: timedOut ? 'timeout' : 'unavailable',

      responseTimeMilliseconds,
    };
  }
}

function createNotCheckedReadinessResponse(): ReadinessResponseData {
  return {
    status: 'not_ready',
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
}

export async function livenessController(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const response: LivenessResponseData = {
    status: 'alive',
    timestamp: new Date().toISOString(),

    uptimeSeconds: Math.floor(process.uptime()),
  };

  await reply.status(200).send(createSuccessResponse(response));
}

export async function readinessController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const infrastructure = getOptionalInfrastructure(request);

  if (infrastructure === undefined) {
    await reply.status(503).send(createSuccessResponse(createNotCheckedReadinessResponse()));

    return;
  }

  const [postgresql, redis] = await Promise.all([
    checkDependency(async () => {
      await infrastructure.prisma.$queryRaw`SELECT 1`;
    }),

    checkDependency(async () => {
      const result = await infrastructure.redis.ping();

      if (result !== 'PONG') {
        throw new Error('Redis ping returned an unexpected response');
      }
    }),
  ]);

  const ready = postgresql.status === 'connected' && redis.status === 'connected';

  const response: ReadinessResponseData = {
    status: ready ? 'ready' : 'not_ready',

    timestamp: new Date().toISOString(),

    dependencies: {
      postgresql,
      redis,
    },
  };

  await reply.status(ready ? 200 : 503).send(createSuccessResponse(response));
}
