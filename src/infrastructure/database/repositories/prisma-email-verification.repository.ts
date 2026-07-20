import { SECURITY_AUDIT_ACTIONS } from '@/application/auditing/security-audit-action.js';
import { EmailAlreadyVerifiedError } from '@/application/errors/email-already-verified.error.js';
import { EmailVerificationTokenExpiredError } from '@/application/errors/email-verification-token-expired.error.js';
import { EmailVerificationTokenInvalidError } from '@/application/errors/email-verification-token-invalid.error.js';
import { OptimisticConcurrencyError } from '@/application/errors/optimistic-concurrency.error.js';
import type {
  EmailVerificationRepository,
  VerifyEmailInput,
  VerifyEmailResult,
} from '@/application/ports/repositories/email-verification.repository.js';
import { mapPrismaUserToDomain } from '../mapper/prisma-user.mapper.js';
import type { ApplicationPrismaClient } from '../prisma-client.js';

const USER_RESOURCE_TYPE = 'USER';

export class PrismaEmailVerificationRepository implements EmailVerificationRepository {
  private readonly prisma: ApplicationPrismaClient;

  public constructor(prisma: ApplicationPrismaClient) {
    this.prisma = prisma;
  }

  public async verifyEmail(input: VerifyEmailInput): Promise<VerifyEmailResult> {
    return this.prisma.$transaction(
      async (transaction) => {
        const verificationToken = await transaction.emailVerificationToken.findUnique({
          where: {
            tokenHash: input.tokenHash,
          },

          include: {
            user: true,
          },
        });

        if (verificationToken === null) {
          throw new EmailVerificationTokenInvalidError();
        }

        if (verificationToken.usedAt !== null) {
          if (verificationToken.user.emailVerified) {
            throw new EmailAlreadyVerifiedError();
          }

          throw new EmailVerificationTokenInvalidError();
        }

        if (verificationToken.expiresAt.getTime() <= input.verifiedAt.getTime()) {
          throw new EmailVerificationTokenExpiredError();
        }

        if (verificationToken.user.deletedAt !== null) {
          throw new EmailVerificationTokenInvalidError();
        }

        if (verificationToken.user.emailVerified) {
          await transaction.emailVerificationToken.updateMany({
            where: {
              userId: verificationToken.userId,

              usedAt: null,
            },

            data: {
              usedAt: input.verifiedAt,
            },
          });

          throw new EmailAlreadyVerifiedError();
        }

        const user = mapPrismaUserToDomain(verificationToken.user);

        const expectedVersion = user.getVersion();

        user.verifyEmail(input.verifiedAt);

        const userState = user.toState();

        const userUpdateResult = await transaction.user.updateMany({
          where: {
            id: user.getId(),

            version: expectedVersion,

            deletedAt: null,
            emailVerified: false,
          },

          data: {
            status: userState.status,

            emailVerified: userState.emailVerified,

            version: userState.version,

            updatedAt: userState.updatedAt,
          },
        });

        if (userUpdateResult.count === 0) {
          throw new OptimisticConcurrencyError('User', user.getId());
        }

        const tokenUpdateResult = await transaction.emailVerificationToken.updateMany({
          where: {
            id: verificationToken.id,

            usedAt: null,
          },

          data: {
            usedAt: input.verifiedAt,
          },
        });

        if (tokenUpdateResult.count === 0) {
          throw new EmailVerificationTokenInvalidError();
        }

        await transaction.emailVerificationToken.updateMany({
          where: {
            userId: user.getId(),

            id: {
              not: verificationToken.id,
            },

            usedAt: null,
          },

          data: {
            usedAt: input.verifiedAt,
          },
        });

        await transaction.auditLog.create({
          data: {
            actorUserId: user.getId(),

            action: SECURITY_AUDIT_ACTIONS.EMAIL_VERIFIED,

            resourceType: USER_RESOURCE_TYPE,

            resourceId: user.getId(),

            outcome: 'SUCCESS',

            createdAt: input.verifiedAt,

            metadata: {
              verificationRequestId: verificationToken.id,
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
          userId: user.getId(),

          email: user.getEmail().value,

          status: 'ACTIVE',
        };
      },
      {
        maxWait: 2_000,
        timeout: 5_000,
      },
    );
  }
}
