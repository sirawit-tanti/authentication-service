import type {
  AuditLogCursor,
  AuditLogQueryRepository,
  AuditLogRecord,
  FindAuditLogsInput,
  FindAuditLogsResult,
} from '../../../src/application/ports/repositories/audit-log-query.repository.js';
import { ListAuditLogsUseCase } from '../../../src/application/use-cases/auditing/list-audit-logs.use-case.js';

const APPLICATION_ID = 'd797d3eb-41ce-40cf-9d79-30b15fe49042';

const ACTOR_USER_ID = 'f7ee2402-e515-47fa-b79f-c700e82b4451';

const FIRST_AUDIT_LOG_ID = 'a0f72720-71ee-4b52-81ef-b999014fa23f';

const SECOND_AUDIT_LOG_ID = 'c31aa41e-b942-4622-b520-62d50cb651dc';

const FIRST_CREATED_AT = new Date('2026-07-20T10:00:00.000Z');

const SECOND_CREATED_AT = new Date('2026-07-20T09:00:00.000Z');

function createAuditLogRecord(input: { id: string; createdAt: Date }): AuditLogRecord {
  return {
    id: input.id,
    applicationId: APPLICATION_ID,
    actorUserId: ACTOR_USER_ID,
    action: 'SESSION_REVOKED',
    resourceType: 'SESSION',
    resourceId: 'be4c57d3-b4c9-4eb5-a975-92adb74f69c8',
    outcome: 'SUCCESS',
    ipAddress: '127.0.0.1',
    userAgent: 'Vitest',
    requestId: 'request-123',
    metadata: {
      reason: 'Revoked by user',
    },
    errorMessage: null,
    createdAt: input.createdAt,
  };
}

class FakeAuditLogQueryRepository implements AuditLogQueryRepository {
  public input: FindAuditLogsInput | null = null;

  public result: FindAuditLogsResult = {
    records: [],
    nextCursor: null,
  };

  public findMany(input: FindAuditLogsInput): Promise<FindAuditLogsResult> {
    this.input = input;

    return Promise.resolve(this.result);
  }
}

describe('ListAuditLogsUseCase', () => {
  it('uses the default page size and returns audit logs', async () => {
    const repository = new FakeAuditLogQueryRepository();

    const firstRecord = createAuditLogRecord({
      id: FIRST_AUDIT_LOG_ID,
      createdAt: FIRST_CREATED_AT,
    });

    const secondRecord = createAuditLogRecord({
      id: SECOND_AUDIT_LOG_ID,
      createdAt: SECOND_CREATED_AT,
    });

    const nextCursor: AuditLogCursor = {
      createdAt: SECOND_CREATED_AT,
      id: SECOND_AUDIT_LOG_ID,
    };

    repository.result = {
      records: [firstRecord, secondRecord],
      nextCursor,
    };

    const useCase = new ListAuditLogsUseCase(repository);

    const result = await useCase.execute({
      applicationId: APPLICATION_ID,
    });

    expect(repository.input).toEqual({
      applicationId: APPLICATION_ID,
      limit: 20,
    });

    expect(result).toEqual({
      auditLogs: [firstRecord, secondRecord],
      nextCursor,
    });
  });

  it('passes all supported filters to the repository', async () => {
    const repository = new FakeAuditLogQueryRepository();

    const useCase = new ListAuditLogsUseCase(repository);

    const cursor: AuditLogCursor = {
      createdAt: SECOND_CREATED_AT,
      id: SECOND_AUDIT_LOG_ID,
    };

    const createdFrom = new Date('2026-07-01T00:00:00.000Z');

    const createdTo = new Date('2026-07-31T23:59:59.999Z');

    await useCase.execute({
      applicationId: APPLICATION_ID,

      limit: 50,

      cursor,

      actorUserId: ACTOR_USER_ID,

      action: 'SESSION_REVOKED',

      outcome: 'SUCCESS',

      resourceType: 'SESSION',

      resourceId: 'be4c57d3-b4c9-4eb5-a975-92adb74f69c8',

      requestId: 'request-123',

      createdFrom,

      createdTo,
    });

    expect(repository.input).toEqual({
      applicationId: APPLICATION_ID,

      limit: 50,

      cursor,

      actorUserId: ACTOR_USER_ID,

      action: 'SESSION_REVOKED',

      outcome: 'SUCCESS',

      resourceType: 'SESSION',

      resourceId: 'be4c57d3-b4c9-4eb5-a975-92adb74f69c8',

      requestId: 'request-123',

      createdFrom,

      createdTo,
    });
  });

  it('limits the page size to the maximum of 100', async () => {
    const repository = new FakeAuditLogQueryRepository();

    const useCase = new ListAuditLogsUseCase(repository);

    await useCase.execute({
      applicationId: APPLICATION_ID,

      limit: 500,
    });

    expect(repository.input).toEqual({
      applicationId: APPLICATION_ID,

      limit: 100,
    });
  });

  it('raises a page size below one to one', async () => {
    const repository = new FakeAuditLogQueryRepository();

    const useCase = new ListAuditLogsUseCase(repository);

    await useCase.execute({
      applicationId: APPLICATION_ID,

      limit: 0,
    });

    expect(repository.input).toEqual({
      applicationId: APPLICATION_ID,

      limit: 1,
    });
  });

  it('omits optional filters when they are not supplied', async () => {
    const repository = new FakeAuditLogQueryRepository();

    const useCase = new ListAuditLogsUseCase(repository);

    await useCase.execute({
      applicationId: APPLICATION_ID,

      limit: 10,
    });

    expect(repository.input).toEqual({
      applicationId: APPLICATION_ID,

      limit: 10,
    });
  });
});
