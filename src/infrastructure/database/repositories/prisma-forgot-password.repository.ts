import type {
  CreatePasswordResetRequestInput,
  ForgotPasswordRepository,
  ForgotPasswordUserRecord,
} from '@/application/ports/repositories/forgot-password.repository.js';
import type { Prisma } from '@/generated/prisma/client.js';
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
    return value.map((item): Prisma.InputJsonValue => toPrismaJsonValue(item));
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

export class PrismaForgotPasswordRepository implements ForgotPasswordRepository {
  private readonly prisma: ApplicationPrismaClient;

  public constructor(prisma: ApplicationPrismaClient) {
    this.prisma = prisma;
  }

  public async findActiveUserByNormalizedEmail(
    normalizedEmail: string,
  ): Promise<ForgotPasswordUserRecord | null> {
    const user = await this.prisma.user.findFirst({
      where: {
        normalizedEmail,
        status: 'ACTIVE',
        emailVerified: true,
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
      },
    });

    if (user === null) {
      return null;
    }

    return {
      userId: user.id,
      email: user.email,
    };
  }

  public async createPasswordResetRequest(input: CreatePasswordResetRequestInput): Promise<void> {
    const outboxPayload = toPrismaJsonObject({
      ...input.outboxMessage.payload,
    });

    await this.prisma.$transaction(
      async (transaction) => {
        await transaction.passwordResetToken.updateMany({
          where: {
            userId: input.userId,
            usedAt: null,
          },
          data: {
            usedAt: input.invalidatedAt,
          },
        });

        await transaction.passwordResetToken.create({
          data: {
            id: input.resetToken.id,
            userId: input.userId,
            tokenHash: input.resetToken.tokenHash,
            expiresAt: input.resetToken.expiresAt,
            createdAt: input.resetToken.createdAt,
          },
        });

        await transaction.outboxMessage.create({
          data: {
            id: input.outboxMessage.id,
            topic: input.outboxMessage.topic,
            eventType: input.outboxMessage.eventType,
            aggregateId: input.outboxMessage.aggregateId,
            payload: outboxPayload,
            availableAt: input.outboxMessage.availableAt,
            createdAt: input.outboxMessage.createdAt,
          },
        });
      },
      {
        maxWait: 2_000,
        timeout: 5_000,
      },
    );
  }
}
