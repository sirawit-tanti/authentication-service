import type { FastifyReply, FastifyRequest } from 'fastify';

import { env } from '@/shared/config/env.js';
import { createSuccessResponse } from '@/shared/http/api-response.js';

interface LivenessData {
  service: string;
  status: 'healthy';
  timestamp: string;
  uptime: number;
}

interface ReadinessData {
  service: string;
  status: 'ready';
  dependencies: {
    database: 'connected';
  };
  timestamp: string;
}

function createLivenessData(): LivenessData {
  return {
    service: env.APP_NAME,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  };
}

export async function getHealthStatus(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  await reply.status(200).send(createSuccessResponse('Service is healthy', createLivenessData()));
}

export async function getLivenessStatus(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  await reply.status(200).send(createSuccessResponse('Service is alive', createLivenessData()));
}

export async function getReadinessStatus(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  await request.server.prisma.$queryRaw`SELECT 1`;

  const readinessData: ReadinessData = {
    service: env.APP_NAME,
    status: 'ready',
    dependencies: {
      database: 'connected',
    },
    timestamp: new Date().toISOString(),
  };

  await reply.status(200).send(createSuccessResponse('Service is ready', readinessData));
}
