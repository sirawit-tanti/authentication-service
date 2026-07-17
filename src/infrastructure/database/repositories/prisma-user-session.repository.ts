import type {
  RevokeOtherUserSessionsInput,
  RevokeOtherUserSessionsResult,
  RevokeUserSessionInput,
  RevokeUserSessionResult,
  UserSessionRecord,
  UserSessionRepository,
} from '@/application/ports/repositories/user-session.repository.js';
import type { ApplicationPrismaClient } from '../prisma-client.js';

export class PrismaUserSessionRepository implements UserSessionRepository {
  private readonly prisma: ApplicationPrismaClient;

  public constructor(prisma: ApplicationPrismaClient) {
    this.prisma = prisma;
  }

  public async findByUserId(userId: string): Promise<UserSessionRecord[]> {
    const sessions = await this.prisma.session.findMany({
      where: {
        userId,
      },
      orderBy: [
        {
          status: 'asc',
        },
        {
          lastActivityAt: 'desc',
        },
      ],
      select: {
        id: true,
        applicationId: true,
        deviceId: true,
        status: true,
        ipAddress: true,
        userAgent: true,
        lastActivityAt: true,
        expiresAt: true,
        revokedAt: true,
        revokeReason: true,
        createdAt: true,
      },
    });

    return sessions.map((session): UserSessionRecord => ({
      sessionId: session.id,
      applicationId: session.applicationId,
      deviceId: session.deviceId,
      status: session.status,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      lastActivityAt: session.lastActivityAt,
      expiresAt: session.expiresAt,
      revokedAt: session.revokedAt,
      revokeReason: session.revokeReason,
      createdAt: session.createdAt,
    }));
  }

  public async revoke(input: RevokeUserSessionInput): Promise<RevokeUserSessionResult> {
    return this.prisma.$transaction(
      async (transaction) => {
        const session = await transaction.session.findFirst({
          where: {
            id: input.sessionId,
            userId: input.userId,
          },
          select: {
            id: true,
            status: true,
            revokedAt: true,
          },
        });

        if (session === null) {
          return 'NOT_FOUND';
        }

        if (session.status === 'REVOKED' || session.revokedAt !== null) {
          return 'ALREADY_REVOKED';
        }

        await transaction.session.updateMany({
          where: {
            id: session.id,
            userId: input.userId,
            status: {
              not: 'REVOKED',
            },
          },
          data: {
            status: 'REVOKED',
            revokedAt: input.revokedAt,
            revokeReason: input.reason,
            lastActivityAt: input.revokedAt,
            updatedAt: input.revokedAt,
          },
        });

        await transaction.refreshToken.updateMany({
          where: {
            sessionId: session.id,
            revokedAt: null,
          },
          data: {
            revokedAt: input.revokedAt,
            revokeReason: input.reason,
          },
        });

        return 'REVOKED';
      },
      {
        maxWait: 2_000,
        timeout: 5_000,
      },
    );
  }

  public async revokeOthers(
    input: RevokeOtherUserSessionsInput,
  ): Promise<RevokeOtherUserSessionsResult> {
    return this.prisma.$transaction(
      async (transaction) => {
        const sessions = await transaction.session.findMany({
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

        const sessionIds = sessions.map((session): string => session.id);

        if (sessionIds.length === 0) {
          return {
            revokedCount: 0,
          };
        }

        const sessionUpdate = await transaction.session.updateMany({
          where: {
            id: {
              in: sessionIds,
            },

            userId: input.userId,
            status: 'ACTIVE',
            revokedAt: null,
          },

          data: {
            status: 'REVOKED',
            revokedAt: input.revokedAt,
            revokeReason: input.reason,
            lastActivityAt: input.revokedAt,
            updatedAt: input.revokedAt,
          },
        });

        await transaction.refreshToken.updateMany({
          where: {
            sessionId: {
              in: sessionIds,
            },

            revokedAt: null,
          },

          data: {
            revokedAt: input.revokedAt,
            revokeReason: input.reason,
          },
        });

        return {
          revokedCount: sessionUpdate.count,
        };
      },
      {
        maxWait: 2_000,
        timeout: 5_000,
      },
    );
  }
}
