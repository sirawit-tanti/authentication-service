import type { FastifyRequest, FastifyReply } from 'fastify';

import { createErrorResponse, createSuccessResponse } from '@/shared/http/api-response.js';

export async function meController(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const principal = request.authenticatedPrincipal;

  if (principal === null) {
    await reply.status(401).send(createErrorResponse('UNAUTHORIZED', 'Authentication is required'));

    return;
  }

  await reply.status(200).send(
    createSuccessResponse({
      userId: principal.userId,
      email: principal.email,
      applicationId: principal.applicationId,
      sessionId: principal.sessionId,
    }),
  );
}
