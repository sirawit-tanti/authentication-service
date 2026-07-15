import type { FastifyReply, FastifyRequest } from 'fastify';

import type {
  ResendEmailVerificationCommand,
  ResendEmailVerificationResult,
} from '../../../../application/use-cases/authentication/resend-email-verification.use-case.js';
import {
  createErrorResponse,
  createSuccessResponse,
} from '../../../../shared/http/api-response.js';
import {
  resendVerificationRequestSchema,
  type ResendVerificationRequestBody,
} from './resend-verification.schema.js';

export interface ResendVerificationExecutor {
  execute(command: ResendEmailVerificationCommand): Promise<ResendEmailVerificationResult>;
}

export interface ResendVerificationControllerDependencies {
  resendVerificationUseCase: ResendVerificationExecutor;
}

interface ResendVerificationRouteRequest {
  Body: ResendVerificationRequestBody;
}

export function createResendVerificationController(
  dependencies: ResendVerificationControllerDependencies,
): (request: FastifyRequest<ResendVerificationRouteRequest>, reply: FastifyReply) => Promise<void> {
  return async function resendVerificationController(
    request: FastifyRequest<ResendVerificationRouteRequest>,
    reply: FastifyReply,
  ): Promise<void> {
    const validationResult = resendVerificationRequestSchema.safeParse(request.body);

    if (!validationResult.success) {
      await reply.status(400).send(
        createErrorResponse(
          'INVALID_REQUEST',
          'Request validation failed',
          validationResult.error.issues.map((issue) => ({
            code: issue.code,
            field: issue.path.length === 0 ? 'email' : issue.path.map(String).join('.'),
            message: issue.message,
          })),
        ),
      );

      return;
    }

    const result = await dependencies.resendVerificationUseCase.execute({
      email: validationResult.data.email,
    });

    await reply.status(202).send(createSuccessResponse(result));
  };
}
