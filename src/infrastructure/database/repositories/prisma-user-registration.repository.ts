import type {
  CreateUserRegistrationInput,
  UserRegistrationRepository,
} from '@/application/ports/repositories/user-registration.repository.js';
import type { ApplicationPrismaClient } from '../prisma-client.js';
import { mapUserToPrismaCreateData } from '../mapper/prisma-user.mapper.js';
import { EmailAlreadyExistsError } from '@/application/errors/email-already-exists.error.js';

interface PrismaErrorWithCode {
  code: string;
}

function isPrismaUniqueConstraintError(error: unknown): error is PrismaErrorWithCode {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  if (!('code' in error)) {
    return false;
  }

  return error.code === 'P2002';
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

    try {
      await this.prisma.$transaction(async (transaction) => {
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
      });
    } catch (error: unknown) {
      if (isPrismaUniqueConstraintError(error)) {
        throw new EmailAlreadyExistsError();
      }

      throw error;
    }
  }
}
