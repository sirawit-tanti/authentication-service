import { SECURITY_AUDIT_ACTIONS } from '@/application/auditing/security-audit-action.js';
import type {
  ChangePasswordRepository,
  ChangePasswordUserRecord,
  FindUserForPasswordChangeInput,
  PersistPasswordChangeInput,
  PersistPasswordChangeResult,
} from '@/application/ports/repositories/change-password.repository.js';
import type { ApplicationPrismaClient } from '../prisma-client.js';
import { revokeSessions } from './session-revocation.js';

const USER_RESOURCE_TYPE = 'USER';

export class PrismaChangePasswordRepository implements ChangePasswordRepository {
  private readonly prisma: ApplicationPrismaClient;

  public constructor(prisma: ApplicationPrismaClient) {
    this.prisma = prisma;
  }

  public async findUser(
    input: FindUserForPasswordChangeInput,
  ): Promise<ChangePasswordUserRecord | null> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: input.userId,
        status: 'ACTIVE',
        emailVerified: true,
        deletedAt: null,
      },

      select: {
        id: true,
        passwordHash: true,
        version: true,
      },
    });

    if (user === null) {
      return null;
    }

    return {
      userId: user.id,
      passwordHash: user.passwordHash,
      version: user.version,
    };
  }

  public async persist(input: PersistPasswordChangeInput): Promise<PersistPasswordChangeResult> {
    return this.prisma.$transaction(
      async (transaction) => {
        const userUpdate = await transaction.user.updateMany({
          where: {
            id: input.userId,
            version: input.expectedVersion,
            status: 'ACTIVE',
            deletedAt: null,
          },

          data: {
            passwordHash: input.newPasswordHash,

            passwordChangedAt: input.passwordChangedAt,

            version: {
              increment: 1,
            },

            updatedAt: input.passwordChangedAt,
          },
        });

        if (userUpdate.count === 0) {
          const userExists = await transaction.user.count({
            where: {
              id: input.userId,
              status: 'ACTIVE',
              deletedAt: null,
            },
          });

          return userExists === 0 ? 'NOT_FOUND' : 'CONFLICT';
        }

        const otherSessions = await transaction.session.findMany({
          where: {
            userId: input.userId,
            applicationId: input.applicationId,
            id: {
              not: input.currentSessionId,
            },

            status: 'ACTIVE',
            revokedAt: null,
          },

          select: {
            id: true,
          },
        });

        const otherSessionIds = otherSessions.map((session): string => session.id);

        const revocationResult = await revokeSessions(transaction, {
          sessionIds: otherSessionIds,

          userId: input.userId,

          applicationId: input.applicationId,

          revokedAt: input.passwordChangedAt,

          reason: input.revokeReason,
        });

        await transaction.session.updateMany({
          where: {
            id: input.currentSessionId,
            userId: input.userId,
            applicationId: input.applicationId,
            status: 'ACTIVE',
            revokedAt: null,
          },

          data: {
            lastActivityAt: input.passwordChangedAt,

            updatedAt: input.passwordChangedAt,
          },
        });

        await transaction.auditLog.create({
          data: {
            applicationId: input.applicationId,

            actorUserId: input.userId,

            action: SECURITY_AUDIT_ACTIONS.PASSWORD_CHANGED,

            resourceType: USER_RESOURCE_TYPE,

            resourceId: input.userId,

            outcome: 'SUCCESS',

            createdAt: input.passwordChangedAt,

            metadata: {
              preservedSessionId: input.currentSessionId,

              revokedSessionCount: revocationResult.revokedSessionCount,
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

        return 'UPDATED';
      },
      {
        maxWait: 2_000,
        timeout: 5_000,
      },
    );
  }
}
