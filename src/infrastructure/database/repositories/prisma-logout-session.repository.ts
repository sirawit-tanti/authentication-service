import type {
  LogoutSessionRepository,
  RevokeSessionByRefreshTokenInput,
  RevokeSessionByRefreshTokenResult,
} from '@/application/ports/repositories/logout-session.repository.js';
import type { ApplicationPrismaClient } from '../prisma-client.js';

export class PrismaLogoutSessionRepository implements LogoutSessionRepository {
  private readonly prisma: ApplicationPrismaClient;

  public constructor(prisma: ApplicationPrismaClient) {
    this.prisma = prisma;
  }

  public async revokeByRefreshToken(
    input: RevokeSessionByRefreshTokenInput,
  ): Promise<RevokeSessionByRefreshTokenResult> {
    return this.prisma.$transaction(
      async (transaction) => {
        const refreshToken = await transaction.refreshToken.findUnique({
          where: {
            tokenHash: input.refreshTokenHash,
          },

          select: {
            sessionId: true,
            session: {
              select: {
                status: true,
                revokedAt: true,
              },
            },
          },
        });

        if (refreshToken === null) {
          return 'NOT_FOUND';
        }

        if (refreshToken.session.status === 'REVOKED' || refreshToken.session.revokedAt !== null) {
          return 'ALREADY_REVOKED';
        }

        await transaction.session.updateMany({
          where: {
            id: refreshToken.sessionId,
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
            sessionId: refreshToken.sessionId,
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
}
