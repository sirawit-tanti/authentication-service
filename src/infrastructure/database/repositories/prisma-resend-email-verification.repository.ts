import type { Prisma } from '@/generated/prisma/client.js';
import type {
  ResendEmailVerificationInput,
  ResendEmailVerificationRepository,
  ResendEmailVerificationStatus,
} from '@/application/ports/repositories/resend-email-verification.repository.js';
import type { ApplicationPrismaClient } from '../prisma-client.js';

function toPrismaJsonValue(value: unknown): Prisma.InputJsonValue {
  if (value === null) {
    throw new TypeError('Outbox JSON payload must not contain null values');
  }

  if (typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError('Outbox JSON payload contains a non-finite number');
    }

    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => toPrismaJsonValue(item));
  }

  if (typeof value === 'object') {
    return toPrismaJsonObject(value as Record<string, unknown>);
  }

  throw new TypeError(`Unsupported outbox JSON value type: ${typeof value}`);
}

function toPrismaJsonObject(value: Record<string, unknown>): Prisma.InputJsonObject {
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, toPrismaJsonValue(item)]),
  );
}

export class PrismaResendEmailVerificationRepository implements ResendEmailVerificationRepository {
  private readonly prisma: ApplicationPrismaClient;

  public constructor(prisma: ApplicationPrismaClient) {
    this.prisma = prisma;
  }

  public async createReplacementVerification(
    input: ResendEmailVerificationInput,
  ): Promise<ResendEmailVerificationStatus> {
    return this.prisma.$transaction(
      async (transaction) => {
        const user = await transaction.user.findFirst({
          where: {
            normalizedEmail: input.normalizedEmail,
            deletedAt: null,
          },

          select: {
            id: true,
            email: true,
            status: true,
            emailVerified: true,

            emailVerificationTokens: {
              where: {
                usedAt: null,
              },

              orderBy: {
                createdAt: 'desc',
              },

              take: 1,

              select: {
                createdAt: true,
              },
            },
          },
        });

        if (user === null || user.emailVerified || user.status !== 'PENDING_VERIFICATION') {
          return 'IGNORED';
        }

        const latestUnusedToken = user.emailVerificationTokens[0];

        if (latestUnusedToken !== undefined) {
          const cooldownMilliseconds = input.cooldownSeconds * 1_000;

          const cooldownEndsAt = latestUnusedToken.createdAt.getTime() + cooldownMilliseconds;

          if (cooldownEndsAt > input.requestedAt.getTime()) {
            return 'COOLDOWN';
          }
        }

        await transaction.emailVerificationToken.updateMany({
          where: {
            userId: user.id,
            usedAt: null,
          },

          data: {
            usedAt: input.requestedAt,
          },
        });

        await transaction.emailVerificationToken.create({
          data: {
            id: input.verificationToken.id,
            userId: user.id,
            tokenHash: input.verificationToken.tokenHash,
            expiresAt: input.verificationToken.expiresAt,
            createdAt: input.verificationToken.createdAt,
          },
        });

        const payload = toPrismaJsonObject({
          ...input.outboxMessage.payload,
          userId: user.id,
          email: user.email,
        });

        await transaction.outboxMessage.create({
          data: {
            id: input.outboxMessage.id,
            topic: input.outboxMessage.topic,
            eventType: input.outboxMessage.eventType,
            aggregateId: user.id,
            payload,
            availableAt: input.outboxMessage.availableAt,
            createdAt: input.outboxMessage.createdAt,
          },
        });

        return 'CREATED';
      },
      {
        maxWait: 2_000,
        timeout: 5_000,
      },
    );
  }
}
