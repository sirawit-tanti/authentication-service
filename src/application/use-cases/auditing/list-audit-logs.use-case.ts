import type {
  AuditLogCursor,
  AuditLogOutcome,
  AuditLogQueryRepository,
  AuditLogRecord,
} from '@/application/ports/repositories/audit-log-query.repository.js';

const DEFAULT_PAGE_SIZE = 20;

const MAXIMUM_PAGE_SIZE = 100;

export interface ListAuditLogsCommand {
  applicationId: string;
  limit?: number;
  cursor?: AuditLogCursor;
  actorUserId?: string;
  action?: string;
  outcome?: AuditLogOutcome;
  resourceType?: string;
  resourceId?: string;
  requestId?: string;
  createdFrom?: Date;
  createdTo?: Date;
}

export interface ListAuditLogsResult {
  auditLogs: AuditLogRecord[];
  nextCursor: AuditLogCursor | null;
}

export class ListAuditLogsUseCase {
  private readonly repository: AuditLogQueryRepository;

  public constructor(repository: AuditLogQueryRepository) {
    this.repository = repository;
  }

  public async execute(command: ListAuditLogsCommand): Promise<ListAuditLogsResult> {
    const requestedLimit = command.limit ?? DEFAULT_PAGE_SIZE;

    const limit = Math.min(Math.max(requestedLimit, 1), MAXIMUM_PAGE_SIZE);

    const result = await this.repository.findMany({
      applicationId: command.applicationId,

      limit,

      ...(command.cursor === undefined
        ? {}
        : {
            cursor: command.cursor,
          }),

      ...(command.actorUserId === undefined
        ? {}
        : {
            actorUserId: command.actorUserId,
          }),

      ...(command.action === undefined
        ? {}
        : {
            action: command.action,
          }),

      ...(command.outcome === undefined
        ? {}
        : {
            outcome: command.outcome,
          }),

      ...(command.resourceType === undefined
        ? {}
        : {
            resourceType: command.resourceType,
          }),

      ...(command.resourceId === undefined
        ? {}
        : {
            resourceId: command.resourceId,
          }),

      ...(command.requestId === undefined
        ? {}
        : {
            requestId: command.requestId,
          }),

      ...(command.createdFrom === undefined
        ? {}
        : {
            createdFrom: command.createdFrom,
          }),

      ...(command.createdTo === undefined
        ? {}
        : {
            createdTo: command.createdTo,
          }),
    });

    return {
      auditLogs: result.records,

      nextCursor: result.nextCursor,
    };
  }
}
