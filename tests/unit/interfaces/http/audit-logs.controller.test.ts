import type { FastifyReply, FastifyRequest } from 'fastify';

import type {
  AuditLogCursor,
  AuditLogRecord,
} from '../../../../src/application/ports/repositories/audit-log-query.repository.js';
import type {
  ListAuditLogsCommand,
  ListAuditLogsResult,
} from '../../../../src/application/use-cases/auditing/list-audit-logs.use-case.js';
import {
  createListAuditLogsController,
  type ListAuditLogsExecutor,
} from '../../../../src/interfaces/http/modules/auditing/audit-logs.controller.js';
import { encodeAuditLogCursor } from '../../../../src/interfaces/http/modules/auditing/audit-log-cursor.js';

const USER_ID = 'f7ee2402-e515-47fa-b79f-c700e82b4451';

const APPLICATION_ID = 'd797d3eb-41ce-40cf-9d79-30b15fe49042';

const SESSION_ID = 'be4c57d3-b4c9-4eb5-a975-92adb74f69c8';

const AUDIT_LOG_ID = 'a0f72720-71ee-4b52-81ef-b999014fa23f';

const NEXT_AUDIT_LOG_ID = 'c31aa41e-b942-4622-b520-62d50cb651dc';

const CREATED_AT = new Date('2026-07-20T10:00:00.000Z');

const NEXT_CREATED_AT = new Date('2026-07-20T09:00:00.000Z');

class FakeListAuditLogsUseCase implements ListAuditLogsExecutor {
  public command: ListAuditLogsCommand | null = null;

  public result: ListAuditLogsResult = {
    auditLogs: [],
    nextCursor: null,
  };

  public execute(command: ListAuditLogsCommand): Promise<ListAuditLogsResult> {
    this.command = command;

    return Promise.resolve(this.result);
  }
}

interface ReplyState {
  statusCode: number | null;
  payload: unknown;
}

interface ReplyDouble {
  status(statusCode: number): ReplyDouble;
  send(payload?: unknown): ReplyDouble;
}

function createReply(): {
  reply: FastifyReply;
  state: ReplyState;
} {
  const state: ReplyState = {
    statusCode: null,
    payload: null,
  };

  const replyDouble: ReplyDouble = {
    status(statusCode: number): ReplyDouble {
      state.statusCode = statusCode;

      return replyDouble;
    },

    send(payload?: unknown): ReplyDouble {
      state.payload = payload ?? null;

      return replyDouble;
    },
  };

  return {
    reply: replyDouble as unknown as FastifyReply,

    state,
  };
}

function createRequest(
  query: unknown,
  authenticated = true,
): FastifyRequest<{
  Querystring: unknown;
}> {
  return {
    query,

    authenticatedPrincipal: authenticated
      ? {
          userId: USER_ID,

          email: 'sirawit@example.com',

          applicationId: APPLICATION_ID,

          sessionId: SESSION_ID,
        }
      : null,
  } as unknown as FastifyRequest<{
    Querystring: unknown;
  }>;
}

function createAuditLogRecord(): AuditLogRecord {
  return {
    id: AUDIT_LOG_ID,

    applicationId: APPLICATION_ID,

    actorUserId: USER_ID,

    action: 'SESSION_REVOKED',

    resourceType: 'SESSION',

    resourceId: SESSION_ID,

    outcome: 'SUCCESS',

    ipAddress: '127.0.0.1',

    userAgent: 'Vitest',

    requestId: 'request-123',

    metadata: {
      reason: 'Revoked by user',
    },

    errorMessage: null,

    createdAt: CREATED_AT,
  };
}

describe('AuditLogsController', () => {
  it('lists audit logs and encodes the next cursor', async () => {
    const useCase = new FakeListAuditLogsUseCase();

    const nextCursor: AuditLogCursor = {
      createdAt: NEXT_CREATED_AT,

      id: NEXT_AUDIT_LOG_ID,
    };

    useCase.result = {
      auditLogs: [createAuditLogRecord()],

      nextCursor,
    };

    const controller = createListAuditLogsController({
      listAuditLogsUseCase: useCase,
    });

    const cursor: AuditLogCursor = {
      createdAt: CREATED_AT,

      id: AUDIT_LOG_ID,
    };

    const request = createRequest({
      limit: '50',

      cursor: encodeAuditLogCursor(cursor),

      actorUserId: USER_ID,

      action: 'SESSION_REVOKED',

      outcome: 'SUCCESS',

      resourceType: 'SESSION',

      resourceId: SESSION_ID,

      requestId: 'request-123',

      createdFrom: '2026-07-01T00:00:00.000Z',

      createdTo: '2026-07-31T23:59:59.999Z',
    });

    const { reply, state } = createReply();

    await controller(request, reply);

    expect(useCase.command).toEqual({
      applicationId: APPLICATION_ID,

      limit: 50,

      cursor,

      actorUserId: USER_ID,

      action: 'SESSION_REVOKED',

      outcome: 'SUCCESS',

      resourceType: 'SESSION',

      resourceId: SESSION_ID,

      requestId: 'request-123',

      createdFrom: new Date('2026-07-01T00:00:00.000Z'),

      createdTo: new Date('2026-07-31T23:59:59.999Z'),
    });

    expect(state.statusCode).toBe(200);

    expect(state.payload).toEqual({
      success: true,

      data: {
        auditLogs: [createAuditLogRecord()],

        nextCursor: encodeAuditLogCursor(nextCursor),
      },
    });
  });

  it('returns 400 when the query is invalid', async () => {
    const useCase = new FakeListAuditLogsUseCase();

    const controller = createListAuditLogsController({
      listAuditLogsUseCase: useCase,
    });

    const request = createRequest({
      limit: '0',
    });

    const { reply, state } = createReply();

    await controller(request, reply);

    expect(state.statusCode).toBe(400);

    expect(state.payload).toEqual({
      success: false,

      error: {
        code: 'INVALID_REQUEST',

        message: 'Request validation failed',

        details: [
          {
            code: 'too_small',

            field: 'limit',

            message: 'Too small: expected number to be >=1',
          },
        ],
      },
    });

    expect(useCase.command).toBeNull();
  });

  it('returns 400 when the cursor is malformed', async () => {
    const useCase = new FakeListAuditLogsUseCase();

    const controller = createListAuditLogsController({
      listAuditLogsUseCase: useCase,
    });

    const request = createRequest({
      cursor: 'not-a-valid-cursor',
    });

    const { reply, state } = createReply();

    await controller(request, reply);

    expect(state.statusCode).toBe(400);

    expect(state.payload).toEqual({
      success: false,

      error: {
        code: 'INVALID_REQUEST',

        message: 'Request validation failed',

        details: [
          {
            code: 'invalid_cursor',

            field: 'cursor',

            message: 'Cursor is invalid or malformed',
          },
        ],
      },
    });

    expect(useCase.command).toBeNull();
  });

  it('returns 401 when there is no authenticated principal', async () => {
    const useCase = new FakeListAuditLogsUseCase();

    const controller = createListAuditLogsController({
      listAuditLogsUseCase: useCase,
    });

    const request = createRequest({}, false);

    const { reply, state } = createReply();

    await controller(request, reply);

    expect(state.statusCode).toBe(401);

    expect(state.payload).toEqual({
      success: false,

      error: {
        code: 'UNAUTHORIZED',

        message: 'Authentication is required',
      },
    });

    expect(useCase.command).toBeNull();
  });

  it('returns a null next cursor when there are no more records', async () => {
    const useCase = new FakeListAuditLogsUseCase();

    useCase.result = {
      auditLogs: [],
      nextCursor: null,
    };

    const controller = createListAuditLogsController({
      listAuditLogsUseCase: useCase,
    });

    const request = createRequest({});

    const { reply, state } = createReply();

    await controller(request, reply);

    expect(useCase.command).toEqual({
      applicationId: APPLICATION_ID,

      limit: 20,
    });

    expect(state.statusCode).toBe(200);

    expect(state.payload).toEqual({
      success: true,

      data: {
        auditLogs: [],
        nextCursor: null,
      },
    });
  });
});
