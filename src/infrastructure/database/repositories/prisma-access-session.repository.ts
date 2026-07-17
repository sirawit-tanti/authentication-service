import type {
  AccessSessionRepository,
  ValidateAccessSessionInput,
  ValidAccessSession,
} from '@/application/ports/repositories/access-session.repository.js';
import type { ApplicationPrismaClient } from '../prisma-client.js';

export class PrismaAccessSessionRepository implements AccessSessionRepository {
  private readonly prisma: ApplicationPrismaClient;

  public constructor(prisma: ApplicationPrismaClient) {
    this.prisma = prisma;
  }

  public async findActive(input: ValidateAccessSessionInput): Promise<ValidAccessSession | null> {
    const session = await this.prisma.session.findFirst({
      where: {
        id: input.sessionId,
        userId: input.userId,
        applicationId: input.applicationId,
        status: 'ACTIVE',
        revokedAt: null,
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
        applicationId: true,
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    if (session === null) {
      return null;
    }

    return {
      userId: session.user.id,
      email: session.user.email,
      applicationId: session.applicationId,
      sessionId: session.id,
    };
  }
}
