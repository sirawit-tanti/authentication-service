import type { FastifyReply, FastifyRequest } from 'fastify';

import type {
  ListAuditLogsCommand,
  ListAuditLogsResult,
} from '@/application/use-cases/auditing/list-audit-logs.use-case.js';
import {
  createErrorResponse,
  createSuccessResponse,
  type ApiErrorDetail,
} from '@/shared/http/api-response.js';
import {
  decodeAuditLogCursor,
  encodeAuditLogCursor,
  InvalidAuditLogCursorError,
} from './audit-log-cursor.js';
import { listAuditLogsQuerySchema } from './audit-logs.schema.js';

interface ListAuditLogsRequest {
  Querystring: unknown;
}

export interface ListAuditLogsExecutor {
  execute(command: ListAuditLogsCommand): Promise<ListAuditLogsResult>;
}

export interface AuditLogsControllerDependencies {
  listAuditLogsUseCase: ListAuditLogsExecutor;
}

function createValidationDetails(
  issues: {
    code: string;
    path: PropertyKey[];
    message: string;
  }[],
): ApiErrorDetail[] {
  return issues.map((issue): ApiErrorDetail => {
    const field = issue.path.map(String).join('.');

    if (field.length === 0) {
      return {
        code: issue.code,

        message: issue.message,
      };
    }

    return {
      code: issue.code,

      field,

      message: issue.message,
    };
  });
}

async function sendInvalidRequest(reply: FastifyReply, details?: ApiErrorDetail[]): Promise<void> {
  await reply
    .status(400)
    .send(createErrorResponse('INVALID_REQUEST', 'Request validation failed', details));
}

export function createListAuditLogsController(
  dependencies: AuditLogsControllerDependencies,
): (request: FastifyRequest<ListAuditLogsRequest>, reply: FastifyReply) => Promise<void> {
  return async function listAuditLogsController(
    request: FastifyRequest<ListAuditLogsRequest>,

    reply: FastifyReply,
  ): Promise<void> {
    const principal = request.authenticatedPrincipal;

    if (principal === null) {
      await reply
        .status(401)
        .send(createErrorResponse('UNAUTHORIZED', 'Authentication is required'));

      return;
    }

    const validationResult = listAuditLogsQuerySchema.safeParse(request.query);

    if (!validationResult.success) {
      await sendInvalidRequest(reply, createValidationDetails(validationResult.error.issues));

      return;
    }

    let cursor;

    try {
      cursor =
        validationResult.data.cursor === undefined
          ? undefined
          : decodeAuditLogCursor(validationResult.data.cursor);
    } catch (error: unknown) {
      if (error instanceof InvalidAuditLogCursorError) {
        await sendInvalidRequest(reply, [
          {
            code: 'invalid_cursor',

            field: 'cursor',

            message: 'Cursor is invalid or malformed',
          },
        ]);

        return;
      }

      throw error;
    }

    const result = await dependencies.listAuditLogsUseCase.execute({
      applicationId: principal.applicationId,

      limit: validationResult.data.limit,

      ...(cursor === undefined
        ? {}
        : {
            cursor,
          }),

      ...(validationResult.data.actorUserId === undefined
        ? {}
        : {
            actorUserId: validationResult.data.actorUserId,
          }),

      ...(validationResult.data.action === undefined
        ? {}
        : {
            action: validationResult.data.action,
          }),

      ...(validationResult.data.outcome === undefined
        ? {}
        : {
            outcome: validationResult.data.outcome,
          }),

      ...(validationResult.data.resourceType === undefined
        ? {}
        : {
            resourceType: validationResult.data.resourceType,
          }),

      ...(validationResult.data.resourceId === undefined
        ? {}
        : {
            resourceId: validationResult.data.resourceId,
          }),

      ...(validationResult.data.requestId === undefined
        ? {}
        : {
            requestId: validationResult.data.requestId,
          }),

      ...(validationResult.data.createdFrom === undefined
        ? {}
        : {
            createdFrom: validationResult.data.createdFrom,
          }),

      ...(validationResult.data.createdTo === undefined
        ? {}
        : {
            createdTo: validationResult.data.createdTo,
          }),
    });

    await reply.status(200).send(
      createSuccessResponse({
        auditLogs: result.auditLogs,

        nextCursor: result.nextCursor === null ? null : encodeAuditLogCursor(result.nextCursor),
      }),
    );
  };
}
