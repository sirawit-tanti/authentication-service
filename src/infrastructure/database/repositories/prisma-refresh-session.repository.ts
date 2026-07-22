import { SECURITY_AUDIT_ACTIONS } from '@/application/auditing/security-audit-action.js';
import type {
  RefreshSessionRepository,
  RotateSessionRefreshTokenInput,
  RotateSessionRefreshTokenResult,
} from '@/application/ports/repositories/refresh-session.repository.js';
import type { ApplicationPrismaClient } from '../prisma-client.js';

const REUSE_REVOKE_REASON = 'Refresh token reuse detected';

const SESSION_RESOURCE_TYPE = 'SESSION';

export class PrismaRefreshSessionRepository implements RefreshSessionRepository {
  private readonly prisma: ApplicationPrismaClient;

  public constructor(prisma: ApplicationPrismaClient) {
    this.prisma = prisma;
  }

  public async rotate(
    input: RotateSessionRefreshTokenInput,
  ): Promise<RotateSessionRefreshTokenResult> {
    return this.prisma.$transaction(
      async (transaction): Promise<RotateSessionRefreshTokenResult> => {
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

              lastActivityAt: input.rotatedAt,

              updatedAt: input.rotatedAt,
            },
          });

          await transaction.auditLog.create({
            data: {
              applicationId: session.applicationId,

              actorUserId: user.id,

              action: SECURITY_AUDIT_ACTIONS.REFRESH_TOKEN_REUSE_DETECTED,

              resourceType: SESSION_RESOURCE_TYPE,

              resourceId: session.id,

              outcome: 'FAILURE',

              errorMessage: REUSE_REVOKE_REASON,

              createdAt: input.rotatedAt,

              metadata: {
                sessionId: session.id,

                refreshTokenFamilyId: currentToken.familyId,

                detectionReason: 'PREVIOUSLY_USED_TOKEN',

                sessionRevoked: true,
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

              lastActivityAt: input.rotatedAt,

              updatedAt: input.rotatedAt,
            },
          });

          await transaction.auditLog.create({
            data: {
              applicationId: session.applicationId,

              actorUserId: user.id,

              action: SECURITY_AUDIT_ACTIONS.REFRESH_TOKEN_REUSE_DETECTED,

              resourceType: SESSION_RESOURCE_TYPE,

              resourceId: session.id,

              outcome: 'FAILURE',

              errorMessage: REUSE_REVOKE_REASON,

              createdAt: input.rotatedAt,

              metadata: {
                sessionId: session.id,

                refreshTokenFamilyId: currentToken.familyId,

                detectionReason: 'CONCURRENT_ROTATION',

                sessionRevoked: true,
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

        await transaction.auditLog.create({
          data: {
            applicationId: session.applicationId,

            actorUserId: user.id,

            action: SECURITY_AUDIT_ACTIONS.REFRESH_TOKEN_ROTATED,

            resourceType: SESSION_RESOURCE_TYPE,

            resourceId: session.id,

            outcome: 'SUCCESS',

            createdAt: input.rotatedAt,

            metadata: {
              sessionId: session.id,

              rotationType: 'STANDARD',
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
