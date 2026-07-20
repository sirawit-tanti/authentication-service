import type {
  AuditLogQueryRepository,
  AuditLogRecord,
  FindAuditLogsInput,
  FindAuditLogsResult,
} from '@/application/ports/repositories/audit-log-query.repository.js';
import type { ApplicationPrismaClient } from '../prisma-client.js';

export class PrismaAuditLogQueryRepository implements AuditLogQueryRepository {
  private readonly prisma: ApplicationPrismaClient;

  public constructor(prisma: ApplicationPrismaClient) {
    this.prisma = prisma;
  }

  public async findMany(input: FindAuditLogsInput): Promise<FindAuditLogsResult> {
    const auditLogs = await this.prisma.auditLog.findMany({
      where: {
        applicationId: input.applicationId,

        ...(input.actorUserId === undefined
          ? {}
          : {
              actorUserId: input.actorUserId,
            }),

        ...(input.action === undefined
          ? {}
          : {
              action: input.action,
            }),

        ...(input.outcome === undefined
          ? {}
          : {
              outcome: input.outcome,
            }),

        ...(input.resourceType === undefined
          ? {}
          : {
              resourceType: input.resourceType,
            }),

        ...(input.resourceId === undefined
          ? {}
          : {
              resourceId: input.resourceId,
            }),

        ...(input.requestId === undefined
          ? {}
          : {
              requestId: input.requestId,
            }),

        ...(input.createdFrom === undefined && input.createdTo === undefined
          ? {}
          : {
              createdAt: {
                ...(input.createdFrom === undefined
                  ? {}
                  : {
                      gte: input.createdFrom,
                    }),

                ...(input.createdTo === undefined
                  ? {}
                  : {
                      lte: input.createdTo,
                    }),
              },
            }),

        ...(input.cursor === undefined
          ? {}
          : {
              OR: [
                {
                  createdAt: {
                    lt: input.cursor.createdAt,
                  },
                },
                {
                  createdAt: input.cursor.createdAt,

                  id: {
                    lt: input.cursor.id,
                  },
                },
              ],
            }),
      },

      orderBy: [
        {
          createdAt: 'desc',
        },
        {
          id: 'desc',
        },
      ],

      take: input.limit + 1,

      select: {
        id: true,
        applicationId: true,
        actorUserId: true,
        action: true,
        resourceType: true,
        resourceId: true,
        outcome: true,
        ipAddress: true,
        userAgent: true,
        requestId: true,
        metadata: true,
        errorMessage: true,
        createdAt: true,
      },
    });

    const hasMore = auditLogs.length > input.limit;

    const page = hasMore ? auditLogs.slice(0, input.limit) : auditLogs;

    const lastRecord = page.at(-1);

    return {
      records: page.map((auditLog): AuditLogRecord => ({
        id: auditLog.id,

        applicationId: auditLog.applicationId,

        actorUserId: auditLog.actorUserId,

        action: auditLog.action,

        resourceType: auditLog.resourceType,

        resourceId: auditLog.resourceId,

        outcome: auditLog.outcome,

        ipAddress: auditLog.ipAddress,

        userAgent: auditLog.userAgent,

        requestId: auditLog.requestId,

        metadata: auditLog.metadata,

        errorMessage: auditLog.errorMessage,

        createdAt: auditLog.createdAt,
      })),

      nextCursor:
        hasMore && lastRecord !== undefined
          ? {
              createdAt: lastRecord.createdAt,

              id: lastRecord.id,
            }
          : null,
    };
  }
}
