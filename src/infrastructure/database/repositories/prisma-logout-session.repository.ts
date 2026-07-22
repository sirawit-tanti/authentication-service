import { SECURITY_AUDIT_ACTIONS } from '@/application/auditing/security-audit-action.js';
import type {
  LogoutSessionRepository,
  RevokeSessionByRefreshTokenInput,
  RevokeSessionByRefreshTokenResult,
} from '@/application/ports/repositories/logout-session.repository.js';
import type { ApplicationPrismaClient } from '../prisma-client.js';
import { revokeSessions } from './session-revocation.js';

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

        const revocationResult = await revokeSessions(transaction, {
          sessionIds: [refreshToken.sessionId],

          revokedAt: input.revokedAt,

          reason: input.reason,
        });

        if (revocationResult.revokedSessionCount === 0) {
          return 'ALREADY_REVOKED';
        }

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
