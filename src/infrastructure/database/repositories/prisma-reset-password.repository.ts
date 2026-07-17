import type {
  ConsumePasswordResetInput,
  ConsumePasswordResetResult,
  FindPasswordResetRequestInput,
  PasswordResetRequestRecord,
  ResetPasswordRepository,
} from '@/application/ports/repositories/reset-password.repository.js';
import type { ApplicationPrismaClient } from '../prisma-client.js';

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
          /*
           * Consume token ก่อนด้วย conditional update
           * หากขั้นต่อไปผิดพลาด transaction จะ rollback
           * ทำให้ usedAt ไม่ถูกบันทึกค้างไว้
           */
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

          /*
           * ปิด reset token อื่นของ user
           * เพื่อให้เหลือ token ที่ใช้งานได้เป็นศูนย์
           */
          await transaction.passwordResetToken.updateMany({
            where: {
              userId: input.userId,
              usedAt: null,
            },

            data: {
              usedAt: input.passwordChangedAt,
            },
          });

          const sessions = await transaction.session.findMany({
            where: {
              userId: input.userId,
            },

            select: {
              id: true,
            },
          });

          const sessionIds = sessions.map((session): string => session.id);

          if (sessionIds.length > 0) {
            await transaction.session.updateMany({
              where: {
                id: {
                  in: sessionIds,
                },

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
                  in: sessionIds,
                },

                revokedAt: null,
              },

              data: {
                revokedAt: input.passwordChangedAt,

                revokeReason: input.revokeReason,
              },
            });
          }
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
