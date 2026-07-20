import { SECURITY_AUDIT_ACTIONS } from '@/application/auditing/security-audit-action.js';
import type {
  LogoutSessionRepository,
  RevokeSessionByRefreshTokenInput,
  RevokeSessionByRefreshTokenResult,
} from '@/application/ports/repositories/logout-session.repository.js';
import type { ApplicationPrismaClient } from '../prisma-client.js';

const SESSION_RESOURCE_TYPE = 'SESSION';

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
                userId: true,
                applicationId: true,
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

        const sessionUpdate = await transaction.session.updateMany({
          where: {
            id: refreshToken.sessionId,

            status: {
              not: 'REVOKED',
            },

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

        if (sessionUpdate.count === 0) {
          return 'ALREADY_REVOKED';
        }

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

        await transaction.auditLog.create({
          data: {
            actorUserId: refreshToken.session.userId,

            action: SECURITY_AUDIT_ACTIONS.LOGOUT_SUCCEEDED,

            resourceType: SESSION_RESOURCE_TYPE,

            resourceId: refreshToken.sessionId,

            outcome: 'SUCCESS',

            createdAt: input.revokedAt,

            metadata: {
              sessionId: refreshToken.sessionId,

              applicationId: refreshToken.session.applicationId,
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

        return 'REVOKED';
      },
      {
        maxWait: 2_000,
        timeout: 5_000,
      },
    );
  }
}
