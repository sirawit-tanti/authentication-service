import Fastify, { type FastifyInstance } from 'fastify';

import type { AuditLogRecord } from '../../../src/application/ports/repositories/audit-log-query.repository.js';
import type {
  ListAuditLogsCommand,
  ListAuditLogsResult,
} from '../../../src/application/use-cases/auditing/list-audit-logs.use-case.js';
import type { AuthenticationGuard } from '../../../src/interfaces/http/authentication/authentication-guard.js';
import type { PermissionGuard } from '../../../src/interfaces/http/authorization/permission-guard.js';
import type { ListAuditLogsExecutor } from '../../../src/interfaces/http/modules/auditing/audit-logs.controller.js';
import { auditingRoutes } from '../../../src/interfaces/http/modules/auditing/auditing.routes.js';
import { errorHandler } from '../../../src/shared/errors/error-handler.js';
import { createErrorResponse } from '../../../src/shared/http/api-response.js';

const USER_ID = 'f7ee2402-e515-47fa-b79f-c700e82b4451';

const APPLICATION_ID = 'd797d3eb-41ce-40cf-9d79-30b15fe49042';

const SESSION_ID = 'be4c57d3-b4c9-4eb5-a975-92adb74f69c8';

const AUDIT_LOG_ID = 'a0f72720-71ee-4b52-81ef-b999014fa23f';

const AUDIT_LOG_CREATED_AT = new Date('2026-07-20T10:00:00.000Z');

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

    userAgent: 'Vitest Audit Client',

    requestId: 'audit-route-request-id',

    metadata: {
      reason: 'Revoked by user',
    },

    errorMessage: null,

    createdAt: AUDIT_LOG_CREATED_AT,
  };
}

function createSuccessfulAuthenticationGuard(): AuthenticationGuard {
  return function successfulAuthenticationGuard(request, reply): Promise<void> {
    void reply;

    request.authenticatedPrincipal = {
      userId: USER_ID,

      email: 'sirawit@example.com',

      applicationId: APPLICATION_ID,

      sessionId: SESSION_ID,
    };

    return Promise.resolve();
  };
}

function createRejectedAuthenticationGuard(): AuthenticationGuard {
  return async function rejectedAuthenticationGuard(request, reply): Promise<void> {
    request.authenticatedPrincipal = null;

    await reply.status(401).send(createErrorResponse('UNAUTHORIZED', 'Authentication is required'));
  };
}

function createAllowedPermissionGuard(): PermissionGuard {
  return function allowedPermissionGuard(request, reply): Promise<void> {
    void request;
    void reply;

    return Promise.resolve();
  };
}

function createRejectedPermissionGuard(): PermissionGuard {
  return async function rejectedPermissionGuard(request, reply): Promise<void> {
    void request;

    await reply
      .status(403)
      .send(createErrorResponse('FORBIDDEN', 'You do not have permission to perform this action'));
  };
}

interface CreateApplicationInput {
  authenticationGuard: AuthenticationGuard;

  permissionGuard: PermissionGuard;

  listAuditLogsUseCase: FakeListAuditLogsUseCase;
}

async function createApplication(input: CreateApplicationInput): Promise<FastifyInstance> {
  const application = Fastify({
    logger: false,

    ajv: {
      customOptions: {
        removeAdditional: false,
      },
    },
  });

  await application.register(errorHandler);

  await application.register(auditingRoutes, {
    prefix: '/api/v1',

    authenticationGuard: input.authenticationGuard,

    auditLogsReadPermissionGuard: input.permissionGuard,

    listAuditLogsUseCase: input.listAuditLogsUseCase,
  });

  await application.ready();

  return application;
}

describe('GET /api/v1/audit-logs', () => {
  let application: FastifyInstance | null = null;

  afterEach(async () => {
    if (application !== null) {
      await application.close();

      application = null;
    }
  });

  it('returns application-scoped audit logs', async () => {
    const listAuditLogsUseCase = new FakeListAuditLogsUseCase();

    listAuditLogsUseCase.result = {
      auditLogs: [createAuditLogRecord()],

      nextCursor: null,
    };

    application = await createApplication({
      authenticationGuard: createSuccessfulAuthenticationGuard(),

      permissionGuard: createAllowedPermissionGuard(),

      listAuditLogsUseCase,
    });

    const response = await application.inject({
      method: 'GET',

      url: '/api/v1/audit-logs',

      headers: {
        authorization: 'Bearer test-access-token',
      },
    });

    expect(response.statusCode).toBe(200);

    expect(response.json()).toEqual({
      success: true,

      data: {
        auditLogs: [
          {
            id: AUDIT_LOG_ID,

            applicationId: APPLICATION_ID,

            actorUserId: USER_ID,

            action: 'SESSION_REVOKED',

            resourceType: 'SESSION',

            resourceId: SESSION_ID,

            outcome: 'SUCCESS',

            ipAddress: '127.0.0.1',

            userAgent: 'Vitest Audit Client',

            requestId: 'audit-route-request-id',

            metadata: {
              reason: 'Revoked by user',
            },

            errorMessage: null,

            createdAt: '2026-07-20T10:00:00.000Z',
          },
        ],

        nextCursor: null,
      },
    });

    expect(listAuditLogsUseCase.command).toEqual({
      applicationId: APPLICATION_ID,

      limit: 20,
    });
  });

  it('passes supported query filters to the use case', async () => {
    const listAuditLogsUseCase = new FakeListAuditLogsUseCase();

    application = await createApplication({
      authenticationGuard: createSuccessfulAuthenticationGuard(),

      permissionGuard: createAllowedPermissionGuard(),

      listAuditLogsUseCase,
    });

    const response = await application.inject({
      method: 'GET',

      url: [
        '/api/v1/audit-logs',
        '?limit=50',
        `&actorUserId=${USER_ID}`,
        '&action=SESSION_REVOKED',
        '&outcome=SUCCESS',
        '&resourceType=SESSION',
        `&resourceId=${SESSION_ID}`,
        '&requestId=request-123',
        '&createdFrom=2026-07-01T00%3A00%3A00.000Z',
        '&createdTo=2026-07-31T23%3A59%3A59.999Z',
      ].join(''),

      headers: {
        authorization: 'Bearer test-access-token',
      },
    });

    expect(response.statusCode).toBe(200);

    expect(listAuditLogsUseCase.command).toEqual({
      applicationId: APPLICATION_ID,

      limit: 50,

      actorUserId: USER_ID,

      action: 'SESSION_REVOKED',

      outcome: 'SUCCESS',

      resourceType: 'SESSION',

      resourceId: SESSION_ID,

      requestId: 'request-123',

      createdFrom: new Date('2026-07-01T00:00:00.000Z'),

      createdTo: new Date('2026-07-31T23:59:59.999Z'),
    });
  });

  it('returns 401 when authentication fails', async () => {
    const listAuditLogsUseCase = new FakeListAuditLogsUseCase();

    application = await createApplication({
      authenticationGuard: createRejectedAuthenticationGuard(),

      permissionGuard: createAllowedPermissionGuard(),

      listAuditLogsUseCase,
    });

    const response = await application.inject({
      method: 'GET',

      url: '/api/v1/audit-logs',
    });

    expect(response.statusCode).toBe(401);

    expect(response.json()).toEqual({
      success: false,

      error: {
        code: 'UNAUTHORIZED',

        message: 'Authentication is required',
      },
    });

    expect(listAuditLogsUseCase.command).toBeNull();
  });

  it('returns 403 when the required permission is missing', async () => {
    const listAuditLogsUseCase = new FakeListAuditLogsUseCase();

    application = await createApplication({
      authenticationGuard: createSuccessfulAuthenticationGuard(),

      permissionGuard: createRejectedPermissionGuard(),

      listAuditLogsUseCase,
    });

    const response = await application.inject({
      method: 'GET',

      url: '/api/v1/audit-logs',

      headers: {
        authorization: 'Bearer test-access-token',
      },
    });

    expect(response.statusCode).toBe(403);

    expect(response.json()).toEqual({
      success: false,

      error: {
        code: 'FORBIDDEN',

        message: 'You do not have permission to perform this action',
      },
    });

    expect(listAuditLogsUseCase.command).toBeNull();
  });
});
