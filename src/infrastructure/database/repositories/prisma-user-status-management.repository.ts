import { SECURITY_AUDIT_ACTIONS } from '@/application/auditing/security-audit-action.js';
import type { AdministrativeUserStatus } from '@/application/ports/repositories/user-administration-query.repository.js';
import type {
  ChangeUserStatusInput,
  ChangeUserStatusPersistenceResult,
  UserStatusManagementRepository,
} from '@/application/ports/repositories/user-status-management.repository.js';
import type { ApplicationPrismaClient } from '../prisma-client.js';

const USER_RESOURCE_TYPE = 'USER';

function isAdministrativeUserStatus(status: string): status is AdministrativeUserStatus {
  return (
    status === 'PENDING_VERIFICATION' ||
    status === 'ACTIVE' ||
    status === 'SUSPENDED' ||
    status === 'DISABLED'
  );
}

export class PrismaUserStatusManagementRepository implements UserStatusManagementRepository {
  private readonly prisma: ApplicationPrismaClient;

  public constructor(prisma: ApplicationPrismaClient) {
    this.prisma = prisma;
  }

  public async changeStatus(
    input: ChangeUserStatusInput,
  ): Promise<ChangeUserStatusPersistenceResult> {
    return this.prisma.$transaction(
      async (transaction): Promise<ChangeUserStatusPersistenceResult> => {
        const user = await transaction.user.findFirst({
          where: {
            id: input.targetUserId,

            deletedAt: null,

            userRoles: {
              some: {
                role: {
                  applicationId: input.applicationId,
                },
              },
            },
          },

          select: {
            id: true,

            email: true,

            status: true,

            emailVerified: true,

            version: true,
          },
        });

        if (user === null) {
          return {
            status: 'NOT_FOUND',
          };
        }

        if (!isAdministrativeUserStatus(user.status)) {
          throw new Error('Unsupported user status');
        }

        if (user.status === 'DISABLED' && input.status !== 'DISABLED') {
          return {
            status: 'DISABLED_USER',
          };
        }

        if (input.status === 'ACTIVE' && !user.emailVerified) {
          return {
            status: 'EMAIL_NOT_VERIFIED',
          };
        }

        if (user.version !== input.expectedVersion) {
          return {
            status: 'CONFLICT',
          };
        }

        const previousStatus = user.status;

        const updateResult = await transaction.user.updateMany({
          where: {
            id: user.id,

            version: input.expectedVersion,

            deletedAt: null,
          },

          data: {
            status: input.status,

            ...(input.status === 'DISABLED'
              ? {
                  lockedUntil: null,
                }
              : {}),

            version: {
              increment: 1,
            },

            updatedAt: input.changedAt,
          },
        });

        if (updateResult.count === 0) {
          return {
            status: 'CONFLICT',
          };
        }

        let revokedSessionCount = 0;

        if (input.status === 'SUSPENDED' || input.status === 'DISABLED') {
          const sessions = await transaction.session.findMany({
            where: {
              userId: user.id,

              status: 'ACTIVE',

              revokedAt: null,
            },

            select: {
              id: true,
            },
          });

          const sessionIds = sessions.map((session): string => session.id);

          if (sessionIds.length > 0) {
            const sessionUpdate = await transaction.session.updateMany({
              where: {
                id: {
                  in: sessionIds,
                },

                userId: user.id,

                status: 'ACTIVE',

                revokedAt: null,
              },

              data: {
                status: 'REVOKED',

                revokedAt: input.changedAt,

                revokeReason: input.revokeReason,

                lastActivityAt: input.changedAt,

                updatedAt: input.changedAt,
              },
            });

            revokedSessionCount = sessionUpdate.count;

            await transaction.refreshToken.updateMany({
              where: {
                sessionId: {
                  in: sessionIds,
                },

                revokedAt: null,
              },

              data: {
                revokedAt: input.changedAt,

                revokeReason: input.revokeReason,
              },
            });
          }
        }

        const updatedUser = await transaction.user.findUniqueOrThrow({
          where: {
            id: user.id,
          },

          select: {
            version: true,

            updatedAt: true,
          },
        });

        await transaction.auditLog.create({
          data: {
            applicationId: input.applicationId,

            actorUserId: input.actorUserId,

            action: SECURITY_AUDIT_ACTIONS.USER_STATUS_CHANGED,

            resourceType: USER_RESOURCE_TYPE,

            resourceId: user.id,

            outcome: 'SUCCESS',

            createdAt: input.changedAt,

            metadata: {
              targetUserId: user.id,

              targetUserEmail: user.email,

              previousStatus,

              currentStatus: input.status,

              revokedSessionCount,
            },

            ...(input.requestId === undefined
              ? {}
              : {
                  requestId: input.requestId,
                }),

            ...(input.ipAddress === undefined
              ? {}
              : {
                  ipAddress: input.ipAddress,
                }),

            ...(input.userAgent === undefined
              ? {}
              : {
                  userAgent: input.userAgent,
                }),
          },
        });

        return {
          status: 'UPDATED',

          userId: user.id,

          email: user.email,

          previousStatus,

          currentStatus: input.status,

          version: updatedUser.version,

          revokedSessionCount,

          updatedAt: updatedUser.updatedAt,
        };
      },
      {
        maxWait: 2_000,

        timeout: 5_000,
      },
    );
  }
}
