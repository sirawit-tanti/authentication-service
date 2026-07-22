import { SECURITY_AUDIT_ACTIONS } from '@/application/auditing/security-audit-action.js';
import type {
  ConsumePasswordResetInput,
  ConsumePasswordResetResult,
  FindPasswordResetRequestInput,
  PasswordResetRequestRecord,
  ResetPasswordRepository,
} from '@/application/ports/repositories/reset-password.repository.js';
import type { ApplicationPrismaClient } from '../prisma-client.js';
import { revokeSessions } from './session-revocation.js';

const USER_RESOURCE_TYPE = 'USER';

class InvalidResetTokenPersistenceError extends Error {
  public constructor() {
    super('Password reset token is no longer valid');

    this.name = 'InvalidResetTokenPersistenceError';
  }
}

class PasswordResetConflictPersistenceError extends Error {
  public constructor() {
    super('Password reset user update conflicted');

    this.name = 'PasswordResetConflictPersistenceError';
  }
}

export class PrismaResetPasswordRepository implements ResetPasswordRepository {
  private readonly prisma: ApplicationPrismaClient;

  public constructor(prisma: ApplicationPrismaClient) {
    this.prisma = prisma;
  }

  public async findActiveRequest(
    input: FindPasswordResetRequestInput,
  ): Promise<PasswordResetRequestRecord | null> {
    const resetToken = await this.prisma.passwordResetToken.findFirst({
      where: {
        tokenHash: input.tokenHash,
        usedAt: null,

        expiresAt: {
          gt: input.checkedAt,
        },

        user: {
          status: 'ACTIVE',
          emailVerified: true,
          deletedAt: null,
        },
      },

      select: {
        id: true,
        userId: true,

        user: {
          select: {
            passwordHash: true,
            version: true,
          },
        },
      },
    });

    if (resetToken === null) {
      return null;
    }

    return {
      tokenId: resetToken.id,
      userId: resetToken.userId,

      passwordHash: resetToken.user.passwordHash,

      userVersion: resetToken.user.version,
    };
  }

  public async consume(input: ConsumePasswordResetInput): Promise<ConsumePasswordResetResult> {
    try {
      await this.prisma.$transaction(
        async (transaction) => {
          const tokenUpdate = await transaction.passwordResetToken.updateMany({
            where: {
              id: input.tokenId,
              tokenHash: input.tokenHash,
              userId: input.userId,
              usedAt: null,

              expiresAt: {
                gt: input.passwordChangedAt,
              },
            },

            data: {
              usedAt: input.passwordChangedAt,
            },
          });

          if (tokenUpdate.count === 0) {
            throw new InvalidResetTokenPersistenceError();
          }

          const userUpdate = await transaction.user.updateMany({
            where: {
              id: input.userId,

              version: input.expectedUserVersion,

              status: 'ACTIVE',
              emailVerified: true,
              deletedAt: null,
            },

            data: {
              passwordHash: input.newPasswordHash,

              passwordChangedAt: input.passwordChangedAt,

              failedLoginAttempts: 0,
              lockedUntil: null,

              version: {
                increment: 1,
              },

              updatedAt: input.passwordChangedAt,
            },
          });

          if (userUpdate.count === 0) {
            throw new PasswordResetConflictPersistenceError();
          }

          await transaction.passwordResetToken.updateMany({
            where: {
              userId: input.userId,
              usedAt: null,
            },

            data: {
              usedAt: input.passwordChangedAt,
            },
          });

          const activeSessions = await transaction.session.findMany({
            where: {
              userId: input.userId,
              status: 'ACTIVE',
              revokedAt: null,
            },

            select: {
              id: true,
            },
          });

          const activeSessionIds = activeSessions.map((session): string => session.id);

          const revocationResult = await revokeSessions(transaction, {
            sessionIds: activeSessionIds,

            userId: input.userId,

            revokedAt: input.passwordChangedAt,

            reason: input.revokeReason,
          });

          await transaction.auditLog.create({
            data: {
              actorUserId: input.userId,

              action: SECURITY_AUDIT_ACTIONS.PASSWORD_RESET_COMPLETED,

              resourceType: USER_RESOURCE_TYPE,

              resourceId: input.userId,

              outcome: 'SUCCESS',

              createdAt: input.passwordChangedAt,

              metadata: {
                passwordResetTokenId: input.tokenId,

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
        },
        {
          maxWait: 2_000,
          timeout: 5_000,
        },
      );

      return 'UPDATED';
    } catch (error: unknown) {
      if (error instanceof InvalidResetTokenPersistenceError) {
        return 'INVALID_TOKEN';
      }

      if (error instanceof PasswordResetConflictPersistenceError) {
        return 'CONFLICT';
      }

      throw error;
    }
  }
}
