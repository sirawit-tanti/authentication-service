import type {
  ChangePasswordRepository,
  ChangePasswordUserRecord,
  FindUserForPasswordChangeInput,
  PersistPasswordChangeInput,
  PersistPasswordChangeResult,
} from '@/application/ports/repositories/change-password.repository.js';
import type { ApplicationPrismaClient } from '../prisma-client.js';

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

        if (otherSessionIds.length > 0) {
          await transaction.session.updateMany({
            where: {
              id: {
                in: otherSessionIds,
              },

              userId: input.userId,
              status: 'ACTIVE',
              revokedAt: null,
            },

            data: {
              status: 'REVOKED',
              revokedAt: input.passwordChangedAt,

              revokeReason: input.revokeReason,

              lastActivityAt: input.passwordChangedAt,

              updatedAt: input.passwordChangedAt,
            },
          });

          await transaction.refreshToken.updateMany({
            where: {
              sessionId: {
                in: otherSessionIds,
              },

              revokedAt: null,
            },

            data: {
              revokedAt: input.passwordChangedAt,

              revokeReason: input.revokeReason,
            },
          });
        }

        await transaction.session.updateMany({
          where: {
            id: input.currentSessionId,
            userId: input.userId,
            status: 'ACTIVE',
            revokedAt: null,
          },

          data: {
            lastActivityAt: input.passwordChangedAt,

            updatedAt: input.passwordChangedAt,
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
