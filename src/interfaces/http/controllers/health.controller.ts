import type { FastifyReply, FastifyRequest } from 'fastify';

import { env } from '@/shared/config/env.js';
import { createSuccessResponse } from '@/shared/http/api-response.js';

interface HealthData {
  service: string;
  status: 'healthy';
  timestamp: string;
  uptime: number;
}

export async function getHealthStatus(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const healthData: HealthData = {
    service: env.APP_NAME,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  };

  await reply.status(200).send(createSuccessResponse('Service is healthy', healthData));
}
