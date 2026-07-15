import { EmailAlreadyExistsError } from '@/application/errors/email-already-exists.error.js';
import type {
  CreateUserRegistrationInput,
  UserRegistrationRepository,
} from '@/application/ports/repositories/user-registration.repository.js';
import type { Prisma } from '@/generated/prisma/client.js';
import { mapUserToPrismaCreateData } from '../mapper/prisma-user.mapper.js';
import type { ApplicationPrismaClient } from '../prisma-client.js';

interface PrismaErrorWithCode {
  code: string;
}

function isPrismaUniqueConstraintError(error: unknown): error is PrismaErrorWithCode {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

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

export class PrismaUserRegistrationRepository implements UserRegistrationRepository {
  private readonly prisma: ApplicationPrismaClient;

  public constructor(prisma: ApplicationPrismaClient) {
    this.prisma = prisma;
  }

  public async existsByNormalizedEmail(normalizedEmail: string): Promise<boolean> {
    const record = await this.prisma.user.findFirst({
      where: {
        normalizedEmail,
      },
      select: {
        id: true,
      },
    });

    return record !== null;
  }

  public async createRegistration(input: CreateUserRegistrationInput): Promise<void> {
    const userData = mapUserToPrismaCreateData(input.user);

    const outboxPayload = toPrismaJsonObject({
      ...input.outboxMessage.payload,
    });

    try {
      await this.prisma.$transaction(
        async (transaction) => {
          await transaction.user.create({
            data: userData,
          });

          await transaction.emailVerificationToken.create({
            data: {
              id: input.verificationToken.id,
              userId: input.user.getId(),
              tokenHash: input.verificationToken.tokenHash,
              expiresAt: input.verificationToken.expiresAt,
              createdAt: input.verificationToken.createdAt,
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
    } catch (error: unknown) {
      if (isPrismaUniqueConstraintError(error)) {
        throw new EmailAlreadyExistsError();
      }

      throw error;
    }
  }
}
