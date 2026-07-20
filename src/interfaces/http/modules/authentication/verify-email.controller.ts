import type { FastifyReply, FastifyRequest } from 'fastify';

import { EmailAlreadyVerifiedError } from '@/application/errors/email-already-verified.error.js';
import { EmailVerificationTokenExpiredError } from '@/application/errors/email-verification-token-expired.error.js';
import { EmailVerificationTokenInvalidError } from '@/application/errors/email-verification-token-invalid.error.js';
import { OptimisticConcurrencyError } from '@/application/errors/optimistic-concurrency.error.js';
import type { VerifyEmailResult } from '@/application/ports/repositories/email-verification.repository.js';
import type { VerifyEmailCommand } from '@/application/use-cases/authentication/verify-email.use-case.js';
import { createRequestAuditContext } from '@/interfaces/http/auditing/request-audit-context.js';
import { createErrorResponse, createSuccessResponse } from '@/shared/http/api-response.js';
import { verifyEmailRequestSchema, type VerifyEmailRequestBody } from './verify-email.schema.js';

export interface VerifyEmailExecutor {
  execute(command: VerifyEmailCommand): Promise<VerifyEmailResult>;
}

export interface VerifyEmailControllerDependencies {
  verifyEmailUseCase: VerifyEmailExecutor;
}

interface VerifyEmailRouteRequest {
  Body: VerifyEmailRequestBody;
}

export function createVerifyEmailController(
  dependencies: VerifyEmailControllerDependencies,
): (request: FastifyRequest<VerifyEmailRouteRequest>, reply: FastifyReply) => Promise<void> {
  return async function verifyEmailController(
    request: FastifyRequest<VerifyEmailRouteRequest>,

    reply: FastifyReply,
  ): Promise<void> {
    const validationResult = verifyEmailRequestSchema.safeParse(request.body);

    if (!validationResult.success) {
      await reply.status(400).send(
        createErrorResponse(
          'INVALID_REQUEST',
          'Request validation failed',

          validationResult.error.issues.map((issue) => ({
            code: issue.code,

            field: issue.path.length === 0 ? 'token' : issue.path.map(String).join('.'),

            message: issue.message,
          })),
        ),
      );

      return;
    }

    try {
      const result = await dependencies.verifyEmailUseCase.execute({
        token: validationResult.data.token,

        ...createRequestAuditContext(request),
      });

      await reply.status(200).send(createSuccessResponse(result));
    } catch (error: unknown) {
      if (error instanceof EmailVerificationTokenInvalidError) {
        await reply
          .status(422)
          .send(
            createErrorResponse(
              'INVALID_VERIFICATION_TOKEN',
              'Email verification token is invalid',
            ),
          );

        return;
      }

      if (error instanceof EmailVerificationTokenExpiredError) {
        await reply
          .status(410)
          .send(
            createErrorResponse(
              'VERIFICATION_TOKEN_EXPIRED',
              'Email verification token has expired',
            ),
          );

        return;
      }

      if (error instanceof EmailAlreadyVerifiedError) {
        await reply
          .status(409)
          .send(
            createErrorResponse(
              'EMAIL_ALREADY_VERIFIED',
              'Email address has already been verified',
            ),
          );

        return;
      }

      if (error instanceof OptimisticConcurrencyError) {
        await reply
          .status(409)
          .send(
            createErrorResponse(
              'CONCURRENT_UPDATE',
              'The user account was modified by another operation',
            ),
          );

        return;
      }

      throw error;
    }
  };
}
