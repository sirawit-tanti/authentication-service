import type {
  RefreshSessionRepository,
  RotateSessionRefreshTokenInput,
  RotateSessionRefreshTokenResult,
} from '@/application/ports/repositories/refresh-session.repository.js';
import type { ApplicationPrismaClient } from '../prisma-client.js';

const REUSE_REVOKE_REASON = 'Refresh token reuse detected';

export class PrismaRefreshSessionRepository implements RefreshSessionRepository {
  private readonly prisma: ApplicationPrismaClient;

  public constructor(prisma: ApplicationPrismaClient) {
    this.prisma = prisma;
  }

  public async rotate(
    input: RotateSessionRefreshTokenInput,
  ): Promise<RotateSessionRefreshTokenResult> {
    return this.prisma.$transaction(
      async (transaction) => {
        const currentToken = await transaction.refreshToken.findUnique({
          where: {
            tokenHash: input.currentTokenHash,
          },

          include: {
            session: {
              include: {
                user: true,
              },
            },
          },
        });

        if (currentToken === null) {
          return {
            status: 'INVALID',
          };
        }

        const session = currentToken.session;
        const user = session.user;

        const tokenWasPreviouslyUsed =
          currentToken.usedAt !== null ||
          currentToken.revokedAt !== null ||
          currentToken.replacedByTokenId !== null;

        if (tokenWasPreviouslyUsed) {
          await transaction.refreshToken.updateMany({
            where: {
              familyId: currentToken.familyId,
              revokedAt: null,
            },

            data: {
              revokedAt: input.rotatedAt,
              revokeReason: REUSE_REVOKE_REASON,
            },
          });

          await transaction.session.updateMany({
            where: {
              id: session.id,
              status: 'ACTIVE',
            },

            data: {
              status: 'REVOKED',
              revokedAt: input.rotatedAt,
              revokeReason: REUSE_REVOKE_REASON,
              updatedAt: input.rotatedAt,
            },
          });

          return {
            status: 'REUSE_DETECTED',
          };
        }

        const tokenHasExpired = currentToken.expiresAt.getTime() <= input.rotatedAt.getTime();

        const sessionHasExpired = session.expiresAt.getTime() <= input.rotatedAt.getTime();

        const sessionIsUnavailable = session.status !== 'ACTIVE' || session.revokedAt !== null;

        const userCannotAuthenticate =
          user.deletedAt !== null || user.status !== 'ACTIVE' || !user.emailVerified;

        if (
          tokenHasExpired ||
          sessionHasExpired ||
          sessionIsUnavailable ||
          userCannotAuthenticate
        ) {
          if (sessionHasExpired && session.status === 'ACTIVE') {
            await transaction.session.updateMany({
              where: {
                id: session.id,
                status: 'ACTIVE',
              },

              data: {
                status: 'EXPIRED',
                updatedAt: input.rotatedAt,
              },
            });
          }

          return {
            status: 'INVALID',
          };
        }

        const refreshTokenExpiresAt = new Date(
          Math.min(input.requestedTokenExpiresAt.getTime(), session.expiresAt.getTime()),
        );

        await transaction.refreshToken.create({
          data: {
            id: input.newTokenId,
            sessionId: session.id,
            familyId: currentToken.familyId,
            tokenHash: input.newTokenHash,
            jti: input.newTokenJti,
            expiresAt: refreshTokenExpiresAt,
            createdAt: input.rotatedAt,
          },
        });

        const currentTokenUpdate = await transaction.refreshToken.updateMany({
          where: {
            id: currentToken.id,
            usedAt: null,
            revokedAt: null,
            replacedByTokenId: null,
          },

          data: {
            usedAt: input.rotatedAt,
            replacedByTokenId: input.newTokenId,
          },
        });

        if (currentTokenUpdate.count === 0) {
          await transaction.refreshToken.deleteMany({
            where: {
              id: input.newTokenId,
              usedAt: null,
              replacedByTokenId: null,
            },
          });

          await transaction.refreshToken.updateMany({
            where: {
              familyId: currentToken.familyId,
              revokedAt: null,
            },

            data: {
              revokedAt: input.rotatedAt,
              revokeReason: REUSE_REVOKE_REASON,
            },
          });

          await transaction.session.updateMany({
            where: {
              id: session.id,
              status: 'ACTIVE',
            },

            data: {
              status: 'REVOKED',
              revokedAt: input.rotatedAt,
              revokeReason: REUSE_REVOKE_REASON,
              updatedAt: input.rotatedAt,
            },
          });

          return {
            status: 'REUSE_DETECTED',
          };
        }

        await transaction.session.update({
          where: {
            id: session.id,
          },

          data: {
            lastActivityAt: input.rotatedAt,
            updatedAt: input.rotatedAt,
          },
        });

        return {
          status: 'ROTATED',

          userId: user.id,
          userEmail: user.email,
          applicationId: session.applicationId,
          sessionId: session.id,

          refreshTokenExpiresAt,
        };
      },
      {
        maxWait: 2_000,
        timeout: 5_000,
      },
    );
  }
}
